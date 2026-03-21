'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, ShieldCheck, BarChart3, PieChart } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LegalDisclaimer from '@/components/shared/LegalDisclaimer';

interface Alert {
  id: string;
  title: string;
  description: string;
  suggested_action?: string;
  severity: string;
}

interface AnalyticsData {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  complianceScore: number;
  tasksByType: { type: string; count: number }[];
  tasksByStatus: { status: string; count: number }[];
  monthlyTrend: { month: string; completed: number; total: number }[];
  alerts: Alert[];
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      // Get business IDs for this user
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user!.id);

      const businessIds = businesses?.map((b) => b.id) || [];
      if (businessIds.length === 0) {
        setData({ totalTasks: 0, completedTasks: 0, overdueTasks: 0, complianceScore: 0, tasksByType: [], tasksByStatus: [], monthlyTrend: [], alerts: [] });
        setLoading(false);
        return;
      }

      // Fetch all tasks
      const { data: tasks } = await supabase
        .from('compliance_tasks')
        .select('id, task_name, task_type, status, due_date, created_at')
        .in('business_id', businessIds)
        .is('deleted_at', null);

      const allTasks = tasks || [];
      const completed = allTasks.filter((t) => ['acknowledged', 'locked', 'filed'].includes(t.status));
      const overdue = allTasks.filter(
        (t) => new Date(t.due_date) < new Date() && !['acknowledged', 'locked', 'filed'].includes(t.status)
      );

      // Compliance score
      const score = allTasks.length > 0 ? Math.round((completed.length / allTasks.length) * 100) : 100;

      // Tasks by type
      const typeMap: Record<string, number> = {};
      allTasks.forEach((t) => { typeMap[t.task_type] = (typeMap[t.task_type] || 0) + 1; });
      const tasksByType = Object.entries(typeMap).map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Tasks by status
      const statusMap: Record<string, number> = {};
      allTasks.forEach((t) => { statusMap[t.status] = (statusMap[t.status] || 0) + 1; });
      const tasksByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      // Monthly trend (last 6 months)
      const monthlyTrend: { month: string; completed: number; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = format(d, 'MMM yyyy');
        const monthTasks = allTasks.filter((t) => {
          const cd = new Date(t.created_at);
          return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
        });
        const monthCompleted = monthTasks.filter((t) => ['acknowledged', 'locked', 'filed'].includes(t.status));
        monthlyTrend.push({ month: monthStr, completed: monthCompleted.length, total: monthTasks.length });
      }

      // Compliance alerts
      const { data: alerts } = await supabase
        .from('compliance_alerts')
        .select('*')
        .in('business_id', businessIds)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);

      setData({
        totalTasks: allTasks.length,
        completedTasks: completed.length,
        overdueTasks: overdue.length,
        complianceScore: score,
        tasksByType,
        tasksByStatus,
        monthlyTrend,
        alerts: alerts || [],
      });
    } catch (err: unknown) {
      console.error('Analytics error:', err instanceof Error ? err.message : String(err));
      toast({ title: 'Error', description: 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <LoadingSpinner message="Loading analytics..." />;

  const handleSignOut = async () => { await signOut(); router.push('/login'); };

  const getScoreColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

  const getScoreBg = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      created: 'bg-blue-500', awaiting_documents: 'bg-yellow-500', under_review: 'bg-orange-500',
      ready_to_file: 'bg-purple-500', filed: 'bg-cyan-500', acknowledged: 'bg-green-500', locked: 'bg-slate-500',
    };
    return colors[status] || 'bg-slate-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <PageHeader
        title="Analytics"
        subtitle="Compliance performance and insights"
        userInfo={{ name: profile?.full_name || '', detail: 'Business Analytics' }}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Score + Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-900 to-blue-700 text-white">
            <CardContent className="pt-6 text-center">
              <p className="text-5xl font-bold">{data?.complianceScore || 0}%</p>
              <p className="text-blue-200 text-sm mt-1">Compliance Score</p>
              <div className="mt-3 w-full bg-blue-800 rounded-full h-2">
                <div className={`h-2 rounded-full ${getScoreBg(data?.complianceScore || 0)}`}
                  style={{ width: `${data?.complianceScore || 0}%` }}></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-slate-900">{data?.completedTasks || 0}</p>
              <p className="text-sm text-slate-600">Completed</p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-slate-900">
                {(data?.totalTasks || 0) - (data?.completedTasks || 0) - (data?.overdueTasks || 0)}
              </p>
              <p className="text-sm text-slate-600">In Progress</p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-red-600">{data?.overdueTasks || 0}</p>
              <p className="text-sm text-slate-600">Overdue</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tasks by Type */}
          <Card className="shadow-md">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><PieChart className="h-5 w-5 text-blue-600" /> Tasks by Type</CardTitle></CardHeader>
            <CardContent>
              {data?.tasksByType.length ? (
                <div className="space-y-3">
                  {data.tasksByType.map((item) => (
                    <div key={item.type} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{item.type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-slate-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(item.count / (data?.totalTasks || 1)) * 100}%` }}></div>
                        </div>
                        <span className="text-sm font-semibold text-slate-900 w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={PieChart} title="No task data" description="Tasks will appear as they are created" />}
            </CardContent>
          </Card>

          {/* Tasks by Status */}
          <Card className="shadow-md">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple-600" /> Tasks by Status</CardTitle></CardHeader>
            <CardContent>
              {data?.tasksByStatus.length ? (
                <div className="space-y-3">
                  {data.tasksByStatus.map((item) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${getStatusColor(item.status)}`}></div>
                        <span className="text-sm text-slate-700 capitalize">{item.status.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={BarChart3} title="No status data" description="Status distribution will appear here" />}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card className="shadow-md">
          <CardHeader><CardTitle className="text-lg">Monthly Compliance Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {data?.monthlyTrend.map((m) => {
                const completionRate = m.total > 0 ? (m.completed / m.total) * 100 : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-700">{Math.round(completionRate)}%</span>
                    <div className="w-full bg-slate-100 rounded-t-sm relative" style={{ height: '120px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all"
                        style={{ height: `${completionRate}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-500">{m.month.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Compliance Alerts */}
        {data?.alerts && data.alerts.length > 0 && (
          <Card className="shadow-md border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="text-lg text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Active Compliance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {data.alerts.map((alert: Alert) => (
                <div key={alert.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-red-900">{alert.title}</p>
                      <p className="text-xs text-red-700 mt-0.5">{alert.description}</p>
                      {alert.suggested_action && (
                        <p className="text-xs text-red-600 mt-1 italic">💡 {alert.suggested_action}</p>
                      )}
                    </div>
                    <Badge className={alert.severity === 'critical' ? 'bg-red-600' : 'bg-yellow-600'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <LegalDisclaimer type="banner" context="general" />
      </main>
    </div>
  );
}
