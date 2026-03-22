// FILE: components/shared/WorkflowStepIndicator.tsx
'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Status Config ────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'created', label: 'Created', index: 0 },
  { key: 'awaiting_documents', label: 'Awaiting Docs', index: 1 },
  { key: 'under_review', label: 'Under Review', index: 2 },
  { key: 'ready_to_file', label: 'Ready to File', index: 3 },
  { key: 'filed', label: 'Filed', index: 4 },
  { key: 'acknowledged', label: 'Acknowledged', index: 5 },
];

const STATUS_TO_STEP: Record<string, number> = {
  created: 0,
  awaiting_documents: 1,
  under_review: 2,
  ready_to_file: 3,
  filed: 4,
  acknowledged: 5,
  locked: 5,
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export function getStatusLabel(status: string): string {
  const step = STEPS.find(s => s.key === status);
  if (step) return step.label;
  if (status === 'locked') return 'Locked';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getNextAllowedStatus(status: string): string | null {
  switch (status) {
    case 'created':
      return 'awaiting_documents';
    case 'awaiting_documents':
      return 'under_review';
    case 'under_review':
      return 'ready_to_file';
    case 'ready_to_file':
      return 'filed';
    case 'filed':
      return 'acknowledged';
    case 'acknowledged':
      return 'locked';
    case 'locked':
      return null;
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkflowStepIndicatorProps {
  currentStatus: string;
  compact?: boolean;
}

export default function WorkflowStepIndicator({ currentStatus, compact = false }: WorkflowStepIndicatorProps) {
  const currentIndex = STATUS_TO_STEP[currentStatus] ?? 0;

  if (compact) {
    // Compact mode: just colored dots
    return (
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={step.key} className="flex items-center gap-1">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all',
                  isCompleted ? 'bg-emerald-500' :
                  isCurrent ? 'bg-indigo-600 ring-2 ring-indigo-200' :
                  'bg-slate-200'
                )}
                title={step.label}
              />
              {i < STEPS.length - 1 && (
                <div className={cn('w-4 h-0.5 transition-all', i < currentIndex ? 'bg-emerald-400' : 'bg-slate-200')} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Full mode: numbered circles with labels
  return (
    <div className="flex items-start gap-0 w-full overflow-x-auto">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={step.key} className="flex items-start flex-1 min-w-0">
            {/* Step */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : 'bg-slate-100 text-slate-400'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
              </div>
              <p
                className={cn(
                  'text-xs mt-1.5 font-medium text-center leading-tight max-w-[60px]',
                  isCompleted ? 'text-emerald-700' :
                  isCurrent ? 'text-indigo-700' :
                  'text-slate-400'
                )}
              >
                {step.label}
              </p>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 flex items-start mt-4">
                <div
                  className={cn(
                    'w-full h-0.5 transition-all',
                    i < currentIndex ? 'bg-emerald-400' : 'bg-slate-200'
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
