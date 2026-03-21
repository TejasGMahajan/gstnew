import { cn } from '@/lib/utils';

type Status = 'completed' | 'pending' | 'overdue' | 'active' | 'acknowledged' | 'under_review' | 'awaiting_documents' | 'created' | 'locked' | 'free' | 'pro' | 'enterprise';

const statusConfig: Record<string, { label: string; className: string }> = {
  completed:           { label: 'Completed',           className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  acknowledged:        { label: 'Acknowledged',        className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  locked:              { label: 'Locked',              className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:             { label: 'Pending',             className: 'bg-amber-50 text-amber-700 border-amber-200' },
  awaiting_documents:  { label: 'Awaiting Docs',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  overdue:             { label: 'Overdue',             className: 'bg-rose-50 text-rose-700 border-rose-200' },
  active:              { label: 'Active',              className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  under_review:        { label: 'Under Review',        className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  created:             { label: 'Created',             className: 'bg-slate-50 text-slate-600 border-slate-200' },
  free:                { label: 'Free',                className: 'bg-slate-50 text-slate-600 border-slate-200' },
  pro:                 { label: 'Pro',                 className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  enterprise:          { label: 'Enterprise',          className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', cfg.className)}>
      {cfg.label}
    </span>
  );
}
