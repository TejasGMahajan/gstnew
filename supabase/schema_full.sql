-- ════════════════════════════════════════════════════════════════════════════════
-- ComplianceHub — Full Schema (Clean Rebuild)
-- Run this in Supabase SQL Editor to wipe and recreate everything from scratch.
-- ════════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────────
-- STEP 0 — DROP EVERYTHING
-- ────────────────────────────────────────────────────────────────────────────────

-- Drop triggers first
DROP TRIGGER IF EXISTS audit_trail_compliance_tasks       ON compliance_tasks;
DROP TRIGGER IF EXISTS audit_trail_documents              ON documents;
DROP TRIGGER IF EXISTS validate_task_status_trigger       ON compliance_tasks;
DROP TRIGGER IF EXISTS prevent_locked_approval_edit_trigger ON compliance_tasks;
DROP TRIGGER IF EXISTS on_document_upload_trigger         ON documents;
DROP TRIGGER IF EXISTS on_task_status_change_trigger      ON compliance_tasks;
DROP TRIGGER IF EXISTS update_profiles_updated_at         ON profiles;
DROP TRIGGER IF EXISTS update_businesses_updated_at       ON businesses;
DROP TRIGGER IF EXISTS update_compliance_tasks_updated_at ON compliance_tasks;

-- Drop functions
DROP FUNCTION IF EXISTS validate_task_transition(TEXT, TEXT)              CASCADE;
DROP FUNCTION IF EXISTS trigger_validate_task_status()                    CASCADE;
DROP FUNCTION IF EXISTS trigger_prevent_locked_approval_edit()            CASCADE;
DROP FUNCTION IF EXISTS trigger_on_document_upload()                      CASCADE;
DROP FUNCTION IF EXISTS trigger_on_task_status_change()                   CASCADE;
DROP FUNCTION IF EXISTS trigger_audit_trail()                             CASCADE;
DROP FUNCTION IF EXISTS transition_task_status(UUID, TEXT, UUID)          CASCADE;
DROP FUNCTION IF EXISTS validate_ca_access(UUID, UUID)                    CASCADE;
DROP FUNCTION IF EXISTS validate_ca_verified(UUID)                        CASCADE;
DROP FUNCTION IF EXISTS admin_verify_ca(UUID, UUID, TEXT)                 CASCADE;
DROP FUNCTION IF EXISTS check_permission(UUID, TEXT)                      CASCADE;
DROP FUNCTION IF EXISTS check_storage_limit(UUID, BIGINT)                 CASCADE;
DROP FUNCTION IF EXISTS check_whatsapp_limit(UUID)                        CASCADE;
DROP FUNCTION IF EXISTS check_deadlines(DATE)                             CASCADE;
DROP FUNCTION IF EXISTS generate_compliance_tasks(DATE)                   CASCADE;
DROP FUNCTION IF EXISTS optimistic_update_task(UUID, UUID, TIMESTAMPTZ, JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS secure_upload_document(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS validate_document_access(UUID, UUID)              CASCADE;
DROP FUNCTION IF EXISTS soft_delete(TEXT, UUID, UUID)                     CASCADE;
DROP FUNCTION IF EXISTS soft_restore(TEXT, UUID)                          CASCADE;
DROP FUNCTION IF EXISTS sanitize_text(TEXT)                               CASCADE;
DROP FUNCTION IF EXISTS sanitize_filename(TEXT)                           CASCADE;
DROP FUNCTION IF EXISTS system_health_check()                             CASCADE;
DROP FUNCTION IF EXISTS deduct_whatsapp_credit(UUID)                      CASCADE;
DROP FUNCTION IF EXISTS invite_team_member(UUID, UUID, TEXT, TEXT)        CASCADE;
DROP FUNCTION IF EXISTS evaluate_compliance_rules(UUID)                   CASCADE;
DROP FUNCTION IF EXISTS generate_gstr1_json(UUID, DATE, DATE, UUID)       CASCADE;
DROP FUNCTION IF EXISTS paginated_query(TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column()                        CASCADE;

-- Drop tables (order matters — dependents first)
DROP TABLE IF EXISTS filing_exports        CASCADE;
DROP TABLE IF EXISTS compliance_alerts     CASCADE;
DROP TABLE IF EXISTS compliance_rules      CASCADE;
DROP TABLE IF EXISTS legal_acceptances     CASCADE;
DROP TABLE IF EXISTS whatsapp_logs         CASCADE;
DROP TABLE IF EXISTS business_members      CASCADE;
DROP TABLE IF EXISTS audit_trail           CASCADE;
DROP TABLE IF EXISTS audit_logs            CASCADE;
DROP TABLE IF EXISTS document_versions     CASCADE;
DROP TABLE IF EXISTS documents             CASCADE;
DROP TABLE IF EXISTS notifications         CASCADE;
DROP TABLE IF EXISTS error_logs            CASCADE;
DROP TABLE IF EXISTS compliance_tasks      CASCADE;
DROP TABLE IF EXISTS compliance_templates  CASCADE;
DROP TABLE IF EXISTS storage_usage         CASCADE;
DROP TABLE IF EXISTS whatsapp_credits      CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS client_relationships  CASCADE;
DROP TABLE IF EXISTS role_permissions      CASCADE;
DROP TABLE IF EXISTS businesses            CASCADE;
DROP TABLE IF EXISTS profiles              CASCADE;


-- ────────────────────────────────────────────────────────────────────────────────
-- STEP 1 — EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ────────────────────────────────────────────────────────────────────────────────
-- STEP 2 — CORE TABLES
-- ────────────────────────────────────────────────────────────────────────────────

-- profiles
CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type               TEXT NOT NULL CHECK (user_type IN ('business_owner','chartered_accountant','employee','admin')),
  full_name               TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT,
  ca_verification_status  TEXT DEFAULT 'not_applicable'
                            CHECK (ca_verification_status IN ('pending','verified','rejected','not_applicable')),
  icai_membership_number  TEXT UNIQUE,
  ca_verified_at          TIMESTAMPTZ,
  ca_verified_by          UUID, -- FK added after table creation
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ADD CONSTRAINT profiles_ca_verified_by_fk
  FOREIGN KEY (ca_verified_by) REFERENCES profiles(id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON profiles FOR SELECT    TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT    TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE    TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- businesses
CREATE TABLE businesses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name    TEXT NOT NULL,
  gstin            TEXT,
  pan              TEXT,
  business_type    TEXT,
  address          TEXT,
  compliance_score INTEGER DEFAULT 0,
  deleted_at       TIMESTAMPTZ,
  deleted_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner selects businesses"  ON businesses FOR SELECT    TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner inserts businesses"  ON businesses FOR INSERT    TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates businesses"  ON businesses FOR UPDATE    TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes businesses"  ON businesses FOR DELETE    TO authenticated USING (auth.uid() = owner_id);


-- subscriptions
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_type             TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','pro','enterprise')),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','cancelled')),
  billing_cycle         TEXT CHECK (billing_cycle IN ('annual','quarterly')),
  amount_paid           NUMERIC DEFAULT 0,
  razorpay_customer_id  TEXT,
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  start_date            TIMESTAMPTZ DEFAULT now(),
  end_date              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription"   ON subscriptions FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "Users update own subscription" ON subscriptions FOR UPDATE TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));


-- client_relationships
CREATE TABLE client_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ca_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','inactive')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ca_profile_id, business_id)
);

ALTER TABLE client_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CAs view their relationships"   ON client_relationships FOR SELECT TO authenticated USING (ca_profile_id = auth.uid());
CREATE POLICY "CAs manage their relationships" ON client_relationships FOR ALL    TO authenticated
  USING (ca_profile_id = auth.uid()) WITH CHECK (ca_profile_id = auth.uid());


-- compliance_tasks (7-state workflow)
CREATE TABLE compliance_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  task_name             TEXT NOT NULL,
  task_type             TEXT NOT NULL DEFAULT 'GST',
  due_date              DATE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'created'
                          CHECK (status IN ('created','awaiting_documents','under_review','ready_to_file','filed','acknowledged','locked')),
  description           TEXT,
  priority              TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  approval_status       TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft','ca_reviewed','business_approved','locked')),
  approved_by           UUID REFERENCES profiles(id),
  approved_at           TIMESTAMPTZ,
  edited_by             UUID REFERENCES profiles(id),
  final_values          JSONB,
  responsible_ca_id     UUID REFERENCES profiles(id),
  ca_disclaimer_accepted BOOLEAN DEFAULT false,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

ALTER TABLE compliance_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views tasks"    ON compliance_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = compliance_tasks.business_id AND owner_id = auth.uid()));
CREATE POLICY "Owner inserts tasks"  ON compliance_tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE id = compliance_tasks.business_id AND owner_id = auth.uid()));
CREATE POLICY "Owner updates tasks"  ON compliance_tasks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = compliance_tasks.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE id = compliance_tasks.business_id AND owner_id = auth.uid()));
CREATE POLICY "Owner deletes tasks"  ON compliance_tasks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = compliance_tasks.business_id AND owner_id = auth.uid()));
CREATE POLICY "CA views client tasks" ON compliance_tasks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM client_relationships
    WHERE ca_profile_id = auth.uid() AND business_id = compliance_tasks.business_id AND status = 'active'
  ));
