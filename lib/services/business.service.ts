import { supabase } from '@/lib/supabase/client';
import { sanitizeText } from '../sanitize';

export const businessService = {
  checkPermission: async (permission: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('check_permission', {
      p_user_id: user.id,
      p_permission: permission,
    });

    if (error) return false;
    return !!data;
  },

  checkStorageLimit: async (businessId: string, fileSize: number) => {
    const { data, error } = await supabase.rpc('check_storage_limit', {
      p_business_id: businessId,
      p_file_size_bytes: fileSize,
    });

    if (error) return { allowed: true };
    return data;
  },

  checkWhatsAppLimit: async (businessId: string) => {
    const { data, error } = await supabase.rpc('check_whatsapp_limit', {
      p_business_id: businessId,
    });

    if (error) return { allowed: true };
    return data;
  },

  logAction: async (action: string, entityType: string, entityId: string, description: string, businessId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      business_id: businessId || null,
      entity_type: entityType,
      entity_id: entityId,
      action,
      description: sanitizeText(description),
    }).then(() => {}).catch(() => {});
  }
};
