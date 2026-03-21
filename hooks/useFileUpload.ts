import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from './use-toast';
import { logError } from '@/lib/errorLogger';

export const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useFileUpload({
  businessId,
  category = 'General',
  onUploadComplete,
  onUploadError,
  acceptedTypes = ALLOWED_TYPES,
  maxSize = MAX_FILE_SIZE,
}: {
  businessId: string;
  category?: string;
  onUploadComplete?: (doc: { id: string; fileName: string; storagePath: string; signedUrl: string }) => void;
  onUploadError?: (error: string) => void;
  acceptedTypes?: string[];
  maxSize?: number;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildStructuredPath = (fileName: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${businessId}/${category}/${year}/${month}/${timestamp}_${safeName}`;
  };

  const checkStorageLimit = async (fileSize: number) => {
    try {
      const { data, error: rpcError } = await supabase.rpc('check_storage_limit', {
        p_business_id: businessId,
        p_file_size_bytes: fileSize,
      });
      if (rpcError) return true;
      if (data && !data.allowed) {
        setError(data.message || 'Storage limit exceeded');
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploadedFile(null);

    if (!acceptedTypes.includes(file.type)) {
      const msg = `File type not accepted.`;
      setError(msg);
      onUploadError?.(msg);
      return;
    }

    if (file.size > maxSize) {
      const msg = `File is too large.`;
      setError(msg);
      onUploadError?.(msg);
      return;
    }

    const hasCapacity = await checkStorageLimit(file.size);
    if (!hasCapacity) {
      onUploadError?.('Storage limit exceeded');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const storagePath = buildStructuredPath(file.name);
      setProgress(20);

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;
      setProgress(60);

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 3600);

      if (signedUrlError) throw signedUrlError;
      const signedUrl = signedUrlData.signedUrl;
      setProgress(75);

      const { data: { user } } = await supabase.auth.getUser();

      const { data: docRecord, error: dbError } = await supabase
        .from('documents')
        .insert({
          business_id: businessId,
          file_name: file.name,
          file_url: signedUrl,
          storage_path: storagePath,
          file_type: file.type || file.name.split('.').pop() || 'unknown',
          file_size: file.size,
          category,
          uploaded_by: user?.id,
          version_number: 1,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setProgress(90);

      await supabase.from('document_versions').insert({
        document_id: docRecord.id,
        version_number: 1,
        file_name: file.name,
        file_url: signedUrl,
        storage_path: storagePath,
        file_size: file.size,
        created_by: user?.id,
        metadata: { original_upload: true },
      });

      setProgress(100);
      setUploadedFile(file);
      toast({ title: 'Uploaded!', description: `"${file.name}" uploaded successfully.` });

      onUploadComplete?.({
        id: docRecord.id,
        fileName: file.name,
        storagePath,
        signedUrl,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed.';
      setError(errorMsg);
      toast({ title: 'Upload Failed', description: errorMsg, variant: 'destructive' });
      onUploadError?.(errorMsg);
      await logError('file_upload', err instanceof Error ? err : new Error(String(err)), { businessId, category });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [businessId, category, acceptedTypes, maxSize, onUploadComplete, onUploadError]);

  const resetUpload = () => {
    setUploadedFile(null);
    setError(null);
    setProgress(0);
  };

  return { uploadFile, uploading, progress, uploadedFile, error, resetUpload };
}
