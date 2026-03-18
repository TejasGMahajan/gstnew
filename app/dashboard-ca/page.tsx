'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, TrendingUp, Download, Upload, Send, CreditCard as Edit, Clock, CircleAlert as AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import WorkflowStepIndicator, { getStatusLabel, getNextAllowedStatus } from '@/components/shared/WorkflowStepIndicator';
import { logError, withErrorLogging } from '@/lib/errorLogger';
import { transitionTaskStatus, updateTaskOptimistic, uploadDocumentSecure, getSignedDocumentUrl, logUserAction } from '@/lib/api';
import { getTaskActions } from '@/lib/authGuard';
import { sanitizeFileName } from '@/lib/sanitize';

interface ClientBusiness {
  id: string;
  business_name: string;
  business_type: string;
  compliance_score: number;
  pending_docs: number;
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
          relationships.map(async (rel: any) => {
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
            };
          })
        );
        setClients(clientsList);
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
    } catch (error: any) {
      await logError('request_document', error, { taskId: selectedTask.id });
      toast({ title: 'Error', description: error.message || 'Failed to send request.', variant: 'destructive' });
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
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        toast({ title: 'Invalid JSON', description: 'Please check your JSON format.', variant: 'destructive' });
      } else if (error.message?.startsWith('CONFLICT:')) {
        toast({ title: 'Conflict', description: 'Someone else modified this task. Please reload and try again.', variant: 'destructive' });
      } else {
        await logError('save_task_edit', error, { taskId: selectedTask.id });
        toast({ title: 'Error', description: error.message || 'Failed to save changes.', variant: 'destructive' });
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
    } catch (error: any) {
      await logError('upload_acknowledgement', error, { taskId: selectedTask.id });
      toast({ title: 'Upload Failed', description: error.message || 'Could not upload the file.', variant: 'destructive' });
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
    } catch (error: any) {
      toast({ title: 'Access Denied', description: error.message || 'Cannot view document.', variant: 'destructive' });
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
            <CardTitle className="text-xl">Client Roster</CardTitle>
            <CardDescription className="text-blue-100">
              Manage compliance for all your MSME clients
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={clients.length > 0 && selectedClientIds.size === clients.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Business Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Entity Type</TableHead>
                    <TableHead>Compliance Score</TableHead>
                    <TableHead className="hidden md:table-cell">Pending</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClientIds.has(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{client.business_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{client.business_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-full max-w-[100px] bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                client.compliance_score >= 80
                                  ? 'bg-green-600'
                                  : client.compliance_score >= 60
                                  ? 'bg-yellow-600'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${client.compliance_score}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold">{client.compliance_score}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {client.pending_docs > 0 ? (
                          <Badge variant="destructive">{client.pending_docs} Pending</Badge>
                        ) : (
                          <Badge className="bg-green-600">All Clear</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => setSelectedClient(client)}
                          className="bg-blue-900 hover:bg-blue-800"
                        >
                          View Tasks
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        <EmptyState
                          icon={Users}
                          title="No clients yet"
                          description="Start building your portfolio by inviting clients!"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
    </div>
  );
}

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
