import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Build query
    let query = supabase
      .from('compliance_tasks')
      .select('id, task_name, task_type, status, due_date, priority, approval_status, created_at, updated_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (status) query = query.eq('status', status);
    if (businessId) query = query.eq('business_id', businessId);

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
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
