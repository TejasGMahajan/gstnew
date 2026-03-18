'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, HardDrive, Zap, TrendingUp, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock, Shield } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

interface Business {
  id: string;
  business_name: string;
  compliance_score: number;
  business_type?: string;
}

interface Subscription {
  plan_type: string;
  status: string;
}

interface ComplianceTask {
  id: string;
  task_name: string;
  task_type: string;
  due_date: string;
  status: string;
  priority: string;
}

interface StorageUsage {
  used_mb: number;
  total_mb: number;
}

interface WhatsAppCredits {
  credits_remaining: number;
  credits_total: number;
}

export default function OwnerDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [credits, setCredits] = useState<WhatsAppCredits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && profile) {
      loadDashboardData();
    }
  }, [user, profile]);

  const loadDashboardData = async () => {
    try {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();

      if (!businessData) {
        router.push('/onboarding');
        return;
      }

      setBusiness(businessData);

      const [subscriptionRes, tasksRes, storageRes, creditsRes] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('business_id', businessData.id).maybeSingle(),
        supabase.from('compliance_tasks').select('*').eq('business_id', businessData.id).order('due_date', { ascending: true }),
        supabase.from('storage_usage').select('*').eq('business_id', businessData.id).maybeSingle(),
        supabase.from('whatsapp_credits').select('*').eq('business_id', businessData.id).maybeSingle(),
      ]);

      if (!subscriptionRes.data) {
        const { data: newSub } = await supabase
          .from('subscriptions')
          .insert({ business_id: businessData.id, plan_type: 'free', status: 'active' })
          .select()
          .single();
        setSubscription(newSub);
      } else {
        setSubscription(subscriptionRes.data);
      }

      if (!storageRes.data) {
        const { data: newStorage } = await supabase
          .from('storage_usage')
          .insert({ business_id: businessData.id, used_mb: 0, total_mb: 100 })
          .select()
          .single();
        setStorage(newStorage);
      } else {
        setStorage(storageRes.data);
      }

      if (!creditsRes.data) {
        const { data: newCredits } = await supabase
          .from('whatsapp_credits')
          .insert({ business_id: businessData.id, credits_remaining: 50, credits_total: 50 })
          .select()
          .single();
        setCredits(newCredits);
      } else {
        setCredits(creditsRes.data);
      }

      setTasks(tasksRes.data || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast({ title: 'Error', description: 'Failed to load dashboard data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const getComplianceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const showUpgradeBanner =
    subscription?.plan_type === 'free' &&
    business?.business_type?.toLowerCase().includes('proprietorship');

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const complianceScore = business?.compliance_score || 0;
  const storagePercent = storage ? (storage.used_mb / storage.total_mb) * 100 : 0;
  const creditsPercent = credits ? (credits.credits_remaining / credits.credits_total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <PageHeader
        title={business?.business_name || 'Dashboard'}
        badge={
          <Badge variant="outline" className="text-xs">
            {subscription?.plan_type?.toUpperCase() || 'FREE'}
          </Badge>
        }
        subtitle={business?.business_type}
        actions={[
          {
            label: 'Document Vault',
            onClick: () => router.push('/vault'),
            icon: <Shield className="h-4 w-4 mr-2" />,
            variant: 'outline',
            className: 'border-blue-900 text-blue-900 hover:bg-blue-50',
          },
          {
            label: 'Upgrade',
            onClick: () => router.push('/pricing'),
            icon: <Zap className="h-4 w-4 mr-2" />,
            variant: 'outline',
            className: 'border-blue-900 text-blue-900 hover:bg-blue-50',
          },
        ]}
        onSignOut={handleSignOut}
      />

      {showUpgradeBanner && (
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white sticky top-[73px] z-[9] shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5" />
                <p className="font-semibold text-sm sm:text-base">
                  Upgrade to Pro to unlock WhatsApp Alerts and 2GB Vault Storage
                </p>
              </div>
              <Link href="/pricing">
                <Button className="bg-white text-blue-900 hover:bg-blue-50 font-semibold">
                  Upgrade via UPI
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <Card className="lg:col-span-1 shadow-lg border-slate-200">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Compliance Health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle cx="96" cy="96" r="88" stroke="#e2e8f0" strokeWidth="16" fill="none" />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke={complianceScore >= 80 ? '#22c55e' : complianceScore >= 60 ? '#eab308' : '#ef4444'}
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - complianceScore / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-5xl font-bold ${getComplianceColor(complianceScore)}`}>
                    {complianceScore}%
                  </span>
                  <span className="text-sm text-slate-600 mt-1">Compliant</span>
                </div>
              </div>
              <div className="mt-6 w-full space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">On Time Filings</span>
                  <span className="font-semibold">{Math.round(complianceScore)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Document Completeness</span>
                  <span className="font-semibold">85%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Resource Meters</CardTitle>
              <CardDescription>Monitor your platform usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-blue-900" />
                    <span className="font-semibold text-slate-900">Vault Storage</span>
                  </div>
                  <span className="text-sm font-medium text-slate-600">
                    {storage?.used_mb?.toFixed(0) || 0}MB of {storage?.total_mb || 100}MB Used
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${storagePercent}%` }}></div>
                </div>
                {storagePercent > 80 && (
                  <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Storage running low. Consider upgrading.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-900" />
                    <span className="font-semibold text-slate-900">WhatsApp Alert Credits</span>
                  </div>
                  <span className="text-sm font-medium text-slate-600">
                    {credits?.credits_remaining || 0} of {credits?.credits_total || 50} Remaining
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-green-600 h-3 rounded-full" style={{ width: `${creditsPercent}%` }}></div>
                </div>
                {subscription?.plan_type === 'free' && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Upgrade to Pro for unlimited WhatsApp alerts
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">
                    {tasks.filter((t) => t.status === 'completed').length}
                  </p>
                  <p className="text-xs text-slate-600">Completed Tasks</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">
                    {tasks.filter((t) => t.status === 'pending').length}
                  </p>
                  <p className="text-xs text-slate-600">Pending Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-t-lg">
              <CardTitle className="text-xl">Smart Calendar</CardTitle>
              <CardDescription className="text-blue-100">
                Track your statutory deadlines
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <p className="text-slate-600 mb-2">Calendar View</p>
                <p className="text-sm text-slate-500">Visual deadline calendar coming soon</p>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs justify-center flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Overdue</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
              <CardTitle className="text-xl">Upcoming Deadlines</CardTitle>
              <CardDescription className="text-slate-300">
                Tasks due in the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {tasks.slice(0, 10).map((task) => {
                  const daysUntil = differenceInDays(new Date(task.due_date), new Date());
                  const isOverdue = daysUntil < 0;
                  const isDueSoon = daysUntil >= 0 && daysUntil <= 3;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-lg border-2 ${
                        task.status === 'completed'
                          ? 'bg-green-50 border-green-200'
                          : isOverdue
                          ? 'bg-red-50 border-red-200'
                          : isDueSoon
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{task.task_name}</h4>
                          <p className="text-sm text-slate-600 mt-1">{task.task_type}</p>
                        </div>
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : isOverdue ? (
                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        ) : (
                          <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3 text-sm flex-wrap">
                        <span className="font-medium">
                          {format(new Date(task.due_date), 'MMM dd, yyyy')}
                        </span>
                        <span
                          className={`${
                            isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-blue-600'
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(daysUntil)} days overdue`
                            : daysUntil === 0
                            ? 'Due today'
                            : `${daysUntil} days remaining`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <EmptyState icon={Clock} title="No upcoming tasks" description="You're all caught up!" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
