// FILE: app/(dashboard)/vault/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { getSignedDocumentUrl } from '@/lib/api';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import Pagination from '@/components/shared/Pagination';
import FileUpload from '@/components/shared/FileUpload';
import {
  Folder, FolderOpen, Upload, X, FileText, Image, File, Eye,
  Download, Clock, HardDrive, Plus, RefreshCw, AlertCircle
} from 'lucide-react';
import type { Document } from '@/lib/supabase/types';

const PAGE_SIZE = 12;

const CATEGORIES = [
  { key: 'all', label: 'All Documents', icon: FolderOpen, color: 'text-slate-600' },
  { key: 'GST', label: 'GST', icon: Folder, color: 'text-indigo-600' },
  { key: 'PF-ESI', label: 'PF & ESI', icon: Folder, color: 'text-emerald-600' },
  { key: 'ROC', label: 'ROC', icon: Folder, color: 'text-purple-600' },
  { key: 'Invoices', label: 'Invoices', icon: Folder, color: 'text-amber-600' },
  { key: 'Other', label: 'Other', icon: Folder, color: 'text-slate-500' },
];

const UPLOAD_CATEGORIES = ['GST', 'PF-ESI', 'ROC', 'Invoices', 'Other'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fileIcon(fileType: string) {
  if (fileType.includes('pdf')) return { icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50' };
  if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg')) return { icon: Image, color: 'text-blue-600', bg: 'bg-blue-50' };
  if (fileType.includes('word') || fileType.includes('doc')) return { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' };
  if (fileType.includes('excel') || fileType.includes('sheet') || fileType.includes('xls')) return { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  return { icon: File, color: 'text-slate-600', bg: 'bg-slate-50' };
}

function formatBytes(bytes?: number) {
  if (!bytes) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface AuditEntry {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

export default function VaultPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [storageUsage, setStorageUsage] = useState<{ used_mb: number; total_mb: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);

  // Upload dialog
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('GST');
  const [uploadMonth, setUploadMonth] = useState(new Date().getMonth());
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear());

  // History dialog
  const [historyDoc, setHistoryDoc] = useState<Document | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Monthly usage
  const [monthlyUploads, setMonthlyUploads] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, business_name, owner_id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!biz) { router.replace('/onboarding'); return; }
      setBusiness(biz);

      const [docsRes, subRes, storageRes] = await Promise.allSettled([
        supabase
          .from('documents')
          .select('*')
          .eq('business_id', biz.id)
          .order('uploaded_at', { ascending: false }),

        supabase
          .from('subscriptions')
          .select('plan_type')
          .eq('business_id', biz.id)
          .eq('status', 'active')
          .maybeSingle(),

        supabase
          .from('storage_usage')
          .select('used_mb, total_mb')
          .eq('business_id', biz.id)
          .maybeSingle(),
      ]);

      if (docsRes.status === 'fulfilled' && docsRes.value.data) {
        const docs = docsRes.value.data as Document[];
        setDocuments(docs);

        // Monthly uploads count
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        setMonthlyUploads(docs.filter(d => d.uploaded_at >= firstOfMonth).length);
      }
      if (subRes.status === 'fulfilled' && subRes.value.data) setSubscription(subRes.value.data);
      if (storageRes.status === 'fulfilled' && storageRes.value.data) setStorageUsage(storageRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user) loadData();
  }, [authLoading, user, loadData, router]);

  const handleUploadComplete = (doc: Document) => {
    setDocuments(prev => [doc, ...prev]);
    setMonthlyUploads(prev => prev + 1);
    setShowUploadDialog(false);
  };

  const handleView = async (doc: Document) => {
    try {
      const url = await getSignedDocumentUrl(doc.id);
      window.open(url, '_blank');
    } catch {
      alert('Could not open document. Please try again.');
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const url = await getSignedDocumentUrl(doc.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
    } catch {
      alert('Could not download document. Please try again.');
    }
  };

  const handleHistory = async (doc: Document) => {
    setHistoryDoc(doc);
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, description, created_at')
        .eq('entity_id', doc.id)
        .eq('entity_type', 'document')
        .order('created_at', { ascending: false });
      setAuditHistory(data || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = activeCategory === 'all'
    ? documents
    : documents.filter(d => d.category === activeCategory);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const plan = subscription?.plan_type || 'free';

  const storageMB = storageUsage ? storageUsage.used_mb.toFixed(1) : '0';
  const storageLimitMB = storageUsage ? storageUsage.total_mb : (plan === 'enterprise' ? 10240 : plan === 'pro' ? 2048 : 100);
  const storagePercent = storageUsage ? Math.min(100, (storageUsage.used_mb / storageUsage.total_mb) * 100) : 0;

  const catCount = (cat: string) =>
    cat === 'all' ? documents.length : documents.filter(d => d.category === cat).length;

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">Document Vault</h1>
          <p className="text-sm text-slate-500 mt-1">{business?.business_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowUploadDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Storage + Plan Banner */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-slate-700">Storage Used</p>
              <span className="text-xs text-slate-500">{storageMB} MB / {storageLimitMB} MB</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${storagePercent > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </div>

        {plan === 'free' && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Free plan: 5 uploads/month</p>
              <p className="text-xs text-amber-700">{monthlyUploads} used this month</p>
            </div>
            <a href="/pricing" className="ml-2 text-xs font-bold text-indigo-600 hover:underline whitespace-nowrap">Upgrade →</a>
          </div>
        )}
      </div>

      {/* Category Folders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {CATEGORIES.map(cat => {
          const CatIcon = activeCategory === cat.key ? FolderOpen : Folder;
          return (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setPage(1); }}
              className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                activeCategory === cat.key
                  ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <CatIcon className={`w-8 h-8 mb-2 ${cat.color}`} />
              <p className="text-xs font-semibold text-slate-700">{cat.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{catCount(cat.key)} files</p>
            </button>
          );
        })}
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="card-base py-20 text-center">
          <FolderOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-base font-semibold text-slate-700">
            {activeCategory === 'all' ? 'No documents yet' : `No ${activeCategory} documents`}
          </p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Upload your first document to get started.</p>
          <button
            onClick={() => { setUploadCategory(activeCategory === 'all' ? 'GST' : activeCategory); setShowUploadDialog(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(doc => {
              const { icon: DocIcon, color, bg } = fileIcon(doc.file_type);
              return (
                <div key={doc.id} className="card-base p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <DocIcon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate" title={doc.file_name}>{doc.file_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatBytes(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  {doc.category && (
                    <div className="mb-3">
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-medium">
                        {doc.category}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleView(doc)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Eye className="w-3 h-3" /> View
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button
                      onClick={() => handleHistory(doc)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Clock className="w-3 h-3" /> History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}

      {/* ── Upload Dialog ── */}
      {showUploadDialog && business && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUploadDialog(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Upload Document</h3>
              <button onClick={() => setShowUploadDialog(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {UPLOAD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Month</label>
                <select
                  value={uploadMonth}
                  onChange={(e) => setUploadMonth(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Year</label>
                <select
                  value={uploadYear}
                  onChange={(e) => setUploadYear(Number(e.target.value))}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {years.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <FileUpload
              businessId={business.id}
              userId={user.id}
              category={uploadCategory}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </div>
      )}

      {/* ── History Dialog ── */}
      {historyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setHistoryDoc(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Audit Trail</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{historyDoc.file_name}</p>
              </div>
              <button onClick={() => setHistoryDoc(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : auditHistory.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No history found for this document.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-slate-100" />
                <div className="space-y-4">
                  {auditHistory.map((entry) => (
                    <div key={entry.id} className="relative flex gap-4 pl-8">
                      <div className="absolute left-2 w-3 h-3 bg-indigo-600 rounded-full mt-0.5 border-2 border-white" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800 capitalize">{entry.action.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{entry.description}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(entry.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
