// FILE: app/api/admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Verify the requester is an admin by checking their JWT via the regular client
async function verifyAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .maybeSingle();

  return profile?.user_type === 'admin';
}

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdmin(req.headers.get('authorization'));
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const page = Number(searchParams.get('page') || 1);
  const search = searchParams.get('search') || '';
  const filter = searchParams.get('filter') || '';
  const start = (page - 1) * PAGE_SIZE;

  try {
    if (type === 'stats') {
      const [usersRes, bizRes, subRes] = await Promise.allSettled([
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('businesses').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('subscriptions').select('amount_paid, status').eq('status', 'active'),
      ]);

      return NextResponse.json({
        totalUsers: usersRes.status === 'fulfilled' ? (usersRes.value.count || 0) : 0,
        totalBusinesses: bizRes.status === 'fulfilled' ? (bizRes.value.count || 0) : 0,
        activeSubscriptions: subRes.status === 'fulfilled' && subRes.value.data ? subRes.value.data.length : 0,
        totalRevenue: subRes.status === 'fulfilled' && subRes.value.data
          ? subRes.value.data.reduce((sum: number, s: any) => sum + (s.amount_paid || 0), 0)
          : 0,
      });
    }

    if (type === 'users') {
      let query = supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, user_type, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (search) query = query.ilike('email', `%${search}%`);
      if (filter) query = query.eq('user_type', filter);
      const { data, count } = await query;
      return NextResponse.json({ data: data || [], total: count || 0 });
    }

    if (type === 'subscriptions') {
      let query = supabaseAdmin
        .from('subscriptions')
        .select('id, plan_type, status, amount_paid, created_at, razorpay_order_id, businesses (business_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (filter) query = query.eq('plan_type', filter);
      const { data, count } = await query;
      return NextResponse.json({ data: data || [], total: count || 0 });
    }

    if (type === 'wa_credits') {
      const { data } = await supabaseAdmin
        .from('whatsapp_credits')
        .select('id, credits_remaining, credits_total, updated_at, businesses (business_name)')
        .order('credits_remaining', { ascending: true });
      return NextResponse.json({ data: data || [] });
    }

    if (type === 'audit_logs') {
      let query = supabaseAdmin
        .from('audit_logs')
        .select('id, action, entity_type, entity_id, description, created_at, profiles (email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (filter) query = query.eq('entity_type', filter);
      const { data, count } = await query;
      return NextResponse.json({ data: data || [], total: count || 0 });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
