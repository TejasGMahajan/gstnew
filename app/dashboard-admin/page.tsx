'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, CreditCard, Files, TrendingUp, AlertTriangle, ShieldCheck, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  checked_at: string;
  metrics: {
    total_users: number;
    active_subscriptions: number;
    total_documents: number;
    total_tasks: number;
    overdue_tasks: number;
    errors_24h: number;
    critical_errors_24h: number;
    avg_storage_usage_pct: number;
  };
}

interface ErrorLog {
  id: string;
  user_id: string;
  action: string;
  error_message: string;
  severity: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && profile) {
      if (profile.user_type !== 'admin') {
        toast({ title: 'Access Denied', description: 'Admin access required.', variant: 'destructive' });
        router.push('/dashboard');
        return;
      }
      loadAdminData();
    }
  }, [user, profile]);

  const loadAdminData = async () => {
    try {
      // System health check
      const { data: healthData, error: healthError } = await supabase.rpc('system_health_check');
      if (!healthError && healthData) {
        setHealth(healthData as HealthCheck);
      }

      // Recent error logs
      const { data: logs } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setErrorLogs(logs || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast({ title: 'Error', description: 'Failed to load admin dashboard.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-orange-100 text-orange-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  const metrics = health?.metrics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <PageHeader
        title="Admin Dashboard"
        subtitle="System overview and monitoring"
        userInfo={{ name: profile?.full_name || 'Admin', detail: 'System Administrator' }}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Status Banner */}
        {health && (
          <div className={`rounded-xl p-4 mb-8 flex items-center gap-4 ${
            health.status === 'healthy'
              ? 'bg-green-50 border-2 border-green-200'
              : health.status === 'degraded'
              ? 'bg-yellow-50 border-2 border-yellow-200'
              : 'bg-red-50 border-2 border-red-200'
          }`}>
            <div className={`h-4 w-4 rounded-full ${getStatusColor(health.status)} animate-pulse`}></div>
            <div>
              <h3 className="font-bold text-lg">
                System Status: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </h3>
              <p className="text-sm text-slate-600">
                Last checked: {format(new Date(health.checked_at), 'MMM dd, yyyy hh:mm:ss a')}
              </p>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-slate-900">{metrics?.total_users || 0}</p>
              <p className="text-sm text-slate-600">Total Users</p>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 text-center">
              <CreditCard className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-slate-900">{metrics?.active_subscriptions || 0}</p>
              <p className="text-sm text-slate-600">Active Subs</p>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 text-center">
              <Files className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-slate-900">{metrics?.total_documents || 0}</p>
              <p className="text-sm text-slate-600">Documents</p>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 text-center">
              <Activity className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-slate-900">{metrics?.avg_storage_usage_pct || 0}%</p>
              <p className="text-sm text-slate-600">Avg Storage</p>
            </CardContent>
          </Card>
        </div>

        {/* Second row of metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-50">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Errors (24h)</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.errors_24h || 0}</p>
                {(metrics?.critical_errors_24h || 0) > 0 && (
                  <Badge className="bg-red-600 mt-1">{metrics?.critical_errors_24h} critical</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-50">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Overdue Tasks</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.overdue_tasks || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-50">
                <ShieldCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Tasks</p>
                <p className="text-2xl font-bold text-slate-900">{metrics?.total_tasks || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Logs */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
            <CardTitle className="text-xl">Recent Error Logs</CardTitle>
            <CardDescription className="text-slate-300">
              Last 50 errors across the system
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {errorLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden md:table-cell">Error</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(log.severity)}`}>
                            {log.severity}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">
                          {log.action}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-slate-600 max-w-[300px] truncate">
                          {log.error_message}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                          {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8">
                <EmptyState
                  icon={ShieldCheck}
                  title="No errors"
                  description="All systems running smoothly!"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
