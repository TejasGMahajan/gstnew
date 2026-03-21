export type UserType = 'business_owner' | 'chartered_accountant' | 'admin';

export interface Profile {
  id: string;
  user_type: UserType;
  full_name: string;
  email: string;
  phone?: string;
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
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface ComplianceTask {
  id: string;
  business_id: string;
  task_name: string;
  task_type: string;
  due_date: string;
  status: TaskStatus;
  description?: string;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Document {
  id: string;
  business_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  category?: string;
  uploaded_by: string;
  uploaded_at: string;
  description?: string;
}
