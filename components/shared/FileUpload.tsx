// FILE: components/shared/FileUpload.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { sanitizeFileName } from '@/lib/sanitize';
import { logUserAction } from '@/lib/api';
import { UpgradePrompt } from '@/lib/featureGate';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface FileUploadProps {
  businessId: string;
  userId: string;
  category: string;
  onUploadComplete: (doc: any) => void;
}

export default function FileUpload({ businessId, userId, category, onUploadComplete }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_BYTES) return `File is too large. Maximum size is 10 MB. Your file: ${formatFileSize(file.size)}`;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
      return `File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    return null;
  };

  const checkUploadLimit = useCallback(async () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('uploaded_at', firstOfMonth);

    // Check subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan_type')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .maybeSingle();

    const plan = sub?.plan_type || 'free';
    if (plan !== 'free') return { allowed: true, used: count || 0, limit: Infinity };

    const used = count || 0;
    const limit = 5;
    return { allowed: used < limit, used, limit };
  }, [businessId]);

  const handleFile = (file: File) => {
    setError('');
    setSuccess(false);
    setLimitExceeded(false);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError('');
    setUploading(true);
    setProgress(10);

    try {
      // 1. Check upload limit
      const limitCheck = await checkUploadLimit();
      if (!limitCheck.allowed) {
        setLimitExceeded(true);
        setUploading(false);
        return;
      }

      setProgress(20);

      // 2. Build storage path
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now();
      const safeFileName = sanitizeFileName(selectedFile.name);
      const storagePath = `${businessId}/${category}/${year}/${month}/${timestamp}_${safeFileName}`;

      setProgress(40);

      // 3. Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) throw new Error(storageError.message);

      setProgress(70);

      // 4. Get public URL
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
      const fileUrl = urlData.publicUrl;

      setProgress(85);

      // 5. Insert document record
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          business_id: businessId,
          file_name: safeFileName,
          file_url: fileUrl,
          file_type: selectedFile.type || selectedFile.name.split('.').pop() || 'unknown',
          file_size: selectedFile.size,
          category: category,
          uploaded_by: userId,
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (docError) throw new Error(docError.message);

      setProgress(95);

      // 6. Log action
      await logUserAction('uploaded', 'document', docData.id, `Uploaded ${safeFileName} to ${category}`, businessId);

      setProgress(100);
      setSuccess(true);
      setSelectedFile(null);

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';

      onUploadComplete(docData);

      // Reset success after 3 seconds
      setTimeout(() => { setSuccess(false); setProgress(0); }, 3000);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError('');
    setLimitExceeded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Limit Exceeded State ──────────────────────────────────────────────────

  if (limitExceeded) {
    return (
      <div className="space-y-3">
        <UpgradePrompt featureName="Document Upload (Free plan limit reached)" />
        <button
          onClick={() => setLimitExceeded(false)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Success State ─────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="text-base font-semibold text-slate-800">Upload successful!</p>
        <p className="text-sm text-slate-500 mt-1">Your document has been saved to the vault.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : selectedFile
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">Drag & drop a file here, or click to browse</p>
            <p className="text-xs text-slate-400 mt-2">Accepted: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX • Max 10 MB</p>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-600 font-medium">Uploading...</p>
            <p className="text-xs text-slate-500">{progress}%</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="h-2 bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !uploading && (
        <button
          onClick={handleUpload}
          className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      )}
    </div>
  );
}
