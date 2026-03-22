-- ─── 1. Allow CAs to look up business owner profiles by email ────────────────
-- The profiles SELECT policy only allows users to see their own profile.
-- CAs need to search for business owners by email to send invites.

CREATE POLICY "CAs can look up business owner profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    user_type = 'business_owner'
    AND EXISTS (
      SELECT 1 FROM profiles AS me
      WHERE me.id = auth.uid()
      AND me.user_type IN ('chartered_accountant', 'admin')
    )
  );


-- ─── 2. Storage bucket policies for 'documents' bucket ───────────────────────
-- Without these policies, all storage uploads return RLS violations.

-- Business owners can upload files to their business folder
CREATE POLICY "Business owners can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = (storage.foldername(name))[1]::uuid
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business owners can read their own documents
CREATE POLICY "Business owners can read their documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = (storage.foldername(name))[1]::uuid
      AND businesses.owner_id = auth.uid()
    )
  );

-- CAs can read documents of their linked clients
CREATE POLICY "CAs can read client documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM client_relationships cr
      JOIN businesses b ON b.id = cr.business_id
      WHERE b.id = (storage.foldername(name))[1]::uuid
      AND cr.ca_profile_id = auth.uid()
      AND cr.status = 'active'
    )
  );

-- Business owners can delete their own documents
CREATE POLICY "Business owners can delete their documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = (storage.foldername(name))[1]::uuid
      AND businesses.owner_id = auth.uid()
    )
  );


-- ─── 3. Add applicable_compliance_types to businesses ─────────────────────────
-- Business owners can opt out of compliance types not relevant to their business.
-- e.g. a proprietor without employees doesn't need PF/ESI tasks shown.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS applicable_compliance_types text[]
  DEFAULT ARRAY['GST', 'TDS', 'PF_ESI', 'ROC', 'Income_Tax'];
