-- Deadline overrides table: admin can override statutory due dates when govt extends them
CREATE TABLE IF NOT EXISTS public.deadline_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,            -- matches task_name prefix e.g. 'GSTR-1', 'TDS Payment'
  original_due_date DATE NOT NULL,    -- the original statutory date
  extended_due_date DATE NOT NULL,    -- the new govt-extended date
  reason TEXT NOT NULL,               -- e.g. "CBIC Circular 05/2026 – COVID relief"
  circular_ref TEXT,                  -- optional circular number/URL
  applied_count INTEGER DEFAULT 0,   -- how many tasks were updated
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deadline_overrides ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — only accessed via service role in API
