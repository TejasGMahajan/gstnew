import { supabase } from '@/lib/supabase/client';

export type UserRole = 'business_owner' | 'chartered_accountant' | 'employee' | 'admin';

export type Permission =
  | 'upload_document'
  | 'edit_data'
  | 'approve_data'
  | 'delete_document'
  | 'view_admin';

interface AuthGuardResult {
  allowed: boolean;
  error?: string;
  user?: any;
  profile?: any;
}

/**
 * Check if current user has a specific permission.
 * Calls the DB-level check_permission() RPC.
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.rpc('check_permission', {
    p_user_id: user.id,
    p_permission: permission,
  });

  return !!data;
}

/**
 * Check if current user can access a specific route/page.
 */
export async function canAccessRoute(route: string): Promise<AuthGuardResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, ca_verification_status')
    .eq('id', user.id)
    .single();

  if (!profile) return { allowed: false, error: 'Profile not found' };

  const role = profile.user_type as UserRole;

  // Route-based access rules
  const routePermissions: Record<string, UserRole[]> = {
    '/dashboard': ['business_owner', 'employee'],
    '/dashboard-ca': ['chartered_accountant'],
    '/dashboard-admin': ['admin'],
    '/dashboard-owner': ['business_owner'],
    '/vault': ['business_owner', 'chartered_accountant', 'employee', 'admin'],
    '/analytics': ['business_owner', 'chartered_accountant', 'admin'],
    '/pricing': ['business_owner', 'chartered_accountant', 'employee', 'admin'],
  };

  const allowedRoles = routePermissions[route];
  if (allowedRoles && !allowedRoles.includes(role)) {
    return { allowed: false, error: `Access denied for role: ${role}`, user, profile };
  }

  // CA-specific: must be verified for client operations
  if (role === 'chartered_accountant' && profile.ca_verification_status !== 'verified') {
    if (route === '/dashboard-ca') {
      return { allowed: true, user, profile }; // Can see dashboard (with warning)
    }
  }

  return { allowed: true, user, profile };
}

/**
 * Check if current user has access to a specific business.
 */
export async function canAccessBusiness(businessId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.rpc('validate_ca_access', {
    p_user_id: user.id,
    p_business_id: businessId,
  });

  return !!data;
}

/**
 * Get allowed actions for current user on a task.
 * Returns which buttons to enable/disable.
 */
export function getTaskActions(
  taskStatus: string,
  approvalStatus: string,
  userRole: UserRole
): {
  canAdvanceStatus: boolean;
  canEditData: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canExport: boolean;
  nextStatus: string | null;
  statusLocked: boolean;
} {
  const TRANSITIONS: Record<string, string> = {
    created: 'awaiting_documents',
    awaiting_documents: 'under_review',
    under_review: 'ready_to_file',
    ready_to_file: 'filed',
    filed: 'acknowledged',
    acknowledged: 'locked',
  };

  const statusLocked = taskStatus === 'locked' || approvalStatus === 'locked';
  const nextStatus = TRANSITIONS[taskStatus] || null;

  return {
    canAdvanceStatus: !statusLocked && !!nextStatus && ['business_owner', 'chartered_accountant', 'admin'].includes(userRole),
    canEditData: !statusLocked && ['business_owner', 'chartered_accountant', 'admin'].includes(userRole),
    canApprove: !statusLocked && ['business_owner', 'admin'].includes(userRole),
    canDelete: ['business_owner', 'admin'].includes(userRole),
    canExport: ['business_owner', 'chartered_accountant', 'admin'].includes(userRole),
    nextStatus,
    statusLocked,
  };
}

/**
 * Check if CA is verified before allowing client operations.
 */
export async function isCAVerified(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, ca_verification_status')
    .eq('id', user.id)
    .single();

  if (!profile) return false;
  if (profile.user_type !== 'chartered_accountant') return true; // non-CAs not restricted
  return profile.ca_verification_status === 'verified';
}
