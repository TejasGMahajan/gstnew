'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, TrendingUp, Download, Upload, Send, CreditCard as Edit, Clock, CircleAlert as AlertCircle, UserPlus, Copy, CheckCheck, Mail, FileDown, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import WorkflowStepIndicator, { getStatusLabel, getNextAllowedStatus } from '@/components/shared/WorkflowStepIndicator';
import { logError, withErrorLogging } from '@/lib/errorLogger';
import { transitionTaskStatus, updateTaskOptimistic, uploadDocumentSecure, getSignedDocumentUrl, logUserAction } from '@/lib/api';
import { UpgradePrompt } from '@/lib/featureGate';
import { getTaskActions } from '@/lib/authGuard';
import { sanitizeFileName } from '@/lib/sanitize';

interface ClientBusiness {
  id: string;
  business_name: string;
  business_type: string;
  compliance_score: number;
  pending_docs: number;
  plan_type: string;
}

interface PendingClient {
  relId: string;
  business_id: string;
  business_name: string;
  business_type: string;
}

interface ComplianceTask {
  id: string;
  business_id: string;
  task_name: string;
  task_type: string;
  due_date: string;
  status: string;
  description: string;
  final_values?: any;
  edited_by?: string;
}

interface Document {
  id: string;
  file_name: string;
  file_url?: string;
  uploaded_at: string;
}

