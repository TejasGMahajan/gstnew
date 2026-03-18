/*
  # Final Features Migration — Schema & Functions
  
  1.  CA Verification System
  2.  Field-Level Audit Trail
  3.  Business Members (Multi-Employee)
  4.  WhatsApp Logs
  5.  Legal Disclaimers
  6.  Pagination Helper
  7.  Smart Compliance Rules
  8.  GST Filing Export Data
*/

-- ================================================
-- 1. CA VERIFICATION SYSTEM
-- ================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ca_verification_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ca_verification_status TEXT DEFAULT 'pending'
      CHECK (ca_verification_status IN ('pending', 'verified', 'rejected', 'not_applicable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'icai_membership_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN icai_membership_number TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ca_verified_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ca_verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ca_verified_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ca_verified_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Set existing non-CA users to not_applicable
UPDATE profiles SET ca_verification_status = 'not_applicable'
WHERE user_type != 'chartered_accountant' AND ca_verification_status = 'pending';

-- Function: Only verified CAs can access clients
CREATE OR REPLACE FUNCTION validate_ca_verified(p_ca_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT ca_verification_status INTO v_status
  FROM profiles WHERE id = p_ca_id AND user_type = 'chartered_accountant';
  
  RETURN v_status = 'verified';
END;
$$ LANGUAGE plpgsql STABLE;

-- Admin function to verify/reject CA
CREATE OR REPLACE FUNCTION admin_verify_ca(
  p_admin_id UUID,
  p_ca_id UUID,
  p_action TEXT -- 'verify' or 'reject'
)
RETURNS JSONB AS $$
DECLARE
  v_admin_type TEXT;
BEGIN
  SELECT user_type INTO v_admin_type FROM profiles WHERE id = p_admin_id;
  IF v_admin_type != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_action = 'verify' THEN
    UPDATE profiles
    SET ca_verification_status = 'verified',
        ca_verified_at = now(),
        ca_verified_by = p_admin_id
    WHERE id = p_ca_id AND user_type = 'chartered_accountant';
  ELSIF p_action = 'reject' THEN
    UPDATE profiles
    SET ca_verification_status = 'rejected',
        ca_verified_at = now(),
        ca_verified_by = p_admin_id
    WHERE id = p_ca_id AND user_type = 'chartered_accountant';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  INSERT INTO audit_logs (user_id, entity_type, entity_id, action, description)
  VALUES (p_admin_id, 'profile', p_ca_id, 'ca_verification',
    'CA ' || p_action || 'd by admin');

  RETURN jsonb_build_object('success', true, 'action', p_action, 'ca_id', p_ca_id);
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 2. FIELD-LEVEL AUDIT TRAIL (LEGAL REQUIREMENT)
-- ================================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  change_context TEXT -- 'manual_edit', 'api_update', 'trigger', 'bulk_import'
);

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit trail"
  ON audit_trail FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Business owners see own audit trail"
  ON audit_trail FOR SELECT TO authenticated
  USING (
    record_id IN (
      SELECT ct.id FROM compliance_tasks ct
      JOIN businesses b ON b.id = ct.business_id
      WHERE b.owner_id = auth.uid()
    )
    OR
    record_id IN (
      SELECT d.id FROM documents d
      JOIN businesses b ON b.id = d.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit trail"
  ON audit_trail FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_trail_table_record ON audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_at ON audit_trail(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_by ON audit_trail(changed_by);

-- Generic trigger function for field-level audit tracking
CREATE OR REPLACE FUNCTION trigger_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  old_val TEXT;
  new_val TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    auth.uid()
  );

  -- Track changes for important columns
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_name = TG_TABLE_NAME
      AND column_name NOT IN ('id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by')
      AND data_type NOT IN ('jsonb', 'json') -- skip large JSON fields for perf
  LOOP
    EXECUTE format('SELECT ($1).%I::TEXT', col) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::TEXT', col) INTO new_val USING NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO audit_trail (table_name, record_id, field_name, old_value, new_value, changed_by)
      VALUES (TG_TABLE_NAME, NEW.id, col, old_val, new_val, v_user_id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trail trigger to critical tables
DROP TRIGGER IF EXISTS audit_trail_compliance_tasks ON compliance_tasks;
CREATE TRIGGER audit_trail_compliance_tasks
  AFTER UPDATE ON compliance_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_trail();

DROP TRIGGER IF EXISTS audit_trail_documents ON documents;
CREATE TRIGGER audit_trail_documents
  AFTER UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION trigger_audit_trail();


-- ================================================
-- 3. BUSINESS MEMBERS (MULTI-EMPLOYEE ACCESS)
-- ================================================

CREATE TABLE IF NOT EXISTS business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'manager', 'employee', 'viewer')),
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'rejected', 'revoked')),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  permissions JSONB DEFAULT '[]'::jsonb,
  UNIQUE(business_id, email)
);

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners manage members"
  ON business_members FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE INDEX IF NOT EXISTS idx_business_members_business ON business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_email ON business_members(email);

