/*
  # Backend Systems Architecture — Schema Migration
  
  ## Changes
  1. Expand compliance_tasks.status to 7-state workflow
  2. Add approval fields to compliance_tasks
  3. Create compliance_templates table (pre-seeded with Indian deadlines)
  4. Create role_permissions table + expand user_type
  5. Create document_versions table
  6. Update documents table (storage_path, version_number)
  7. Create notifications table
  8. Create error_logs table
  9. RLS policies + indexes for all new tables
*/

-- ================================================
-- 1. WORKFLOW ENGINE — Expand compliance_tasks.status
-- ================================================

-- Drop the old CHECK constraint
ALTER TABLE compliance_tasks DROP CONSTRAINT IF EXISTS compliance_tasks_status_check;

-- Migrate existing data to new states
UPDATE compliance_tasks SET status = 'created' WHERE status = 'pending';
UPDATE compliance_tasks SET status = 'acknowledged' WHERE status = 'completed';
-- overdue tasks go back to created (they'll be re-evaluated by the system)
UPDATE compliance_tasks SET status = 'created' WHERE status = 'overdue';

-- Add new CHECK with all 7 workflow states
ALTER TABLE compliance_tasks ADD CONSTRAINT compliance_tasks_status_check 
  CHECK (status IN ('created', 'awaiting_documents', 'under_review', 'ready_to_file', 'filed', 'acknowledged', 'locked'));

-- Set default for new tasks
ALTER TABLE compliance_tasks ALTER COLUMN status SET DEFAULT 'created';

-- ================================================
-- 2. DATA APPROVAL WORKFLOW — Add approval fields
-- ================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN approval_status TEXT DEFAULT 'draft'
      CHECK (approval_status IN ('draft', 'ca_reviewed', 'business_approved', 'locked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN approved_by UUID REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
END $$;

-- ================================================
-- 3. COMPLIANCE TEMPLATES
-- ================================================

CREATE TABLE IF NOT EXISTS compliance_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  applicable_entity_types TEXT[] DEFAULT '{}',
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  due_day INTEGER NOT NULL DEFAULT 20,
  due_month INTEGER,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_templates ENABLE ROW LEVEL SECURITY;

-- Templates are readable by all authenticated users (reference data)
CREATE POLICY "Authenticated users can view templates"
  ON compliance_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage templates (via service role in practice)

-- Pre-seed Indian compliance templates
INSERT INTO compliance_templates (template_name, task_type, applicable_entity_types, frequency, due_day, due_month, description, priority) VALUES
  ('GSTR-1', 'GST', ARRAY['proprietorship', 'pvt_ltd', 'llp', 'partnership'], 'monthly', 11, NULL, 'Monthly return for outward supplies', 'high'),
  ('GSTR-3B', 'GST', ARRAY['proprietorship', 'pvt_ltd', 'llp', 'partnership'], 'monthly', 20, NULL, 'Monthly summary return and tax payment', 'high'),
  ('GSTR-9', 'GST', ARRAY['proprietorship', 'pvt_ltd', 'llp', 'partnership'], 'yearly', 31, 12, 'Annual GST return', 'high'),
  ('TDS Return - Q1', 'Income Tax', ARRAY['pvt_ltd', 'llp', 'partnership'], 'quarterly', 31, 7, 'TDS return for Apr-Jun quarter', 'high'),
  ('TDS Return - Q2', 'Income Tax', ARRAY['pvt_ltd', 'llp', 'partnership'], 'quarterly', 31, 10, 'TDS return for Jul-Sep quarter', 'high'),
  ('TDS Return - Q3', 'Income Tax', ARRAY['pvt_ltd', 'llp', 'partnership'], 'quarterly', 31, 1, 'TDS return for Oct-Dec quarter', 'high'),
  ('TDS Return - Q4', 'Income Tax', ARRAY['pvt_ltd', 'llp', 'partnership'], 'quarterly', 31, 5, 'TDS return for Jan-Mar quarter', 'high'),
  ('PF Monthly Return', 'PF', ARRAY['pvt_ltd', 'llp', 'partnership'], 'monthly', 15, NULL, 'Monthly PF contribution return', 'medium'),
  ('ESI Monthly Return', 'ESI', ARRAY['pvt_ltd', 'llp', 'partnership'], 'monthly', 15, NULL, 'Monthly ESI contribution return', 'medium'),
  ('Income Tax Return', 'Income Tax', ARRAY['proprietorship', 'pvt_ltd', 'llp', 'partnership'], 'yearly', 31, 7, 'Annual income tax return filing', 'high'),
  ('Tax Audit Report', 'Income Tax', ARRAY['pvt_ltd', 'llp'], 'yearly', 30, 9, 'Tax audit report for eligible businesses', 'high'),
  ('ROC Annual Return', 'ROC', ARRAY['pvt_ltd', 'llp'], 'yearly', 30, 11, 'Annual return filing with MCA', 'medium'),
  ('DIR-3 KYC', 'ROC', ARRAY['pvt_ltd'], 'yearly', 30, 9, 'Director KYC annual filing', 'medium'),
  ('Professional Tax', 'State Tax', ARRAY['proprietorship', 'pvt_ltd', 'llp', 'partnership'], 'monthly', 30, NULL, 'Monthly professional tax payment', 'low')
ON CONFLICT DO NOTHING;

-- ================================================
-- 4. ROLE PERMISSIONS
-- ================================================

-- Expand user_type to include employee and admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('business_owner', 'chartered_accountant', 'employee', 'admin'));

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  UNIQUE(role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Pre-seed permission matrix
INSERT INTO role_permissions (role, permission, granted) VALUES
  -- Business Owner
  ('business_owner', 'upload_document', true),
  ('business_owner', 'edit_data', true),
  ('business_owner', 'approve_data', true),
  ('business_owner', 'delete_document', true),
  ('business_owner', 'view_admin', false),
  -- Chartered Accountant
  ('chartered_accountant', 'upload_document', true),
  ('chartered_accountant', 'edit_data', true),
  ('chartered_accountant', 'approve_data', false),
  ('chartered_accountant', 'delete_document', false),
  ('chartered_accountant', 'view_admin', false),
  -- Employee
  ('employee', 'upload_document', true),
  ('employee', 'edit_data', false),
  ('employee', 'approve_data', false),
  ('employee', 'delete_document', false),
  ('employee', 'view_admin', false),
  -- Admin
  ('admin', 'upload_document', true),
  ('admin', 'edit_data', true),
  ('admin', 'approve_data', true),
  ('admin', 'delete_document', true),
  ('admin', 'view_admin', true)
ON CONFLICT (role, permission) DO NOTHING;

-- ================================================
-- 5. DOCUMENT VERSIONING
-- ================================================

-- Add columns to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN storage_path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'version_number'
  ) THEN
    ALTER TABLE documents ADD COLUMN version_number INTEGER DEFAULT 1;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  storage_path TEXT,
  file_size BIGINT,
  metadata JSONB,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their documents"
  ON document_versions FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM documents d
      JOIN businesses b ON b.id = d.business_id
      WHERE b.owner_id = auth.uid()
    )
    OR
    document_id IN (
      SELECT d.id FROM documents d
      JOIN client_relationships cr ON cr.business_id = d.business_id
      WHERE cr.ca_profile_id = auth.uid() AND cr.status = 'active'
    )
  );

CREATE POLICY "Users can create versions for their documents"
  ON document_versions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ================================================
-- 6. NOTIFICATIONS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deadline_approaching', 'document_uploaded', 'task_completed',
    'task_status_changed', 'limit_warning', 'approval_requested',
    'approval_granted', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ================================================
-- 7. ERROR LOGS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  metadata JSONB,
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Error logs writable by any authenticated user, readable only by admins
CREATE POLICY "Any user can create error logs"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view error logs"
  ON error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ================================================
-- 8. INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_compliance_templates_type ON compliance_templates(task_type);
CREATE INDEX IF NOT EXISTS idx_compliance_templates_frequency ON compliance_templates(frequency);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_version ON document_versions(document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_approval ON compliance_tasks(approval_status);
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);
