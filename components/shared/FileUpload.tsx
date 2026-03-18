'use client';

import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, File, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/errorLogger';

const ALLOWED_TYPES = [
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileUploadProps {
  businessId: string;
  category?: string;
  onUploadComplete?: (doc: { id: string; fileName: string; storagePath: string; signedUrl: string }) => void;
  onUploadError?: (error: string) => void;
  acceptedTypes?: string[];
  maxSize?: number;
}

export default function FileUpload({
  businessId,
  category = 'General',
  onUploadComplete,
  onUploadError,
  acceptedTypes = ALLOWED_TYPES,
  maxSize = MAX_FILE_SIZE,
}: FileUploadProps) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildStructuredPath = (fileName: string): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${businessId}/${category}/${year}/${month}/${timestamp}_${safeName}`;
  };

  const checkStorageLimit = async (fileSize: number): Promise<boolean> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('check_storage_limit', {
        p_business_id: businessId,
        p_file_size_bytes: fileSize,
      });

      if (rpcError) {
        // If function doesn't exist yet, allow the upload
        console.warn('Storage limit check skipped:', rpcError.message);
        return true;
      }

      if (data && !data.allowed) {
        setLimitExceeded(true);
        setError(data.message || 'Storage limit exceeded');
        toast({
          title: 'Storage Limit Reached',
          description: data.message,
          variant: 'destructive',
        });
        return false;
      }

      return true;
    } catch (err) {
      // Allow upload if limit check fails
      console.warn('Storage limit check error:', err);
      return true;
    }
  };

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploadedFile(null);
      setLimitExceeded(false);

      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        const msg = `File type "${file.type || 'unknown'}" is not accepted. Please upload PDF, images, Excel, Word, or CSV files.`;
        setError(msg);
        onUploadError?.(msg);
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        const msg = `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${(maxSize / 1024 / 1024).toFixed(0)}MB.`;
        setError(msg);
        onUploadError?.(msg);
        return;
      }

      // Check subscription storage limit
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

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false });

        if (storageError) throw storageError;
        setProgress(60);

        // Create a signed URL (1 hour expiry) instead of public URL
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600);

        if (signedUrlError) throw signedUrlError;
        const signedUrl = signedUrlData.signedUrl;
        setProgress(75);

        // Get user for uploaded_by
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Insert document record with structured path
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

        // Create initial version entry
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
        setUploadedFile(file.name);
        toast({ title: 'Uploaded!', description: `"${file.name}" uploaded successfully.` });

        onUploadComplete?.({
          id: docRecord.id,
          fileName: file.name,
          storagePath,
          signedUrl,
        });
      } catch (err: any) {
        const errorMsg = err.message || 'Upload failed. Please try again.';
        setError(errorMsg);
        toast({ title: 'Upload Failed', description: errorMsg, variant: 'destructive' });
        onUploadError?.(errorMsg);
        await logError('file_upload', err, { businessId, category, fileName: file.name });
      } finally {
        setUploading(false);
      }
    },
    [businessId, category, acceptedTypes, maxSize, toast, onUploadComplete, onUploadError]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.[0]) {
        uploadFile(e.dataTransfer.files[0]);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        uploadFile(e.target.files[0]);
      }
    },
    [uploadFile]
  );

  const resetUpload = () => {
    setUploadedFile(null);
    setError(null);
    setProgress(0);
    setLimitExceeded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : uploadedFile
            ? 'border-green-400 bg-green-50'
            : error
            ? 'border-red-400 bg-red-50'
            : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
        }`}
      >
        {uploadedFile ? (
          <div className="space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700">Upload Successful</p>
            <p className="text-sm text-green-600">{uploadedFile}</p>
            <Button size="sm" variant="outline" onClick={resetUpload} className="mt-2">
              Upload Another
            </Button>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="font-semibold text-red-700">
              {limitExceeded ? 'Storage Limit Reached' : 'Upload Failed'}
            </p>
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={resetUpload} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : uploading ? (
          <div className="space-y-4">
            <File className="h-12 w-12 text-blue-500 mx-auto animate-pulse" />
            <p className="text-sm font-medium text-blue-700">Uploading...</p>
            <div className="w-full max-w-xs mx-auto bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500">{progress}%</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="h-12 w-12 text-slate-400 mx-auto" />
            <p className="font-medium text-slate-700">Drag and drop your file here</p>
            <p className="text-sm text-slate-500">
              PDF, Images, Excel, Word, CSV (max {(maxSize / 1024 / 1024).toFixed(0)}MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept={acceptedTypes.join(',')}
              id="file-upload-input"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-900 hover:bg-blue-800"
            >
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
            <p className="text-xs text-slate-400 mt-2">
              Stored at: <code className="bg-slate-200 px-1 rounded">business/{category}/YYYY/MM/</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
