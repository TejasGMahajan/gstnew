// FILE: app/(dashboard)/dashboard-admin/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import StatsCard from '@/components/shared/StatsCard';
import { SkeletonCard, SkeletonTable } from '@/components/shared/SkeletonCard';
import StatusBadge from '@/components/shared/StatusBadge';
import Pagination from '@/components/shared/Pagination';
import { Users, CreditCard, MessageSquare, Activity, Search, RefreshCw, ShieldAlert, Calendar, Plus, Trash2, CheckCircle2 } from 'lucide-react';

type AdminTab = 'users' | 'subscriptions' | 'wa_credits' | 'audit_logs' | 'deadlines';

const PAGE_SIZE = 20;

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [accessDenied, setAccessDenied] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // Users tab
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [totalUsersFiltered, setTotalUsersFiltered] = useState(0);

  // Subscriptions tab
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subPlanFilter, setSubPlanFilter] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [totalSubs, setTotalSubs] = useState(0);

  // WA Credits tab
  const [waCredits, setWaCredits] = useState<any[]>([]);
  const [waLoading, setWaLoading] = useState(false);

  // Audit logs tab
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);

  // Deadlines tab
  const [overrides, setOverrides] = useState<any[]>([]);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ id: string; count: number } | null>(null);
  const [newOverride, setNewOverride] = useState({
    task_type: '',
    original_due_date: '',
    extended_due_date: '',
    reason: '',
    circular_ref: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Security Check ────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (profile && profile.user_type !== 'admin') {
      setAccessDenied(true);
      setPageLoading(false);
    }
  }, [user, profile, authLoading, router]);

  // ── Admin API helper ──────────────────────────────────────────────────────

  const adminFetch = useCallback(async (params: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/admin?${qs}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const adminPost = useCallback(async (body: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  // ── Load Stats ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const data = await adminFetch({ type: 'stats' });
    if (!data) return;
    setTotalUsers(data.totalUsers);
    setTotalBusinesses(data.totalBusinesses);
    setActiveSubscriptions(data.activeSubscriptions);
    setTotalRevenue(data.totalRevenue);
  }, [adminFetch]);

  // ── Load Users Tab ────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    const params: Record<string, string> = { type: 'users', page: String(userPage) };
    if (userSearch) params.search = userSearch;
    if (userTypeFilter) params.filter = userTypeFilter;
    const data = await adminFetch(params);
    if (!data) return;
    setUsers(data.data || []);
    setTotalUsersFiltered(data.total || 0);
  }, [userPage, userSearch, userTypeFilter, adminFetch]);

  // ── Load Subscriptions Tab ────────────────────────────────────────────────

  const loadSubscriptions = useCallback(async () => {
    const params: Record<string, string> = { type: 'subscriptions', page: String(subPage) };
    if (subPlanFilter) params.filter = subPlanFilter;
    const data = await adminFetch(params);
    if (!data) return;
    setSubscriptions(data.data || []);
    setTotalSubs(data.total || 0);
  }, [subPage, subPlanFilter, adminFetch]);

  // ── Load WA Credits Tab ───────────────────────────────────────────────────

  const loadWACredits = useCallback(async () => {
    setWaLoading(true);
    const data = await adminFetch({ type: 'wa_credits' });
    setWaCredits(data?.data || []);
    setWaLoading(false);
  }, [adminFetch]);

  // ── Load Audit Logs Tab ───────────────────────────────────────────────────

  const loadAuditLogs = useCallback(async () => {
    const params: Record<string, string> = { type: 'audit_logs', page: String(auditPage) };
    if (auditEntityFilter) params.filter = auditEntityFilter;
    const data = await adminFetch(params);
    if (!data) return;
    setAuditLogs(data.data || []);
    setTotalAuditLogs(data.total || 0);
  }, [auditPage, auditEntityFilter, adminFetch]);

  const loadOverrides = useCallback(async () => {
    setOverrideLoading(true);
    const data = await adminFetch({ type: 'deadline_overrides' });
    setOverrides(data?.data || []);
    setOverrideLoading(false);
  }, [adminFetch]);

  // ── Main Load ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !profile || profile.user_type !== 'admin') return;
    setPageLoading(true);
    loadStats().finally(() => setPageLoading(false));
  }, [user, profile, loadStats]);

  useEffect(() => {
    if (!user || !profile || profile.user_type !== 'admin') return;
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'subscriptions') loadSubscriptions();
    if (activeTab === 'wa_credits') loadWACredits();
    if (activeTab === 'audit_logs') loadAuditLogs();
    if (activeTab === 'deadlines') loadOverrides();
  }, [activeTab, user, profile, loadUsers, loadSubscriptions, loadWACredits, loadAuditLogs, loadOverrides]);

  // ── Access Denied Screen ──────────────────────────────────────────────────

  if (accessDenied) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-9 h-9 text-rose-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-slate-500 mt-2 mb-6">You don't have admin permissions to view this page.</p>
          <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs: { key: AdminTab; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { key: 'wa_credits', label: 'WA Credits', icon: MessageSquare },
    { key: 'audit_logs', label: 'Audit Logs', icon: Activity },
    { key: 'deadlines', label: 'Deadlines', icon: Calendar },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">Admin Panel</h1>
          <p className="text-sm text-slate-500 mt-1">System overview and management</p>
        </div>
        <button
          onClick={() => { loadStats(); if (activeTab === 'users') loadUsers(); if (activeTab === 'subscriptions') loadSubscriptions(); if (activeTab === 'wa_credits') loadWACredits(); if (activeTab === 'audit_logs') loadAuditLogs(); }}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stat Cards */}
      {pageLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard label="Total Users" value={totalUsers} icon={Users} color="indigo" />
          <StatsCard label="Total Businesses" value={totalBusinesses} icon={Activity} color="emerald" />
          <StatsCard label="Active Subscriptions" value={activeSubscriptions} icon={CreditCard} color="amber" />
          <StatsCard
            label="Revenue This Month"
            value={`₹${(totalRevenue / 100).toLocaleString('en-IN')}`}
            icon={CreditCard}
            color="emerald"
            subtitle="from active subscriptions"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl mb-5 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (
        <div className="card-base overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-3 p-5 border-b border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by email..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={userTypeFilter}
              onChange={e => { setUserTypeFilter(e.target.value); setUserPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All types</option>
              <option value="business_owner">Business Owner</option>
              <option value="chartered_accountant">Chartered Accountant</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{u.full_name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.user_type === 'admin' ? 'bg-purple-100 text-purple-700' :
                        u.user_type === 'chartered_accountant' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-indigo-100 text-indigo-700'
                      }`}>
                        {u.user_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination page={userPage} total={totalUsersFiltered} pageSize={PAGE_SIZE} onChange={setUserPage} />
          </div>
        </div>
      )}

      {/* ── Subscriptions Tab ── */}
      {activeTab === 'subscriptions' && (
        <div className="card-base overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Total Revenue: <span className="text-emerald-600">₹{(totalRevenue / 100).toLocaleString('en-IN')}</span>
              </p>
            </div>
            <select
              value={subPlanFilter}
              onChange={e => { setSubPlanFilter(e.target.value); setSubPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Business</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Plan</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Razorpay Order</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {subscriptions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{(s.businesses as any)?.business_name || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={s.plan_type} /></td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      ₹{s.amount_paid ? (s.amount_paid / 100).toLocaleString('en-IN') : '0'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono">{s.razorpay_order_id || '—'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination page={subPage} total={totalSubs} pageSize={PAGE_SIZE} onChange={setSubPage} />
          </div>
        </div>
      )}

      {/* ── WA Credits Tab ── */}
      {activeTab === 'wa_credits' && (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Business</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Remaining</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Usage</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {waCredits.map(w => {
                  const usagePercent = w.credits_total > 0
                    ? Math.round(((w.credits_total - w.credits_remaining) / w.credits_total) * 100)
                    : 0;
                  const isHigh = usagePercent > 80;
                  return (
                    <tr key={w.id} className={`hover:bg-slate-50 transition-colors ${isHigh ? 'bg-rose-50/30' : ''}`}>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {(w.businesses as any)?.business_name || '—'}
                        {isHigh && <span className="ml-2 text-xs text-rose-600 font-semibold">⚠ High usage</span>}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{w.credits_remaining}</td>
                      <td className="px-5 py-3 text-slate-600">{w.credits_total}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 rounded-full h-2 flex-shrink-0">
                            <div
                              className={`h-2 rounded-full transition-all ${isHigh ? 'bg-rose-500' : 'bg-indigo-600'}`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${isHigh ? 'text-rose-600' : 'text-slate-600'}`}>{usagePercent}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {new Date(w.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
                {!waLoading && waCredits.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No WhatsApp credit records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Audit Logs Tab ── */}
      {activeTab === 'audit_logs' && (
        <div className="card-base overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Audit Logs</h3>
            <select
              value={auditEntityFilter}
              onChange={e => { setAuditEntityFilter(e.target.value); setAuditPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All entity types</option>
              <option value="document">Document</option>
              <option value="task">Task</option>
              <option value="business">Business</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Entity Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-mono capitalize">{log.action}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs capitalize">{log.entity_type?.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-indigo-600 text-xs">{(log.profiles as any)?.email || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs max-w-xs truncate">{log.description}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination page={auditPage} total={totalAuditLogs} pageSize={PAGE_SIZE} onChange={setAuditPage} />
          </div>
        </div>
      )}

      {/* ── Deadlines Tab ── */}
      {activeTab === 'deadlines' && (
        <div className="space-y-5">
          {/* Create Override Form */}
          <div className="card-base p-5">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Add Deadline Extension
            </h3>
            {createError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{createError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Filing Type</label>
                <select
                  value={newOverride.task_type}
                  onChange={e => setNewOverride(p => ({ ...p, task_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select filing...</option>
                  <option value="GSTR-1">GSTR-1</option>
                  <option value="GSTR-3B">GSTR-3B</option>
                  <option value="GSTR-9">GSTR-9 Annual</option>
                  <option value="TDS Payment">TDS Payment</option>
                  <option value="TDS Return">TDS Return</option>
                  <option value="PF & ESI">PF & ESI</option>
                  <option value="ITR Filing">ITR Filing</option>
                  <option value="DIR-3 KYC">DIR-3 KYC</option>
                  <option value="MSME Form 1">MSME Form 1</option>
                  <option value="MGT-7">Annual Return (MGT-7)</option>
                  <option value="AOC-4">Financial Statements (AOC-4)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Original Due Date</label>
                <input
                  type="date"
                  value={newOverride.original_due_date}
                  onChange={e => setNewOverride(p => ({ ...p, original_due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Extended Due Date</label>
                <input
                  type="date"
                  value={newOverride.extended_due_date}
                  onChange={e => setNewOverride(p => ({ ...p, extended_due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Circular Reference <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={newOverride.circular_ref}
                  onChange={e => setNewOverride(p => ({ ...p, circular_ref: e.target.value }))}
                  placeholder="e.g. CBIC Circular 05/2026"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                <input
                  type="text"
                  value={newOverride.reason}
                  onChange={e => setNewOverride(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Extended due to server downtime on GSTN portal"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              disabled={creating || !newOverride.task_type || !newOverride.original_due_date || !newOverride.extended_due_date || !newOverride.reason}
              onClick={async () => {
                setCreating(true);
                setCreateError('');
                const res = await adminPost({ action: 'create_override', ...newOverride });
                setCreating(false);
                if (!res) { setCreateError('Failed to create override.'); return; }
                setNewOverride({ task_type: '', original_due_date: '', extended_due_date: '', reason: '', circular_ref: '' });
                loadOverrides();
              }}
              className="mt-4 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Saving...' : 'Save Override'}
            </button>
          </div>

          {/* Overrides Table */}
          <div className="card-base overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Active Overrides</h3>
              <p className="text-xs text-slate-500">Click "Apply" to update all matching tasks in the database</p>
            </div>
            {overrideLoading ? (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">Loading...</div>
            ) : overrides.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">No overrides yet. Add one above when the government extends a deadline.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Filing</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Original Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Extended To</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Reason</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Applied</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {overrides.map(ov => (
                      <tr key={ov.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-800">{ov.task_type}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs line-through">{new Date(ov.original_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-5 py-3 font-semibold text-emerald-600 text-xs">{new Date(ov.extended_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-5 py-3 text-slate-600 text-xs max-w-xs">
                          <div>{ov.reason}</div>
                          {ov.circular_ref && <div className="text-indigo-600 mt-0.5">{ov.circular_ref}</div>}
                        </td>
                        <td className="px-5 py-3">
                          {ov.applied_count > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {ov.applied_count} tasks
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">Not applied</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              disabled={applyingId === ov.id}
                              onClick={async () => {
                                setApplyingId(ov.id);
                                setApplyResult(null);
                                const res = await adminPost({
                                  action: 'apply_override',
                                  id: ov.id,
                                  task_type: ov.task_type,
                                  original_due_date: ov.original_due_date,
                                  extended_due_date: ov.extended_due_date,
                                });
                                setApplyingId(null);
                                if (res) { setApplyResult({ id: ov.id, count: res.updated }); loadOverrides(); }
                              }}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                              {applyingId === ov.id ? 'Applying...' : 'Apply to Tasks'}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this override?')) return;
                                await adminPost({ action: 'delete_override', id: ov.id });
                                loadOverrides();
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {applyResult?.id === ov.id && (
                            <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Updated {applyResult.count} tasks</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
