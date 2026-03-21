export interface User {
  id: string;
  email: string;
  role: 'admin' | 'employee' | 'ca' | 'owner';
}

export interface Business {
  id: string;
  name: string;
  industry: string;
  gstin?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  businessId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  category: string;
  createdAt: string;
}

export interface Task {
  id: string;
  businessId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  businessId?: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  createdAt: string;
}
