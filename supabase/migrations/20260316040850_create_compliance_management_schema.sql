/*
  # Tax and Compliance Management System for Indian MSMEs
  
  ## Overview
  This migration creates the complete database schema for a SaaS platform that helps
  Indian MSMEs manage their tax and regulatory compliance requirements.
  
  ## New Tables
  
  ### 1. `profiles`
  - `id` (uuid, primary key) - References auth.users
  - `user_type` (text) - Either 'business_owner' or 'chartered_accountant'
  - `full_name` (text) - User's full name
  - `email` (text) - User's email address
  - `phone` (text, optional) - Contact number
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. `businesses`
  - `id` (uuid, primary key) - Unique business identifier
  - `owner_id` (uuid) - References profiles table
  - `business_name` (text) - Official business name
  - `gstin` (text, optional) - GST Identification Number
  - `pan` (text, optional) - Permanent Account Number
  - `business_type` (text, optional) - Type of business entity
  - `address` (text, optional) - Business address
  - `created_at` (timestamptz) - Registration timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 3. `compliance_tasks`
  - `id` (uuid, primary key) - Unique task identifier
  - `business_id` (uuid) - References businesses table
  - `task_name` (text) - Name of compliance task (e.g., GSTR-1, GSTR-3B)
  - `task_type` (text) - Category (GST, PF, ESI, Income Tax, etc.)
  - `due_date` (date) - Deadline for compliance
  - `status` (text) - Current status: 'pending', 'completed', 'overdue'
  - `description` (text, optional) - Additional details
  - `priority` (text) - Priority level: 'high', 'medium', 'low'
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `completed_at` (timestamptz, optional) - Completion timestamp
  
  ### 4. `documents`
  - `id` (uuid, primary key) - Unique document identifier
  - `business_id` (uuid) - References businesses table
  - `file_name` (text) - Original file name
  - `file_url` (text) - Storage URL for the document
  - `file_type` (text) - MIME type or file extension
  - `file_size` (bigint, optional) - File size in bytes
  - `category` (text, optional) - Document category (GST, Invoice, Receipt, etc.)
  - `uploaded_by` (uuid) - References profiles table
  - `uploaded_at` (timestamptz) - Upload timestamp
  - `description` (text, optional) - Document description
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies ensure users can only access their own data or businesses they're associated with
  - Business owners can manage their businesses
  - Chartered Accountants can view businesses they're assigned to (future enhancement)
  
  ## Important Notes
  1. All tables use UUIDs for primary keys for better scalability
  2. Timestamps use `timestamptz` for proper timezone handling
  3. RLS policies are restrictive by default - data is locked down until explicit access is granted
  4. Foreign key constraints ensure data integrity
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- PROFILES TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('business_owner', 'chartered_accountant')),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ================================================
-- BUSINESSES TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  gstin text,
  pan text,
  business_type text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Business owners can create businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Business owners can update their businesses"
  ON businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Business owners can delete their businesses"
  ON businesses FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ================================================
-- COMPLIANCE_TASKS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  task_type text NOT NULL DEFAULT 'GST',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE compliance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks for their businesses"
  ON compliance_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = compliance_tasks.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tasks for their businesses"
  ON compliance_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = compliance_tasks.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks for their businesses"
  ON compliance_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = compliance_tasks.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = compliance_tasks.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tasks for their businesses"
  ON compliance_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = compliance_tasks.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- ================================================
-- DOCUMENTS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  category text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at timestamptz DEFAULT now(),
  description text
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents for their businesses"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = documents.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload documents to their businesses"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = documents.business_id
      AND businesses.owner_id = auth.uid()
    )
    AND auth.uid() = uploaded_by
  );

CREATE POLICY "Users can delete documents from their businesses"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = documents.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_business_id ON compliance_tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_due_date ON compliance_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_tasks_status ON compliance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_documents_business_id ON documents(business_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- ================================================
-- FUNCTIONS FOR AUTOMATIC TIMESTAMP UPDATES
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_businesses_updated_at') THEN
    CREATE TRIGGER update_businesses_updated_at
      BEFORE UPDATE ON businesses
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_tasks_updated_at') THEN
    CREATE TRIGGER update_compliance_tasks_updated_at
      BEFORE UPDATE ON compliance_tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;