CREATE POLICY "CA updates client tasks" ON compliance_tasks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM client_relationships
    WHERE ca_profile_id = auth.uid() AND business_id = compliance_tasks.business_id AND status = 'active'
  ));


-- documents
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT,              -- legacy; nullable
  storage_path    TEXT,              -- canonical path for signed URLs
  file_type       TEXT NOT NULL,
  file_size       BIGINT,
  category        TEXT,
  version_number  INTEGER DEFAULT 1,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at     TIMESTAMPTZ DEFAULT now(),
  description     TEXT,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES profiles(id)
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views docs"    ON documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = documents.business_id AND owner_id = auth.uid()));
CREATE POLICY "Owner uploads docs"  ON documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM businesses WHERE id = documents.business_id AND owner_id = auth.uid()) AND auth.uid() = uploaded_by);
CREATE POLICY "Owner deletes docs"  ON documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses WHERE id = documents.business_id AND owner_id = auth.uid()));
CREATE POLICY "CA views client docs" ON documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM client_relationships
    WHERE ca_profile_id = auth.uid() AND business_id = documents.business_id AND status = 'active'
  ));


-- document_versions
CREATE TABLE document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  file_name       TEXT NOT NULL,
  file_url        TEXT,
  storage_path    TEXT,
  file_size       BIGINT,
  metadata        JSONB,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views doc versions" ON document_versions FOR SELECT TO authenticated
  USING (document_id IN (
    SELECT d.id FROM documents d JOIN businesses b ON b.id = d.business_id WHERE b.owner_id = auth.uid()
  ));
CREATE POLICY "CA views doc versions" ON document_versions FOR SELECT TO authenticated
  USING (document_id IN (
    SELECT d.id FROM documents d
    JOIN client_relationships cr ON cr.business_id = d.business_id
    WHERE cr.ca_profile_id = auth.uid() AND cr.status = 'active'
  ));
CREATE POLICY "Users create doc versions" ON document_versions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());


-- audit_logs
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,   -- nullable: CA/admin actions
  user_id      UUID NOT NULL REFERENCES profiles(id),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('document','task','compliance','subscription','profile','business','client_relationship')),
  entity_id    UUID NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('created','updated','deleted','uploaded','downloaded','edited','exported','completed','ca_verification','linked','unlinked','approved','locked')),
  old_value    JSONB,
  new_value    JSONB,
  description  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view audit logs for their business" ON audit_logs FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM client_relationships WHERE ca_profile_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Users create audit logs" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- storage_usage
CREATE TABLE storage_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  used_mb      NUMERIC DEFAULT 0,
  total_mb     NUMERIC DEFAULT 100,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views storage" ON storage_usage FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));


-- whatsapp_credits
CREATE TABLE whatsapp_credits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  credits_remaining INTEGER DEFAULT 50,
  credits_total     INTEGER DEFAULT 50,
  last_topup_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views WA credits" ON whatsapp_credits FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "Owner updates WA credits" ON whatsapp_credits FOR UPDATE TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));


-- notifications
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN (
    'deadline_approaching','document_uploaded','task_completed',
    'task_status_changed','limit_warning','approval_requested','approval_granted','system'
  )),
  title        TEXT NOT NULL,
  message      TEXT,
  is_read      BOOLEAN DEFAULT false,
  metadata     JSONB,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications"   ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "System creates notifications"   ON notifications FOR INSERT TO authenticated WITH CHECK (true);


-- error_logs
CREATE TABLE error_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES profiles(id),
  action         TEXT NOT NULL,
  error_message  TEXT NOT NULL,
  error_stack    TEXT,
  metadata       JSONB,
  severity       TEXT DEFAULT 'error' CHECK (severity IN ('info','warning','error','critical')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create error logs" ON error_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins view error logs"  ON error_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));


-- compliance_templates
CREATE TABLE compliance_templates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name            TEXT NOT NULL,
  task_type                TEXT NOT NULL,
  applicable_entity_types  TEXT[] DEFAULT '{}',
  frequency                TEXT NOT NULL CHECK (frequency IN ('monthly','quarterly','yearly')),
  due_day                  INTEGER NOT NULL DEFAULT 20,
  due_month                INTEGER,
  description              TEXT,
  priority                 TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  is_active                BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view templates" ON compliance_templates FOR SELECT TO authenticated USING (true);