export default function CADashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientBusiness[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientBusiness | null>(null);
  const [selectedTask, setSelectedTask] = useState<ComplianceTask | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editedValues, setEditedValues] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [showReportUpgrade, setShowReportUpgrade] = useState(false);

  // Bulk selection state
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && profile) {
      if (profile.user_type !== 'chartered_accountant') {
        router.push('/dashboard-owner');
        return;
      }
      loadCADashboard();
    }
  }, [user, profile]);

  /**
   * Loads the CA dashboard by compiling an aggregate representation 
   * of all linked client businesses, verifying their compliance levels, 
   * and calculating their respective pending tasks.
   */
  const loadCADashboard = async () => {
    try {
      const { data: relationships } = await supabase
        .from('client_relationships')
        .select(`
          business_id,
          businesses (
            id,
            business_name,
            business_type,
            compliance_score
          )
        `)
        .eq('ca_profile_id', user!.id)
        .eq('status', 'active');

      if (relationships) {
        const clientsList = await Promise.all(
          relationships.map(async (rel: { business_id: string; businesses: any }) => {
            const { data: pendingTasks } = await supabase
              .from('compliance_tasks')
              .select('id')
              .eq('business_id', rel.business_id)
              .eq('status', 'pending');

            return {
              id: rel.businesses.id,
              business_name: rel.businesses.business_name,
              business_type: rel.businesses.business_type || 'N/A',
              compliance_score: rel.businesses.compliance_score || 0,
              pending_docs: pendingTasks?.length || 0,
              plan_type: 'free',
            };
          })
        );

        // Fetch subscriptions for all clients and attach plan_type
        const businessIds = clientsList.map((c) => c.id);
        if (businessIds.length > 0) {
          const { data: subs } = await supabase
            .from('subscriptions')
            .select('business_id, plan_type')
            .in('business_id', businessIds)
            .eq('status', 'active');

          if (subs) {
            const planMap = new Map(subs.map((s: any) => [s.business_id, s.plan_type as string]));
            for (const c of clientsList) {
              c.plan_type = planMap.get(c.id) ?? 'free';
            }
          }
        }

        // Sort: pro/enterprise first, then free
        clientsList.sort((a, b) => {
          const isPaidA = ['pro', 'enterprise'].includes(a.plan_type) ? 0 : 1;
          const isPaidB = ['pro', 'enterprise'].includes(b.plan_type) ? 0 : 1;
          return isPaidA - isPaidB;
        });

        setClients(clientsList);
      }

      // Load pending invites (status='pending') so CA can see who hasn't accepted yet
      const { data: pendingRels } = await supabase
        .from('client_relationships')
        .select(`
          id,
          business_id,
          businesses (
            business_name,
            business_type
          )
        `)
        .eq('ca_profile_id', user!.id)
        .eq('status', 'pending');

      if (pendingRels) {
        setPendingClients(
          pendingRels.map((r: any) => ({
            relId:         r.id,
            business_id:   r.business_id,
            business_name: r.businesses?.business_name ?? 'Unknown',
            business_type: r.businesses?.business_type ?? 'N/A',
          })),
        );
      }
    } catch (error) {
      console.error('Error loading CA dashboard:', error);
      toast({ title: 'Error', description: 'Failed to load dashboard data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = async (task: ComplianceTask) => {
    setSelectedTask(task);
    setEditedValues(task.final_values ? JSON.stringify(task.final_values, null, 2) : '');

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('business_id', task.business_id)
      .order('uploaded_at', { ascending: false });

    setDocuments(docs || []);
    setDrawerOpen(true);
  };

  const handleRequestDocument = async () => {
    if (!selectedTask) return;
    setActionLoading('request');

    try {
      // Transition task to awaiting_documents via RPC
      const nextStatus = getNextAllowedStatus(selectedTask.status);
      if (nextStatus && selectedTask.status === 'created') {
        await transitionTaskStatus(selectedTask.id, 'awaiting_documents');
      }

      await logUserAction(
        'document_request', 'task', selectedTask.id,
        `CA requested documents for ${selectedTask.task_name}`,
        selectedTask.business_id
      );

      toast({
        title: 'Request Sent',
        description: 'Document request notification sent to client!',
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      await logError('request_document', err, { taskId: selectedTask.id });
      toast({ title: 'Error', description: err.message || 'Failed to send request.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedTask) return;
    setActionLoading('save');

    try {
      const parsedValues = JSON.parse(editedValues);

      // Use optimistic update with concurrency control
      await updateTaskOptimistic(
        selectedTask.id,
        selectedTask.updated_at,
        { finalValues: parsedValues, description: `CA edited task values for ${selectedTask.task_name}` }
      );

      // If task is in awaiting_documents or later, transition to under_review
      if (selectedTask.status === 'awaiting_documents') {
        await transitionTaskStatus(selectedTask.id, 'under_review');
      }

      toast({ title: 'Saved', description: 'Task values updated successfully!' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err instanceof SyntaxError) {
        toast({ title: 'Invalid JSON', description: 'Please check your JSON format.', variant: 'destructive' });
      } else if (error.message?.startsWith('CONFLICT:')) {
        toast({ title: 'Conflict', description: 'Someone else modified this task. Please reload and try again.', variant: 'destructive' });
      } else {
        await logError('save_task_edit', err, { taskId: selectedTask.id });
        toast({ title: 'Error', description: err.message || 'Failed to save changes.', variant: 'destructive' });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportData = async () => {
    if (!selectedTask) return;
    setActionLoading('export');

    try {
      const exportData = {
        task_name: selectedTask.task_name,
        task_type: selectedTask.task_type,
        due_date: selectedTask.due_date,
        final_values: selectedTask.final_values,
        exported_at: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTask.task_name.replace(/\s/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);

      await supabase.from('audit_logs').insert({
        business_id: selectedTask.business_id,
        user_id: user!.id,
        entity_type: 'task',
        entity_id: selectedTask.id,
        action: 'exported',
        description: `CA exported data for ${selectedTask.task_name} to govt portal`,
      });

      toast({ title: 'Exported', description: 'Data exported for government portal filing!' });
    } catch (error) {
      toast({ title: 'Error', description: 'Export failed.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUploadAcknowledgement = async (file: File) => {
    if (!selectedTask) return;
    setActionLoading('upload');

    try {
      const now = new Date();
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${selectedTask.business_id}/acknowledgements/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${safeName}`;

      // Upload via RPC (checks access + permissions + limits)
      await uploadDocumentSecure(
        selectedTask.business_id,
        file,
        'Acknowledgement',
        storagePath
      );

      // Actually upload the file bytes to storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      // Transition task to 'acknowledged' state via RPC
      await transitionTaskStatus(selectedTask.id, 'acknowledged');

      await logUserAction(
        'acknowledgement_uploaded', 'task', selectedTask.id,
        `CA uploaded acknowledgement and marked ${selectedTask.task_name} as acknowledged`,
        selectedTask.business_id
      );

      toast({ title: 'Completed!', description: 'Acknowledgement uploaded and task acknowledged.' });
      setDrawerOpen(false);
      loadCADashboard();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      await logError('upload_acknowledgement', err, { taskId: selectedTask.id });
      toast({ title: 'Upload Failed', description: err.message || 'Could not upload the file.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Bulk actions
  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedClientIds.size === clients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(clients.map((c) => c.id)));
    }
  };

  const handleBulkExport = async () => {
    const selected = clients.filter((c) => selectedClientIds.has(c.id));
    const exportData = {
      exported_at: new Date().toISOString(),
      clients: selected.map((c) => ({
        business_name: c.business_name,
        business_type: c.business_type,
        compliance_score: c.compliance_score,
        pending_tasks: c.pending_docs,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client_portfolio_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: `Exported data for ${selected.length} client(s).` });
    setSelectedClientIds(new Set());
  };

  const handleViewDocUrl = async (doc: Document) => {
    try {
      const signedUrl = await getSignedDocumentUrl(doc.id);
      window.open(signedUrl, '_blank');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({ title: 'Access Denied', description: err.message || 'Cannot view document.', variant: 'destructive' });
    }
  };

  const handleExportReport = async () => {
    if (!selectedTask) return;
    setActionLoading('export_report');
    setShowReportUpgrade(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const res = await fetch(`/api/export/${selectedTask.business_id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'upgrade_required') {
          setShowReportUpgrade(true);
          return;
        }
        toast({ title: 'Access denied', variant: 'destructive' });
        return;
      }

      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use filename from Content-Disposition if available
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : 'compliance_report.pdf';
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Report Downloaded', description: 'PDF compliance report saved.' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading CA dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <PageHeader
        title="CA Partner Dashboard"
        subtitle="Manage your client portfolio"
        userInfo={{
          name: profile?.full_name || '',
          detail: 'Chartered Accountant',
        }}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Total Clients</CardTitle>
                <Users className="h-5 w-5 text-blue-900" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-900">{clients.length}</p>
              <p className="text-sm text-slate-600 mt-1">Active businesses</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Pending Tasks</CardTitle>
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-yellow-600">
                {clients.reduce((sum, c) => sum + c.pending_docs, 0)}
              </p>
              <p className="text-sm text-slate-600 mt-1">Across all clients</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Avg Compliance</CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">
                {clients.length > 0
                  ? Math.round(clients.reduce((sum, c) => sum + c.compliance_score, 0) / clients.length)
                  : 0}
                %
              </p>
              <p className="text-sm text-slate-600 mt-1">Portfolio health</p>
            </CardContent>
          </Card>
        </div>

        {/* Bulk action bar */}
        {selectedClientIds.size > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedClientIds.size} client(s) selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleBulkExport}
                className="bg-blue-900 hover:bg-blue-800"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedClientIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Client Roster</CardTitle>
                <CardDescription className="text-blue-100">
                  {clients.length} active · {pendingClients.length} pending
                </CardDescription>
              </div>
              <Button
                onClick={() => setInviteOpen(true)}
                className="bg-white text-blue-900 hover:bg-blue-50 shrink-0"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Summary line */}
            {clients.length > 0 && (
              <p className="text-sm text-slate-500 mb-4">
                <span className="font-medium text-green-700">
                  {clients.filter((c) => ['pro', 'enterprise'].includes(c.plan_type)).length} priority clients
                </span>
                {' | '}
                <span className="font-medium text-slate-600">
                  {clients.filter((c) => !['pro', 'enterprise'].includes(c.plan_type)).length} standard clients
                </span>
              </p>
            )}

            <div className="space-y-3">
              {/* Priority Clients */}
              {clients.some((c) => ['pro', 'enterprise'].includes(c.plan_type)) && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-1">Priority Clients</p>
                  {clients
                    .filter((c) => ['pro', 'enterprise'].includes(c.plan_type))
                    .map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 border-l-[3px] border-l-green-500 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedClientIds.has(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900 truncate">{client.business_name}</span>
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs shrink-0">
                              {client.plan_type.charAt(0).toUpperCase() + client.plan_type.slice(1)}
                            </Badge>
                            {client.pending_docs > 0 ? (
                              <Badge variant="destructive" className="text-xs shrink-0">{client.pending_docs} Pending</Badge>
                            ) : (
                              <Badge className="bg-green-600 text-xs shrink-0">All Clear</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{client.business_type}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-semibold text-slate-700 mr-2">{client.compliance_score}%</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8"
                            title="Send WhatsApp notification"
                            onClick={() => {/* WhatsApp handled via task workflow */}}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedClient(client)}
                            className="bg-blue-900 hover:bg-blue-800 text-xs h-8"
                          >
                            View Tasks
                          </Button>
                        </div>
                      </div>
                    ))}
                </>
              )}

              {/* Standard Clients */}
              {clients.some((c) => !['pro', 'enterprise'].includes(c.plan_type)) && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-4 mb-1">Standard Clients</p>
                  {clients
                    .filter((c) => !['pro', 'enterprise'].includes(c.plan_type))
                    .map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedClientIds.has(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900 truncate">{client.business_name}</span>
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs shrink-0">Free Plan</Badge>
                            {client.pending_docs > 0 ? (
                              <Badge variant="destructive" className="text-xs shrink-0">{client.pending_docs} Pending</Badge>
                            ) : (
                              <Badge className="bg-green-600 text-xs shrink-0">All Clear</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{client.business_type}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-semibold text-slate-700 mr-2">{client.compliance_score}%</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 opacity-50 cursor-not-allowed"
                            disabled
                            title="Client needs Pro plan for automated reminders"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedClient(client)}
                            className="bg-blue-900 hover:bg-blue-800 text-xs h-8"
                          >
                            View Tasks
                          </Button>
                        </div>
                      </div>
                    ))}
                </>
              )}

              {/* Pending invite rows */}
              {pendingClients.map((pc) => (
                <div key={pc.relId} className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                  <div className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700 truncate">{pc.business_name}</span>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs shrink-0">Pending</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{pc.business_type}</p>
                  </div>
                </div>
              ))}

              {clients.length === 0 && pendingClients.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <EmptyState
                    icon={Users}
                    title="No clients yet"
                    description="Start building your portfolio by inviting clients!"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClient && (
          <Card className="mt-8 shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
              <CardTitle className="text-xl">
                {selectedClient.business_name} - Compliance Tasks
              </CardTitle>
              <CardDescription className="text-slate-300">
                Click on any task to manage the workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ClientTasksList clientId={selectedClient.id} onTaskClick={handleTaskClick} />
            </CardContent>
          </Card>
        )}
      </main>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTask.task_name}</SheetTitle>
                <SheetDescription>
                  CA workflow for {selectedTask.task_type}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 mb-6">
                <WorkflowStepIndicator currentStatus={selectedTask.status} />
              </div>

              {/* Export Report */}
              <div className="mb-4">
                <Button
                  onClick={handleExportReport}
                  variant="outline"
                  className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-2"
                  disabled={actionLoading === 'export_report'}
                >
                  <FileDown className="h-4 w-4" />
                  {actionLoading === 'export_report' ? 'Generating PDF…' : 'Export Compliance Report (PDF)'}
                </Button>
                {showReportUpgrade && (
                  <div className="mt-3">
                    <UpgradePrompt feature="export_report" />
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-6">
                <div className="border-l-4 border-blue-900 pl-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Step 1: Request Documents</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Send a notification to the client requesting necessary documents.
                  </p>
                  <Button
                    onClick={handleRequestDocument}
                    className="bg-blue-900 hover:bg-blue-800"
                    disabled={actionLoading === 'request'}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {actionLoading === 'request' ? 'Sending...' : 'Request Document from Client'}
                  </Button>
                </div>

                <div className="border-l-4 border-green-600 pl-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Step 2: Review & Edit Data</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Review uploaded data and edit values based on your professional judgment.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        Edit Task Values (JSON Format)
                      </label>
                      <Textarea
                        value={editedValues}
                        onChange={(e) => setEditedValues(e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                        placeholder='{"invoice_total": 50000, "tax_amount": 9000}'
                      />
                    </div>
                    <Button
                      onClick={handleSaveEdit}
                      variant="outline"
                      className="w-full"
                      disabled={actionLoading === 'save'}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {actionLoading === 'save' ? 'Saving...' : 'Save Edited Values'}
                    </Button>
                  </div>
                </div>

                <div className="border-l-4 border-yellow-600 pl-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Step 3: Export for Govt Portal</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Export finalized data to file for GST/MCA/EPFO portal.
                  </p>
                  <Button
                    onClick={handleExportData}
                    className="bg-yellow-600 hover:bg-yellow-700 w-full"
                    disabled={actionLoading === 'export'}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {actionLoading === 'export' ? 'Exporting...' : 'Export Data for Govt Portal'}
                  </Button>
                </div>

                <div className="border-l-4 border-purple-600 pl-4">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Step 4: Upload Acknowledgement
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Upload the final challan/acknowledgement to mark task as completed.
                  </p>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 mb-3">
                      Drag and drop your acknowledgement file here
                    </p>
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleUploadAcknowledgement(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="ack-upload"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    />
                    <Button
                      type="button"
                      onClick={() => document.getElementById('ack-upload')?.click()}
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={actionLoading === 'upload'}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {actionLoading === 'upload' ? 'Uploading...' : 'Upload & Complete Task'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-900 mb-3">Recent Documents</h3>
                  <div className="space-y-2">
                    {documents.slice(0, 5).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{doc.file_name}</p>
                          <p className="text-xs text-slate-600">
                            {format(new Date(doc.uploaded_at), 'MMM dd, yyyy hh:mm a')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDocUrl(doc)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No documents uploaded yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <InviteClientModal
        caProfileId={user!.id}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => { setInviteOpen(false); loadCADashboard(); }}
      />
    </div>
  );
}

// ─── InviteClientModal ────────────────────────────────────────────────────────

type InviteStep = 'form' | 'success' | 'link';

function InviteClientModal({
  caProfileId,
  open,
  onClose,
  onSuccess,
}: {
  caProfileId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<InviteStep>('form');
  const [invitedBizName, setInvitedBizName] = useState('');
  const [signupLink, setSignupLink] = useState('');
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail('');
    setStep('form');
    setInvitedBizName('');
    setSignupLink('');
    setCopied(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(signupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);

    try {
      // 1. Check if a business_owner with this email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', trimmed)
        .eq('user_type', 'business_owner')
        .maybeSingle();

      if (!existingProfile) {
        // No account yet — give the CA a copyable signup link
        const link = `${window.location.origin}/signup?ca=${caProfileId}&role=business_owner`;
        setSignupLink(link);
        setStep('link');
        setLoading(false);
        return;
      }

      // 2. Get their business
      const { data: business } = await supabase
        .from('businesses')
        .select('id, business_name')
        .eq('owner_id', existingProfile.id)
        .maybeSingle();

      if (!business) {
        // Profile exists but no business created yet — send signup link so they finish onboarding
        const link = `${window.location.origin}/signup?ca=${caProfileId}&role=business_owner`;
        setSignupLink(link);
        setStep('link');
        setLoading(false);
        return;
      }

      // 3. Create the client_relationships row (pending until the owner accepts)
      const { error: relError } = await supabase
        .from('client_relationships')
        .insert({
          ca_profile_id: caProfileId,
          business_id:   business.id,
          status:        'pending',
        });

      if (relError) {
        // Likely a duplicate — handle gracefully
        if (relError.code === '23505') {
          toast({
            title:       'Already linked',
            description: `A relationship with ${business.business_name} already exists.`,
            variant:     'destructive',
          });
        } else {
          throw relError;
        }
      } else {
        setInvitedBizName(business.business_name);
        setStep('success');
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">

        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-900" />
                Invite a Client
              </DialogTitle>
              <DialogDescription>
                Enter the client's email address. If they already have an account,
                a connection request will be sent. Otherwise you'll get a shareable
                signup link.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Client's Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleInvite()}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleInvite}
                disabled={loading || !email.trim()}
                className="bg-blue-900 hover:bg-blue-800"
              >
                {loading ? 'Checking…' : 'Send Invite'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCheck className="h-5 w-5" />
                Invite Sent
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-700 py-2">
              A connection request has been sent to{' '}
              <strong>{invitedBizName}</strong>. It will appear in your client
              roster once they accept.
            </p>
            <DialogFooter>
              <Button onClick={handleClose} className="bg-blue-900 hover:bg-blue-800">
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'link' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-blue-900" />
                Share Signup Link
              </DialogTitle>
              <DialogDescription>
                This email isn't registered yet. Share the link below on WhatsApp
                — when they sign up, you'll be connected automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <p className="text-xs font-mono text-slate-700 break-all flex-1">
                  {signupLink}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <CheckCheck className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}

// ─── ClientTasksList ──────────────────────────────────────────────────────────

function ClientTasksList({
  clientId,
  onTaskClick,
}: {
  clientId: string;
  onTaskClick: (task: ComplianceTask) => void;
}) {
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [clientId]);

  const loadTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('compliance_tasks')
      .select('*')
      .eq('business_id', clientId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    setTasks(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onTaskClick(task)}
          className="p-4 border-2 border-slate-200 rounded-lg hover:border-blue-900 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900">{task.task_name}</h4>
              <p className="text-sm text-slate-600 mt-1">{task.task_type}</p>
              <p className="text-xs text-slate-500 mt-2">
                Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
              </p>
              <div className="mt-2">
                <WorkflowStepIndicator currentStatus={task.status} compact />
              </div>
            </div>
            <Badge
              variant={task.status === 'acknowledged' || task.status === 'locked' ? 'default' : 'outline'}
              className={
                task.status === 'acknowledged' || task.status === 'locked'
                  ? 'bg-green-600'
                  : task.status === 'created'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-yellow-600 text-yellow-600'
              }
            >
              {getStatusLabel(task.status)}
            </Badge>
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <EmptyState
          icon={AlertCircle}
          title="No tasks for this client"
          description="Tasks will appear here when added"
        />
      )}
    </div>
  );
}
