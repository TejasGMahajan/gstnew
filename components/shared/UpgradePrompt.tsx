// FILE: components/shared/UpgradePrompt.tsx
import { Lock } from 'lucide-react';

interface UpgradePromptProps {
  featureName?: string;
  compact?: boolean;
}

export function UpgradePrompt({ featureName, compact = false }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-amber-800 text-xs">
          {featureName ? `${featureName} requires Pro` : 'Upgrade to Pro'}
        </span>
        <a
          href="/pricing"
          className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
        >
          Upgrade →
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Lock className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          {featureName ? `${featureName} is a Pro feature` : 'This feature requires Pro'}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Upgrade to unlock unlimited access, WhatsApp alerts, PDF exports, and more.
        </p>
      </div>
      <a
        href="/pricing"
        className="flex-shrink-0 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Upgrade to Pro
      </a>
    </div>
  );
}
