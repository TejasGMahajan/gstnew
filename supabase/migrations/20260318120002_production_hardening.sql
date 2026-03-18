/*
  # Production Hardening Migration
  
  Addresses 10 CTO-audit gaps:
  1. CA-Business access validation function
  2. Transaction safety (EXCEPTION blocks in triggers)
  3. Idempotency — unique constraints to prevent duplicates
  4. Concurrency control — optimistic locking via updated_at
  5. Deadline monitoring engine — mark overdue + send warnings
  6. Soft delete — deleted_at/deleted_by on major tables
  7. Data sanitization function
  8. Search indexes (trigram)
  9. System health monitoring function
*/

-- ================================================
-- 1. CA-BUSINESS ACCESS VALIDATION
-- ================================================

CREATE OR REPLACE FUNCTION validate_ca_access(p_user_id UUID, p_business_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_type TEXT;
  v_has_link BOOLEAN;
BEGIN
  SELECT user_type INTO v_user_type
  FROM profiles WHERE id = p_user_id;

  -- Admins have full access
  IF v_user_type = 'admin' THEN
    RETURN true;
  END IF;

  -- Business owners have access to their own businesses
  IF v_user_type = 'business_owner' THEN
    RETURN EXISTS (
      SELECT 1 FROM businesses WHERE id = p_business_id AND owner_id = p_user_id
    );
  END IF;

  -- CAs must have an active link
  IF v_user_type = 'chartered_accountant' THEN
    RETURN EXISTS (
      SELECT 1 FROM client_relationships
      WHERE ca_profile_id = p_user_id
        AND business_id = p_business_id
        AND status = 'active'
    );
  END IF;

  -- Employees — check if they belong to the business (via business_members or similar)
  -- For now, deny by default
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================
-- 2. TRANSACTION-SAFE WRAPPERS
-- ================================================

-- Secured version of transition_task_status with CA access check + exception handling
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id UUID,
  p_new_status TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
  v_has_access BOOLEAN;
BEGIN
  -- Get current task
  SELECT * INTO v_task FROM compliance_tasks WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- Validate CA/user has access to this business
  v_has_access := validate_ca_access(p_user_id, v_task.business_id);
  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: you are not linked to this business');
  END IF;

  -- Validate transition
  IF NOT validate_task_transition(v_task.status, p_new_status) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transition: ' || v_task.status || ' → ' || p_new_status,
      'current_status', v_task.status,
      'allowed_next', CASE v_task.status
        WHEN 'created' THEN 'awaiting_documents'
        WHEN 'awaiting_documents' THEN 'under_review'
        WHEN 'under_review' THEN 'ready_to_file'
        WHEN 'ready_to_file' THEN 'filed'
        WHEN 'filed' THEN 'acknowledged'
        WHEN 'acknowledged' THEN 'locked'
        WHEN 'locked' THEN 'none (task is locked)'
        ELSE 'unknown'
      END
    );
  END IF;

  -- Perform the transition (trigger handles validation + audit)
  BEGIN
    UPDATE compliance_tasks
    SET status = p_new_status,
        edited_by = p_user_id,
        completed_at = CASE WHEN p_new_status IN ('acknowledged', 'locked') THEN now() ELSE completed_at END
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'success', true,
      'task_id', p_task_id,
      'old_status', v_task.status,
      'new_status', p_new_status
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$ LANGUAGE plpgsql;


-- Secured document upload with access check
CREATE OR REPLACE FUNCTION secure_upload_document(
  p_user_id UUID,
  p_business_id UUID,
  p_file_name TEXT,
  p_storage_path TEXT,
  p_file_type TEXT,
  p_file_size BIGINT,
  p_category TEXT DEFAULT 'General'
)
RETURNS JSONB AS $$
DECLARE
  v_has_access BOOLEAN;
  v_has_permission BOOLEAN;
  v_storage_check JSONB;
  v_doc_id UUID;
  v_sanitized_name TEXT;