-- Invite function
CREATE OR REPLACE FUNCTION invite_team_member(
  p_business_id UUID,
  p_inviter_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'employee'
)
RETURNS JSONB AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_existing UUID;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM businesses WHERE id = p_business_id AND owner_id = p_inviter_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only business owners can invite members');
  END IF;

  SELECT id INTO v_existing
  FROM business_members
  WHERE business_id = p_business_id AND email = p_email AND invite_status != 'revoked';

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This email has already been invited');
  END IF;

  INSERT INTO business_members (business_id, email, role, invited_by)
  VALUES (p_business_id, p_email, p_role, p_inviter_id);

  RETURN jsonb_build_object('success', true, 'message', 'Invitation sent to ' || p_email);
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 4. WHATSAPP LOGS
-- ================================================

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  phone_number TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN (
    'deadline_reminder', 'document_request', 'approval_notification',
    'overdue_alert', 'welcome', 'custom'
  )),
  message_content TEXT,
  template_id TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  external_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own business WhatsApp logs"
  ON whatsapp_logs FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "System can insert WhatsApp logs"
  ON whatsapp_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_business ON whatsapp_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_logs(created_at DESC);

-- WhatsApp credit deduction on send
CREATE OR REPLACE FUNCTION deduct_whatsapp_credit(p_business_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT credits_remaining INTO v_remaining
  FROM whatsapp_credits WHERE business_id = p_business_id;

  IF COALESCE(v_remaining, 0) <= 0 THEN
    RETURN false;
  END IF;

  UPDATE whatsapp_credits
  SET credits_remaining = credits_remaining - 1, updated_at = now()
  WHERE business_id = p_business_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 5. LEGAL DISCLAIMERS
-- ================================================

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  disclaimer_type TEXT NOT NULL CHECK (disclaimer_type IN (
    'terms_of_service', 'privacy_policy', 'data_accuracy',
    'ca_responsibility', 'tax_submission_disclaimer'
  )),
  version TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE(user_id, disclaimer_type, version)
);

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own acceptances"
  ON legal_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert acceptances"
  ON legal_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- CA responsibility tagging on tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'responsible_ca_id'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN responsible_ca_id UUID REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'ca_disclaimer_accepted'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN ca_disclaimer_accepted BOOLEAN DEFAULT false;
  END IF;
END $$;


-- ================================================
-- 6. SMART COMPLIANCE RULES ENGINE
-- ================================================

CREATE TABLE IF NOT EXISTS compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('anomaly', 'validation', 'suggestion', 'warning')),
  description TEXT,
  condition_sql TEXT, -- SQL expression to evaluate
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  applicable_task_types TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rules"
  ON compliance_rules FOR SELECT TO authenticated USING (true);

