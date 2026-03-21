import { createClient } from '@supabase/supabase-js';
import { logError } from '@/lib/errorLogger';

/**
 * Public API — GET /api/v1/documents
 *
 * Returns documents for authenticated user.
 * Supports: ?category=GST&page=1&page_size=20&business_id=UUID
 *
 * Authentication: Bearer token (Supabase access_token)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const businessId = url.searchParams.get('business_id');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(url.searchParams.get('page_size') || '20'), 100);
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('documents')
      .select('id, file_name, file_type, file_size, category, storage_path, version_number, created_at', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (category) query = query.eq('category', category);
    if (businessId) query = query.eq('business_id', businessId);

    const { data: documents, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: documents,
      pagination: {
        page,
        page_size: pageSize,
        total: count,
        total_pages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logError('api_v1_documents_get', errorMessage, { originalError: error }, null, null);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
