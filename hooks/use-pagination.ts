'use client';

import { useState, useCallback } from 'react';

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UsePaginationOptions {
  initialPageSize?: number;
}

export function usePagination({ initialPageSize = 20 }: UsePaginationOptions = {}) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
    totalPages: 0,
  });

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, Math.min(page, prev.totalPages || 1)) }));
  }, []);

  const nextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      page: Math.min(prev.page + 1, prev.totalPages),
    }));
  }, []);

  const prevPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      page: Math.max(prev.page - 1, 1),
    }));
  }, []);

  const updateTotal = useCallback(
    (total: number) => {
      setPagination((prev) => ({
        ...prev,
        total,
        totalPages: Math.ceil(total / prev.pageSize),
      }));
    },
    []
  );

  const resetPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const rangeStart = (pagination.page - 1) * pagination.pageSize;
  const rangeEnd = rangeStart + pagination.pageSize - 1;

  return {
    ...pagination,
    setPage,
    nextPage,
    prevPage,
    updateTotal,
    resetPage,
    rangeStart,
    rangeEnd,
    hasNext: pagination.page < pagination.totalPages,
    hasPrev: pagination.page > 1,
  };
}
