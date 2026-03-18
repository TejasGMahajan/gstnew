// Supabase Edge Function: CRON-triggered daily job
// Runs: generate_compliance_tasks() + check_deadlines()
//
// Deploy: supabase functions deploy daily-compliance-cron
// Schedule via Supabase Dashboard → Database → Extensions → pg_cron
//
// pg_cron schedule (add to SQL after enabling pg_cron):
//   SELECT cron.schedule('daily-compliance-tasks', '0 1 * * *', $$SELECT generate_compliance_tasks()$$);
//   SELECT cron.schedule('daily-deadline-check',   '0 6 * * *', $$SELECT check_deadlines()$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    // Verify authorization (CRON secret or service role)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Generate compliance tasks for today
    const { data: taskGenResult, error: taskGenError } = await supabase.rpc(
      'generate_compliance_tasks',
      { target_date: new Date().toISOString().split('T')[0] }
    );

    if (taskGenError) {
      console.error('Task generation failed:', taskGenError);
    }

    // 2. Check deadlines (3-day warnings + overdue notifications)
    const { data: deadlineResult, error: deadlineError } = await supabase.rpc(
      'check_deadlines',
      { target_date: new Date().toISOString().split('T')[0] }
    );

    if (deadlineError) {
      console.error('Deadline check failed:', deadlineError);
    }

    const result = {
      success: true,
      executed_at: new Date().toISOString(),
      task_generation: taskGenResult || { error: taskGenError?.message },
      deadline_check: deadlineResult || { error: deadlineError?.message },
    };

    console.log('Daily compliance CRON result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('CRON function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
