'use client';

import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <Icon className="h-16 w-16 mx-auto text-slate-300 mb-4" />
      <p className="text-slate-600 text-lg">{title}</p>
      {description && (
        <p className="text-slate-500 text-sm mt-2">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          className="mt-4 bg-blue-900 hover:bg-blue-800"
          onClick={onAction}
        >
          {ActionIcon && <ActionIcon className="h-4 w-4 mr-2" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
