'use client';

import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

const WORKFLOW_STEPS = [
  { key: 'created', label: 'Created', color: 'blue' },
  { key: 'awaiting_documents', label: 'Awaiting Docs', color: 'yellow' },
  { key: 'under_review', label: 'Under Review', color: 'orange' },
  { key: 'ready_to_file', label: 'Ready to File', color: 'purple' },
  { key: 'filed', label: 'Filed', color: 'cyan' },
  { key: 'acknowledged', label: 'Acknowledged', color: 'green' },
  { key: 'locked', label: 'Locked', color: 'slate' },
];

interface WorkflowStepIndicatorProps {
  currentStatus: string;
  compact?: boolean;
}

export default function WorkflowStepIndicator({
  currentStatus,
  compact = false,
}: WorkflowStepIndicatorProps) {
  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.key === currentStatus);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  isComplete
                    ? 'bg-green-500'
                    : isCurrent
                    ? 'bg-blue-500 ring-2 ring-blue-200'
                    : 'bg-slate-200'
                }`}
                title={step.label}
              />
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-3 ${
                    idx < currentIdx ? 'bg-green-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {WORKFLOW_STEPS.map((step, idx) => {
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isLocked = step.key === 'locked' && currentStatus === 'locked';

        return (
          <React.Fragment key={step.key}>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isLocked
                  ? 'bg-slate-800 text-white'
                  : isComplete
                  ? 'bg-green-100 text-green-800'
                  : isCurrent
                  ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-300'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {step.label}
            </div>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <ArrowRight
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  idx < currentIdx ? 'text-green-400' : 'text-slate-300'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Returns the allowed next status given the current status, or null if locked.
 */
export function getNextAllowedStatus(currentStatus: string): string | null {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === currentStatus);
  if (idx < 0 || idx >= WORKFLOW_STEPS.length - 1) return null;
  return WORKFLOW_STEPS[idx + 1].key;
}

/**
 * Returns human-readable label for a status key.
 */
export function getStatusLabel(status: string): string {
  return WORKFLOW_STEPS.find((s) => s.key === status)?.label || status;
}
