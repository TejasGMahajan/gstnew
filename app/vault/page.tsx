'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, FolderOpen, History, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import PageHeader from '@/components/shared/PageHeader';
import FileUpload from '@/components/shared/FileUpload';

import { Business } from '@/types';

interface Document {
  id: string;
  business_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  category: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  description: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

const CATEGORIES = ['GST', 'PF-ESI', 'ROC', 'Invoices', 'Other'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DocumentVault() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('GST');
  const currentYear = new Date().getFullYear();
  const [uploadMonth, setUploadMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [uploadYear, setUploadYear] = useState(String(currentYear));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && profile) {
      loadVaultData();
    }
  }, [user, profile]);

  const loadVaultData = async () => {
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

      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .eq('business_id', businessData.id)
        .order('uploaded_at', { ascending: false });

      setDocuments(docsData || []);
    } catch (error: unknown) {
      console.error('Error loading vault:', error instanceof Error ? error.message : String(error));
      toast({ title: 'Error', description: 'Failed to load vault data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleViewDoc = (doc: Document) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    } else {
      toast({ title: 'No URL', description: 'Document URL is not available.', variant: 'destructive' });
    }
  };

  const handleDownloadDoc = async (doc: Document) => {
    try {
      if (!doc.file_url) {
        toast({ title: 'No URL', description: 'Document URL is not available.', variant: 'destructive' });
        return;
      }
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Download Started', description: `Downloading "${doc.file_name}"` });
    } catch (error: unknown) {
      toast({ title: 'Download Failed', description: 'Could not download the file.', variant: 'destructive' });
    }
  };

  const handleViewAuditLog = async (doc: Document) => {
    setSelectedDoc(doc);

    const { data: logs } = await supabase
      .from('audit_logs')
      .select(`
        *,
        profiles (full_name)
      `)
      .eq('entity_type', 'document')
      .eq('entity_id', doc.id)
      .order('created_at', { ascending: false });

    setAuditLogs(logs || []);
    setAuditDialogOpen(true);
  };

  const handleUploadComplete = async (doc: Record<string, unknown>) => {
    await supabase.from('audit_logs').insert({
      entity_type: 'document',
      entity_id:   doc.id as string,
      action:      'uploaded',
      user_id:     user!.id,
      new_value: {
        file_name: doc.fileName,
        category:  uploadCategory,
        month:     uploadMonth,
        year:      uploadYear,
      },
    });
    setUploadDialogOpen(false);
    loadVaultData();
  };

  const getCategoryCount = (category: string) => {
    return documents.filter((doc) => doc.category === category).length;
  };

  const filteredDocuments =
    selectedCategory === 'All'
      ? documents
      : documents.filter((doc) => doc.category === selectedCategory);

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading vault..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <PageHeader
        title="Document Vault"
        subtitle={business?.business_name}
        actions={[
          {
            label: 'Back to Dashboard',
            onClick: () => router.push('/dashboard-owner'),
            variant: 'outline',
          },
        ]}
        onSignOut={handleSignOut}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-t-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Auto-Organized Folders</CardTitle>
                  <CardDescription className="text-blue-100">
                    Documents automatically categorized for compliance
                  </CardDescription>
                </div>
                <Button
                  className="bg-white text-blue-900 hover:bg-blue-50"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`p-4 sm:p-6 rounded-lg border-2 transition-all ${
                      selectedCategory === category
                        ? 'border-blue-900 bg-blue-50 shadow-md'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <FolderOpen className="h-6 w-6 text-blue-900" />
                      <h3 className="font-semibold text-slate-900 mt-2 sm:mt-3 text-sm sm:text-base">
                        {category}
                      </h3>
                      <p className="text-xl sm:text-2xl font-bold text-blue-900 mt-1 sm:mt-2">
                        {getCategoryCount(category)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Documents</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={selectedCategory === 'All' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('All')}
                    className={selectedCategory === 'All' ? 'bg-blue-900' : ''}
                  >
                    All Documents
                  </Button>
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat)}
                      className={selectedCategory === cat ? 'bg-blue-900' : ''}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  {filteredDocuments.length} document(s)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                  <Card
                    key={doc.id}
                    className="border-2 border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-6 w-6 text-blue-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {doc.file_name}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1">{doc.category}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleViewDoc(doc)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDownloadDoc(doc)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewAuditLog(doc)}
                          className="flex-1 border-purple-600 text-purple-600 hover:bg-purple-50"
                        >
                          <History className="h-3 w-3 mr-1" />
                          History
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredDocuments.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      icon={FolderOpen}
                      title="No documents in this category"
                      description="Upload your first document to get started"
                      actionLabel="Upload Document"
                      actionIcon={Upload}
                      onAction={() => setUploadDialogOpen(true)}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Select a category and upload your compliance document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Category</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Month</label>
                <Select value={uploadMonth} onValueChange={setUploadMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1).padStart(2, '0')}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Year</label>
                <Select value={uploadYear} onValueChange={setUploadYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {business && user && (
              <FileUpload
                businessId={business.id}
                userId={user.id}
                category={uploadCategory}
                onUploadComplete={handleUploadComplete}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Audit Trail - Legal Protection Log
            </DialogTitle>
            <DialogDescription>
              Complete chronological history for {selectedDoc?.file_name}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-purple-900 mb-2">Legal Compliance Notice</h3>
              <p className="text-sm text-purple-800">
                This audit trail is maintained for legal protection and compliance verification.
                All actions are timestamped and immutable.
              </p>
            </div>

            {selectedDoc && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-slate-900 mb-2">Document Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600">File Name:</span>
                    <p className="font-medium text-slate-900">{selectedDoc.file_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Category:</span>
                    <p className="font-medium text-slate-900">{selectedDoc.category}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">File Type:</span>
                    <p className="font-medium text-slate-900">{selectedDoc.file_type}</p>
                  </div>
                  <div>
                    <span className="text-slate-600">Uploaded:</span>
                    <p className="font-medium text-slate-900">
                      {format(new Date(selectedDoc.uploaded_at), 'MMM dd, yyyy hh:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900">Activity Timeline</h4>
              {auditLogs.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">
                  No activity recorded yet for this document
                </p>
              )}

              <div className="relative">
                {auditLogs.length > 0 && (
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-600 via-purple-400 to-purple-200"></div>
                )}
                <div className="space-y-6">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="relative pl-14">
                      <div className="absolute left-3 top-1.5 h-7 w-7 rounded-full bg-white border-4 border-purple-600 flex items-center justify-center shadow-md">
                        <div className="h-2 w-2 rounded-full bg-purple-600"></div>
                      </div>

                      <Card className="border-2 border-purple-100 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-semibold text-slate-900">
                                {log.action.toUpperCase()}
                              </h5>
                              <p className="text-sm text-slate-600 mt-1">{log.description}</p>
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                              {format(new Date(log.created_at), 'MMM dd, yyyy')}
                              <br />
                              {format(new Date(log.created_at), 'hh:mm:ss a')}
                            </span>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs text-slate-600">
                              <span className="font-medium">Performed by:</span>{' '}
                              {log.profiles?.full_name || 'Unknown'}
                            </p>
                          </div>

                          {log.old_value && log.new_value && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-slate-600 font-medium mb-1">Old Value:</p>
                                  <pre className="bg-red-50 p-2 rounded text-red-900 overflow-x-auto">
                                    {JSON.stringify(log.old_value, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-slate-600 font-medium mb-1">New Value:</p>
                                  <pre className="bg-green-50 p-2 rounded text-green-900 overflow-x-auto">
                                    {JSON.stringify(log.new_value, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
