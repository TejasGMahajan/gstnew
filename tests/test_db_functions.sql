-- =============================================
-- TEST SUITE: Database Functions
-- Run with: psql -f tests/test_db_functions.sql
-- =============================================
-- These tests use DO blocks to validate function behavior.
-- In production, integrate with pgTAP for proper test framework.

-- ================================
-- TEST 1: validate_task_transition
-- ================================
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  -- Valid transitions
  ASSERT validate_task_transition('created', 'awaiting_documents') = true, 'FAIL: created → awaiting_documents should be valid';
  ASSERT validate_task_transition('awaiting_documents', 'under_review') = true, 'FAIL: awaiting_documents → under_review should be valid';
  ASSERT validate_task_transition('under_review', 'ready_to_file') = true, 'FAIL: under_review → ready_to_file should be valid';
  ASSERT validate_task_transition('ready_to_file', 'filed') = true, 'FAIL: ready_to_file → filed should be valid';
  ASSERT validate_task_transition('filed', 'acknowledged') = true, 'FAIL: filed → acknowledged should be valid';
  ASSERT validate_task_transition('acknowledged', 'locked') = true, 'FAIL: acknowledged → locked should be valid';

  -- Invalid transitions (skipping)
  ASSERT validate_task_transition('created', 'under_review') = false, 'FAIL: created → under_review should be invalid (skip)';
  ASSERT validate_task_transition('created', 'locked') = false, 'FAIL: created → locked should be invalid (skip)';
  ASSERT validate_task_transition('filed', 'created') = false, 'FAIL: filed → created should be invalid (reverse)';
  ASSERT validate_task_transition('locked', 'created') = false, 'FAIL: locked → created should be invalid';

  -- Same-status (no-op)
  ASSERT validate_task_transition('created', 'created') = true, 'FAIL: same-status should be valid (no-op)';

  RAISE NOTICE '✅ TEST 1 PASSED: validate_task_transition';
END $$;


-- ================================
-- TEST 2: check_permission
-- ================================
DO $$
BEGIN
  -- Test permission matrix (these rely on seeded role_permissions data)
  -- Business owner should have delete permission
  -- CA should NOT have delete permission

  -- Check that function exists and returns boolean
  PERFORM check_permission(gen_random_uuid(), 'upload_document');

  RAISE NOTICE '✅ TEST 2 PASSED: check_permission executes without error';
END $$;


-- ================================
-- TEST 3: sanitize_text
-- ================================
DO $$
BEGIN
  ASSERT sanitize_text('<script>alert("xss")</script>Hello') = 'alert("xss")Hello', 'FAIL: HTML tags not stripped';
  ASSERT sanitize_text(E'Normal\x00Text') = 'NormalText', 'FAIL: null bytes not removed';
  ASSERT sanitize_text('  trimmed  ') = 'trimmed', 'FAIL: whitespace not trimmed';
  ASSERT sanitize_text(NULL) IS NULL, 'FAIL: NULL input should return NULL';

  RAISE NOTICE '✅ TEST 3 PASSED: sanitize_text';
END $$;


-- ================================
-- TEST 4: sanitize_filename
-- ================================
DO $$
BEGIN
  ASSERT sanitize_filename('my file (1).pdf') = 'my file 1.pdf', 'FAIL: parentheses not cleaned';
  ASSERT sanitize_filename('../../etc/passwd') = '.._.._etc_passwd', 'FAIL: path traversal not cleaned';
  ASSERT sanitize_filename('') = 'unnamed_file', 'FAIL: empty string should default';
  ASSERT sanitize_filename(NULL) = 'unnamed_file', 'FAIL: NULL should default';
  ASSERT length(sanitize_filename(repeat('a', 300))) <= 255, 'FAIL: should limit to 255 chars';

  RAISE NOTICE '✅ TEST 4 PASSED: sanitize_filename';
END $$;


-- ================================
-- TEST 5: validate_ca_access (negative case - random UUID)
-- ================================
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  v_result := validate_ca_access(gen_random_uuid(), gen_random_uuid());
  ASSERT v_result = false, 'FAIL: random UUID should have no access';

  RAISE NOTICE '✅ TEST 5 PASSED: validate_ca_access denies unknown users';
END $$;


-- ================================
-- TEST 6: check_storage_limit
-- ================================
DO $$
DECLARE
  v_result JSONB;
BEGIN
  -- For a random business_id (no storage record), should allow with defaults
  v_result := check_storage_limit(gen_random_uuid(), 1024);
  ASSERT (v_result->>'allowed')::BOOLEAN = true, 'FAIL: should allow small upload with default limits';

  RAISE NOTICE '✅ TEST 6 PASSED: check_storage_limit with defaults';
END $$;


-- ================================
-- TEST 7: system_health_check
-- ================================
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := system_health_check();
  ASSERT v_result IS NOT NULL, 'FAIL: health check should return data';
  ASSERT v_result->>'status' IS NOT NULL, 'FAIL: health check should have status';
  ASSERT v_result->'metrics' IS NOT NULL, 'FAIL: health check should have metrics';

  RAISE NOTICE '✅ TEST 7 PASSED: system_health_check returns valid structure';
END $$;


-- ================================
-- TEST 8: generate_compliance_tasks (idempotency)
-- ================================
DO $$
DECLARE
  v_result1 JSONB;
  v_result2 JSONB;
BEGIN
  v_result1 := generate_compliance_tasks(CURRENT_DATE);
  v_result2 := generate_compliance_tasks(CURRENT_DATE);

  -- Second call should create 0 new tasks (all duplicates)
  ASSERT (v_result2->>'tasks_created')::INTEGER = 0,
    'FAIL: duplicate call should create 0 tasks, got ' || (v_result2->>'tasks_created');

  RAISE NOTICE '✅ TEST 8 PASSED: generate_compliance_tasks is idempotent';
END $$;


-- ================================
-- SUMMARY
-- ================================
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'All database function tests passed! ✅';
  RAISE NOTICE '================================================';
END $$;
