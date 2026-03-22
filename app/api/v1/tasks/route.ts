import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Public API — GET /api/v1/tasks
 *
 * Returns compliance tasks for authenticated user.
 * Supports: ?status=created&page=1&page_size=20&business_id=UUID
 *
 * Authentication: Bearer token (Supabase access_token)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  try {
    // Extract bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Bearer <access_token>' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Parse query params
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const businessId = url.searchParams.get('business_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(url.searchParams.get('page_size') || '20'), 100);
    const offset = (page - 1) * pageSize;

    // Validate status against known values
    const VALID_STATUSES = ['created','awaiting_documents','under_review','ready_to_file','filed','acknowledged','locked'];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status value. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Ownership check — look up businesses owned by this user
    const { data: ownedBusinesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id);
    const ownedIds = (ownedBusinesses ?? []).map((b: { id: string }) => b.id);

    if (businessId && !ownedIds.includes(businessId)) {
      return NextResponse.json({ error: 'Forbidden: you do not own this business' }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('compliance_tasks')
      .select('id, task_name, task_type, status, due_date, priority, approval_status, created_at, updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (status) query = query.eq('status', status);
    // Restrict to owned businesses only
    if (businessId) {
      query = query.eq('business_id', businessId);
    } else if (ownedIds.length > 0) {
      query = query.in('business_id', ownedIds);
    } else {
      // User owns no businesses — return empty
      return NextResponse.json({ data: [], pagination: { page, page_size: pageSize, total: 0, total_pages: 0 } });
    }

    const { data: tasks, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: tasks,
      pagination: {
        page,
        page_size: pageSize,
        total: count,
        total_pages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err: unknown) {
    console.error('[api/v1/tasks] unhandled error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
