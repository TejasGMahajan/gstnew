import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; up: boolean };
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  subtitle?: string;
}

const colorMap = {
  indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-500', text: 'text-indigo-600' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-500', text: 'text-amber-600' },
  rose: { bg: 'bg-rose-50', icon: 'bg-rose-500', text: 'text-rose-600' },
  slate: { bg: 'bg-slate-50', icon: 'bg-slate-600', text: 'text-slate-600' },
};

export default function StatsCard({ label, value, icon: Icon, trend, color = 'indigo', subtitle }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className="stat-card flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        {trend && (
          <p className={cn('text-xs font-medium mt-2', trend.up ? 'text-emerald-600' : 'text-rose-600')}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
