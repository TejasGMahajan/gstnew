// FILE: app/(dashboard)/dashboard-owner/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { transitionTaskStatus, logUserAction } from '@/lib/api';
import StatsCard from '@/components/shared/StatsCard';
import { SkeletonCard, SkeletonRow } from '@/components/shared/SkeletonCard';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  CheckCircle, Clock, FileText, TrendingUp, AlertTriangle,
  Upload, HardDrive, MessageSquare, ArrowRight, RefreshCw
} from 'lucide-react';
import type { ComplianceTask, Document } from '@/lib/supabase/types';

// ─── Compliance Health Gauge ──────────────────────────────────────────────────

function ComplianceGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-slate-900">{score}%</span>
          <span className="text-xs text-slate-500">Health</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2" style={{ color }}>
        {score >= 80 ? 'Excellent' : score >= 60 ? 'Moderate' : 'Needs Attention'}
      </p>
    </div>
  );
}

// ─── Days Badge ───────────────────────────────────────────────────────────────

function DaysBadge({ dueDate }: { dueDate: string }) {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full font-medium border border-rose-200">{Math.abs(diff)}d overdue</span>;
  if (diff === 0) return <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full font-medium border border-rose-200">Due today</span>;
  if (diff <= 3) return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium border border-amber-200">Due in {diff}d</span>;
  return <span className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full font-medium border border-slate-200">Due in {diff}d</span>;
}

const DONE_STATUSES = new Set<string>(['filed', 'acknowledged', 'locked']);
const ACTIVE_STATUSES = new Set<string>(['created', 'awaiting_documents', 'under_review', 'ready_to_file']);

function isTaskDone(t: ComplianceTask) { return DONE_STATUSES.has(t.status); }
function isTaskOverdue(t: ComplianceTask) {
  return ACTIVE_STATUSES.has(t.status) && new Date(t.due_date) < new Date();
}

function taskBorderColor(task: ComplianceTask) {
  if (isTaskDone(task)) return 'border-l-emerald-500';
  if (isTaskOverdue(task)) return 'border-l-rose-500';
  const due = new Date(task.due_date);
  const diff = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 3) return 'border-l-amber-500';
  return 'border-l-indigo-400';
}

// ─── Dashboard Owner Page ─────────────────────────────────────────────────────

interface Subscription {
  plan_type: string;
  status: string;
}

interface StorageUsage {
  used_mb: number;
  total_mb: number;
}

interface WhatsAppCredits {
  credits_remaining: number;
  credits_total: number;
}