BEGIN
  -- Access check
  v_has_access := validate_ca_access(p_user_id, p_business_id);
  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Permission check
  v_has_permission := check_permission(p_user_id, 'upload_document');
  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have upload permission');
  END IF;

  -- Storage limit check
  v_storage_check := check_storage_limit(p_business_id, p_file_size);
  IF NOT (v_storage_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object('success', false, 'error', v_storage_check->>'message', 'limit_exceeded', true);
  END IF;

  -- Sanitize file name
  v_sanitized_name := sanitize_text(p_file_name);

  BEGIN
    INSERT INTO documents (
      business_id, file_name, storage_path, file_type, file_size,
      category, uploaded_by, version_number
    ) VALUES (
      p_business_id, v_sanitized_name, p_storage_path, p_file_type,
      p_file_size, p_category, p_user_id, 1
    )
    RETURNING id INTO v_doc_id;

    -- Create initial version
    INSERT INTO document_versions (
      document_id, version_number, file_name, storage_path,
      file_size, created_by, metadata
    ) VALUES (
      v_doc_id, 1, v_sanitized_name, p_storage_path,
      p_file_size, p_user_id, '{"original_upload": true}'::jsonb
    );

    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate file detected at this path');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 3. IDEMPOTENCY — UNIQUE CONSTRAINTS
-- ================================================

-- Prevent duplicate documents at the same storage path
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_path
  ON documents (business_id, storage_path)
  WHERE storage_path IS NOT NULL AND deleted_at IS NULL;

-- Prevent duplicate compliance tasks (same name + due date for a business)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique_per_business
  ON compliance_tasks (business_id, task_name, due_date)
  WHERE deleted_at IS NULL;


-- ================================================
-- 4. CONCURRENCY CONTROL — OPTIMISTIC LOCKING
-- ================================================

-- Function to perform optimistic-lock update on compliance_tasks
CREATE OR REPLACE FUNCTION optimistic_update_task(
  p_task_id UUID,
  p_user_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_final_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
  v_rows_affected INTEGER;
BEGIN
  -- Verify the row hasn't been modified since the user loaded it
  SELECT * INTO v_task
  FROM compliance_tasks
  WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- Check for stale data
  IF v_task.updated_at > p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conflict: this task was modified by another user. Please refresh and try again.',
      'conflict', true,
      'server_updated_at', v_task.updated_at
    );
  END IF;

  -- Access check
  IF NOT validate_ca_access(p_user_id, v_task.business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Perform update
  UPDATE compliance_tasks
  SET final_values = COALESCE(p_final_values, final_values),
      description = COALESCE(p_description, description),
      edited_by = p_user_id,
      updated_at = now()
  WHERE id = p_task_id
    AND updated_at = p_expected_updated_at;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Concurrent modification detected. Refresh and retry.',
      'conflict', true
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id);
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 5. DEADLINE MONITORING ENGINE
-- ================================================

CREATE OR REPLACE FUNCTION check_deadlines(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
  v_warnings_sent INTEGER := 0;
  v_overdue_marked INTEGER := 0;
  v_owner_id UUID;
BEGIN
  -- Find tasks due in 3 days → send warning notification
  FOR v_task IN
    SELECT ct.id, ct.task_name, ct.business_id, ct.due_date
    FROM compliance_tasks ct
    WHERE ct.status NOT IN ('acknowledged', 'locked', 'filed')
      AND ct.due_date = target_date + INTERVAL '3 days'
      AND ct.deleted_at IS NULL
  LOOP
    SELECT b.owner_id INTO v_owner_id
    FROM businesses b WHERE b.id = v_task.business_id;

    -- Avoid duplicate notifications (check if one was already sent today)
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_owner_id
        AND type = 'deadline_approaching'
        AND metadata->>'task_id' = v_task.id::TEXT
        AND created_at::DATE = target_date
    ) THEN
      INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
      VALUES (
        v_task.business_id, v_owner_id, 'deadline_approaching',
        '⚠️ Deadline in 3 days: ' || v_task.task_name,
        'Task "' || v_task.task_name || '" is due on ' || v_task.due_date || '. Please take action.',
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date)
      );
      v_warnings_sent := v_warnings_sent + 1;
    END IF;
  END LOOP;

  -- Find overdue tasks (due_date < today) that are still active
  FOR v_task IN
    SELECT ct.id, ct.task_name, ct.business_id, ct.due_date, ct.status
    FROM compliance_tasks ct
    WHERE ct.status IN ('created', 'awaiting_documents', 'under_review', 'ready_to_file')
      AND ct.due_date < target_date
      AND ct.deleted_at IS NULL
  LOOP
    SELECT b.owner_id INTO v_owner_id
    FROM businesses b WHERE b.id = v_task.business_id;

    -- Send overdue notification (daily until resolved)
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_owner_id
        AND type = 'deadline_approaching'
        AND metadata->>'task_id' = v_task.id::TEXT
        AND metadata->>'overdue' = 'true'
        AND created_at::DATE = target_date
    ) THEN
      INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
      VALUES (
        v_task.business_id, v_owner_id, 'deadline_approaching',
        '🚨 OVERDUE: ' || v_task.task_name,
        'Task "' || v_task.task_name || '" was due on ' || v_task.due_date || ' and is overdue!',
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date, 'overdue', 'true')
      );
      v_overdue_marked := v_overdue_marked + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'target_date', target_date,
    'warnings_sent', v_warnings_sent,
    'overdue_notified', v_overdue_marked
  );
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 6. SOFT DELETE — Add columns to major tables
-- ================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['compliance_tasks', 'documents', 'businesses', 'notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'deleted_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL', t);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'deleted_by'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_by UUID REFERENCES profiles(id)', t);
    END IF;
  END LOOP;
END $$;

