import { supabase } from '@/lib/supabase/client';
import { logError } from '../errorLogger';
import { sanitizeFileName } from '../sanitize';

export const documentService = {
  upload: async (businessId: string, file: File, category: string, storagePath: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('secure_upload_document', {
      p_user_id: user.id,
      p_business_id: businessId,
      p_file_name: sanitizeFileName(file.name),
      p_storage_path: storagePath,
      p_file_type: file.type || file.name.split('.').pop() || 'unknown',
      p_file_size: file.size,
      p_category: category,
    });

    if (error) {
      await logError('secure_upload_document', error, { businessId, category });
      throw error;
    }

    if (data && !data.success) {
      if (data.limit_exceeded) {
        throw new Error('LIMIT_EXCEEDED: ' + data.error);
      }
      throw new Error(data.error);
    }
    return data;
  },

  list: async (businessId: string, options?: { category?: string; search?: string; page?: number; pageSize?: number }) => {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(start, end);

    if (options?.category) query = query.eq('category', options.category);
    if (options?.search) query = query.ilike('file_name', `%${options.search}%`);

    const { data, count, error } = await query;
    if (error) {
      await logError('fetch_documents', error, { businessId });
      throw error;
    }

    return { data: data || [], total: count || 0, page, pageSize };
  },

  getSignedUrl: async (documentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: accessCheck, error: accessError } = await supabase.rpc('validate_document_access', {
      p_user_id: user.id,
      p_document_id: documentId,
    });

    if (accessError) throw accessError;
    if (!accessCheck?.allowed) throw new Error(accessCheck?.error || 'Access denied');

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(accessCheck.storage_path, 60);

    if (error) throw error;
    return data.signedUrl;
  },

  delete: async (documentId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('soft_delete', {
      p_table_name: 'documents',
      p_record_id: documentId,
      p_user_id: user.id,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error);
    return data;
  },

  getVersions: async (documentId: string) => {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
