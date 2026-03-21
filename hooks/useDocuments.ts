import { useState, useEffect, useCallback } from 'react';
import { documentService } from '../services/document.service';
import { Document } from '@/types';

export function useDocuments(businessId: string | null) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await documentService.list(businessId);
      setDocuments(response.data as Document[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const removeDocument = async (documentId: string) => {
    try {
      await documentService.delete(documentId);
      await loadDocuments();
    } catch (err: unknown) {
      throw err;
    }
  };

  return { documents, loading, error, loadDocuments, removeDocument };
}
