'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, File as FileIcon, CheckCircle2, AlertCircle, FileText, Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileUpload, ALLOWED_TYPES, MAX_FILE_SIZE } from '@/hooks/useFileUpload';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  businessId: string;
  category?: string;
  onUploadComplete?: (doc: Record<string, unknown>) => void;
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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile, uploading, progress, uploadedFile, error, resetUpload } = useFileUpload({
    businessId,
    category,
    onUploadComplete,
    onUploadError,
    acceptedTypes,
    maxSize
  });

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

  const getFileIcon = (type?: string) => {
    if (type?.includes('image')) return <ImageIcon className="h-8 w-8 text-blue-500" />;
    if (type?.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    return <FileIcon className="h-8 w-8 text-slate-500" />;
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && !uploadedFile && !error && fileInputRef.current?.click()}
        className={`relative overflow-hidden group border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
          dragOver
            ? 'border-blue-500 bg-blue-50/50 scale-[1.02]'
            : uploadedFile
            ? 'border-green-400 bg-green-50/30'
            : error
            ? 'border-red-400 bg-red-50/30'
            : 'border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-slate-50 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept={acceptedTypes.join(',')}
          id="file-upload-input"
        />

        {uploadedFile ? (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-lg">Upload Successful</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-sm text-slate-600 bg-white border border-slate-100 py-2 px-4 rounded-full shadow-sm mx-auto w-max">
                {getFileIcon(uploadedFile.type)}
                <span className="truncate max-w-[200px] font-medium">{uploadedFile.name}</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); resetUpload(); }} className="mt-4 rounded-full px-6">
              <RefreshCcw className="w-4 h-4 mr-2" /> Upload Another
            </Button>
          </div>
        ) : error ? (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-lg">Upload Failed</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); resetUpload(); }} className="mt-4 rounded-full px-6 hover:bg-red-50 hover:text-red-600">
              <RefreshCcw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        ) : uploading ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Uploading Document...</p>
              <p className="text-sm text-slate-500 mt-1">Please wait while we secure your file</p>
            </div>
            <div className="w-full max-w-[240px] mx-auto space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs font-medium text-slate-500 text-right">{progress}%</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-lg">Click or drag file to upload</p>
              <p className="text-sm text-slate-500 mt-1">
                PDF, PNG, JPG, Excel or Word (max {(maxSize / 1024 / 1024).toFixed(0)}MB)
              </p>
            </div>
            <div className="pt-4 flex justify-center gap-2">
               <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">Secure</span>
               <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">Encrypted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
