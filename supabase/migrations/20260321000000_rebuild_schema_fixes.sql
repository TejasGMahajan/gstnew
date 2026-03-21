/*
  # Rebuild Schema Fixes — 2026-03-21

  Fixes 4 constraint issues discovered during the ground-up rebuild:

  1. documents.file_url — make nullable
     The secure_upload_document RPC stores the path in storage_path (added in
     migration 20260318120002). file_url is legacy from migration 1 and is no
     longer populated by the RPC. Making it nullable prevents NOT NULL violations.

  2. audit_logs.business_id — make nullable
     logUserAction() is called for CA-level and admin-level actions that don't
     belong to a specific business. The NOT NULL constraint blocks those inserts.

  3. audit_logs.entity_type CHECK — add 'profile'
     admin_verify_ca() inserts audit_logs with entity_type = 'profile'. The
     existing CHECK only allows document/task/compliance/subscription.

  4. audit_logs.action CHECK — add 'ca_verification'
     admin_verify_ca() inserts audit_logs with action = 'ca_verification'. The
     existing CHECK does not include this value.
*/


-- ─── 1. Make documents.file_url nullable ─────────────────────────────────────
-- storage_path (added in migration _120002) is now the canonical path.
-- file_url is kept for backwards compatibility but no longer required.

ALTER TABLE documents ALTER COLUMN file_url DROP NOT NULL;


-- ─── 2. Make audit_logs.business_id nullable ─────────────────────────────────
-- Allows audit entries for platform-level actions (CA verification, admin ops)
-- that are not scoped to a single business.

ALTER TABLE audit_logs ALTER COLUMN business_id DROP NOT NULL;


-- ─── 3. Expand audit_logs.entity_type CHECK ──────────────────────────────────

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN (
    'document', 'task', 'compliance', 'subscription',
    'profile',           -- CA verification, user management
    'business',          -- business-level admin actions
    'client_relationship' -- CA-client link management
  ));


-- ─── 4. Expand audit_logs.action CHECK ───────────────────────────────────────

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'created', 'updated', 'deleted', 'uploaded', 'downloaded',
    'edited', 'exported', 'completed',
    'ca_verification',   -- admin_verify_ca()
    'linked',            -- CA-client relationship created
    'unlinked',          -- CA-client relationship removed
    'approved',          -- data approval workflow
    'locked'             -- task locked after filing
  ));


-- ─── 5. Add deleted_at filter index for featureGate doc count ─────────────────
-- featureGate.tsx counts monthly uploads; exclude soft-deleted docs.

CREATE INDEX IF NOT EXISTS idx_documents_monthly_count
  ON documents (business_id, uploaded_at)
  WHERE deleted_at IS NULL;


-- ─── 6. Allow owner "Mark Done" — any active state → acknowledged ─────────────
-- Business owners need a one-click "Mark Done" on the dashboard.
-- The strict CA workflow (created→awaiting_documents→...→filed→acknowledged)
-- is correct for CAs, but owners should be able to directly acknowledge a task.
-- This updates validate_task_transition to allow the owner shortcut.

CREATE OR REPLACE FUNCTION validate_task_transition(old_status TEXT, new_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF old_status = new_status THEN
    RETURN true;
  END IF;

  RETURN CASE
    -- Standard CA workflow (sequential)
    WHEN old_status = 'created'             AND new_status = 'awaiting_documents' THEN true
    WHEN old_status = 'awaiting_documents'  AND new_status = 'under_review'       THEN true
    WHEN old_status = 'under_review'        AND new_status = 'ready_to_file'      THEN true
    WHEN old_status = 'ready_to_file'       AND new_status = 'filed'              THEN true
    WHEN old_status = 'filed'               AND new_status = 'acknowledged'       THEN true
    WHEN old_status = 'acknowledged'        AND new_status = 'locked'             THEN true
    -- Owner shortcut: any active state → acknowledged ("Mark Done")
    WHEN old_status IN ('created', 'awaiting_documents', 'under_review', 'ready_to_file')
         AND new_status = 'acknowledged'                                           THEN true
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
