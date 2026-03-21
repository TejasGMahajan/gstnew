'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Clock, CheckCircle2, AlertCircle, Upload, Building2, Shield, TrendingUp, Activity, Bell } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import OnboardingGuide from '@/components/shared/OnboardingGuide';
import { useTasks } from '@/hooks/useTasks';
import { useDocuments } from '@/hooks/useDocuments';
import { Business, Task, Document } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  // Use custom hooks for separation of concerns
  const { tasks, loading: tasksLoading, loadTasks } = useTasks(business?.id || null);
  const { documents, loading: docsLoading, loadDocuments } = useDocuments(business?.id || null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Profile is null — either fetch failed (RLS/500) or genuinely new user.
    // Either way, send to onboarding so they can set up their account.
    if (!profile) {
      setLoading(false);
      router.push('/onboarding');
      return;
    }

    if (profile.user_type === 'chartered_accountant') {
      router.push('/dashboard-ca');
      return;
    }

    if (profile.user_type === 'business_owner') {
      router.push('/dashboard-owner');
      return;
    }

    // Unknown user_type — send to onboarding
    setLoading(false);
    router.push('/onboarding');
  }, [user, profile, authLoading, router]);

  const loadBusiness = async () => {
    try {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();

      if (data) setBusiness(data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to build business profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const getTaskStatusColor = (task: any) => {
    if (task.status === 'completed') return 'border-l-green-500 bg-green-50/50';
    const dueDate = new Date(task.due_date);
    const daysUntilDue = differenceInDays(dueDate, new Date());

    if (isPast(dueDate)) return 'border-l-red-500 bg-red-50/50';
    if (daysUntilDue <= 3) return 'border-l-amber-500 bg-amber-50/50';
    return 'border-l-blue-500 bg-slate-50 border-slate-200';
  };

  const getDaysUntilText = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `${days} days left`;
  };

  const complianceScore = useMemo(() => {
    if (!tasks || tasks.length === 0) return 100;
    const overdue = tasks.filter((t: Task) => isPast(new Date(t.due_date)) && t.status !== 'completed').length;
    const pending = tasks.filter((t: Task) => t.status !== 'completed').length;
    return Math.max(0, Math.min(100, 100 - (overdue * 20) - (pending * 2)));
  }, [tasks]);

  const pendingTasksCount = useMemo(() => {
    if (!tasks) return 0;
    return tasks.filter((t: Task) => t.status !== 'completed').length;
  }, [tasks]);

  if (authLoading || loading) return <LoadingSpinner message="Loading your dashboard..." />;

  if (!business) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-xl border-slate-200">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 className="h-10 w-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Welcome aboard!</CardTitle>
            <CardDescription className="text-base text-slate-600">
              Let's set up your business profile to get started with compliance tracking.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/onboarding')} className="w-full h-12 text-lg">
              Set Up My Business
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <OnboardingGuide />

      <PageHeader
        title="Overview"
        subtitle={business.business_name}
        userInfo={{ name: profile?.full_name || '', detail: profile?.email || '' }}
        actions={[
          {
            label: 'Documents',
            onClick: () => router.push('/vault'),
            icon: <Shield className="h-4 w-4 mr-2" />,
            variant: 'outline',
          },
        ]}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">
        
        {/* TOP STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm shadow-slate-200/50 bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Compliance Score</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h2 className={`text-4xl font-bold ${complianceScore >= 90 ? 'text-green-600' : complianceScore >= 70 ? 'text-amber-500' : 'text-red-600'}`}>
                    {complianceScore}
                  </h2>
                  <span className="text-sm font-medium text-slate-400">/ 100</span>
                </div>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${complianceScore >= 90 ? 'bg-green-100' : 'bg-amber-100'}`}>
                <Activity className={`w-8 h-8 ${complianceScore >= 90 ? 'text-green-600' : 'text-amber-600'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm shadow-slate-200/50 bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Pending Tasks</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h2 className="text-4xl font-bold text-slate-900">
                    {pendingTasksCount}
                  </h2>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm shadow-slate-200/50 bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Recent Documents</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <h2 className="text-4xl font-bold text-slate-900">{documents.length}</h2>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COL: TASKS */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Upcoming Deadlines</h3>
              <Button variant="ghost" size="sm" className="text-blue-600 font-medium">View Calendar</Button>
            </div>
            
            {tasksLoading ? (
              <div className="space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl"></div>)}
              </div>
            ) : tasks.length === 0 ? (
               <Card className="border-dashed border-2 shadow-none"><CardContent className="p-12 text-center text-slate-500">No upcoming tasks.</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {tasks.slice(0,5).map((task: Task) => (
                  <div key={task.id} className={`group flex items-start gap-4 p-5 rounded-xl border-l-[6px] border border-y-slate-200 border-r-slate-200 transition-all hover:shadow-md ${getTaskStatusColor(task)}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-slate-900 text-lg">{task.task_name || task.title}</h4>
                        <Badge variant={isPast(new Date(task.due_date)) && task.status !== 'completed' ? 'destructive' : 'secondary'} className="rounded-full px-3 text-xs">
                          {getDaysUntilText(task.due_date)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 font-medium mb-3">{task.task_type || 'General Compliance'}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4"/> {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    <div>
                      {task.status === 'completed' 
                        ? <CheckCircle2 className="w-8 h-8 text-green-500 opacity-50" />
                        : <Button variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Mark Done</Button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COL: ALERTS & RECENT */}
          <div className="space-y-8">
            
            {/* Action Required */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" /> Action Required
              </h3>
              <Card className="bg-amber-50/50 border-amber-200 shadow-sm">
                <CardContent className="p-5">
                   <div className="flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                     <div>
                       <p className="text-sm font-semibold text-amber-900">GST Registration Pending</p>
                       <p className="text-xs text-amber-700 mt-1">Please provide your GSTIN in business settings.</p>
                       <Button size="sm" variant="outline" className="mt-3 border-amber-300 text-amber-800 bg-white hover:bg-amber-50">Update Now</Button>
                     </div>
                   </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Uploads */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                <Button variant="ghost" size="sm" className="text-blue-600 h-8 px-2" onClick={() => router.push('/vault')}>See all</Button>
              </div>
              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-0 divide-y divide-slate-100">
                  {docsLoading ? (
                    <div className="p-6 text-center text-sm text-slate-500">Loading documents...</div>
                  ) : documents.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">No recent uploads.</div>
                  ) : (
                    documents.slice(0,4).map((doc: Document) => (
                      <div key={doc.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors mx-2 my-1 rounded-lg cursor-pointer">
                        <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-500">
                           <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{format(new Date(doc.uploaded_at || doc.created_at || new Date()), 'MMM dd, h:mm a')}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
