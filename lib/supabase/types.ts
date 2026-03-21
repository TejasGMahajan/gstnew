export type UserType = 'business_owner' | 'chartered_accountant' | 'employee' | 'admin';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string;
  email: string;
  phone?: string;
  ca_verification_status?: 'pending' | 'verified' | 'rejected' | 'not_applicable';
  icai_membership_number?: string;
  ca_verified_at?: string;
  ca_verified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  business_name: string;
  gstin?: string;
  pan?: string;
  business_type?: string;
  address?: string;
  compliance_score?: number;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
}

// 7-state compliance workflow
export type TaskStatus =
  | 'created'
  | 'awaiting_documents'
  | 'under_review'
  | 'ready_to_file'
  | 'filed'
  | 'acknowledged'
  | 'locked';

export type TaskPriority = 'high' | 'medium' | 'low';
export type ApprovalStatus = 'draft' | 'ca_reviewed' | 'business_approved' | 'locked';

export interface ComplianceTask {
  id: string;
  business_id: string;
  task_name: string;
  task_type: string;
  due_date: string;
  status: TaskStatus;
  description?: string;
  priority: TaskPriority;
  approval_status?: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  edited_by?: string;
  final_values?: Record<string, unknown>;
  responsible_ca_id?: string;
  ca_disclaimer_accepted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Document {
  id: string;
  business_id: string;
  file_name: string;
  file_url?: string;        // legacy — use storage_path for new uploads
  storage_path?: string;    // canonical path for signed URL generation
  file_type: string;
  file_size?: number;
  category?: string;
  version_number?: number;
  uploaded_by: string;
  uploaded_at: string;
  description?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string;
  file_url?: string;
  storage_path?: string;
  file_size?: number;
  metadata?: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan_type: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled';
  billing_cycle?: 'annual' | 'quarterly';
  amount_paid?: number;
  razorpay_customer_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientRelationship {
  id: string;
  ca_profile_id: string;
  business_id: string;
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  business_id?: string;
  user_id: string;
  entity_type: 'document' | 'task' | 'compliance' | 'subscription' | 'profile' | 'business' | 'client_relationship';
  entity_id: string;
  action: 'created' | 'updated' | 'deleted' | 'uploaded' | 'downloaded' | 'edited' | 'exported' | 'completed' | 'ca_verification' | 'linked' | 'unlinked' | 'approved' | 'locked';
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  description: string;
  created_at: string;
}

export interface Notification {
  id: string;
  business_id?: string;
  user_id: string;
  type: 'deadline_approaching' | 'document_uploaded' | 'task_completed' | 'task_status_changed' | 'limit_warning' | 'approval_requested' | 'approval_granted' | 'system';
  title: string;
  message?: string;
  is_read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface StorageUsage {
  id: string;
  business_id: string;
  used_mb: number;
  total_mb: number;
  updated_at: string;
}

export interface WhatsAppCredit {
  id: string;
  business_id: string;
  credits_remaining: number;
  credits_total: number;
  last_topup_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceAlert {
  id: string;
  business_id: string;
  rule_id?: string;
  task_id?: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  suggested_action?: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
