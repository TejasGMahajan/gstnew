import { useState } from 'react';
import { documentService } from '../services/document.service';
import { useToast } from './use-toast';

export function useUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const upload = async (businessId: string, file: File, category: string, storagePath: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await documentService.upload(businessId, file, category, storagePath);
      toast({
        title: 'Upload successful',
        description: 'Your document has been uploaded.',
      });
      return response;
    } catch (err: any) {
      const msg = err.message || 'Failed to upload document';
      setError(msg);
      toast({
        title: 'Upload failed',
        description: msg,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading, error };
}
