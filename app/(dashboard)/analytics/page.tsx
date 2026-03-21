// FILE: app/(dashboard)/analytics/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { RefreshCw, TrendingUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie,
  Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const COLORS = {
  indigo: '#4F46E5',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
};

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height }} />
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      const [tasksRes, docsRes] = await Promise.allSettled([
        supabase
          .from('compliance_tasks')
          .select('id, status, due_date, task_type, created_at, completed_at')
          .eq('business_id', biz.id),

        supabase
          .from('documents')
          .select('id, uploaded_at, category')
          .eq('business_id', biz.id)
          .order('uploaded_at', { ascending: false }),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data) setTasks(tasksRes.value.data);
      if (docsRes.status === 'fulfilled' && docsRes.value.data) setDocuments(docsRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user) loadData();
  }, [authLoading, user, loadData, router]);

  // ── Chart Data Computation ───────────────────────────────────────────────

  // Last 6 months labels
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
  });

  // Compliance trend: % completed tasks per month
  const complianceTrend = last6Months.map(({ label, year, month }) => {
    const monthTasks = tasks.filter(t => {
      const d = new Date(t.due_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const done = monthTasks.filter(t => t.status === 'completed').length;
    const score = monthTasks.length > 0 ? Math.round((done / monthTasks.length) * 100) : 0;
    return { month: label, score };
  });

  // Task breakdown for donut
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const overdue = tasks.filter(t => t.status === 'overdue').length;
  const taskBreakdown = [
    { name: 'Completed', value: completed, color: COLORS.emerald },
    { name: 'Pending', value: pending, color: COLORS.amber },
    { name: 'Overdue', value: overdue, color: COLORS.rose },
  ].filter(d => d.value > 0);

  // Monthly filings bar chart
  const monthlyFilings = last6Months.map(({ label, year, month }) => {
    const count = tasks.filter(t => {
      const d = t.completed_at ? new Date(t.completed_at) : null;
      return d && d.getFullYear() === year && d.getMonth() === month;
    }).length;
    return { month: label, tasks: count };
  });

  // Document uploads area chart
  const docUploads = last6Months.map(({ label, year, month }) => {
    const count = documents.filter(d => {
      const date = new Date(d.uploaded_at);
      return date.getFullYear() === year && date.getMonth() === month;
    }).length;
    return { month: label, uploads: count };
  });

  // Summary stats
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  // Average days to complete
  const completedWithDates = tasks.filter(t => t.status === 'completed' && t.completed_at);
  const avgDays = completedWithDates.length > 0
    ? Math.round(
        completedWithDates.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const done = new Date(t.completed_at).getTime();
          return sum + (done - created) / 86400000;
        }, 0) / completedWithDates.length
      )
    : 0;

  // Most missed: type with most overdue
  const overdueTasks = tasks.filter(t => t.status === 'overdue');
  const typeOverdueCounts = overdueTasks.reduce((acc, t) => {
    acc[t.task_type] = (acc[t.task_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostMissed = Object.entries(typeOverdueCounts).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'None';

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">{business?.business_name}</p>
        </div>
        <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tasks" value={totalTasks} sub="All time" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} color="text-emerald-600" sub={`${completed} of ${totalTasks} done`} />
        <StatCard label="Avg Days to Complete" value={`${avgDays}d`} sub="From creation to done" />
        <StatCard label="Most Missed Deadline" value={mostMissed} color="text-rose-600" sub="Filing type" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Compliance Trend Line */}
        <div className="card-base p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Compliance Score Trend</h3>
          </div>
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={complianceTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [`${v}%`, 'Score']}
                />
                <Line type="monotone" dataKey="score" stroke={COLORS.indigo} strokeWidth={2.5} dot={{ fill: COLORS.indigo, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 2. Task Breakdown Donut */}
        <div className="card-base p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Task Status Breakdown</h3>
          </div>
          {loading ? <ChartSkeleton /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={taskBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {taskBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {taskBreakdown.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <div>
                      <p className="text-xs font-medium text-slate-700">{entry.name}</p>
                      <p className="text-lg font-bold text-slate-900">{entry.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Monthly Filings Bar Chart */}
        <div className="card-base p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Monthly Filings Completed</h3>
          </div>
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyFilings} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [v, 'Tasks completed']}
                />
                <Bar dataKey="tasks" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 4. Document Uploads Area Chart */}
        <div className="card-base p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Document Uploads</h3>
          </div>
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={docUploads} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.indigo} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.indigo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [v, 'Uploads']}
                />
                <Area type="monotone" dataKey="uploads" stroke={COLORS.indigo} strokeWidth={2} fill="url(#uploadGrad)" dot={{ fill: COLORS.indigo, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
