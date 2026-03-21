import { supabase } from '@/lib/supabase/client';
import { logError } from '../errorLogger';
import { sanitizeText } from '../sanitize';

export const taskService = {
  list: async (businessId: string, options?: { status?: string; page?: number; pageSize?: number }) => {
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
  },

  transitionStatus: async (taskId: string, newStatus: string) => {
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
  },

  updateOptimistic: async (taskId: string, expectedUpdatedAt: string, updates: { finalValues?: any; description?: string }) => {
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
};
