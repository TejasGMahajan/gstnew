import { z } from 'zod';

export const documentUploadSchema = z.object({
  file: z.instanceof(File, { message: 'File is required' })
    .refine((file) => file.size <= 10 * 1024 * 1024, { message: 'File size must be less than 10MB' }),
  category: z.string().min(1, 'Category is required'),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['created', 'awaiting_documents', 'under_review', 'ready_to_file', 'filed', 'acknowledged', 'locked']),
  dueDate: z.string().datetime(),
});
