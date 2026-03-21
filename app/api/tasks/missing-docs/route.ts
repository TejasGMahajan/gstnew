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

// ─── GET /api/tasks/missing-docs ──────────────────────────────────────────────
// Returns tasks currently waiting for documents (status='awaiting_documents').
// Called by Activepieces every Monday at 10 AM to chase businesses.
// Required header: Authorization: Bearer <CRON_SECRET>

export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Fetch tasks that are blocked waiting for documents
  const { data: tasks, error: taskError } = await supabaseAdmin
    .from('compliance_tasks')
    .select('id, task_name, due_date, status, business_id')
    .eq('status', 'awaiting_documents')
    .order('due_date', { ascending: true });

  if (taskError) {
    console.error('[tasks/missing-docs] task query error:', taskError.message);
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // 2. Fetch businesses
  const businessIds = Array.from(new Set(tasks.map((t) => t.business_id)));
  const { data: businesses, error: bizError } = await supabaseAdmin
    .from('businesses')
    .select('id, business_name, owner_id')
    .in('id', businessIds);

  if (bizError) {
    console.error('[tasks/missing-docs] business query error:', bizError.message);
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  // 3. Fetch CA names for each business (via client_relationships → profiles)
  //    So the WhatsApp message can say "your CA John needs documents"
  const { data: relationships, error: relError } = await supabaseAdmin
    .from('client_relationships')
    .select('business_id, ca_profile_id')
    .in('business_id', businessIds)
    .eq('status', 'active');

  const caIds = Array.from(new Set((relationships ?? []).map((r: any) => r.ca_profile_id)));

  // 4. Fetch owner + CA profiles together
  const ownerIds = Array.from(new Set((businesses ?? []).map((b: any) => b.owner_id)));
  const allProfileIds = Array.from(new Set([...ownerIds, ...caIds]));

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, phone')
    .in('id', allProfileIds);

  if (profileError) {
    console.error('[tasks/missing-docs] profile query error:', profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // 5. Join in memory
  const bizMap     = new Map((businesses ?? []).map((b: any) => [b.id, b]));
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  // business_id → ca_profile_id (take first active CA per business)
  const caMap      = new Map((relationships ?? []).map((r: any) => [r.business_id, r.ca_profile_id]));

  const results = tasks.map((task) => {
    const biz       = bizMap.get(task.business_id) as any;
    const owner     = biz ? profileMap.get(biz.owner_id) as any : null;
    const caId      = caMap.get(task.business_id);
    const ca        = caId ? profileMap.get(caId) as any : null;

    // Days overdue / until due
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    const diffMs  = dueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      taskId:        task.id,
      taskName:      task.task_name,
      dueDate:       task.due_date,
      daysUntilDue,
      businessId:    task.business_id,
      businessName:  biz?.business_name ?? 'Unknown',
      ownerName:     owner?.full_name ?? '',
      ownerEmail:    owner?.email ?? '',
      phone:         owner?.phone ?? null,
      caName:        ca?.full_name ?? 'Your CA',
      caEmail:       ca?.email ?? '',
    };
  });

  return NextResponse.json({ results });
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