-- role_permissions
CREATE TABLE role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role        TEXT NOT NULL,
  permission  TEXT NOT NULL,
  granted     BOOLEAN DEFAULT true,
  UNIQUE (role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view permissions" ON role_permissions FOR SELECT TO authenticated USING (true);


-- audit_trail (field-level)
CREATE TABLE audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  field_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_by      UUID REFERENCES profiles(id),
  changed_at      TIMESTAMPTZ DEFAULT now(),
  change_context  TEXT
);

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit trail"   ON audit_trail FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));
CREATE POLICY "Owners view own audit trail" ON audit_trail FOR SELECT TO authenticated
  USING (
    record_id IN (SELECT ct.id FROM compliance_tasks ct JOIN businesses b ON b.id = ct.business_id WHERE b.owner_id = auth.uid())
    OR record_id IN (SELECT d.id FROM documents d JOIN businesses b ON b.id = d.business_id WHERE b.owner_id = auth.uid())
  );
CREATE POLICY "System inserts audit trail" ON audit_trail FOR INSERT TO authenticated WITH CHECK (true);


-- business_members
CREATE TABLE business_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES profiles(id),
  email          TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner','manager','employee','viewer')),
  invite_status  TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending','accepted','rejected','revoked')),
  invited_by     UUID NOT NULL REFERENCES profiles(id),
  invited_at     TIMESTAMPTZ DEFAULT now(),
  accepted_at    TIMESTAMPTZ,
  permissions    JSONB DEFAULT '[]'::jsonb,
  UNIQUE (business_id, email)
);

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members policy" ON business_members FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR user_id = auth.uid());


-- whatsapp_logs
CREATE TABLE whatsapp_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES profiles(id),
  phone_number         TEXT,
  message_type         TEXT NOT NULL CHECK (message_type IN (
    'deadline_reminder','document_request','approval_notification','overdue_alert','welcome','custom'
  )),
  message_content      TEXT,
  template_id          TEXT,
  status               TEXT DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed')),
  external_message_id  TEXT,
  error_message        TEXT,
  sent_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views WA logs" ON whatsapp_logs FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
         OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));
CREATE POLICY "System creates WA logs" ON whatsapp_logs FOR INSERT TO authenticated WITH CHECK (true);


-- legal_acceptances
CREATE TABLE legal_acceptances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  disclaimer_type  TEXT NOT NULL CHECK (disclaimer_type IN (
    'terms_of_service','privacy_policy','data_accuracy','ca_responsibility','tax_submission_disclaimer'
  )),
  version          TEXT NOT NULL DEFAULT '1.0',
  accepted_at      TIMESTAMPTZ DEFAULT now(),
  ip_address       TEXT,
  user_agent       TEXT,
  UNIQUE (user_id, disclaimer_type, version)
);

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own acceptances"   ON legal_acceptances FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own acceptances" ON legal_acceptances FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


-- compliance_rules
CREATE TABLE compliance_rules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name                TEXT NOT NULL,
  rule_type                TEXT NOT NULL CHECK (rule_type IN ('anomaly','validation','suggestion','warning')),
  description              TEXT,
  condition_sql            TEXT,
  severity                 TEXT DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  applicable_task_types    TEXT[],
  is_active                BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view rules" ON compliance_rules FOR SELECT TO authenticated USING (true);


-- compliance_alerts
CREATE TABLE compliance_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rule_id           UUID REFERENCES compliance_rules(id),
  task_id           UUID REFERENCES compliance_tasks(id),
  alert_type        TEXT NOT NULL,
  severity          TEXT DEFAULT 'warning',
  title             TEXT NOT NULL,
  description       TEXT,
  suggested_action  TEXT,
  is_resolved       BOOLEAN DEFAULT false,
  resolved_by       UUID REFERENCES profiles(id),
  resolved_at       TIMESTAMPTZ,
  metadata          JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/CA/Admin views alerts" ON compliance_alerts FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM client_relationships WHERE ca_profile_id = auth.uid() AND status = 'active')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
CREATE POLICY "System manages alerts" ON compliance_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- filing_exports
CREATE TABLE filing_exports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES compliance_tasks(id),
  export_type   TEXT NOT NULL CHECK (export_type IN ('GSTR1_JSON','GSTR3B_JSON','TDS_CSV','CUSTOM')),
  file_name     TEXT NOT NULL,
  storage_path  TEXT,
  export_data   JSONB,
  status        TEXT DEFAULT 'generated' CHECK (status IN ('generating','generated','downloaded','filed')),
  generated_by  UUID NOT NULL REFERENCES profiles(id),
  generated_at  TIMESTAMPTZ DEFAULT now(),
  downloaded_at TIMESTAMPTZ,
  filed_at      TIMESTAMPTZ
);

ALTER TABLE filing_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner/CA views filing exports" ON filing_exports FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM client_relationships WHERE ca_profile_id = auth.uid() AND status = 'active')
  );


