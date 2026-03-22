// FILE: app/(dashboard)/dashboard-ca/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { logUserAction } from '@/lib/api';
import StatsCard from '@/components/shared/StatsCard';
import { SkeletonCard, SkeletonRow, SkeletonTable } from '@/components/shared/SkeletonCard';
import StatusBadge from '@/components/shared/StatusBadge';
import Pagination from '@/components/shared/Pagination';
import WorkflowStepIndicator from '@/components/shared/WorkflowStepIndicator';
import {
  Users, Calendar, BarChart2, AlertTriangle, FileText, Bell, Search,
  ChevronLeft, ChevronRight, RefreshCw, Plus, X, Copy, CheckCircle,
  MessageSquare, Download, Briefcase, ClipboardList, DollarSign,
  FileCheck, TrendingUp, Eye, Send, ChevronDown, LayoutGrid,
  BookOpen, Activity
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ClientRelationship {
  id: string;
  ca_profile_id: string;
  business_id: string;
  status: 'active' | 'pending';
  created_at: string;
  businesses?: {
    id: string;
    business_name: string;
    business_type: string;
    owner_id: string;
    gstin?: string;
  };
  subscriptions?: { plan_type: string }[];
  compliance_tasks?: any[];
}

interface Task {
  id: string;
  business_id: string;
  task_name: string;
  task_type: string;
  due_date: string;
  status: string;
  priority: string;
  description?: string;
  updated_at?: string;
}

type TabKey = 'overview' | 'clients' | 'calendar' | 'pipeline' | 'chase' | 'audit' | 'checklist' | 'penalty' | 'reports';

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'pipeline', label: 'Pipeline', icon: Activity },
  { key: 'chase', label: 'Chase', icon: Bell },
  { key: 'audit', label: 'Audit', icon: FileText },
  { key: 'checklist', label: 'Checklist', icon: ClipboardList },
  { key: 'penalty', label: 'Penalty', icon: DollarSign },
  { key: 'reports', label: 'Reports', icon: BarChart2 },
];

