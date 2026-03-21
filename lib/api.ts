import { supabase } from '@/lib/supabase/client';
import { logError } from './errorLogger';
import { sanitizeText, sanitizeFileName } from './sanitize';

/**
 * Centralized API layer — ALL Supabase calls go through here.
 * Uses RPC functions for critical operations instead of direct table access.
 * Provides: error handling, sanitization, and action logging.
 */

// ─── TASK OPERATIONS ────────────────────────────

export async function transitionTaskStatus(taskId: string, newStatus: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('transition_task_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_user_id: user.id,
  });

  if (error) {
    await logError('transition_task_status', error, { taskId, newStatus });
    throw error;
  }

  if (data && !data.success) {
    throw new Error(data.error);
  }

  return data;
}

export async function updateTaskOptimistic(
  taskId: string,
  expectedUpdatedAt: string,
  updates: { finalValues?: Record<string, unknown>; description?: string }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('optimistic_update_task', {
    p_task_id: taskId,
    p_user_id: user.id,
    p_expected_updated_at: expectedUpdatedAt,
    p_final_values: updates.finalValues || null,
    p_description: updates.description ? sanitizeText(updates.description) : null,
  });

  if (error) {
    await logError('optimistic_update_task', error, { taskId });
    throw error;
  }

  if (data && !data.success) {
    if (data.conflict) {
      throw new Error('CONFLICT: ' + data.error);
    }
    throw new Error(data.error);
  }

  return data;
}

export async function fetchTasks(businessId: string, options?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('compliance_tasks')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .range(start, end);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, count, error } = await query;
  if (error) {
    await logError('fetch_tasks', error, { businessId });
    throw error;
  }

  return { data: data || [], total: count || 0, page, pageSize };
}


// ─── DOCUMENT OPERATIONS ────────────────────────

export async function uploadDocumentSecure(
  businessId: string,
  file: File,
  category: string,
  storagePath: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use the secure RPC which checks: access + permission + limits + sanitizes
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
}

export async function fetchDocuments(businessId: string, options?: {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
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
}

export async function getSignedDocumentUrl(documentId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate access via RPC before generating signed URL
  const { data: accessCheck, error: accessError } = await supabase.rpc('validate_document_access', {
    p_user_id: user.id,
    p_document_id: documentId,
  });

  if (accessError) throw accessError;
  if (!accessCheck?.allowed) throw new Error(accessCheck?.error || 'Access denied');

  // Generate short-lived signed URL (60 seconds)
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(accessCheck.storage_path, 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function softDeleteDocument(documentId: string) {
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
}

export async function fetchDocumentVersions(documentId: string) {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}


// ─── PERMISSION & ACCESS ────────────────────────

export async function checkPermission(permission: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('check_permission', {
    p_user_id: user.id,
    p_permission: permission,
  });

  if (error) return false;
  return !!data;
}

export async function checkStorageLimit(businessId: string, fileSize: number) {
  const { data, error } = await supabase.rpc('check_storage_limit', {
    p_business_id: businessId,
    p_file_size_bytes: fileSize,
  });

  if (error) return { allowed: true }; // Fail open if function not found
  return data;
}

export async function checkWhatsAppLimit(businessId: string) {
  const { data, error } = await supabase.rpc('check_whatsapp_limit', {
    p_business_id: businessId,
  });

  if (error) return { allowed: true };
  return data;
}


// ─── CA OPERATIONS ──────────────────────────────

export async function verifyCAAccess(businessId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('validate_ca_access', {
    p_user_id: user.id,
    p_business_id: businessId,
  });

  if (error) return false;
  return !!data;
}

export async function generateGSTR1(businessId: string, periodStart: string, periodEnd: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('generate_gstr1_json', {
    p_business_id: businessId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_user_id: user.id,
  });

  if (error) throw error;
  if (data && !data.success) throw new Error(data.error);
  return data;
}


// ─── COMPLIANCE ENGINE ──────────────────────────

export async function evaluateComplianceRules(businessId: string) {
  const { data, error } = await supabase.rpc('evaluate_compliance_rules', {
    p_business_id: businessId,
  });

  if (error) throw error;
  return data;
}

export async function fetchComplianceAlerts(businessId: string) {
  const { data, error } = await supabase
    .from('compliance_alerts')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}


// ─── ACTION LOGGING ─────────────────────────────

export async function logUserAction(
  action: string,
  entityType: string,
  entityId: string,
  description: string,
  businessId?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    business_id: businessId || null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description: sanitizeText(description),
  }).then(() => {}, () => {}); // Fire and forget
}
