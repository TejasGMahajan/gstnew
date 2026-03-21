import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ─── GET /api/tasks/due-soon ──────────────────────────────────────────────────
// Returns tasks due within the next 3 days (status not completed/acknowledged).
// Called by Activepieces daily at 9 AM.
// Required header: Authorization: Bearer <CRON_SECRET>

export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 3);

  const todayStr  = today.toISOString().split('T')[0];
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // 1. Fetch tasks due within the next 3 days, excluding completed/acknowledged
  const { data: tasks, error: taskError } = await supabaseAdmin
    .from('compliance_tasks')
    .select('id, task_name, due_date, status, business_id')
    .gte('due_date', todayStr)
    .lte('due_date', cutoffStr)
    .not('status', 'in', '("completed","acknowledged")');

  if (taskError) {
    console.error('[tasks/due-soon] task query error:', taskError.message);
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // 2. Fetch businesses for those tasks
  const businessIds = [...new Set(tasks.map((t) => t.business_id))];
  const { data: businesses, error: bizError } = await supabaseAdmin
    .from('businesses')
    .select('id, business_name, owner_id')
    .in('id', businessIds);

  if (bizError) {
    console.error('[tasks/due-soon] business query error:', bizError.message);
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  // 3. Fetch owner profiles (phone + name + email)
  const ownerIds = [...new Set((businesses ?? []).map((b: any) => b.owner_id))];
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, phone')
    .in('id', ownerIds);

  if (profileError) {
    console.error('[tasks/due-soon] profile query error:', profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // 4. Join in memory
  const bizMap     = new Map((businesses ?? []).map((b: any) => [b.id, b]));
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const results = tasks.map((task) => {
    const biz     = bizMap.get(task.business_id) as any;
    const profile = biz ? profileMap.get(biz.owner_id) as any : null;

    return {
      taskId:       task.id,
      taskName:     task.task_name,
      dueDate:      task.due_date,
      status:       task.status,
      businessId:   task.business_id,
      businessName: biz?.business_name ?? 'Unknown',
      ownerName:    profile?.full_name ?? '',
      ownerEmail:   profile?.email ?? '',
      // Phone may be null if business owner has not added it yet
      phone:        profile?.phone ?? null,
    };
  });

  return NextResponse.json({ results });
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