export default function DashboardOwnerPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [waCredits, setWaCredits] = useState<WhatsAppCredits | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [markDoneError, setMarkDoneError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      // Fetch business
      const { data: biz } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!biz) {
        router.replace('/onboarding');
        return;
      }
      setBusiness(biz);

      // Parallel fetches
      const [tasksRes, docsRes, subRes, storageRes, waRes] = await Promise.allSettled([
        supabase
          .from('compliance_tasks')
          .select('*')
          .eq('business_id', biz.id)
          .order('due_date', { ascending: true })
          .limit(20),

        supabase
          .from('documents')
          .select('*')
          .eq('business_id', biz.id)
          .order('uploaded_at', { ascending: false })
          .limit(4),

        supabase
          .from('subscriptions')
          .select('plan_type, status')
          .eq('business_id', biz.id)
          .eq('status', 'active')
          .maybeSingle(),

        supabase
          .from('storage_usage')
          .select('used_mb, total_mb')
          .eq('business_id', biz.id)
          .maybeSingle(),

        supabase
          .from('whatsapp_credits')
          .select('credits_remaining, credits_total')
          .eq('business_id', biz.id)
          .maybeSingle(),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data) setTasks(tasksRes.value.data);
      if (docsRes.status === 'fulfilled' && docsRes.value.data) setDocuments(docsRes.value.data);
      if (subRes.status === 'fulfilled' && subRes.value.data) setSubscription(subRes.value.data);
      if (storageRes.status === 'fulfilled' && storageRes.value.data) setStorageUsage(storageRes.value.data);
      if (waRes.status === 'fulfilled' && waRes.value.data) setWaCredits(waRes.value.data);
    } finally {
      setPageLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user) loadData();
  }, [authLoading, user, loadData, router]);

  const handleMarkDone = async (taskId: string) => {
    if (!business || markingDone) return;
    setMarkingDone(taskId);
    setMarkDoneError(null);
    try {
      await transitionTaskStatus(taskId, 'acknowledged');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'acknowledged' as const } : t));
      await logUserAction('completed', 'task', taskId, 'Task marked as complete by owner', business.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update task status';
      setMarkDoneError(msg);
    } finally {
      setMarkingDone(null);
    }
  };

  // ── Derived Stats ────────────────────────────────────────────────────────
  const overdueTasks = tasks.filter(isTaskOverdue);
  const completedTasks = tasks.filter(isTaskDone);
  const pendingTasks = tasks.filter(t => ACTIVE_STATUSES.has(t.status));
  const complianceScore = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 100;

  const upcomingTasks = tasks
    .filter(t => !isTaskDone(t))
    .slice(0, 5);

  const nextDeadline = upcomingTasks[0]
    ? Math.ceil((new Date(upcomingTasks[0].due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const storageMB = storageUsage ? storageUsage.used_mb.toFixed(1) : '0';
  const storageLimitMB = storageUsage ? storageUsage.total_mb.toFixed(0) : (subscription?.plan_type === 'pro' ? '2048' : '100');
  const storagePercent = storageUsage ? Math.min(100, (storageUsage.used_mb / storageUsage.total_mb) * 100) : 0;

  const plan = subscription?.plan_type || 'free';

  if (authLoading) {
    return (
      <div className="page-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* ── Free Plan Banner ── */}
      {plan === 'free' && (
        <div className="mb-6 flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-indigo-900">You're on the Free Plan</p>
            <p className="text-xs text-indigo-700 mt-0.5">Upgrade to Pro for WhatsApp alerts, unlimited documents, and PDF exports.</p>
          </div>
          <a href="/pricing" className="flex-shrink-0 ml-4 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">
            Upgrade →
          </a>
        </div>
      )}

      {/* ── Action Required Banner ── */}
      {business && !business.gstin && (
        <a href="/settings" className="mb-4 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Add your GSTIN in settings →</p>
            <p className="text-xs text-amber-700 mt-0.5">Your compliance calendar may be incomplete without GSTIN.</p>
          </div>
        </a>
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">
            {business ? `Welcome back, ${profile?.full_name?.split(' ')[0] || 'there'}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {business?.business_name} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Stat Cards ── */}
      {pageLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Compliance Score"
            value={`${complianceScore}%`}
            icon={TrendingUp}
            color={complianceScore >= 80 ? 'emerald' : complianceScore >= 60 ? 'amber' : 'rose'}
            subtitle={`${completedTasks.length}/${tasks.length} tasks done`}
          />
          <StatsCard
            label="Pending Tasks"
            value={pendingTasks.length}
            icon={Clock}
            color="amber"
            subtitle={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'None overdue'}
          />
          <StatsCard
            label="Documents Uploaded"
            value={documents.length}
            icon={FileText}
            color="indigo"
          />
          <StatsCard
            label="Days to Next Deadline"
            value={nextDeadline === null ? 'N/A' : nextDeadline < 0 ? 'Overdue' : `${nextDeadline}d`}
            icon={AlertTriangle}
            color={nextDeadline === null ? 'slate' : nextDeadline < 0 ? 'rose' : nextDeadline <= 3 ? 'amber' : 'slate'}
            subtitle={upcomingTasks[0]?.task_name || 'No pending tasks'}
          />
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Deadlines + Health Gauge */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-base">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Upcoming Deadlines</h2>
              <a href="/tasks" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {markDoneError && (
              <div className="mx-5 mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {markDoneError}
              </div>
            )}
            <div className="divide-y divide-slate-50">
              {pageLoading ? (
                [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
              ) : upcomingTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">All caught up!</p>
                  <p className="text-xs text-slate-400 mt-1">No pending tasks. Great work!</p>
                </div>
              ) : (
                upcomingTasks.map((task) => (
                  <div key={task.id} className={`flex items-center gap-3 px-5 py-3 border-l-4 ${taskBorderColor(task)}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.task_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{task.task_type}</span>
                        <DaysBadge dueDate={task.due_date} />
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                    {!isTaskDone(task) && (
                      <button
                        onClick={() => handleMarkDone(task.id)}
                        disabled={markingDone === task.id}
                        className="flex-shrink-0 px-3 py-1 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                      >
                        {markingDone === task.id ? '...' : 'Mark Done'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Documents */}
          <div className="card-base">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Recent Documents</h2>
              <a href="/vault" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                View vault <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-slate-50">
              {pageLoading ? (
                [...Array(3)].map((_, i) => <SkeletonRow key={i} />)
              ) : documents.length === 0 ? (
                <div className="p-8 text-center">
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">No documents yet</p>
                  <a href="/vault" className="text-xs text-indigo-600 hover:underline mt-1 block">Upload your first document →</a>
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
                      <p className="text-xs text-slate-400">
                        {doc.category} • {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* Compliance Health Gauge */}
          <div className="card-base p-6">
            <h3 className="font-semibold text-slate-900 mb-4 text-sm">Compliance Health</h3>
            <div className="flex justify-center">
              <ComplianceGauge score={complianceScore} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <p className="text-lg font-bold text-emerald-700">{completedTasks.length}</p>
                <p className="text-xs text-emerald-600">Done</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <p className="text-lg font-bold text-amber-700">{pendingTasks.length - overdueTasks.length}</p>
                <p className="text-xs text-amber-600">Pending</p>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg">
                <p className="text-lg font-bold text-rose-700">{overdueTasks.length}</p>
                <p className="text-xs text-rose-600">Overdue</p>
              </div>
            </div>
          </div>

          {/* Resource Meters */}
          <div className="card-base p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm">Resource Usage</h3>

            {/* Storage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">Storage</span>
                </div>
                <span className="text-xs text-slate-500">{storageMB} MB / {storageLimitMB} MB</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${storagePercent > 80 ? 'bg-rose-500' : storagePercent > 60 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>

            {/* WhatsApp Credits (Pro only) */}
            {plan !== 'free' && waCredits && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">WhatsApp Credits</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {waCredits.credits_remaining} / {waCredits.credits_total}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, (waCredits.credits_remaining / waCredits.credits_total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {plan === 'free' && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  WhatsApp alerts available on Pro
                </p>
                <a href="/pricing" className="text-xs text-indigo-600 font-medium hover:underline mt-1 block">
                  Upgrade to Pro →
                </a>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card-base p-6">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <a href="/vault" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">Upload Document</span>
                <ArrowRight className="w-3 h-3 text-slate-400 ml-auto" />
              </a>
              <a href="/tasks" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-slate-700">View All Tasks</span>
                <ArrowRight className="w-3 h-3 text-slate-400 ml-auto" />
              </a>
              <a href="/analytics" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700">View Analytics</span>
                <ArrowRight className="w-3 h-3 text-slate-400 ml-auto" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
