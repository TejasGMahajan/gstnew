// FILE: app/(dashboard)/dashboard-admin/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseAdmin } from '@/lib/supabase/admin';
import StatsCard from '@/components/shared/StatsCard';
import { SkeletonCard, SkeletonTable } from '@/components/shared/SkeletonCard';
import StatusBadge from '@/components/shared/StatusBadge';
import Pagination from '@/components/shared/Pagination';
import { Users, CreditCard, MessageSquare, Activity, Search, RefreshCw, ShieldAlert } from 'lucide-react';

type AdminTab = 'users' | 'subscriptions' | 'wa_credits' | 'audit_logs';

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

  // ── Security Check ────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (profile && profile.user_type !== 'admin') {
      setAccessDenied(true);
      setPageLoading(false);
    }
  }, [user, profile, authLoading, router]);

  // ── Load Stats ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    const [usersRes, bizRes, subRes] = await Promise.allSettled([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('businesses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('subscriptions').select('amount_paid, status').eq('status', 'active'),
    ]);

    if (usersRes.status === 'fulfilled') setTotalUsers(usersRes.value.count || 0);
    if (bizRes.status === 'fulfilled') setTotalBusinesses(bizRes.value.count || 0);
    if (subRes.status === 'fulfilled' && subRes.value.data) {
      setActiveSubscriptions(subRes.value.data.length);
      setTotalRevenue(subRes.value.data.reduce((sum: number, s: any) => sum + (s.amount_paid || 0), 0));
    }
  }, []);

  // ── Load Users Tab ────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    const start = (userPage - 1) * PAGE_SIZE;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, user_type, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (userSearch) query = query.ilike('email', `%${userSearch}%`);
    if (userTypeFilter) query = query.eq('user_type', userTypeFilter);

    const { data, count } = await query;
    setUsers(data || []);
    setTotalUsersFiltered(count || 0);
  }, [userPage, userSearch, userTypeFilter]);

  // ── Load Subscriptions Tab ────────────────────────────────────────────────

  const loadSubscriptions = useCallback(async () => {
    const start = (subPage - 1) * PAGE_SIZE;

    let query = supabaseAdmin
      .from('subscriptions')
      .select(`
        id, plan_type, status, amount_paid, created_at, razorpay_order_id,
        businesses (business_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (subPlanFilter) query = query.eq('plan_type', subPlanFilter);

    const { data, count } = await query;
    setSubscriptions(data || []);
    setTotalSubs(count || 0);
  }, [subPage, subPlanFilter]);

  // ── Load WA Credits Tab ───────────────────────────────────────────────────

  const loadWACredits = useCallback(async () => {
    setWaLoading(true);
    const { data } = await supabaseAdmin
      .from('whatsapp_credits')
      .select(`
        id, credits_remaining, credits_total, updated_at,
        businesses (business_name)
      `)
      .order('credits_remaining', { ascending: true });
    setWaCredits(data || []);
    setWaLoading(false);
  }, []);

  // ── Load Audit Logs Tab ───────────────────────────────────────────────────

  const loadAuditLogs = useCallback(async () => {
    const start = (auditPage - 1) * PAGE_SIZE;

    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        id, action, entity_type, entity_id, description, created_at,
        profiles (email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (auditEntityFilter) query = query.eq('entity_type', auditEntityFilter);

    const { data, count } = await query;
    setAuditLogs(data || []);
    setTotalAuditLogs(count || 0);
  }, [auditPage, auditEntityFilter]);

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
  }, [activeTab, user, profile, loadUsers, loadSubscriptions, loadWACredits, loadAuditLogs]);

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
                      <StatusBadge status={u.user_type === 'chartered_accountant' ? 'active' : u.user_type === 'admin' ? 'enterprise' : 'pending'} />
                      <span className="ml-2 text-xs text-slate-500 capitalize">{u.user_type?.replace(/_/g, ' ')}</span>
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
              <option value="compliance_task">Compliance Task</option>
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
    </div>
  );
}
