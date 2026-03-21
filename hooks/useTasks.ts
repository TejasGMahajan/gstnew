import { useState, useEffect, useCallback } from 'react';
import { taskService } from '@/lib/services/task.service';
import { Task } from '@/types';

export function useTasks(businessId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await taskService.list(businessId);
      setTasks(response.data as Task[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const updateStatus = async (taskId: string, newStatus: string) => {
    try {
      await taskService.transitionStatus(taskId, newStatus);
      await loadTasks();
    } catch (err: unknown) {
      throw err;
    }
  };

  return { tasks, loading, error, loadTasks, updateStatus };
}
