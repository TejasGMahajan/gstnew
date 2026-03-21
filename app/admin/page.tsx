// Server Component — no 'use client'
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  DollarSign,
  BarChart2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

const PRO_PRICE_ANNUAL = 999;

type FilterType = 'all' | 'active' | 'free' | 'expired';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin:                'bg-red-100 text-red-800',
    chartered_accountant: 'bg-blue-100 text-blue-800',
    business_owner:       'bg-green-100 text-green-800',
  };
  return map[role] ?? 'bg-slate-100 text-slate-700';
}

function planBadge(plan: string) {
  const map: Record<string, string> = {
    enterprise: 'bg-purple-100 text-purple-800',
    pro:        'bg-blue-100 text-blue-800',
    free:       'bg-slate-100 text-slate-700',
  };
  return map[plan] ?? 'bg-slate-100 text-slate-400';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active:    'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    past_due:  'bg-yellow-100 text-yellow-800',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filter = ((searchParams?.filter as string | undefined) ?? 'all') as FilterType;

  // ── Build subscriptions query based on filter ──────────────────────────────
  const subsQuery = (() => {
    let q = supabaseAdmin
      .from('subscriptions')
      .select(
        'id, business_id, plan_type, status, created_at, valid_until, razorpay_payment_id, businesses(business_name)',
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'active')  q = q.eq('status', 'active').neq('plan_type', 'free');
    if (filter === 'free')    q = q.eq('plan_type', 'free');
    if (filter === 'expired') q = q.in('status', ['cancelled', 'expired']);
    return q;
  })();

  // ── Parallel fetches ───────────────────────────────────────────────────────
  const [
    { count: totalProfiles },
    { count: totalBusinesses },
    { count: activeSubs },
    { count: freeSubs },
    { data: recentProfiles },
    { data: subscriptions },
    { data: pendingInvites },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .neq('plan_type', 'free'),
    supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('plan_type', 'free'),
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, user_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    subsQuery,
    supabaseAdmin
      .from('client_relationships')
      .select('id, ca_profile_id, business_id, created_at, businesses(business_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // ── Resolve plan for each recent signup ────────────────────────────────────
  const profileIds = (recentProfiles ?? []).map((p) => p.id);
  const { data: bizRows } = profileIds.length
    ? await supabaseAdmin.from('businesses').select('id, owner_id').in('owner_id', profileIds)
    : { data: [] as { id: string; owner_id: string }[] };

  const bizIds = (bizRows ?? []).map((b) => b.id);
  const { data: activePlanRows } = bizIds.length
    ? await supabaseAdmin
        .from('subscriptions')
        .select('business_id, plan_type')
        .in('business_id', bizIds)
        .eq('status', 'active')
    : { data: [] as { business_id: string; plan_type: string }[] };

  const ownerPlan = new Map<string, string>();
  for (const b of bizRows ?? []) {
    const sub = (activePlanRows ?? []).find((s) => s.business_id === b.id);
    ownerPlan.set(b.owner_id, sub?.plan_type ?? 'free');
  }

  // ── MRR / ARR ──────────────────────────────────────────────────────────────
  const activeCount = activeSubs ?? 0;
  const mrr = activeCount * (PRO_PRICE_ANNUAL / 12);
  const arr = activeCount * PRO_PRICE_ANNUAL;

  // ── "View in Supabase" link ────────────────────────────────────────────────
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace('https://', '')
    .replace('.supabase.co', '');
  const supabaseDashUrl = `https://supabase.com/dashboard/project/${projectRef}/auth/users`;

  const FILTERS: { label: string; value: FilterType }[] = [
    { label: 'All',     value: 'all'     },
    { label: 'Active',  value: 'active'  },
    { label: 'Free',    value: 'free'    },
    { label: 'Expired', value: 'expired' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Platform metrics · {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </p>
        </div>

        {/* ── Row 1: Metric cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(
            [
              { label: 'Total Profiles',  value: totalProfiles ?? 0,  icon: Users,     color: 'text-blue-700'    },
              { label: 'Businesses',      value: totalBusinesses ?? 0, icon: Building2, color: 'text-indigo-700'  },
              { label: 'Active Subs',     value: activeCount,          icon: CreditCard,color: 'text-green-700'   },
              { label: 'Free Users',      value: freeSubs ?? 0,        icon: TrendingUp,color: 'text-slate-500'   },
              { label: 'MRR',             value: `₹${fmtINR(mrr)}`,   icon: DollarSign,color: 'text-emerald-700' },
              { label: 'ARR',             value: `₹${fmtINR(arr)}`,   icon: BarChart2, color: 'text-purple-700'  },
            ] as const
          ).map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="shadow-sm border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {label}
                  </p>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Row 2: Recent signups ─────────────────────────────────────────── */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
            <CardTitle className="text-lg">Recent Signups</CardTitle>
            <CardDescription className="text-slate-300">
              Last 20 registrations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentProfiles ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.email}</TableCell>
                      <TableCell>
                        <Badge className={roleBadge(p.user_type)}>
                          {p.user_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {format(new Date(p.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {ownerPlan.has(p.id) ? (
                          <Badge className={planBadge(ownerPlan.get(p.id)!)}>
                            {ownerPlan.get(p.id)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={supabaseDashUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View in Supabase ↗
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(recentProfiles ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                        No signups yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Row 3: Subscriptions with filter ─────────────────────────────── */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-gradient-to-r from-indigo-800 to-indigo-700 text-white rounded-t-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Subscriptions</CardTitle>
                <CardDescription className="text-indigo-200">
                  {(subscriptions ?? []).length} record(s) shown
                </CardDescription>
              </div>
              {/* Filter links — work in server component via URL search params */}
              <div className="flex gap-1 bg-indigo-900/40 rounded-lg p-1">
                {FILTERS.map((f) => (
                  <Link
                    key={f.value}
                    href={`?filter=${f.value}`}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      filter === f.value
                        ? 'bg-white text-indigo-900 shadow-sm'
                        : 'text-indigo-100 hover:bg-indigo-600/50'
                    }`}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Razorpay Payment ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subscriptions ?? []).map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium text-sm">
                        {sub.businesses?.business_name ?? sub.business_id.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell>
                        <Badge className={planBadge(sub.plan_type)}>{sub.plan_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(sub.status)}`}
                        >
                          {sub.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {sub.valid_until
                          ? format(new Date(sub.valid_until), 'dd MMM yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {sub.razorpay_payment_id ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(subscriptions ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                        No subscriptions match this filter
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Row 4: Pending CA–Client invites ─────────────────────────────── */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-gradient-to-r from-amber-700 to-amber-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <div>
                <CardTitle className="text-lg">Pending CA–Client Invites</CardTitle>
                <CardDescription className="text-amber-100">
                  {(pendingInvites ?? []).length} unapproved invitation(s)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>CA Profile ID</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pendingInvites ?? []).map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-sm">
                        {inv.businesses?.business_name ?? inv.business_id.slice(0, 8) + '…'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {inv.ca_profile_id.slice(0, 12)}…
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {inv.created_at
                          ? format(new Date(inv.created_at), 'dd MMM yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(pendingInvites ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                        No pending invites
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