-- Soft-delete function
CREATE OR REPLACE FUNCTION soft_delete(
  p_table_name TEXT,
  p_record_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  -- Permission check
  IF p_table_name = 'documents' AND NOT check_permission(p_user_id, 'delete_document') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No delete permission');
  END IF;

  EXECUTE format(
    'UPDATE %I SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    p_table_name
  ) USING p_user_id, p_record_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record not found or already deleted');
  END IF;

  RETURN jsonb_build_object('success', true, 'deleted', p_record_id);
END;
$$ LANGUAGE plpgsql;

-- Restore function
CREATE OR REPLACE FUNCTION soft_restore(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL',
    p_table_name
  ) USING p_record_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record not found or not deleted');
  END IF;

  RETURN jsonb_build_object('success', true, 'restored', p_record_id);
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 7. DATA SANITIZATION FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION sanitize_text(input TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;

  -- Remove HTML/script tags
  input := regexp_replace(input, '<[^>]*>', '', 'g');
  -- Remove null bytes
  input := replace(input, E'\x00', '');
  -- Remove control characters except newlines and tabs
  input := regexp_replace(input, E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F]', '', 'g');
  -- Trim whitespace
  input := trim(input);

  RETURN input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sanitize file names more aggressively
CREATE OR REPLACE FUNCTION sanitize_filename(input TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input IS NULL THEN RETURN 'unnamed_file'; END IF;

  -- Replace dangerous characters
  input := regexp_replace(input, '[^a-zA-Z0-9._\- ]', '_', 'g');
  -- Collapse multiple underscores
  input := regexp_replace(input, '_{2,}', '_', 'g');
  -- Trim
  input := trim(both '_' from input);

  IF length(input) = 0 THEN
    input := 'unnamed_file';
  END IF;

  -- Limit length
  IF length(input) > 255 THEN
    input := left(input, 255);
  END IF;

  RETURN input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ================================================
-- 8. SEARCH INDEXES
-- ================================================

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search indexes on common fields
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING gin (business_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_gstin ON businesses (gstin) WHERE gstin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_filename_trgm ON documents USING gin (file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (category);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_name_trgm ON compliance_tasks USING gin (task_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_status ON compliance_tasks (status);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_due_date ON compliance_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_type ON compliance_tasks (task_type);

-- Partial indexes for active records (soft delete aware)
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents (business_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_active ON compliance_tasks (business_id, due_date) WHERE deleted_at IS NULL;


-- ================================================
-- 9. SYSTEM HEALTH MONITORING
-- ================================================

CREATE OR REPLACE FUNCTION system_health_check()
RETURNS JSONB AS $$
DECLARE
  v_total_users INTEGER;
  v_active_subs INTEGER;
  v_total_documents INTEGER;
  v_total_tasks INTEGER;
  v_error_count_24h INTEGER;
  v_critical_errors_24h INTEGER;
  v_overdue_tasks INTEGER;
  v_avg_storage_pct NUMERIC;
  v_health_status TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total_users FROM profiles WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_active_subs FROM subscriptions WHERE status = 'active';
  SELECT COUNT(*) INTO v_total_documents FROM documents WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_total_tasks FROM compliance_tasks WHERE deleted_at IS NULL;

  SELECT COUNT(*) INTO v_error_count_24h
  FROM error_logs WHERE created_at > now() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO v_critical_errors_24h
  FROM error_logs WHERE created_at > now() - INTERVAL '24 hours' AND severity = 'critical';

  SELECT COUNT(*) INTO v_overdue_tasks
  FROM compliance_tasks
  WHERE due_date < CURRENT_DATE
    AND status NOT IN ('acknowledged', 'locked', 'filed')
    AND deleted_at IS NULL;

  SELECT COALESCE(AVG(used_mb / NULLIF(total_mb, 0) * 100), 0)
  INTO v_avg_storage_pct
  FROM storage_usage;

  -- Determine health status
  v_health_status := CASE
    WHEN v_critical_errors_24h > 10 THEN 'critical'
    WHEN v_critical_errors_24h > 0 OR v_error_count_24h > 100 THEN 'degraded'
    ELSE 'healthy'
  END;

  RETURN jsonb_build_object(
    'status', v_health_status,
    'checked_at', now(),
    'metrics', jsonb_build_object(
      'total_users', v_total_users,
      'active_subscriptions', v_active_subs,
      'total_documents', v_total_documents,
      'total_tasks', v_total_tasks,
      'overdue_tasks', v_overdue_tasks,
      'errors_24h', v_error_count_24h,
      'critical_errors_24h', v_critical_errors_24h,
      'avg_storage_usage_pct', round(v_avg_storage_pct, 1)
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================
-- 10. SIGNED URL ACCESS VALIDATION FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION validate_document_access(p_user_id UUID, p_document_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_doc RECORD;
  v_has_access BOOLEAN;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;

  IF v_doc IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Document not found');
  END IF;

  v_has_access := validate_ca_access(p_user_id, v_doc.business_id);

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Access denied');
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'storage_path', v_doc.storage_path,
    'file_name', v_doc.file_name
  );
END;
$$ LANGUAGE plpgsql STABLE;