-- Pre-seed compliance rules
INSERT INTO compliance_rules (rule_name, rule_type, description, severity, applicable_task_types) VALUES
  ('GST Sales Mismatch', 'anomaly', 'Mismatch between reported sales and GST returns total', 'critical', ARRAY['GST']),
  ('ITC Claim Spike', 'anomaly', 'Input Tax Credit claim increased >50% from previous period', 'warning', ARRAY['GST']),
  ('Late Filing Risk', 'warning', 'Task approaching due date with incomplete documents', 'warning', ARRAY['GST', 'Income Tax', 'PF', 'ESI']),
  ('Missing Documents', 'validation', 'Required supporting documents not uploaded', 'warning', ARRAY['GST', 'Income Tax']),
  ('TDS Mismatch', 'anomaly', 'TDS deducted vs TDS deposited mismatch', 'critical', ARRAY['Income Tax']),
  ('Revenue Under-Reporting', 'suggestion', 'Reported revenue significantly lower than bank transactions', 'warning', ARRAY['GST', 'Income Tax']),
  ('PF Late Deposit', 'warning', 'PF contribution deposited after 15th of following month', 'critical', ARRAY['PF']),
  ('Duplicate Invoice', 'validation', 'Same invoice number appearing in multiple periods', 'critical', ARRAY['GST'])
ON CONFLICT DO NOTHING;

-- Compliance alerts table (results of rule evaluation)
CREATE TABLE IF NOT EXISTS compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES compliance_rules(id),
  task_id UUID REFERENCES compliance_tasks(id),
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT,
  suggested_action TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners see own alerts"
  ON compliance_alerts FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (
      SELECT business_id FROM client_relationships
      WHERE ca_profile_id = auth.uid() AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE POLICY "System can manage alerts"
  ON compliance_alerts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_business ON compliance_alerts(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_alerts_unresolved ON compliance_alerts(business_id) WHERE is_resolved = false;

-- Function to evaluate rules for a business
CREATE OR REPLACE FUNCTION evaluate_compliance_rules(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_rule RECORD;
  v_alerts_created INTEGER := 0;
  v_task_count INTEGER;
  v_doc_count INTEGER;
  v_overdue_count INTEGER;
BEGIN
  -- Count incomplete tasks approaching deadline
  SELECT COUNT(*) INTO v_overdue_count
  FROM compliance_tasks
  WHERE business_id = p_business_id
    AND due_date < CURRENT_DATE + INTERVAL '3 days'
    AND status NOT IN ('acknowledged', 'locked', 'filed')
    AND deleted_at IS NULL;

  IF v_overdue_count > 0 THEN
    INSERT INTO compliance_alerts (
      business_id, alert_type, severity, title, description, suggested_action, metadata
    )
    SELECT p_business_id, 'late_filing_risk', 'warning',
      'Late Filing Risk: ' || ct.task_name,
      'Task "' || ct.task_name || '" is due on ' || ct.due_date || ' but is still in "' || ct.status || '" state.',
      'Complete pending documents and advance the task to filing stage.',
      jsonb_build_object('task_id', ct.id, 'due_date', ct.due_date, 'status', ct.status)
    FROM compliance_tasks ct
    WHERE ct.business_id = p_business_id
      AND ct.due_date < CURRENT_DATE + INTERVAL '3 days'
      AND ct.status NOT IN ('acknowledged', 'locked', 'filed')
      AND ct.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM compliance_alerts ca
        WHERE ca.task_id = ct.id AND ca.alert_type = 'late_filing_risk'
          AND ca.is_resolved = false
      );

    GET DIAGNOSTICS v_alerts_created = ROW_COUNT;
  END IF;

  -- Check for tasks missing documents
  FOR v_rule IN
    SELECT ct.id, ct.task_name
    FROM compliance_tasks ct
    WHERE ct.business_id = p_business_id
      AND ct.status = 'created'
      AND ct.due_date < CURRENT_DATE + INTERVAL '7 days'
      AND ct.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM documents d
        WHERE d.business_id = p_business_id AND d.deleted_at IS NULL
          AND d.created_at > ct.created_at
      )
  LOOP
    INSERT INTO compliance_alerts (
      business_id, task_id, alert_type, severity, title, description, suggested_action
    ) VALUES (
      p_business_id, v_rule.id, 'missing_documents', 'warning',
      'Missing Documents: ' || v_rule.task_name,
      'No documents uploaded for this task. Upload required documents before filing.',
      'Upload relevant invoices, returns, or challans to the Document Vault.'
    )
    ON CONFLICT DO NOTHING;

    v_alerts_created := v_alerts_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'business_id', p_business_id,
    'alerts_created', v_alerts_created
  );
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 7. GST FILING EXPORT DATA
-- ================================================

