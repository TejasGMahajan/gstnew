'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ComplianceTask, Document, Business } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Upload, Building2, Shield } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import OnboardingGuide from '@/components/shared/OnboardingGuide';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && profile) {
      if (profile.user_type === 'chartered_accountant') {
        router.push('/dashboard-ca');
        return;
      }
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

      if (businessData) {
        setBusiness(businessData);

        const [tasksRes, docsRes] = await Promise.all([
          supabase
            .from('compliance_tasks')
            .select('*')
            .eq('business_id', businessData.id)
            .order('due_date', { ascending: true }),
          supabase
            .from('documents')
            .select('*')
            .eq('business_id', businessData.id)
            .order('uploaded_at', { ascending: false })
            .limit(6),
        ]);

        setTasks(tasksRes.data || []);
        setDocuments(docsRes.data || []);
      }
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

  const getTaskStatusColor = (task: ComplianceTask) => {
    if (task.status === 'completed') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    const dueDate = new Date(task.due_date);
    const daysUntilDue = differenceInDays(dueDate, new Date());

    if (isPast(dueDate)) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (daysUntilDue <= 3) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getStatusIcon = (task: ComplianceTask) => {
    if (task.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    const dueDate = new Date(task.due_date);
    if (isPast(dueDate)) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return <Clock className="h-5 w-5 text-blue-600" />;
  };

  const getDaysUntilText = (dueDate: string) => {
    const date = new Date(dueDate);
    const days = differenceInDays(date, new Date());

    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `${days} days remaining`;
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <Card className="text-center shadow-lg">
            <CardHeader>
              <Building2 className="h-16 w-16 mx-auto mb-4 text-blue-900" />
              <CardTitle className="text-2xl">Welcome to Your Dashboard</CardTitle>
              <CardDescription className="text-base">
                You haven't set up a business profile yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push('/onboarding')}
                className="bg-blue-900 hover:bg-blue-800"
              >
                Set Up Business Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <OnboardingGuide />

      <PageHeader
        title={business.business_name}
        subtitle={profile?.user_type === 'business_owner' ? 'Business Dashboard' : 'CA Dashboard'}
        userInfo={{
          name: profile?.full_name || '',
          detail: profile?.email || '',
        }}
        actions={[
          {
            label: 'Document Vault',
            onClick: () => router.push('/vault'),
            icon: <Shield className="h-4 w-4 mr-2" />,
            variant: 'outline',
            className: 'border-blue-900 text-blue-900 hover:bg-blue-50',
          },
          {
            label: 'Pricing',
            onClick: () => router.push('/pricing'),
            variant: 'outline',
          },
        ]}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Compliance Timeline</CardTitle>
                    <CardDescription className="text-blue-100 mt-1">
                      Upcoming statutory deadlines and filings
                    </CardDescription>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-200" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {tasks.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No compliance tasks yet"
                    description="Your upcoming deadlines will appear here"
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="relative">
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-900 via-blue-600 to-blue-300"></div>

                      <div className="space-y-8">
                        {tasks.map((task) => (
                          <div key={task.id} className="relative pl-16">
                            <div className="absolute left-3 top-1.5 h-7 w-7 rounded-full bg-white border-4 border-blue-900 flex items-center justify-center shadow-md">
                              {getStatusIcon(task)}
                            </div>

                            <div
                              className={`p-4 rounded-lg border-2 ${getTaskStatusColor(task)} shadow-md hover:shadow-lg transition-shadow`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg">{task.task_name}</h3>
                                  <p className="text-sm opacity-75 mt-1">{task.task_type}</p>
                                </div>
                                <Badge
                                  variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                                  className="ml-2"
                                >
                                  {task.priority}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm mt-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  <span className="font-medium">
                                    {format(new Date(task.due_date), 'MMM dd, yyyy')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" />
                                  <span>{getDaysUntilText(task.due_date)}</span>
                                </div>
                              </div>

                              {task.description && (
                                <p className="text-sm mt-3 opacity-90">{task.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Document Vault</CardTitle>
                    <CardDescription className="text-slate-300 mt-1">
                      Recent uploads
                    </CardDescription>
                  </div>
                  <FileText className="h-6 w-6 text-slate-300" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {documents.length === 0 ? (
                  <EmptyState
                    icon={Upload}
                    title="No documents yet"
                    description="Upload your first document"
                    actionLabel="Upload Document"
                    actionIcon={Upload}
                    onAction={() => router.push('/vault')}
                  />
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer bg-white"
                        onClick={() => router.push('/vault')}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-blue-900" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 truncate">
                              {doc.file_name}
                            </p>
                            {doc.category && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {doc.category}
                              </Badge>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                              {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      className="w-full mt-4 border-blue-900 text-blue-900 hover:bg-blue-50"
                      size="sm"
                      onClick={() => router.push('/vault')}
                    >
                      View All Documents
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg border-slate-200 mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600">Business Name</p>
                  <p className="font-medium text-slate-900">{business.business_name}</p>
                </div>
                {business.gstin && (
                  <div>
                    <p className="text-sm text-slate-600">GSTIN</p>
                    <p className="font-medium text-slate-900">{business.gstin}</p>
                  </div>
                )}
                {business.pan && (
                  <div>
                    <p className="text-sm text-slate-600">PAN</p>
                    <p className="font-medium text-slate-900">{business.pan}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