-- ────────────────────────────────────────────────────────────────────────────────
-- STEP 3 — INDEXES
-- ────────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_businesses_owner_id             ON businesses(owner_id);
CREATE INDEX idx_businesses_name_trgm            ON businesses USING gin(business_name gin_trgm_ops);
CREATE INDEX idx_businesses_gstin                ON businesses(gstin) WHERE gstin IS NOT NULL;
CREATE INDEX idx_subscriptions_business_id       ON subscriptions(business_id);
CREATE INDEX idx_client_relationships_ca         ON client_relationships(ca_profile_id);
CREATE INDEX idx_client_relationships_business   ON client_relationships(business_id);
CREATE INDEX idx_compliance_tasks_business_id    ON compliance_tasks(business_id);
CREATE INDEX idx_compliance_tasks_due_date       ON compliance_tasks(due_date);
CREATE INDEX idx_compliance_tasks_status         ON compliance_tasks(status);
CREATE INDEX idx_compliance_tasks_type           ON compliance_tasks(task_type);
CREATE INDEX idx_compliance_tasks_approval       ON compliance_tasks(approval_status);
CREATE INDEX idx_compliance_tasks_name_trgm      ON compliance_tasks USING gin(task_name gin_trgm_ops);
CREATE INDEX idx_tasks_active                    ON compliance_tasks(business_id, due_date) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_tasks_unique_per_business ON compliance_tasks(business_id, task_name, due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_business_id           ON documents(business_id);
CREATE INDEX idx_documents_uploaded_by           ON documents(uploaded_by);
CREATE INDEX idx_documents_category              ON documents(category);
CREATE INDEX idx_documents_storage_path          ON documents(storage_path);
CREATE INDEX idx_documents_filename_trgm         ON documents USING gin(file_name gin_trgm_ops);
CREATE INDEX idx_documents_active                ON documents(business_id, uploaded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_monthly_count         ON documents(business_id, uploaded_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_documents_unique_path    ON documents(business_id, storage_path) WHERE storage_path IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_document_versions_document_id   ON document_versions(document_id);
CREATE INDEX idx_audit_logs_business_id          ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_entity               ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_storage_usage_business          ON storage_usage(business_id);
CREATE INDEX idx_whatsapp_credits_business       ON whatsapp_credits(business_id);
CREATE INDEX idx_notifications_user_id           ON notifications(user_id);
CREATE INDEX idx_notifications_unread            ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_business_id       ON notifications(business_id);
CREATE INDEX idx_error_logs_severity             ON error_logs(severity);
CREATE INDEX idx_error_logs_created_at           ON error_logs(created_at DESC);
CREATE INDEX idx_compliance_templates_type       ON compliance_templates(task_type);
CREATE INDEX idx_audit_trail_table_record        ON audit_trail(table_name, record_id);
CREATE INDEX idx_audit_trail_changed_at          ON audit_trail(changed_at DESC);
CREATE INDEX idx_business_members_business       ON business_members(business_id);
CREATE INDEX idx_business_members_user           ON business_members(user_id);
CREATE INDEX idx_whatsapp_logs_business          ON whatsapp_logs(business_id);
CREATE INDEX idx_whatsapp_logs_status            ON whatsapp_logs(status);
CREATE INDEX idx_compliance_alerts_business      ON compliance_alerts(business_id);
CREATE INDEX idx_compliance_alerts_unresolved    ON compliance_alerts(business_id) WHERE is_resolved = false;


-- ────────────────────────────────────────────────────────────────────────────────
-- STEP 4 — FUNCTIONS
-- ────────────────────────────────────────────────────────────────────────────────

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at         BEFORE UPDATE ON profiles          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at        BEFORE UPDATE ON businesses         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_tasks_updated_at  BEFORE UPDATE ON compliance_tasks   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Sanitize text
CREATE OR REPLACE FUNCTION sanitize_text(input TEXT) RETURNS TEXT AS $$
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  input := regexp_replace(input, '<[^>]*>', '', 'g');
  input := replace(input, chr(0), '');
  input := regexp_replace(input, '[\x01-\x08\x0B\x0C\x0E-\x1F]', '', 'g');
  input := trim(input);
  RETURN input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Sanitize filename
CREATE OR REPLACE FUNCTION sanitize_filename(input TEXT) RETURNS TEXT AS $$
BEGIN
  IF input IS NULL THEN RETURN 'unnamed_file'; END IF;
  input := regexp_replace(input, '[^a-zA-Z0-9._\- ]', '_', 'g');
  input := regexp_replace(input, '_{2,}', '_', 'g');
  input := trim(both '_' from input);
  IF length(input) = 0 THEN input := 'unnamed_file'; END IF;
  IF length(input) > 255 THEN input := left(input, 255); END IF;
  RETURN input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- State machine: validate_task_transition
-- Includes owner shortcut: any active state → acknowledged ("Mark Done")
CREATE OR REPLACE FUNCTION validate_task_transition(old_status TEXT, new_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF old_status = new_status THEN RETURN true; END IF;
  RETURN CASE
    WHEN old_status = 'created'            AND new_status = 'awaiting_documents' THEN true
    WHEN old_status = 'awaiting_documents' AND new_status = 'under_review'       THEN true
    WHEN old_status = 'under_review'       AND new_status = 'ready_to_file'      THEN true
    WHEN old_status = 'ready_to_file'      AND new_status = 'filed'              THEN true
    WHEN old_status = 'filed'              AND new_status = 'acknowledged'       THEN true
    WHEN old_status = 'acknowledged'       AND new_status = 'locked'             THEN true
    -- Owner shortcut: any active → acknowledged
    WHEN old_status IN ('created','awaiting_documents','under_review','ready_to_file')
         AND new_status = 'acknowledged'                                          THEN true
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Trigger: validate task status transitions
CREATE OR REPLACE FUNCTION trigger_validate_task_status() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot modify a locked task (task_id: %)', OLD.id;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT validate_task_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid task status transition: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_task_status_trigger
  BEFORE UPDATE ON compliance_tasks FOR EACH ROW EXECUTE FUNCTION trigger_validate_task_status();


-- Trigger: prevent edits on locked approval_status
CREATE OR REPLACE FUNCTION trigger_prevent_locked_approval_edit() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status = 'locked' THEN
    IF (OLD.final_values IS DISTINCT FROM NEW.final_values)
       OR (OLD.description IS DISTINCT FROM NEW.description) THEN
      RAISE EXCEPTION 'Cannot edit data on a locked task (task_id: %)', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_locked_approval_edit_trigger
  BEFORE UPDATE ON compliance_tasks FOR EACH ROW EXECUTE FUNCTION trigger_prevent_locked_approval_edit();


-- Trigger: on document upload
CREATE OR REPLACE FUNCTION trigger_on_document_upload() RETURNS TRIGGER AS $$
DECLARE v_task RECORD; v_ca_id UUID; v_file_size_mb NUMERIC;
BEGIN
  v_file_size_mb := COALESCE(NEW.file_size, 0) / (1024.0 * 1024.0);
  UPDATE storage_usage SET used_mb = used_mb + v_file_size_mb, updated_at = now()
  WHERE business_id = NEW.business_id;

  FOR v_task IN
    SELECT id, task_name FROM compliance_tasks
    WHERE business_id = NEW.business_id AND status = 'created'
    ORDER BY due_date ASC LIMIT 1
  LOOP
    UPDATE compliance_tasks SET status = 'awaiting_documents' WHERE id = v_task.id;
    INSERT INTO audit_logs (business_id, user_id, entity_type, entity_id, action, description)
    VALUES (NEW.business_id, NEW.uploaded_by, 'task', v_task.id, 'updated',
      'Task "' || v_task.task_name || '" auto-transitioned to awaiting_documents');
  END LOOP;

  SELECT cr.ca_profile_id INTO v_ca_id FROM client_relationships cr
  WHERE cr.business_id = NEW.business_id AND cr.status = 'active' LIMIT 1;

  IF v_ca_id IS NOT NULL THEN
    INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
    VALUES (NEW.business_id, v_ca_id, 'document_uploaded', 'New Document Uploaded',
      'Document "' || NEW.file_name || '" has been uploaded.',
      jsonb_build_object('document_id', NEW.id, 'file_name', NEW.file_name, 'category', NEW.category));
  END IF;

  INSERT INTO audit_logs (business_id, user_id, entity_type, entity_id, action, description)
  VALUES (NEW.business_id, NEW.uploaded_by, 'document', NEW.id, 'uploaded',
    'Document "' || NEW.file_name || '" uploaded to ' || COALESCE(NEW.category, 'General'));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_document_upload_trigger
  AFTER INSERT ON documents FOR EACH ROW EXECUTE FUNCTION trigger_on_document_upload();


-- Trigger: on task status change
CREATE OR REPLACE FUNCTION trigger_on_task_status_change() RETURNS TRIGGER AS $$
DECLARE v_owner_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT b.owner_id INTO v_owner_id FROM businesses b WHERE b.id = NEW.business_id;

  IF NEW.status = 'acknowledged' THEN
    INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
    VALUES (NEW.business_id, v_owner_id, 'task_completed', 'Task Completed: ' || NEW.task_name,
      'Task "' || NEW.task_name || '" has been filed and acknowledged.',
      jsonb_build_object('task_id', NEW.id, 'task_name', NEW.task_name));
  END IF;

  IF NEW.status = 'locked' THEN
    UPDATE compliance_tasks SET approval_status = 'locked', approved_at = now()
    WHERE id = NEW.id AND approval_status != 'locked';
  END IF;

  INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
  VALUES (NEW.business_id, v_owner_id, 'task_status_changed', 'Task Updated: ' || NEW.task_name,
    'Status changed from "' || OLD.status || '" to "' || NEW.status || '"',
    jsonb_build_object('task_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status));

  INSERT INTO audit_logs (business_id, user_id, entity_type, entity_id, action, old_value, new_value, description)
  VALUES (NEW.business_id, COALESCE(NEW.edited_by, v_owner_id), 'task', NEW.id, 'updated',
    jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status),
    'Task "' || NEW.task_name || '" status: ' || OLD.status || ' → ' || NEW.status);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_status_change_trigger
  AFTER UPDATE ON compliance_tasks FOR EACH ROW EXECUTE FUNCTION trigger_on_task_status_change();


-- Field-level audit trail trigger
CREATE OR REPLACE FUNCTION trigger_audit_trail() RETURNS TRIGGER AS $$
DECLARE col TEXT; old_val TEXT; new_val TEXT; v_user_id UUID;
BEGIN
  v_user_id := COALESCE(current_setting('app.current_user_id', true)::UUID, auth.uid());
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_name = TG_TABLE_NAME
      AND column_name NOT IN ('id','created_at','updated_at','deleted_at','deleted_by')
      AND data_type NOT IN ('jsonb','json')
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

CREATE TRIGGER audit_trail_compliance_tasks AFTER UPDATE ON compliance_tasks FOR EACH ROW EXECUTE FUNCTION trigger_audit_trail();
CREATE TRIGGER audit_trail_documents        AFTER UPDATE ON documents         FOR EACH ROW EXECUTE FUNCTION trigger_audit_trail();


-- validate_ca_access
CREATE OR REPLACE FUNCTION validate_ca_access(p_user_id UUID, p_business_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_user_type TEXT;
BEGIN
  SELECT user_type INTO v_user_type FROM profiles WHERE id = p_user_id;
  IF v_user_type = 'admin' THEN RETURN true; END IF;
  IF v_user_type = 'business_owner' THEN
    RETURN EXISTS (SELECT 1 FROM businesses WHERE id = p_business_id AND owner_id = p_user_id);
  END IF;
  IF v_user_type = 'chartered_accountant' THEN
    RETURN EXISTS (SELECT 1 FROM client_relationships
      WHERE ca_profile_id = p_user_id AND business_id = p_business_id AND status = 'active');
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;


-- validate_ca_verified
CREATE OR REPLACE FUNCTION validate_ca_verified(p_ca_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT ca_verification_status INTO v_status FROM profiles WHERE id = p_ca_id AND user_type = 'chartered_accountant';
  RETURN v_status = 'verified';
END;
$$ LANGUAGE plpgsql STABLE;


-- admin_verify_ca
CREATE OR REPLACE FUNCTION admin_verify_ca(p_admin_id UUID, p_ca_id UUID, p_action TEXT)
RETURNS JSONB AS $$
DECLARE v_admin_type TEXT;
BEGIN
  SELECT user_type INTO v_admin_type FROM profiles WHERE id = p_admin_id;
  IF v_admin_type != 'admin' THEN RETURN jsonb_build_object('success', false, 'error', 'Admin access required'); END IF;
  IF p_action NOT IN ('verify','reject') THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid action'); END IF;
  UPDATE profiles SET
    ca_verification_status = CASE WHEN p_action = 'verify' THEN 'verified' ELSE 'rejected' END,
    ca_verified_at = now(), ca_verified_by = p_admin_id
  WHERE id = p_ca_id AND user_type = 'chartered_accountant';
  INSERT INTO audit_logs (user_id, entity_type, entity_id, action, description)
  VALUES (p_admin_id, 'profile', p_ca_id, 'ca_verification', 'CA ' || p_action || 'd by admin');
  RETURN jsonb_build_object('success', true, 'action', p_action, 'ca_id', p_ca_id);
END;
$$ LANGUAGE plpgsql;


-- check_permission
CREATE OR REPLACE FUNCTION check_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_user_type TEXT; v_granted BOOLEAN;
BEGIN
  SELECT user_type INTO v_user_type FROM profiles WHERE id = p_user_id;
  IF v_user_type IS NULL THEN RETURN false; END IF;
  SELECT granted INTO v_granted FROM role_permissions WHERE role = v_user_type AND permission = p_permission;
  RETURN COALESCE(v_granted, false);
END;
$$ LANGUAGE plpgsql STABLE;


-- check_storage_limit
CREATE OR REPLACE FUNCTION check_storage_limit(p_business_id UUID, p_file_size_bytes BIGINT)
RETURNS JSONB AS $$
DECLARE v_used_mb NUMERIC; v_total_mb NUMERIC; v_new_size_mb NUMERIC;
BEGIN
  v_new_size_mb := p_file_size_bytes / (1024.0 * 1024.0);
  SELECT used_mb, total_mb INTO v_used_mb, v_total_mb FROM storage_usage WHERE business_id = p_business_id;
  IF v_total_mb IS NULL THEN v_used_mb := 0; v_total_mb := 100; END IF;
  IF (v_used_mb + v_new_size_mb) > v_total_mb THEN
    RETURN jsonb_build_object('allowed', false, 'used_mb', round(v_used_mb,2), 'total_mb', v_total_mb,
      'message', 'Storage limit exceeded. Used: ' || round(v_used_mb,1) || 'MB of ' || v_total_mb || 'MB');
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used_mb', round(v_used_mb,2), 'total_mb', v_total_mb,
    'remaining_mb', round(v_total_mb - v_used_mb - v_new_size_mb, 2));
END;
$$ LANGUAGE plpgsql STABLE;


-- check_whatsapp_limit
CREATE OR REPLACE FUNCTION check_whatsapp_limit(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE v_remaining INTEGER; v_total INTEGER;
BEGIN
  SELECT credits_remaining, credits_total INTO v_remaining, v_total FROM whatsapp_credits WHERE business_id = p_business_id;
  IF COALESCE(v_remaining, 0) <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', COALESCE(v_remaining,0), 'total', COALESCE(v_total,0),
      'message', 'No WhatsApp credits remaining.');
  END IF;
  RETURN jsonb_build_object('allowed', true, 'remaining', v_remaining, 'total', v_total);
END;
$$ LANGUAGE plpgsql STABLE;


-- deduct_whatsapp_credit
CREATE OR REPLACE FUNCTION deduct_whatsapp_credit(p_business_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_remaining INTEGER;
BEGIN
  SELECT credits_remaining INTO v_remaining FROM whatsapp_credits WHERE business_id = p_business_id;
  IF COALESCE(v_remaining, 0) <= 0 THEN RETURN false; END IF;
  UPDATE whatsapp_credits SET credits_remaining = credits_remaining - 1, updated_at = now()
  WHERE business_id = p_business_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql;


-- transition_task_status (secured RPC — called from client via supabase.rpc)
CREATE OR REPLACE FUNCTION transition_task_status(p_task_id UUID, p_new_status TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE v_task RECORD;
BEGIN
  SELECT * INTO v_task FROM compliance_tasks WHERE id = p_task_id;
  IF v_task IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Task not found'); END IF;
  IF NOT validate_ca_access(p_user_id, v_task.business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF NOT validate_task_transition(v_task.status, p_new_status) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid transition: ' || v_task.status || ' → ' || p_new_status,
      'current_status', v_task.status);
  END IF;
  BEGIN
    UPDATE compliance_tasks SET status = p_new_status, edited_by = p_user_id,
      completed_at = CASE WHEN p_new_status IN ('acknowledged','locked') THEN now() ELSE completed_at END
    WHERE id = p_task_id;
    RETURN jsonb_build_object('success', true, 'task_id', p_task_id,
      'old_status', v_task.status, 'new_status', p_new_status);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql;


-- secure_upload_document
CREATE OR REPLACE FUNCTION secure_upload_document(
  p_user_id UUID, p_business_id UUID, p_file_name TEXT, p_storage_path TEXT,
  p_file_type TEXT, p_file_size BIGINT, p_category TEXT DEFAULT 'General'
)
RETURNS JSONB AS $$
DECLARE v_storage_check JSONB; v_doc_id UUID; v_sanitized_name TEXT;
BEGIN
  IF NOT validate_ca_access(p_user_id, p_business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  IF NOT check_permission(p_user_id, 'upload_document') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No upload permission');
  END IF;
  v_storage_check := check_storage_limit(p_business_id, p_file_size);
  IF NOT (v_storage_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object('success', false, 'error', v_storage_check->>'message', 'limit_exceeded', true);
  END IF;
  v_sanitized_name := sanitize_text(p_file_name);
  BEGIN
    INSERT INTO documents (business_id, file_name, storage_path, file_type, file_size, category, uploaded_by, version_number)
    VALUES (p_business_id, v_sanitized_name, p_storage_path, p_file_type, p_file_size, p_category, p_user_id, 1)
    RETURNING id INTO v_doc_id;
    INSERT INTO document_versions (document_id, version_number, file_name, storage_path, file_size, created_by, metadata)
    VALUES (v_doc_id, 1, v_sanitized_name, p_storage_path, p_file_size, p_user_id, '{"original_upload":true}'::jsonb);
    RETURN jsonb_build_object('success', true, 'document_id', v_doc_id);
  EXCEPTION
    WHEN unique_violation THEN RETURN jsonb_build_object('success', false, 'error', 'Duplicate file at this path');
    WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql;


-- optimistic_update_task
CREATE OR REPLACE FUNCTION optimistic_update_task(
  p_task_id UUID, p_user_id UUID, p_expected_updated_at TIMESTAMPTZ,
  p_final_values JSONB DEFAULT NULL, p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE v_task RECORD; v_rows INTEGER;
BEGIN
  SELECT * INTO v_task FROM compliance_tasks WHERE id = p_task_id;
  IF v_task IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Task not found'); END IF;
  IF v_task.updated_at > p_expected_updated_at THEN
    RETURN jsonb_build_object('success', false, 'conflict', true,
      'error', 'Task was modified by another user. Please refresh.');
  END IF;
  IF NOT validate_ca_access(p_user_id, v_task.business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  UPDATE compliance_tasks
  SET final_values = COALESCE(p_final_values, final_values),
      description = COALESCE(p_description, description),
      edited_by = p_user_id, updated_at = now()
  WHERE id = p_task_id AND updated_at = p_expected_updated_at;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'conflict', true, 'error', 'Concurrent modification detected.');
  END IF;
  RETURN jsonb_build_object('success', true, 'task_id', p_task_id);
END;
$$ LANGUAGE plpgsql;


-- validate_document_access
CREATE OR REPLACE FUNCTION validate_document_access(p_user_id UUID, p_document_id UUID)
RETURNS JSONB AS $$
DECLARE v_doc RECORD;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_doc IS NULL THEN RETURN jsonb_build_object('allowed', false, 'error', 'Document not found'); END IF;
  IF NOT validate_ca_access(p_user_id, v_doc.business_id) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Access denied');
  END IF;
  RETURN jsonb_build_object('allowed', true, 'storage_path', v_doc.storage_path, 'file_name', v_doc.file_name);
END;
$$ LANGUAGE plpgsql STABLE;


-- soft_delete
CREATE OR REPLACE FUNCTION soft_delete(p_table_name TEXT, p_record_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE v_rows INTEGER;
BEGIN
  IF p_table_name = 'documents' AND NOT check_permission(p_user_id, 'delete_document') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No delete permission');
  END IF;
  EXECUTE format('UPDATE %I SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL', p_table_name)
  USING p_user_id, p_record_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Record not found or already deleted'); END IF;
  RETURN jsonb_build_object('success', true, 'deleted', p_record_id);
END;
$$ LANGUAGE plpgsql;


-- soft_restore
CREATE OR REPLACE FUNCTION soft_restore(p_table_name TEXT, p_record_id UUID)
RETURNS JSONB AS $$
DECLARE v_rows INTEGER;
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL', p_table_name)
  USING p_record_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Record not found or not deleted'); END IF;
  RETURN jsonb_build_object('success', true, 'restored', p_record_id);
END;
$$ LANGUAGE plpgsql;


-- check_deadlines
CREATE OR REPLACE FUNCTION check_deadlines(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE v_task RECORD; v_owner_id UUID; v_warnings INTEGER := 0; v_overdue INTEGER := 0;
BEGIN
  FOR v_task IN
    SELECT ct.id, ct.task_name, ct.business_id, ct.due_date FROM compliance_tasks ct
    WHERE ct.status NOT IN ('acknowledged','locked','filed')
      AND ct.due_date = target_date + INTERVAL '3 days' AND ct.deleted_at IS NULL
  LOOP
    SELECT b.owner_id INTO v_owner_id FROM businesses b WHERE b.id = v_task.business_id;
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_owner_id AND type = 'deadline_approaching'
        AND metadata->>'task_id' = v_task.id::TEXT AND created_at::DATE = target_date) THEN
      INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
      VALUES (v_task.business_id, v_owner_id, 'deadline_approaching',
        'Deadline in 3 days: ' || v_task.task_name,
        'Task "' || v_task.task_name || '" is due on ' || v_task.due_date,
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date));
      v_warnings := v_warnings + 1;
    END IF;
  END LOOP;
  FOR v_task IN
    SELECT ct.id, ct.task_name, ct.business_id, ct.due_date FROM compliance_tasks ct
    WHERE ct.status IN ('created','awaiting_documents','under_review','ready_to_file')
      AND ct.due_date < target_date AND ct.deleted_at IS NULL
  LOOP
    SELECT b.owner_id INTO v_owner_id FROM businesses b WHERE b.id = v_task.business_id;
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_owner_id AND type = 'deadline_approaching'
        AND metadata->>'task_id' = v_task.id::TEXT AND metadata->>'overdue' = 'true'
        AND created_at::DATE = target_date) THEN
      INSERT INTO notifications (business_id, user_id, type, title, message, metadata)
      VALUES (v_task.business_id, v_owner_id, 'deadline_approaching',
        'OVERDUE: ' || v_task.task_name,
        'Task "' || v_task.task_name || '" was due on ' || v_task.due_date || ' and is overdue!',
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date, 'overdue', 'true'));
      v_overdue := v_overdue + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'target_date', target_date, 'warnings_sent', v_warnings, 'overdue_notified', v_overdue);
END;
$$ LANGUAGE plpgsql;


-- generate_compliance_tasks
CREATE OR REPLACE FUNCTION generate_compliance_tasks(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  v_template RECORD; v_business RECORD; v_due_date DATE;
  v_created INTEGER := 0; v_skipped INTEGER := 0;
  v_month INTEGER; v_year INTEGER; v_existing INTEGER;
BEGIN
  v_month := EXTRACT(MONTH FROM target_date);
  v_year  := EXTRACT(YEAR  FROM target_date);
  FOR v_template IN SELECT * FROM compliance_templates WHERE is_active = true LOOP
    CASE v_template.frequency
      WHEN 'monthly' THEN
        v_due_date := make_date(v_year, v_month, LEAST(v_template.due_day, 28));
        IF v_due_date < target_date - INTERVAL '5 days' THEN v_due_date := v_due_date + INTERVAL '1 month'; END IF;
      WHEN 'quarterly' THEN
        IF v_template.due_month IS NOT NULL AND v_month = v_template.due_month THEN
          v_due_date := make_date(v_year, v_template.due_month, LEAST(v_template.due_day, 28));
        ELSE CONTINUE; END IF;
      WHEN 'yearly' THEN
        IF v_template.due_month IS NOT NULL AND v_month = v_template.due_month THEN
          v_due_date := make_date(v_year, v_template.due_month, LEAST(v_template.due_day, 28));
        ELSE CONTINUE; END IF;
    END CASE;
    FOR v_business IN
      SELECT b.id FROM businesses b
      WHERE b.business_type = ANY(v_template.applicable_entity_types)
         OR array_length(v_template.applicable_entity_types, 1) IS NULL
    LOOP
      SELECT COUNT(*) INTO v_existing FROM compliance_tasks
      WHERE business_id = v_business.id AND task_name = v_template.template_name AND due_date = v_due_date;
      IF v_existing = 0 THEN
        INSERT INTO compliance_tasks (business_id, task_name, task_type, due_date, status, description, priority, approval_status)
        VALUES (v_business.id, v_template.template_name, v_template.task_type, v_due_date, 'created',
          v_template.description, v_template.priority, 'draft');
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'tasks_created', v_created, 'tasks_skipped', v_skipped);
END;
$$ LANGUAGE plpgsql;


-- evaluate_compliance_rules
CREATE OR REPLACE FUNCTION evaluate_compliance_rules(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE v_rule RECORD; v_alerts INTEGER := 0;
BEGIN
  INSERT INTO compliance_alerts (business_id, alert_type, severity, title, description, suggested_action, metadata)
  SELECT p_business_id, 'late_filing_risk', 'warning',
    'Late Filing Risk: ' || ct.task_name,
    'Task "' || ct.task_name || '" due ' || ct.due_date || ' is in "' || ct.status || '" state.',
    'Advance task to filing stage.',
    jsonb_build_object('task_id', ct.id, 'due_date', ct.due_date, 'status', ct.status)
  FROM compliance_tasks ct
  WHERE ct.business_id = p_business_id
    AND ct.due_date < CURRENT_DATE + INTERVAL '3 days'
    AND ct.status NOT IN ('acknowledged','locked','filed')
    AND ct.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM compliance_alerts ca
      WHERE ca.task_id = ct.id AND ca.alert_type = 'late_filing_risk' AND ca.is_resolved = false
    );
  GET DIAGNOSTICS v_alerts = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'alerts_created', v_alerts);
END;
$$ LANGUAGE plpgsql;


-- system_health_check
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS JSONB AS $$
DECLARE
  v_users INTEGER; v_subs INTEGER; v_docs INTEGER; v_tasks INTEGER;
  v_errors INTEGER; v_critical INTEGER; v_overdue INTEGER; v_storage NUMERIC; v_status TEXT;
BEGIN
  SELECT COUNT(*) INTO v_users  FROM profiles;
  SELECT COUNT(*) INTO v_subs   FROM subscriptions WHERE status = 'active';
  SELECT COUNT(*) INTO v_docs   FROM documents WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_tasks  FROM compliance_tasks WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_errors   FROM error_logs WHERE created_at > now() - INTERVAL '24 hours';
  SELECT COUNT(*) INTO v_critical FROM error_logs WHERE created_at > now() - INTERVAL '24 hours' AND severity = 'critical';
  SELECT COUNT(*) INTO v_overdue  FROM compliance_tasks
    WHERE due_date < CURRENT_DATE AND status NOT IN ('acknowledged','locked','filed') AND deleted_at IS NULL;
  SELECT COALESCE(AVG(used_mb / NULLIF(total_mb,0) * 100), 0) INTO v_storage FROM storage_usage;
  v_status := CASE WHEN v_critical > 10 THEN 'critical' WHEN v_critical > 0 OR v_errors > 100 THEN 'degraded' ELSE 'healthy' END;
  RETURN jsonb_build_object('status', v_status, 'checked_at', now(),
    'metrics', jsonb_build_object('total_users', v_users, 'active_subscriptions', v_subs,
      'total_documents', v_docs, 'total_tasks', v_tasks, 'overdue_tasks', v_overdue,
      'errors_24h', v_errors, 'critical_errors_24h', v_critical, 'avg_storage_pct', round(v_storage,1)));
END;
$$ LANGUAGE plpgsql STABLE;


-- invite_team_member
CREATE OR REPLACE FUNCTION invite_team_member(p_business_id UUID, p_inviter_id UUID, p_email TEXT, p_role TEXT DEFAULT 'employee')
RETURNS JSONB AS $$
DECLARE v_is_owner BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM businesses WHERE id = p_business_id AND owner_id = p_inviter_id) INTO v_is_owner;
  IF NOT v_is_owner THEN RETURN jsonb_build_object('success', false, 'error', 'Only owners can invite members'); END IF;
  IF EXISTS (SELECT 1 FROM business_members WHERE business_id = p_business_id AND email = p_email AND invite_status != 'revoked') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already invited');
  END IF;
  INSERT INTO business_members (business_id, email, role, invited_by) VALUES (p_business_id, p_email, p_role, p_inviter_id);
  RETURN jsonb_build_object('success', true, 'message', 'Invitation sent to ' || p_email);
END;
$$ LANGUAGE plpgsql;


-- paginated_query helper
CREATE OR REPLACE FUNCTION paginated_query(
  p_table TEXT, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 20,
  p_order_by TEXT DEFAULT 'created_at', p_order_dir TEXT DEFAULT 'DESC', p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE v_offset INTEGER; v_total INTEGER; v_pages INTEGER;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE deleted_at IS NULL', p_table) INTO v_total;
  v_pages := CEIL(v_total::NUMERIC / p_page_size);
  RETURN jsonb_build_object('page', p_page, 'page_size', p_page_size, 'total_records', v_total,
    'total_pages', v_pages, 'has_next', p_page < v_pages, 'has_prev', p_page > 1);
END;
$$ LANGUAGE plpgsql STABLE;


-- ────────────────────────────────────────────────────────────────────────────────
-- STEP 5 — SEED DATA
-- ────────────────────────────────────────────────────────────────────────────────

INSERT INTO compliance_templates (template_name, task_type, applicable_entity_types, frequency, due_day, due_month, description, priority) VALUES
  ('GSTR-1',          'GST',          ARRAY['proprietorship','pvt_ltd','llp','partnership'], 'monthly',   11, NULL, 'Monthly return for outward supplies',             'high'),
  ('GSTR-3B',         'GST',          ARRAY['proprietorship','pvt_ltd','llp','partnership'], 'monthly',   20, NULL, 'Monthly summary return and tax payment',           'high'),
  ('GSTR-9',          'GST',          ARRAY['proprietorship','pvt_ltd','llp','partnership'], 'yearly',    31, 12,   'Annual GST return',                               'high'),
  ('TDS Return - Q1', 'Income Tax',   ARRAY['pvt_ltd','llp','partnership'],                  'quarterly', 31, 7,    'TDS return for Apr-Jun quarter',                  'high'),
  ('TDS Return - Q2', 'Income Tax',   ARRAY['pvt_ltd','llp','partnership'],                  'quarterly', 31, 10,   'TDS return for Jul-Sep quarter',                  'high'),
  ('TDS Return - Q3', 'Income Tax',   ARRAY['pvt_ltd','llp','partnership'],                  'quarterly', 31, 1,    'TDS return for Oct-Dec quarter',                  'high'),
  ('TDS Return - Q4', 'Income Tax',   ARRAY['pvt_ltd','llp','partnership'],                  'quarterly', 31, 5,    'TDS return for Jan-Mar quarter',                  'high'),
  ('PF Monthly Return','PF',          ARRAY['pvt_ltd','llp','partnership'],                  'monthly',   15, NULL, 'Monthly PF contribution return',                  'medium'),
  ('ESI Monthly Return','ESI',        ARRAY['pvt_ltd','llp','partnership'],                  'monthly',   15, NULL, 'Monthly ESI contribution return',                 'medium'),
  ('Income Tax Return','Income Tax',  ARRAY['proprietorship','pvt_ltd','llp','partnership'], 'yearly',    31, 7,    'Annual income tax return filing',                 'high'),
  ('Tax Audit Report', 'Income Tax',  ARRAY['pvt_ltd','llp'],                                'yearly',    30, 9,    'Tax audit report for eligible businesses',        'high'),
  ('ROC Annual Return','ROC',         ARRAY['pvt_ltd','llp'],                                'yearly',    30, 11,   'Annual return filing with MCA',                   'medium'),
  ('DIR-3 KYC',        'ROC',         ARRAY['pvt_ltd'],                                      'yearly',    30, 9,    'Director KYC annual filing',                      'medium'),
  ('Professional Tax', 'State Tax',   ARRAY['proprietorship','pvt_ltd','llp','partnership'], 'monthly',   30, NULL, 'Monthly professional tax payment',                'low')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission, granted) VALUES
  ('business_owner',       'upload_document', true),
  ('business_owner',       'edit_data',       true),
  ('business_owner',       'approve_data',    true),
  ('business_owner',       'delete_document', true),
  ('business_owner',       'view_admin',      false),
  ('chartered_accountant', 'upload_document', true),
  ('chartered_accountant', 'edit_data',       true),
  ('chartered_accountant', 'approve_data',    false),
  ('chartered_accountant', 'delete_document', false),
  ('chartered_accountant', 'view_admin',      false),
  ('employee',             'upload_document', true),
  ('employee',             'edit_data',       false),
  ('employee',             'approve_data',    false),
  ('employee',             'delete_document', false),
  ('employee',             'view_admin',      false),
  ('admin',                'upload_document', true),
  ('admin',                'edit_data',       true),
  ('admin',                'approve_data',    true),
  ('admin',                'delete_document', true),
  ('admin',                'view_admin',      true)
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO compliance_rules (rule_name, rule_type, description, severity, applicable_task_types) VALUES
  ('GST Sales Mismatch',     'anomaly',    'Mismatch between reported sales and GST returns total',              'critical', ARRAY['GST']),
  ('ITC Claim Spike',        'anomaly',    'Input Tax Credit claim increased >50% from previous period',         'warning',  ARRAY['GST']),
  ('Late Filing Risk',       'warning',    'Task approaching due date with incomplete documents',                'warning',  ARRAY['GST','Income Tax','PF','ESI']),
  ('Missing Documents',      'validation', 'Required supporting documents not uploaded',                         'warning',  ARRAY['GST','Income Tax']),
  ('TDS Mismatch',           'anomaly',    'TDS deducted vs TDS deposited mismatch',                            'critical', ARRAY['Income Tax']),
  ('Revenue Under-Reporting','suggestion', 'Reported revenue significantly lower than bank transactions',        'warning',  ARRAY['GST','Income Tax']),
  ('PF Late Deposit',        'warning',    'PF contribution deposited after 15th of following month',           'critical', ARRAY['PF']),
  ('Duplicate Invoice',      'validation', 'Same invoice number appearing in multiple periods',                  'critical', ARRAY['GST'])
ON CONFLICT DO NOTHING;
