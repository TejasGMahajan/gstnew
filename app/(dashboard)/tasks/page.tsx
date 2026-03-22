// FILE: app/(dashboard)/tasks/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { logUserAction } from '@/lib/api';
import { SkeletonTable } from '@/components/shared/SkeletonCard';
import StatusBadge from '@/components/shared/StatusBadge';
import Pagination from '@/components/shared/Pagination';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { CheckCircle, Clock, AlertTriangle, TrendingUp, RefreshCw, CalendarDays } from 'lucide-react';
import type { ComplianceTask } from '@/lib/supabase/types';
import { transitionTaskStatus } from '@/lib/api';

const DONE_STATUSES = new Set<string>(['filed', 'acknowledged', 'locked']);
const ACTIVE_STATUSES = new Set<string>(['created', 'awaiting_documents', 'under_review', 'ready_to_file']);
const isTaskDone = (t: ComplianceTask) => DONE_STATUSES.has(t.status);
const isTaskOverdue = (t: ComplianceTask) => ACTIVE_STATUSES.has(t.status) && new Date(t.due_date) < new Date();

const FREE_TASKS_LIMIT = 3;
const PAGE_SIZE = 8;

type FilterTab = 'all' | 'pending' | 'overdue' | 'completed';

const months = [
  'All months', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function DaysBadge({ dueDate }: { dueDate: string }) {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return (
    <span className="text-xs px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full font-semibold border border-rose-200">
      {Math.abs(diff)}d overdue
    </span>
  );
  if (diff === 0) return (
    <span className="text-xs px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full font-semibold border border-rose-200">Due today</span>
  );
  if (diff <= 3) return (
    <span className="text-xs px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full font-semibold border border-amber-200">Due in {diff}d</span>
  );
  return (
    <span className="text-xs px-2.5 py-0.5 bg-slate-50 text-slate-600 rounded-full font-medium border border-slate-200">Due in {diff}d</span>
  );
}

function taskBorderColor(task: ComplianceTask) {
  if (isTaskDone(task)) return 'border-l-emerald-500';
  if (isTaskOverdue(task)) return 'border-l-rose-500';
  const diff = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000);
  if (diff <= 3) return 'border-l-amber-500';
  return 'border-l-indigo-400';
}

const emptyMessages: Record<FilterTab, { icon: typeof CheckCircle; title: string; subtitle: string }> = {
  all: { icon: CheckCircle, title: 'No tasks yet', subtitle: 'Tasks will appear here once your compliance calendar is set up.' },
  pending: { icon: Clock, title: 'No pending tasks', subtitle: 'All your tasks are completed or overdue.' },
  overdue: { icon: CheckCircle, title: "No overdue tasks — you're on track!", subtitle: 'Keep it up! All filings are up to date.' },
  completed: { icon: TrendingUp, title: 'No completed tasks yet', subtitle: 'Mark tasks as complete when you file them.' },
};

export default function TasksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [allTasks, setAllTasks] = useState<ComplianceTask[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = all months
  const [page, setPage] = useState(1);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, business_name')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!biz) { router.replace('/onboarding'); return; }
      setBusiness(biz);

      const [tasksRes, subRes] = await Promise.allSettled([
        supabase
          .from('compliance_tasks')
          .select('*')
          .eq('business_id', biz.id)
          .order('due_date', { ascending: true }),
        supabase
          .from('subscriptions')
          .select('plan_type')
          .eq('business_id', biz.id)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data) setAllTasks(tasksRes.value.data);
      if (subRes.status === 'fulfilled' && subRes.value.data) setSubscription(subRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user) loadData();
  }, [authLoading, user, loadData, router]);

  const handleMarkComplete = async (taskId: string) => {
    if (!business || markingId) return;
    setMarkingId(taskId);
    setMarkError(null);
    try {
      await transitionTaskStatus(taskId, 'acknowledged');
      setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'acknowledged' as const } : t));
      await logUserAction('completed', 'task', taskId, 'Task marked complete by owner', business.id);
    } catch (err: unknown) {
      setMarkError(err instanceof Error ? err.message : 'Could not update task — it may need to be in a later stage first');
    } finally {
      setMarkingId(null);
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────

  const filtered = allTasks.filter(t => {
    if (activeTab === 'pending') return ACTIVE_STATUSES.has(t.status) && !isTaskOverdue(t);
    if (activeTab === 'overdue') return isTaskOverdue(t);
    if (activeTab === 'completed') return isTaskDone(t);
    return true;
  }).filter(t => {
    if (selectedMonth === 0) return true;
    return new Date(t.due_date).getMonth() + 1 === selectedMonth;
  });

  const plan = subscription?.plan_type || 'free';
  const isFree = plan === 'free';

  // Free plan: show only first FREE_TASKS_LIMIT tasks, then upgrade prompt
  const visibleTasks = isFree ? filtered.slice(0, FREE_TASKS_LIMIT) : filtered;
  const lockedCount = isFree ? Math.max(0, filtered.length - FREE_TASKS_LIMIT) : 0;

  // Pagination on visible tasks
  const totalVisible = visibleTasks.length;
  const paginatedTasks = visibleTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const total = allTasks.length;
  const overdue = allTasks.filter(isTaskOverdue).length;
  const completed = allTasks.filter(isTaskDone).length;
  const pending = allTasks.filter(t => ACTIVE_STATUSES.has(t.status) && !isTaskOverdue(t)).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'pending', label: 'Pending', count: pending },
    { key: 'overdue', label: 'Overdue', count: overdue },
    { key: 'completed', label: 'Completed', count: completed },
  ];

  const emptyMsg = emptyMessages[activeTab];
  const EmptyIcon = emptyMsg.icon;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">Compliance Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">{business?.business_name}</p>
        </div>
        <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="stat-card !py-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
          </div>
          <div className="stat-card !py-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pending}</p>
          </div>
          <div className="stat-card !py-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Overdue</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{overdue}</p>
          </div>
          <div className="stat-card !py-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Completion</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completionRate}%</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Month selector */}
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(Number(e.target.value)); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {months.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
      </div>

      {/* Task List */}
      <div className="card-base overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : paginatedTasks.length === 0 && lockedCount === 0 ? (
          <div className="py-16 text-center">
            <EmptyIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-base font-semibold text-slate-700">{emptyMsg.title}</p>
            <p className="text-sm text-slate-400 mt-1">{emptyMsg.subtitle}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {paginatedTasks.map((task) => (
              <div key={task.id} className={`flex items-start gap-3 px-5 py-4 border-l-4 ${taskBorderColor(task)} hover:bg-slate-50/50 transition-colors`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800">{task.task_name}</p>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{task.task_type}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays className="w-3 h-3" />
                      Due {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <DaysBadge dueDate={task.due_date} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={task.status} />
                  {!isTaskDone(task) && (
                    <button
                      onClick={() => handleMarkComplete(task.id)}
                      disabled={markingId === task.id}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    >
                      {markingId === task.id ? '...' : 'Mark Complete'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {markError && (
          <div className="mx-5 mb-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {markError}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalVisible > PAGE_SIZE && (
          <div className="px-5 pb-4">
            <Pagination page={page} total={totalVisible} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        )}

        {/* Free plan locked tasks */}
        {!loading && isFree && lockedCount > 0 && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100">
            <UpgradePrompt featureName={`${lockedCount} more tasks`} />
          </div>
        )}
      </div>
    </div>
  );
}
