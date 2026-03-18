/*
  # Backend Systems — Functions & Triggers

  1. validate_task_transition() — state machine guard
  2. trigger_validate_task_status — BEFORE UPDATE trigger
  3. trigger_prevent_locked_edit — blocks edits on locked tasks
  4. trigger_on_document_upload — AFTER INSERT on documents
  5. trigger_on_task_status_change — AFTER UPDATE on compliance_tasks
  6. check_permission() — role-based access control
  7. check_storage_limit() — subscription enforcement
  8. check_whatsapp_limit() — credit check
  9. generate_compliance_tasks() — auto task generation from templates
*/

-- ================================================
-- 1. STATE MACHINE: validate_task_transition
-- ================================================

CREATE OR REPLACE FUNCTION validate_task_transition(old_status TEXT, new_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Same status is always allowed (no-op update)
  IF old_status = new_status THEN
    RETURN true;
  END IF;

  -- Define valid transitions
  RETURN CASE
    WHEN old_status = 'created'             AND new_status = 'awaiting_documents' THEN true
    WHEN old_status = 'awaiting_documents'  AND new_status = 'under_review'       THEN true
    WHEN old_status = 'under_review'        AND new_status = 'ready_to_file'      THEN true
    WHEN old_status = 'ready_to_file'       AND new_status = 'filed'              THEN true
    WHEN old_status = 'filed'               AND new_status = 'acknowledged'       THEN true
    WHEN old_status = 'acknowledged'        AND new_status = 'locked'             THEN true
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ================================================
-- 2. TRIGGER: Validate task status transitions
-- ================================================

CREATE OR REPLACE FUNCTION trigger_validate_task_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Block ALL updates on locked tasks
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot modify a locked task (task_id: %)', OLD.id;
  END IF;

  -- If status is changing, validate the transition
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT validate_task_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid task status transition: % → %. Allowed: created→awaiting_documents→under_review→ready_to_file→filed→acknowledged→locked',
        OLD.status, NEW.status;
    END IF;
  END IF;

  -- Update the updated_at timestamp
  NEW.updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to allow re-running migration
DROP TRIGGER IF EXISTS validate_task_status_trigger ON compliance_tasks;

CREATE TRIGGER validate_task_status_trigger
  BEFORE UPDATE ON compliance_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validate_task_status();


-- ================================================
-- 3. TRIGGER: Prevent edits on locked approval_status
-- ================================================

CREATE OR REPLACE FUNCTION trigger_prevent_locked_approval_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status = 'locked' THEN
    -- Allow only if the update is ONLY changing non-data fields
    -- Block changes to final_values, description, approval_status
    IF (OLD.final_values IS DISTINCT FROM NEW.final_values)
       OR (OLD.description IS DISTINCT FROM NEW.description) THEN
      RAISE EXCEPTION 'Cannot edit data on a locked task (task_id: %). The task has been approved and locked.', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_locked_approval_edit_trigger ON compliance_tasks;

CREATE TRIGGER prevent_locked_approval_edit_trigger
  BEFORE UPDATE ON compliance_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_prevent_locked_approval_edit();


-- ================================================
-- 4. TRIGGER: On document upload — advance task + notify + audit
-- ================================================

CREATE OR REPLACE FUNCTION trigger_on_document_upload()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_business RECORD;
  v_ca_id UUID;
  v_file_size_mb NUMERIC;
BEGIN
  -- Update storage usage
  v_file_size_mb := COALESCE(NEW.file_size, 0) / (1024.0 * 1024.0);

  UPDATE storage_usage
  SET used_mb = used_mb + v_file_size_mb,
      updated_at = now()
  WHERE business_id = NEW.business_id;

  -- Find any task in 'created' state for this business and transition it
  FOR v_task IN
    SELECT id, task_name FROM compliance_tasks
    WHERE business_id = NEW.business_id
      AND status = 'created'
    ORDER BY due_date ASC
    LIMIT 1
  LOOP
    UPDATE compliance_tasks
    SET status = 'awaiting_documents'
    WHERE id = v_task.id;

    -- Create audit log
    INSERT INTO audit_logs (business_id, user_id, entity_type, entity_id, action, description)
    VALUES (
      NEW.business_id,
      NEW.uploaded_by,
      'task',
      v_task.id,
      'updated',
      'Task "' || v_task.task_name || '" auto-transitioned to awaiting_documents after document upload'
    );
  END LOOP;

  -- Notify linked CA about the upload
  SELECT cr.ca_profile_id INTO v_ca_id
  FROM client_relationships cr
  WHERE cr.business_id = NEW.business_id AND cr.status = 'active'
  LIMIT 1;

  IF v_ca_id IS NOT NULL THEN
    INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
    VALUES (
      NEW.business_id,
      v_ca_id,
      'document_uploaded',
      'New Document Uploaded',
      'A new document "' || NEW.file_name || '" has been uploaded.',
      jsonb_build_object('document_id', NEW.id, 'file_name', NEW.file_name, 'category', NEW.category)
    );
  END IF;

  -- Create audit log for the upload itself
  INSERT INTO audit_logs (business_id, user_id, entity_type, entity_id, action, description)
  VALUES (
    NEW.business_id,
    NEW.uploaded_by,
    'document',
    NEW.id,
    'uploaded',
    'Document "' || NEW.file_name || '" uploaded to ' || COALESCE(NEW.category, 'General')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_document_upload_trigger ON documents;

CREATE TRIGGER on_document_upload_trigger
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_on_document_upload();


-- ================================================
-- 5. TRIGGER: On task status change — notify + audit
-- ================================================

CREATE OR REPLACE FUNCTION trigger_on_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_business RECORD;
  v_owner_id UUID;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get business owner
  SELECT b.owner_id INTO v_owner_id
  FROM businesses b
  WHERE b.id = NEW.business_id;

  -- When task reaches 'acknowledged' — notify the business owner
  IF NEW.status = 'acknowledged' THEN
    INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
    VALUES (
      NEW.business_id,
      v_owner_id,
      'task_completed',
      'Task Completed: ' || NEW.task_name,
      'The compliance task "' || NEW.task_name || '" has been filed and acknowledged.',
      jsonb_build_object('task_id', NEW.id, 'task_name', NEW.task_name)
    );
  END IF;

  -- When task reaches 'locked' — set approval_status to locked
  IF NEW.status = 'locked' THEN
    -- We update directly since trigger is AFTER UPDATE
    UPDATE compliance_tasks
    SET approval_status = 'locked',
        approved_at = now()
    WHERE id = NEW.id
      AND approval_status != 'locked';
  END IF;

  -- Notify owner about all status changes
  IF NEW.status != 'locked' THEN  -- locked notification is redundant with the update above
    INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
    VALUES (
      NEW.business_id,
      v_owner_id,
      'task_status_changed',
      'Task Updated: ' || NEW.task_name,
      'Status changed from "' || OLD.status || '" to "' || NEW.status || '"',
      jsonb_build_object('task_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Audit log for every transition
  INSERT INTO audit_logs (business_id, user_id, entity_type, entity_id, action, old_value, new_value, description)
  VALUES (
    NEW.business_id,
    COALESCE(NEW.edited_by, v_owner_id),
    'task',
    NEW.id,
    'updated',
    jsonb_build_object('status', OLD.status),
    jsonb_build_object('status', NEW.status),
    'Task "' || NEW.task_name || '" status: ' || OLD.status || ' → ' || NEW.status
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_task_status_change_trigger ON compliance_tasks;

CREATE TRIGGER on_task_status_change_trigger
  AFTER UPDATE ON compliance_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_on_task_status_change();


-- ================================================
-- 6. FUNCTION: check_permission
-- ================================================

CREATE OR REPLACE FUNCTION check_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_type TEXT;
  v_granted BOOLEAN;
BEGIN
  -- Get user type
  SELECT user_type INTO v_user_type
  FROM profiles
  WHERE id = p_user_id;

  IF v_user_type IS NULL THEN
    RETURN false;
  END IF;

  -- Check permission
  SELECT granted INTO v_granted
  FROM role_permissions
  WHERE role = v_user_type AND permission = p_permission;

  RETURN COALESCE(v_granted, false);
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================
-- 7. FUNCTION: check_storage_limit
-- ================================================

CREATE OR REPLACE FUNCTION check_storage_limit(p_business_id UUID, p_file_size_bytes BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_used_mb NUMERIC;
  v_total_mb NUMERIC;
  v_new_size_mb NUMERIC;
BEGIN
  v_new_size_mb := p_file_size_bytes / (1024.0 * 1024.0);

  SELECT used_mb, total_mb INTO v_used_mb, v_total_mb
  FROM storage_usage
  WHERE business_id = p_business_id;

  -- If no storage record, assume default limits
  IF v_total_mb IS NULL THEN
    v_used_mb := 0;
    v_total_mb := 100; -- Free plan default
  END IF;

  IF (v_used_mb + v_new_size_mb) > v_total_mb THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used_mb', round(v_used_mb, 2),
      'total_mb', v_total_mb,
      'requested_mb', round(v_new_size_mb, 2),
      'message', 'Storage limit exceeded. Used: ' || round(v_used_mb, 1) || 'MB of ' || v_total_mb || 'MB'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'used_mb', round(v_used_mb, 2),
    'total_mb', v_total_mb,
    'remaining_mb', round(v_total_mb - v_used_mb - v_new_size_mb, 2)
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================
-- 8. FUNCTION: check_whatsapp_limit
-- ================================================

CREATE OR REPLACE FUNCTION check_whatsapp_limit(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_remaining INTEGER;
  v_total INTEGER;
BEGIN
  SELECT credits_remaining, credits_total INTO v_remaining, v_total
  FROM whatsapp_credits
  WHERE business_id = p_business_id;

  IF v_remaining IS NULL THEN
    v_remaining := 0;
    v_total := 0;
  END IF;

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', v_remaining,
      'total', v_total,
      'message', 'No WhatsApp credits remaining. Please top up or upgrade your plan.'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining,
    'total', v_total
  );
END;
$$ LANGUAGE plpgsql STABLE;


-- ================================================
-- 9. FUNCTION: generate_compliance_tasks
-- ================================================

CREATE OR REPLACE FUNCTION generate_compliance_tasks(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  v_template RECORD;
  v_business RECORD;
  v_due_date DATE;
  v_tasks_created INTEGER := 0;
  v_tasks_skipped INTEGER := 0;
  v_current_month INTEGER;
  v_current_year INTEGER;
  v_existing_count INTEGER;
BEGIN
  v_current_month := EXTRACT(MONTH FROM target_date);
  v_current_year := EXTRACT(YEAR FROM target_date);

  FOR v_template IN
    SELECT * FROM compliance_templates WHERE is_active = true
  LOOP
    -- Determine if this template should generate a task this period
    CASE v_template.frequency
      WHEN 'monthly' THEN
        -- Monthly: always generate, due on due_day of current month
        v_due_date := make_date(v_current_year, v_current_month, LEAST(v_template.due_day, 28));
        -- Only generate if due date is in the future or this month
        IF v_due_date < target_date - INTERVAL '5 days' THEN
          -- Move to next month
          v_due_date := v_due_date + INTERVAL '1 month';
        END IF;

      WHEN 'quarterly' THEN
        -- Quarterly: generate if due_month matches a quarter boundary relative to current date
        -- due_month indicates which month of the year this quarterly task is due
        IF v_template.due_month IS NOT NULL AND v_current_month = v_template.due_month THEN
          v_due_date := make_date(v_current_year, v_template.due_month, LEAST(v_template.due_day, 28));
        ELSE
          CONTINUE;  -- Skip this template for this period
        END IF;

      WHEN 'yearly' THEN
        -- Yearly: generate only in the due_month
        IF v_template.due_month IS NOT NULL AND v_current_month = v_template.due_month THEN
          v_due_date := make_date(v_current_year, v_template.due_month, LEAST(v_template.due_day, 28));
        ELSE
          CONTINUE;  -- Skip this template for this period
        END IF;
    END CASE;

    -- Generate for each matching business
    FOR v_business IN
      SELECT b.id, b.business_type
      FROM businesses b
      WHERE b.business_type = ANY(v_template.applicable_entity_types)
         OR array_length(v_template.applicable_entity_types, 1) IS NULL
    LOOP
      -- Check for duplicates: same business + task_name + due_date
      SELECT COUNT(*) INTO v_existing_count
      FROM compliance_tasks
      WHERE business_id = v_business.id
        AND task_name = v_template.template_name
        AND due_date = v_due_date;

      IF v_existing_count = 0 THEN
        INSERT INTO compliance_tasks (
          business_id, task_name, task_type, due_date, status,
          description, priority, approval_status
        ) VALUES (
          v_business.id, v_template.template_name, v_template.task_type,
          v_due_date, 'created', v_template.description,
          v_template.priority, 'draft'
        );
        v_tasks_created := v_tasks_created + 1;
      ELSE
        v_tasks_skipped := v_tasks_skipped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'target_date', target_date,
    'tasks_created', v_tasks_created,
    'tasks_skipped', v_tasks_skipped,
    'message', 'Generated ' || v_tasks_created || ' tasks, skipped ' || v_tasks_skipped || ' duplicates'
  );
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 10. HELPER: transition_task_status (controlled RPC)
-- ================================================

CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id UUID,
  p_new_status TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
BEGIN
  -- Get current task
  SELECT * INTO v_task FROM compliance_tasks WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- Validate transition (the trigger will also validate, but we give a better error message here)
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

  -- Perform the transition
  UPDATE compliance_tasks
  SET status = p_new_status,
      edited_by = p_user_id,
      completed_at = CASE WHEN p_new_status IN ('acknowledged', 'locked') THEN now() ELSE completed_at END
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'old_status', v_task.status,
    'new_status', p_new_status,
    'message', 'Task transitioned from ' || v_task.status || ' to ' || p_new_status
  );
END;
$$ LANGUAGE plpgsql;