const PIPELINE_STATUSES = ['created', 'awaiting_documents', 'under_review', 'ready_to_file', 'filed', 'acknowledged'] as const;
const PIPELINE_LABELS: Record<string, string> = {
  created: 'Created',
  awaiting_documents: 'Awaiting Docs',
  under_review: 'Under Review',
  ready_to_file: 'Ready to File',
  filed: 'Filed',
  acknowledged: 'Acknowledged',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function DaysBadge({ dueDate }: { dueDate: string }) {
  const diff = daysUntil(dueDate);
  if (diff < 0) return <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full border border-rose-200 font-semibold">{Math.abs(diff)}d overdue</span>;
  if (diff <= 3) return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200 font-semibold">Due in {diff}d</span>;
  return <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">{diff}d</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'high') return <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full border border-rose-200">High</span>;
  if (priority === 'medium') return <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">Medium</span>;
  return <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">Low</span>;
}

function planBadgeClass(plan: string) {
  if (plan === 'enterprise') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (plan === 'pro') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function clientScore(tasks: any[]) {
  if (!tasks || tasks.length === 0) return 100;
  const done = tasks.filter(t => t.status === 'completed').length;
  return Math.round((done / tasks.length) * 100);
}

// ─── COMPLIANCE CHECKLIST DATA ────────────────────────────────────────────────

const COMPLIANCE_ITEMS = [
  { month: 'Monthly', filing: 'GSTR-1', dueDate: '11th of next month', freq: 'Monthly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Monthly', filing: 'GSTR-3B', dueDate: '20th of next month', freq: 'Monthly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Monthly', filing: 'TDS Payment', dueDate: '7th of next month', freq: 'Monthly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Monthly', filing: 'PF & ESI', dueDate: '15th of next month', freq: 'Monthly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Quarterly', filing: 'TDS Return (Q1 Apr–Jun)', dueDate: 'July 31', freq: 'Quarterly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Quarterly', filing: 'TDS Return (Q2 Jul–Sep)', dueDate: 'October 31', freq: 'Quarterly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Quarterly', filing: 'TDS Return (Q3 Oct–Dec)', dueDate: 'January 31', freq: 'Quarterly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Quarterly', filing: 'TDS Return (Q4 Jan–Mar)', dueDate: 'May 31', freq: 'Quarterly', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Annual', filing: 'ITR Filing', dueDate: 'July 31', freq: 'Annual', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Annual', filing: 'GSTR-9 Annual Return', dueDate: 'December 31', freq: 'Annual', applicable: ['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'opc'] },
  { month: 'Annual', filing: 'MSME Form 1 (H1)', dueDate: 'April 30', freq: 'Half-yearly', applicable: ['llp', 'pvt_ltd', 'opc'] },
  { month: 'Annual', filing: 'MSME Form 1 (H2)', dueDate: 'October 31', freq: 'Half-yearly', applicable: ['llp', 'pvt_ltd', 'opc'] },
  { month: 'Annual', filing: 'DIR-3 KYC', dueDate: 'September 30', freq: 'Annual', applicable: ['llp', 'pvt_ltd', 'opc'] },
];

// ─── PENALTY CALCULATOR ───────────────────────────────────────────────────────

interface PenaltyResult {
  daysLate: number;
  lateFee: number;
  interest: number;
  total: number;
  breakdown: string;
}

function calculatePenalty(
  filingType: string,
  dueDate: string,
  filingDate: string,
  taxAmount: number
): PenaltyResult {
  const due = new Date(dueDate);
  const filed = new Date(filingDate);
  const daysLate = Math.max(0, Math.ceil((filed.getTime() - due.getTime()) / 86400000));
  const monthsLate = daysLate / 30;

  let lateFee = 0;
  let interest = 0;
  let breakdown = '';

  if (['GSTR-3B', 'GSTR-1'].includes(filingType)) {
    const ratePerDay = taxAmount === 0 ? 25 : 50;
    const maxFee = filingType === 'GSTR-3B' ? 2000 : 5000;
    lateFee = Math.min(ratePerDay * daysLate, maxFee);
    interest = taxAmount > 0 ? Math.round(taxAmount * 0.18 * (daysLate / 365)) : 0;
    breakdown = `₹${ratePerDay}/day × ${daysLate} days (max ₹${maxFee.toLocaleString()})`;
  } else if (filingType === 'TDS') {
    lateFee = Math.round(taxAmount * 0.015 * monthsLate);
    interest = Math.round(taxAmount * 0.015 * monthsLate);
    breakdown = `1.5%/month × ${monthsLate.toFixed(1)} months`;
  } else if (filingType === 'PF/ESI') {
    lateFee = daysLate * 5; // estimated ₹5/employee/day, 1 employee base
    interest = Math.round(taxAmount * 0.12 * (daysLate / 365));
    breakdown = `₹5/employee/day × ${daysLate} days (estimated, 1 employee)`;
  } else if (filingType === 'ROC') {
    lateFee = Math.min(5000, daysLate * 200);
    breakdown = `₹200/day × ${daysLate} days (max ₹5,000)`;
  } else if (filingType === 'ITR') {
    lateFee = daysLate > 0 ? 5000 : 0;
    interest = Math.round(taxAmount * 0.01 * Math.ceil(monthsLate));
    breakdown = `Flat ₹5,000 late filing fee + 1%/month interest`;
  } else {
    lateFee = daysLate * 200;
    breakdown = `₹200/day × ${daysLate} days`;
  }

  return { daysLate, lateFee, interest, total: lateFee + interest, breakdown };
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function DashboardCAPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>((searchParams.get('tab') as TabKey) || 'overview');
  const [clients, setClients] = useState<ClientRelationship[]>([]);
  const [allClientTasks, setAllClientTasks] = useState<(Task & { business_name: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Clients tab state
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | 'priority' | 'standard' | 'pending'>('all');
  const [clientPage, setClientPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<ClientRelationship | null>(null);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [clientTaskPage, setClientTaskPage] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [calendarClientFilter, setCalendarClientFilter] = useState('all');

  // Pipeline state
  const [pipelineClientFilter, setPipelineClientFilter] = useState('all');
  const [selectedPipelineTask, setSelectedPipelineTask] = useState<(Task & { business_name: string }) | null>(null);

  // Chase state
  const [chaseRemindLoading, setChaseRemindLoading] = useState<string | null>(null);
  const [remindeModal, setRemindModal] = useState<(Task & { business_name: string; plan?: string }) | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Audit tab state
  const [auditClientId, setAuditClientId] = useState('');
  const [auditTasks, setAuditTasks] = useState<any[]>([]);
  const [auditDocs, setAuditDocs] = useState<any[]>([]);
  const [auditNote, setAuditNote] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Checklist state
  const [checkEntityType, setCheckEntityType] = useState('pvt_ltd');
  const [checkTurnover, setCheckTurnover] = useState('20l-1.5cr');
  const [checkFY, setCheckFY] = useState('2025-26');
  const [checklistGenerated, setChecklistGenerated] = useState(false);
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [addToClientId, setAddToClientId] = useState('');

  // Penalty state
  const [penFilingType, setPenFilingType] = useState('GSTR-3B');
  const [penDueDate, setPenDueDate] = useState('');
  const [penFilingDate, setPenFilingDate] = useState('');
  const [penTaxAmount, setPenTaxAmount] = useState('');
  const [penResult, setPenResult] = useState<PenaltyResult | null>(null);
  const [waMessageCopied, setWaMessageCopied] = useState(false);

  // Reports state
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  // ── Data Loading ───────────────────────────────────────────────────────────

  const loadClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: rels, error } = await supabase
        .from('client_relationships')
        .select(`
          id, ca_profile_id, business_id, status, created_at,
          businesses (id, business_name, business_type, owner_id, gstin)
        `)
        .eq('ca_profile_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched: ClientRelationship[] = [];
      for (const rel of (rels || []) as any[]) {
        if (!rel.businesses) { enriched.push(rel); continue; }

        // Fetch subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan_type')
          .eq('business_id', rel.business_id)
          .eq('status', 'active')
          .maybeSingle();

        // Fetch tasks
        const { data: tasks } = await supabase
          .from('compliance_tasks')
          .select('id, status, due_date, task_name, task_type, priority, description, updated_at')
          .eq('business_id', rel.business_id)
          .limit(50);

        enriched.push({
          ...rel,
          subscriptions: sub ? [sub] : [],
          compliance_tasks: tasks || [],
        });
      }

      setClients(enriched);

      // Flatten all tasks for pipeline, chase, etc.
      const flat = enriched
        .filter(c => c.status === 'active' && c.businesses)
        .flatMap(c => (c.compliance_tasks || []).map((t: any) => ({
          ...t,
          business_name: c.businesses!.business_name,
        })));
      setAllClientTasks(flat);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user) loadClients();
  }, [authLoading, user, loadClients, router]);

  const loadClientTasks = useCallback(async (businessId: string) => {
    const { data } = await supabase
      .from('compliance_tasks')
      .select('*')
      .eq('business_id', businessId)
      .order('due_date', { ascending: true });
    setClientTasks(data || []);
    setClientTaskPage(1);
  }, []);

  useEffect(() => {
    if (selectedClient?.business_id) loadClientTasks(selectedClient.business_id);
  }, [selectedClient, loadClientTasks]);

  const loadAudit = async (businessId: string) => {
    setLoadingAudit(true);
    const [tasksRes, docsRes] = await Promise.allSettled([
      supabase.from('compliance_tasks').select('*').eq('business_id', businessId).order('due_date', { ascending: true }),
      supabase.from('documents').select('*, audit_logs(*)').eq('business_id', businessId).order('uploaded_at', { ascending: false }),
    ]);
    if (tasksRes.status === 'fulfilled') setAuditTasks(tasksRes.value.data || []);
    if (docsRes.status === 'fulfilled') setAuditDocs(docsRes.value.data || []);
    setLoadingAudit(false);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  // ── Computed values ────────────────────────────────────────────────────────

  const activeClients = clients.filter(c => c.status === 'active');
  const portfolioScore = activeClients.length === 0 ? 0 : Math.round(
    activeClients.reduce((sum, c) => sum + clientScore(c.compliance_tasks || []), 0) / activeClients.length
  );
  const tasksDueThisWeek = allClientTasks.filter(t => {
    const diff = daysUntil(t.due_date);
    return diff >= 0 && diff <= 7 && t.status !== 'completed';
  }).length;
  const awaitingDocs = allClientTasks.filter(t => t.status === 'awaiting_documents').length;
  const completedThisMonth = allClientTasks.filter(t => {
    if (t.status !== 'completed') return false;
    const d = new Date((t as any).completed_at || t.due_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const urgentTasks = allClientTasks
    .filter(t => (t.status === 'overdue' || daysUntil(t.due_date) <= 3) && t.status !== 'completed')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 8);

  const atRiskClients = activeClients
    .filter(c => clientScore(c.compliance_tasks || []) < 70)
    .sort((a, b) => clientScore(a.compliance_tasks || []) - clientScore(b.compliance_tasks || []));

  // Filtered clients
  const filteredClients = clients
    .filter(c => {
      const name = c.businesses?.business_name?.toLowerCase() || '';
      if (clientSearch && !name.includes(clientSearch.toLowerCase())) return false;
      if (clientFilter === 'priority') {
        const plan = c.subscriptions?.[0]?.plan_type;
        return plan === 'pro' || plan === 'enterprise';
      }
      if (clientFilter === 'standard') return (c.subscriptions?.[0]?.plan_type || 'free') === 'free';
      if (clientFilter === 'pending') return c.status === 'pending';
      return true;
    });

  const CLIENT_PAGE_SIZE = 10;
  const paginatedClients = filteredClients.slice((clientPage - 1) * CLIENT_PAGE_SIZE, clientPage * CLIENT_PAGE_SIZE);

  // Calendar
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();

  const tasksByDay = allClientTasks.reduce((acc, t) => {
    const d = new Date(t.due_date);
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const day = d.getDate();
      if (!acc[day]) acc[day] = [];
      acc[day].push(t);
    }
    return acc;
  }, {} as Record<number, typeof allClientTasks>);

  // Pipeline
  const pipelineTasks = allClientTasks.filter(t =>
    pipelineClientFilter === 'all' ||
    clients.find(c => c.businesses?.business_name === t.business_name)?.business_id === pipelineClientFilter
  );

  // Chase tasks
  const chaseTasks = allClientTasks
    .filter(t => t.status === 'awaiting_documents')
    .map(t => ({
      ...t,
      plan: clients.find(c => c.businesses?.business_name === t.business_name)?.subscriptions?.[0]?.plan_type || 'free',
    }));

  // ─────────────────────────────────────────────────────────────────────────
  //  INVITE CLIENT MODAL
  // ─────────────────────────────────────────────────────────────────────────

  const handleInvite = async () => {
    if (!inviteEmail || !user) return;
    setInviteLoading(true);
    setInviteResult('');
    try {
      // Check if user exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_type, businesses(id)')
        .eq('email', inviteEmail.toLowerCase().trim())
        .maybeSingle();

      if (existingProfile) {
        // Link directly
        const businessId = (existingProfile as any).businesses?.[0]?.id;
        if (businessId) {
          await supabase.from('client_relationships').insert({
            ca_profile_id: user.id,
            business_id: businessId,
            status: 'pending',
          });
          setInviteResult(`Invite sent to ${inviteEmail}. They will see it on their dashboard.`);
          loadClients();
        } else {
          setInviteResult(`User found but has no business yet. Share your invite link so they can sign up.`);
        }
      } else {
        setInviteResult(`No account found for ${inviteEmail}. Share the invite link below to invite them.`);
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/signup?role=business_owner&ca=${user?.id}` : '';

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  WHATSAPP REMIND
  // ─────────────────────────────────────────────────────────────────────────

  const handleRemind = async (task: Task & { business_name: string; plan?: string }) => {
    if (!user) return;
    const plan = task.plan || 'free';

    if (plan === 'pro' || plan === 'enterprise') {
      // Call WhatsApp API
      setChaseRemindLoading(task.id);
      try {
        const res = await fetch('/api/notify/whatsapp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ taskId: task.id, businessName: task.business_name }),
        });
        if (res.ok) {
          alert(`WhatsApp reminder sent to ${task.business_name}!`);
        } else {
          alert('Failed to send reminder. Please try again.');
        }
      } finally {
        setChaseRemindLoading(null);
      }
    } else {
      // Show copy-paste modal
      setRemindModal(task);
    }
  };

  const reminderMessage = remindeModal
    ? `Hi! This is a reminder that your ${remindeModal.task_name} is due on ${new Date(remindeModal.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Please share the required documents at your earliest convenience.\n\nRegards,\n${profile?.full_name || 'Your CA'}`
    : '';

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="page-container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">CA Command Centre</h1>
          <p className="text-sm text-slate-500 mt-1">
            {profile?.full_name} • {activeClients.length} active clients
          </p>
        </div>
        <button onClick={loadClients} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1 — OVERVIEW
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Portfolio Health Score */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Portfolio Health Score</p>
                <div className="flex items-end gap-2 mt-2">
                  <span className={`text-5xl font-extrabold ${portfolioScore >= 80 ? 'text-emerald-600' : portfolioScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {portfolioScore}%
                  </span>
                  <span className="text-slate-400 mb-2 text-sm">weighted avg across {activeClients.length} clients</span>
                </div>
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${portfolioScore >= 80 ? 'bg-emerald-100' : portfolioScore >= 60 ? 'bg-amber-100' : 'bg-rose-100'}`}>
                <TrendingUp className={`w-8 h-8 ${portfolioScore >= 80 ? 'text-emerald-600' : portfolioScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`} />
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />) : (
              <>
                <StatsCard label="Total Clients" value={activeClients.length} icon={Users} color="indigo" />
                <StatsCard label="Due This Week" value={tasksDueThisWeek} icon={Calendar} color="amber" />
                <StatsCard label="Awaiting Documents" value={awaitingDocs} icon={FileText} color="rose" />
                <StatsCard label="Completed This Month" value={completedThisMonth} icon={CheckCircle} color="emerald" />
              </>
            )}
          </div>

          {/* Urgent Feed + At-Risk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-base">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Urgent Action Required</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {loading ? <SkeletonTable rows={4} /> : urgentTasks.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No urgent tasks. Portfolio is healthy!</p>
                  </div>
                ) : urgentTasks.map(t => (
                  <div key={t.id} className="flex items-start gap-3 px-5 py-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${daysUntil(t.due_date) < 0 ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{t.task_name}</p>
                      <p className="text-xs text-indigo-600 font-medium">{t.business_name}</p>
                    </div>
                    <DaysBadge dueDate={t.due_date} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card-base">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">At-Risk Clients</h3>
                <p className="text-xs text-slate-400 mt-0.5">Compliance score below 70%</p>
              </div>
              {loading ? <SkeletonTable rows={4} /> : atRiskClients.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">All clients are in good health!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {atRiskClients.slice(0, 6).map(c => {
                    const score = clientScore(c.compliance_tasks || []);
                    const pending = (c.compliance_tasks || []).filter((t: any) => t.status !== 'completed').length;
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-rose-700">{c.businesses?.business_name?.[0] || '?'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.businesses?.business_name}</p>
                          <p className="text-xs text-slate-400">{pending} pending tasks</p>
                        </div>
                        <span className={`text-sm font-bold ${score < 40 ? 'text-rose-600' : 'text-amber-600'}`}>{score}%</span>
                        <button
                          onClick={() => { handleTabChange('clients'); setSelectedClient(c); }}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2 — CLIENTS
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'clients' && (
        <div>
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
              {(['all', 'priority', 'standard', 'pending'] as const).map(f => (
                <button key={f} onClick={() => { setClientFilter(f); setClientPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${clientFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Client
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Client list */}
            <div className={`${selectedClient ? 'lg:col-span-2' : 'lg:col-span-3'} card-base overflow-hidden`}>
              {loading ? <SkeletonTable rows={6} /> : paginatedClients.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-base font-semibold text-slate-700">No clients yet</p>
                  <p className="text-sm text-slate-400 mb-4">Invite your first client to get started.</p>
                  <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    Invite Client
                  </button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100">
                    {paginatedClients.map(c => {
                      const score = clientScore(c.compliance_tasks || []);
                      const pending = (c.compliance_tasks || []).filter((t: any) => t.status !== 'completed').length;
                      const plan = c.subscriptions?.[0]?.plan_type || 'free';
                      return (
                        <div key={c.id}
                          onClick={() => setSelectedClient(c)}
                          className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${selectedClient?.id === c.id ? 'bg-indigo-50' : ''}`}>
                          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-indigo-700">{c.businesses?.business_name?.[0] || '?'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800 truncate">{c.businesses?.business_name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${planBadgeClass(plan)}`}>{plan}</span>
                              {c.status === 'pending' && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 capitalize">{c.businesses?.business_type?.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`text-sm font-bold ${score < 60 ? 'text-rose-600' : score < 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{score}%</span>
                            <span className="text-xs text-slate-400">{pending} pending</span>
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedClient(c); }}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                              Tasks
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-5 pb-4">
                    <Pagination page={clientPage} total={filteredClients.length} pageSize={CLIENT_PAGE_SIZE} onChange={setClientPage} />
                  </div>
                </>
              )}
            </div>

            {/* Client task panel */}
            {selectedClient && (
              <div className="card-base overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedClient.businesses?.business_name}</p>
                    <p className="text-xs text-slate-400">Task details</p>
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {clientTasks.slice((clientTaskPage - 1) * 8, clientTaskPage * 8).map(t => (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{t.task_name}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Due {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
                {clientTasks.length > 8 && (
                  <div className="px-4 pb-4">
                    <Pagination page={clientTaskPage} total={clientTasks.length} pageSize={8} onChange={setClientTaskPage} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3 — CALENDAR
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="card-base p-5">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setCalendarDate(new Date(calYear, calMonth - 1))} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-slate-900">
                {calendarDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => setCalendarDate(new Date(calYear, calMonth + 1))} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {[...Array(firstDayOfMonth)].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const dayTasks = tasksByDay[day] || [];
                const isSelected = selectedDay === day;
                const hasOverdue = dayTasks.some(t => t.status === 'overdue');
                const hasPending = dayTasks.some(t => daysUntil(t.due_date) <= 3 && t.status !== 'completed');
                const hasCompleted = dayTasks.some(t => t.status === 'completed');

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`min-h-[52px] p-1.5 rounded-lg border transition-all ${
                      isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-xs font-medium block mb-1 ${
                      new Date().getDate() === day && new Date().getMonth() === calMonth && new Date().getFullYear() === calYear
                        ? 'w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto'
                        : 'text-slate-700'
                    }`}>{day}</span>
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {hasOverdue && <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />}
                      {hasPending && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                      {hasCompleted && !hasOverdue && !hasPending && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                      {dayTasks.length > 3 && <span className="text-xs text-slate-400">+{dayTasks.length - 3}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full" /> Overdue</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Due soon</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Completed</div>
            </div>
          </div>

          {/* Selected day tasks */}
          {selectedDay && tasksByDay[selectedDay] && (
            <div className="card-base p-5">
              <h3 className="font-semibold text-slate-900 mb-4">
                Tasks due on {selectedDay} {calendarDate.toLocaleString('en-IN', { month: 'long' })}
              </h3>
              <div className="space-y-3">
                {tasksByDay[selectedDay].map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{t.task_name}</p>
                      <p className="text-xs text-indigo-600">{t.business_name}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This month's filings table */}
          <div className="card-base overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">This Month's Filings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Filing</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Object.entries(tasksByDay).flatMap(([day, tasks]) => tasks.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-indigo-700 font-medium text-xs">{t.business_name}</td>
                      <td className="px-5 py-3 text-slate-800 font-medium text-xs">{t.task_name}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4 — PIPELINE (KANBAN)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <select
              value={pipelineClientFilter}
              onChange={e => setPipelineClientFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Clients</option>
              {clients.filter(c => c.status === 'active').map(c => (
                <option key={c.business_id} value={c.business_id}>{c.businesses?.business_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
            {PIPELINE_STATUSES.map(col => {
              const colTasks = pipelineTasks.filter(t => t.status === col);
              return (
                <div key={col} className="min-w-[200px]">
                  <div className="flex items-center justify-between mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-700">{PIPELINE_LABELS[col]}</span>
                    <span className="w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {colTasks.map(t => {
                      const isOverdue = daysUntil(t.due_date) < 0;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedPipelineTask(t)}
                          className={`p-3 bg-white border rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all ${isOverdue ? 'border-l-4 border-l-rose-500' : 'border-slate-200'}`}
                        >
                          <p className="text-xs font-semibold text-indigo-600 mb-1 truncate">{t.business_name}</p>
                          <p className="text-sm font-bold text-slate-800 leading-tight mb-2">{t.task_name}</p>
                          <div className="flex items-center justify-between">
                            <DaysBadge dueDate={t.due_date} />
                            <PriorityBadge priority={t.priority} />
                          </div>
                        </div>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                        <p className="text-xs text-slate-400">No tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Task detail drawer */}
          {selectedPipelineTask && (
            <div className="fixed inset-0 z-50 flex">
              <div className="flex-1 bg-black/40" onClick={() => setSelectedPipelineTask(null)} />
              <div className="w-full max-w-md bg-white shadow-2xl p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-slate-900">Task Details</h3>
                  <button onClick={() => setSelectedPipelineTask(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Client</p>
                    <p className="text-sm font-semibold text-indigo-700 mt-1">{selectedPipelineTask.business_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Task</p>
                    <p className="text-base font-bold text-slate-900 mt-1">{selectedPipelineTask.task_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase">Due Date</p>
                      <p className="text-sm text-slate-700 mt-1">{new Date(selectedPipelineTask.due_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase">Priority</p>
                      <div className="mt-1"><PriorityBadge priority={selectedPipelineTask.priority} /></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Workflow</p>
                    <WorkflowStepIndicator currentStatus={selectedPipelineTask.status} />
                  </div>
                  {selectedPipelineTask.description && (
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase">Description</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedPipelineTask.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 5 — CHASE
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'chase' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Document Chase Tracker</h3>
              <p className="text-xs text-slate-400 mt-0.5">{chaseTasks.length} clients awaiting documents</p>
            </div>
            {chaseTasks.length > 0 && (
              <button
                onClick={() => chaseTasks.forEach(t => handleRemind(t))}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Remind All
              </button>
            )}
          </div>

          <div className="card-base overflow-hidden">
            {loading ? <SkeletonTable rows={5} /> : chaseTasks.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-700">All clients are up to date!</p>
                <p className="text-sm text-slate-400">No pending document requests.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Client</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Task</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {chaseTasks.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-indigo-700 font-medium text-sm">{t.business_name}</td>
                        <td className="px-5 py-3 text-slate-800 text-sm">{t.task_name}</td>
                        <td className="px-5 py-3"><DaysBadge dueDate={t.due_date} /></td>
                        <td className="px-5 py-3"><StatusBadge status="awaiting_documents" /></td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleRemind(t)}
                            disabled={chaseRemindLoading === t.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                          >
                            <MessageSquare className="w-3 h-3" />
                            {chaseRemindLoading === t.id ? 'Sending...' : `Remind${(t as any).plan !== 'free' ? ' (WA)' : ''}`}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Remind copy-paste modal */}
          {remindeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setRemindModal(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">Send Reminder (Free Client)</h3>
                  <button onClick={() => setRemindModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-3">Copy this message and send on WhatsApp:</p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{reminderMessage}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(reminderMessage);
                    setCopiedMessage(true);
                    setTimeout(() => setCopiedMessage(false), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  {copiedMessage ? <><CheckCircle className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Message</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 6 — AUDIT WORKBENCH
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="space-y-5">
          <div className="card-base p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Client</label>
            <select
              value={auditClientId}
              onChange={e => {
                setAuditClientId(e.target.value);
                if (e.target.value) loadAudit(e.target.value);
              }}
              className="w-full sm:w-80 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select a client --</option>
              {clients.filter(c => c.status === 'active').map(c => (
                <option key={c.business_id} value={c.business_id}>{c.businesses?.business_name}</option>
              ))}
            </select>
          </div>

          {auditClientId && (
            <>
              {/* Compliance Timeline */}
              <div className="card-base p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Compliance Timeline</h3>
                  <a
                    href={`/api/export/${auditClientId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Audit PDF
                  </a>
                </div>
                {loadingAudit ? <SkeletonTable rows={4} /> : (
                  <div className="space-y-3">
                    {auditTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'completed' ? 'bg-emerald-500' : t.status === 'overdue' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{t.task_name}</p>
                          <p className="text-xs text-slate-400">Due {new Date(t.due_date).toLocaleDateString('en-IN')}</p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                    {auditTasks.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No tasks found.</p>}
                  </div>
                )}
              </div>

              {/* Document Audit Trail */}
              <div className="card-base p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Document Audit Trail</h3>
                {loadingAudit ? <SkeletonTable rows={3} /> : (
                  <div className="space-y-2">
                    {auditDocs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl">
                        <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
                          <p className="text-xs text-slate-400">
                            {doc.category} • {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {auditDocs.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No documents found.</p>}
                  </div>
                )}
              </div>

              {/* CA Notes */}
              <div className="card-base p-5">
                <h3 className="font-semibold text-slate-900 mb-3">CA Notes (Private)</h3>
                <textarea
                  value={auditNote}
                  onChange={e => setAuditNote(e.target.value)}
                  rows={4}
                  placeholder="Add private notes about this client..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">Notes are stored locally and not shared with the client.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 7 — CHECKLIST GENERATOR
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'checklist' && (
        <div className="space-y-5">
          <div className="card-base p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Generate Compliance Checklist</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Entity Type</label>
                <select value={checkEntityType} onChange={e => setCheckEntityType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="pvt_ltd">Private Limited</option>
                  <option value="opc">OPC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Turnover Bracket</label>
                <select value={checkTurnover} onChange={e => setCheckTurnover(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="<20l">Below ₹20L</option>
                  <option value="20l-1.5cr">₹20L–₹1.5Cr</option>
                  <option value="1.5cr-5cr">₹1.5Cr–₹5Cr</option>
                  <option value=">5cr">Above ₹5Cr</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Financial Year</label>
                <select value={checkFY} onChange={e => setCheckFY(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="2024-25">2024-25</option>
                  <option value="2025-26">2025-26</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => setChecklistGenerated(true)}
              className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
            >
              Generate Checklist
            </button>
          </div>

          {checklistGenerated && (
            <div className="card-base overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-900">Compliance Checklist — {checkFY}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{checkEntityType.replace(/_/g, ' ')} • {checkTurnover}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Export PDF
                  </button>
                  <select
                    value={addToClientId}
                    onChange={e => setAddToClientId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                  >
                    <option value="">Add all tasks to client...</option>
                    {clients.filter(c => c.status === 'active').map(c => (
                      <option key={c.business_id} value={c.business_id}>{c.businesses?.business_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="w-10 px-4 py-3" />
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Filing</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Freq.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {COMPLIANCE_ITEMS.filter(item =>
                      item.applicable.includes(checkEntityType)
                    ).map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!checklistChecked[i]}
                            onChange={e => setChecklistChecked(prev => ({ ...prev, [i]: e.target.checked }))}
                            className="w-4 h-4 accent-indigo-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium">{item.month}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{item.filing}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{item.dueDate}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{item.freq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 8 — PENALTY ESTIMATOR
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'penalty' && (
        <div className="max-w-2xl space-y-5">
          <div className="card-base p-6">
            <h3 className="font-semibold text-slate-900 mb-5">Penalty Estimator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Filing Type</label>
                <select value={penFilingType} onChange={e => setPenFilingType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {['GSTR-3B', 'GSTR-1', 'TDS', 'PF/ESI', 'ROC', 'ITR'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Tax Liability Amount (₹)</label>
                <input type="number" value={penTaxAmount} onChange={e => setPenTaxAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Original Due Date</label>
                <input type="date" value={penDueDate} onChange={e => setPenDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Actual Filing Date</label>
                <input type="date" value={penFilingDate} onChange={e => setPenFilingDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!penDueDate || !penFilingDate) return;
                setPenResult(calculatePenalty(penFilingType, penDueDate, penFilingDate, Number(penTaxAmount) || 0));
              }}
              className="mt-5 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
            >
              Calculate Penalty
            </button>
          </div>

          {penResult && (
            <div className="card-base p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Penalty Breakdown</h3>
              <table className="w-full text-sm mb-4">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-3 text-slate-600">Days Late</td><td className="py-3 font-semibold text-slate-900 text-right">{penResult.daysLate}</td></tr>
                  <tr><td className="py-3 text-slate-600">Late Fee</td><td className="py-3 font-semibold text-rose-600 text-right">₹{penResult.lateFee.toLocaleString('en-IN')}</td></tr>
                  <tr><td className="py-3 text-slate-600">Interest</td><td className="py-3 font-semibold text-rose-600 text-right">₹{penResult.interest.toLocaleString('en-IN')}</td></tr>
                  <tr className="border-t-2 border-slate-200">
                    <td className="py-3 font-bold text-slate-900">Total Estimated Penalty</td>
                    <td className="py-3 font-extrabold text-rose-600 text-right text-lg">₹{penResult.total.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mb-2"><strong>Calculation basis:</strong> {penResult.breakdown}</p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <p className="text-xs text-amber-800">
                  <strong>Disclaimer:</strong> This is an estimate only. Actual penalties may vary based on specific circumstances, notifications, and amendments. Consult your CA for accurate figures.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Share with Client (WhatsApp)</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2">
                  <p className="text-xs text-slate-700">
                    {`For ${penFilingType} filing (due ${penDueDate}, filed ${penFilingDate}):\n• Late Fee: ₹${penResult.lateFee.toLocaleString('en-IN')}\n• Interest: ₹${penResult.interest.toLocaleString('en-IN')}\n• Total: ₹${penResult.total.toLocaleString('en-IN')}\n\nPlease note this is an estimate. Contact your CA for details.`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const msg = `For ${penFilingType} filing (due ${penDueDate}, filed ${penFilingDate}):\n• Late Fee: ₹${penResult.lateFee.toLocaleString('en-IN')}\n• Interest: ₹${penResult.interest.toLocaleString('en-IN')}\n• Total Estimated: ₹${penResult.total.toLocaleString('en-IN')}\n\nThis is an estimate only. Consult your CA.`;
                    navigator.clipboard.writeText(msg);
                    setWaMessageCopied(true);
                    setTimeout(() => setWaMessageCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  {waMessageCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {waMessageCopied ? 'Copied!' : 'Copy WhatsApp Message'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 9 — REPORTS
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Portfolio Summary */}
          <div className="card-base p-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Portfolio Summary</h3>
            <p className="text-sm text-slate-500 mb-4">All clients with scores, pending count, and plan type.</p>
            <button
              onClick={() => {
                const rows = [['Business Name', 'Plan', 'Score', 'Pending Tasks', 'Overdue']];
                activeClients.forEach(c => {
                  const score = clientScore(c.compliance_tasks || []);
                  const pending = (c.compliance_tasks || []).filter((t: any) => t.status === 'pending').length;
                  const overdue = (c.compliance_tasks || []).filter((t: any) => t.status === 'overdue').length;
                  rows.push([c.businesses?.business_name || '', c.subscriptions?.[0]?.plan_type || 'free', `${score}%`, String(pending), String(overdue)]);
                });
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'portfolio_summary.csv'; a.click();
              }}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>

          {/* Monthly Filing Status */}
          <div className="card-base p-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Monthly Filing Status</h3>
            <p className="text-sm text-slate-500 mb-4">Grid of all clients × filing types with completion status.</p>
            <button
              onClick={() => {
                const taskTypes = Array.from(new Set(allClientTasks.map(t => t.task_type)));
                const header = ['Client', ...taskTypes];
                const rows = [header];
                activeClients.forEach(c => {
                  const row = [c.businesses?.business_name || ''];
                  taskTypes.forEach(type => {
                    const task = (c.compliance_tasks || []).find((t: any) => t.task_type === type);
                    row.push(task ? (task.status === 'completed' ? '✓' : task.status === 'overdue' ? '✗' : 'Pending') : 'N/A');
                  });
                  rows.push(row);
                });
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'monthly_filing_status.csv'; a.click();
              }}
              className="w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>

          {/* At-Risk Clients */}
          <div className="card-base p-6">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">At-Risk Clients</h3>
            <p className="text-sm text-slate-500 mb-4">Clients with score below 70% and recommended actions.</p>
            <button
              onClick={() => {
                const rows = [['Business Name', 'Score', 'Overdue Tasks', 'Pending Tasks', 'Recommended Action']];
                atRiskClients.forEach(c => {
                  const score = clientScore(c.compliance_tasks || []);
                  const overdue = (c.compliance_tasks || []).filter((t: any) => t.status === 'overdue').length;
                  const pending = (c.compliance_tasks || []).filter((t: any) => t.status === 'pending').length;
                  const action = overdue > 0 ? 'Immediate filing required' : pending > 5 ? 'Schedule compliance review' : 'Follow up on pending tasks';
                  rows.push([c.businesses?.business_name || '', `${score}%`, String(overdue), String(pending), action]);
                });
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'at_risk_clients.csv'; a.click();
              }}
              className="w-full py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
        </div>
      )}

      {/* ── Invite Client Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowInviteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add Client</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email check */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Client Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteResult(''); }}
                  placeholder="client@example.com"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteEmail}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {inviteLoading ? '...' : 'Check'}
                </button>
              </div>
              {inviteResult && <p className="text-xs text-slate-600 mt-2">{inviteResult}</p>}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-2">Or share your CA invite link:</p>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono truncate">
                  {inviteLink}
                </div>
                <button onClick={copyInviteLink}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap">
                  {copiedLink ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">New clients who use this link will be automatically linked to your account.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