CREATE TABLE IF NOT EXISTS filing_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  task_id UUID REFERENCES compliance_tasks(id),
  export_type TEXT NOT NULL CHECK (export_type IN ('GSTR1_JSON', 'GSTR3B_JSON', 'TDS_CSV', 'CUSTOM')),
  file_name TEXT NOT NULL,
  storage_path TEXT,
  export_data JSONB,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'downloaded', 'filed')),
  generated_by UUID NOT NULL REFERENCES profiles(id),
  generated_at TIMESTAMPTZ DEFAULT now(),
  downloaded_at TIMESTAMPTZ,
  filed_at TIMESTAMPTZ
);

ALTER TABLE filing_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own filing exports"
  ON filing_exports FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (
      SELECT business_id FROM client_relationships
      WHERE ca_profile_id = auth.uid() AND status = 'active'
    )
  );

-- Function to generate GSTR-1 JSON export
CREATE OR REPLACE FUNCTION generate_gstr1_json(
  p_business_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_business RECORD;
  v_export_id UUID;
  v_gstr_data JSONB;
BEGIN
  SELECT * INTO v_business FROM businesses WHERE id = p_business_id;

  IF v_business IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Business not found');
  END IF;

  -- Build GSTR-1 JSON structure (simplified)
  v_gstr_data := jsonb_build_object(
    'gstin', v_business.gstin,
    'fp', to_char(p_period_start, 'MMYYYY'),
    'gt', 0, -- gross turnover placeholder
    'cur_gt', 0,
    'b2b', '[]'::jsonb, -- B2B invoices (populated from extracted_data)
    'b2cl', '[]'::jsonb,
    'b2cs', '[]'::jsonb,
    'hsn', '[]'::jsonb,
    'nil', '[]'::jsonb,
    'doc_det', '[]'::jsonb,
    'generated_at', now(),
    'platform', 'ComplianceOS',
    'disclaimer', 'This is a draft. Verify all data before uploading to GST portal.'
  );

  INSERT INTO filing_exports (
    business_id, export_type, file_name, export_data, generated_by
  ) VALUES (
    p_business_id, 'GSTR1_JSON',
    'GSTR1_' || v_business.gstin || '_' || to_char(p_period_start, 'MMYYYY') || '.json',
    v_gstr_data, p_user_id
  )
  RETURNING id INTO v_export_id;

  RETURN jsonb_build_object(
    'success', true,
    'export_id', v_export_id,
    'file_name', 'GSTR1_' || v_business.gstin || '_' || to_char(p_period_start, 'MMYYYY') || '.json',
    'data', v_gstr_data
  );
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- 8. PAGINATION HELPER
-- ================================================

CREATE OR REPLACE FUNCTION paginated_query(
  p_table TEXT,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_order_by TEXT DEFAULT 'created_at',
  p_order_dir TEXT DEFAULT 'DESC',
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_total_pages INTEGER;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Get total count
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE deleted_at IS NULL', p_table)
  INTO v_total;

  v_total_pages := CEIL(v_total::NUMERIC / p_page_size);

  RETURN jsonb_build_object(
    'page', p_page,
    'page_size', p_page_size,
    'total_records', v_total,
    'total_pages', v_total_pages,
    'has_next', p_page < v_total_pages,
    'has_prev', p_page > 1
  );
END;
$$ LANGUAGE plpgsql STABLE;
