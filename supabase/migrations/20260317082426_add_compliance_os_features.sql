/*
  # Compliance Operating System - Enhanced Schema

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `plan_type` (text: 'free', 'pro', 'enterprise')
      - `status` (text: 'active', 'inactive', 'cancelled')
      - `billing_cycle` (text: 'annual', 'quarterly')
      - `amount_paid` (numeric)
      - `razorpay_customer_id` (text, nullable)
      - `razorpay_order_id` (text, nullable)
      - `razorpay_payment_id` (text, nullable)
      - `start_date` (timestamptz)
      - `end_date` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `client_relationships`
      - `id` (uuid, primary key)
      - `ca_profile_id` (uuid, references profiles)
      - `business_id` (uuid, references businesses)
      - `status` (text: 'active', 'pending', 'inactive')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `audit_logs`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `user_id` (uuid, references profiles)
      - `entity_type` (text: 'document', 'task', 'compliance')
      - `entity_id` (uuid)
      - `action` (text: 'created', 'updated', 'deleted', 'uploaded', 'downloaded')
      - `old_value` (jsonb, nullable)
      - `new_value` (jsonb, nullable)
      - `description` (text)
      - `created_at` (timestamptz)

    - `whatsapp_credits`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `credits_remaining` (integer)
      - `credits_total` (integer)
      - `last_topup_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `storage_usage`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `used_mb` (numeric)
      - `total_mb` (numeric)
      - `updated_at` (timestamptz)

  2. Enhanced Tables
    - Add `compliance_score` to businesses table
    - Add `category` to documents table (if not exists)
    - Add `edited_by` and `final_values` to compliance_tasks

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to access their own data
    - Add policies for CAs to access client data

  4. Indexes
    - Add indexes for foreign keys and frequently queried columns
*/

-- Add compliance_score to businesses if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'compliance_score'
  ) THEN
    ALTER TABLE businesses ADD COLUMN compliance_score INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add edited_by and final_values to compliance_tasks if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'edited_by'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN edited_by UUID REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_tasks' AND column_name = 'final_values'
  ) THEN
    ALTER TABLE compliance_tasks ADD COLUMN final_values JSONB;
  END IF;
END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  billing_cycle TEXT CHECK (billing_cycle IN ('annual', 'quarterly')),
  amount_paid NUMERIC DEFAULT 0,
  razorpay_customer_id TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Create client_relationships table
CREATE TABLE IF NOT EXISTS client_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ca_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ca_profile_id, business_id)
);

ALTER TABLE client_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CAs can view their client relationships"
  ON client_relationships FOR SELECT
  TO authenticated
  USING (ca_profile_id = auth.uid());

CREATE POLICY "CAs can manage their client relationships"
  ON client_relationships FOR ALL
  TO authenticated
  USING (ca_profile_id = auth.uid())
  WITH CHECK (ca_profile_id = auth.uid());

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('document', 'task', 'compliance', 'subscription')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'uploaded', 'downloaded', 'edited', 'exported', 'completed')),
  old_value JSONB,
  new_value JSONB,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their business"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM client_relationships WHERE ca_profile_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create whatsapp_credits table
CREATE TABLE IF NOT EXISTS whatsapp_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  credits_remaining INTEGER DEFAULT 50,
  credits_total INTEGER DEFAULT 50,
  last_topup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their WhatsApp credits"
  ON whatsapp_credits FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their WhatsApp credits"
  ON whatsapp_credits FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Create storage_usage table
CREATE TABLE IF NOT EXISTS storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  used_mb NUMERIC DEFAULT 0,
  total_mb NUMERIC DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their storage usage"
  ON storage_usage FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_client_relationships_ca ON client_relationships(ca_profile_id);
CREATE INDEX IF NOT EXISTS idx_client_relationships_business ON client_relationships(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_credits_business ON whatsapp_credits(business_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_business ON storage_usage(business_id);
