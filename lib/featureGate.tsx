'use client';

/**
 * Feature gating — plan-based access control.
 *
 * Exports:
 *   checkFeatureAccess(businessId, feature) — async, usable anywhere
 *   useFeatureAccess(feature)               — React hook (auto-resolves businessId)
 *   <UpgradePrompt feature="..." />         — dismissible upgrade banner
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanType = 'free' | 'pro' | 'enterprise';

export type Feature =
  | 'upload_document'
  | 'export_report'
  | 'whatsapp_alerts'
  | 'full_task_list'
  | 'priority_handling';

export interface FeatureAccessResult {
  allowed: boolean;
  reason:  string;
  plan:    string;
}

// ─── Feature rules ────────────────────────────────────────────────────────────

/** Minimum plan required to use a feature without any restriction. */
const PLAN_REQUIRED: Record<Feature, PlanType> = {
  upload_document:  'free',        // free has a monthly cap — see quota check below
  export_report:    'pro',
  whatsapp_alerts:  'pro',
  full_task_list:   'pro',         // free gets a 3-task cap
  priority_handling:'pro',
};

/** Human-readable feature names used in messages and the upgrade prompt. */
const FEATURE_LABELS: Record<Feature, string> = {
  upload_document:  'Document Uploads',
  export_report:    'Report Export',
  whatsapp_alerts:  'WhatsApp Alerts',
  full_task_list:   'Full Task List',
  priority_handling:'Priority Handling',
};

const FREE_UPLOAD_LIMIT = 5;   // per calendar month
const FREE_TASK_LIMIT   = 3;   // max tasks shown

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getActivePlan(businessId: string): Promise<PlanType> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_type')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .maybeSingle();

  const plan = data?.plan_type as PlanType | undefined;
  return plan && ['free', 'pro', 'enterprise'].includes(plan) ? plan : 'free';
}

/** Count documents this business uploaded in the current calendar month. */
async function getMonthlyUploadCount(businessId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('uploaded_at', start.toISOString());

  if (error) return 0; // fail open — don't block uploads on a count error
  return count ?? 0;
}

function planLabel(plan: PlanType): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

// ─── checkFeatureAccess ───────────────────────────────────────────────────────

/**
 * Check whether a business is allowed to use a feature.
 *
 * @example
 *   const { allowed, reason, plan } = await checkFeatureAccess(businessId, 'export_report');
 *   if (!allowed) showUpgrade(reason);
 */
export async function checkFeatureAccess(
  businessId: string,
  feature: Feature | string,
): Promise<FeatureAccessResult> {
  // Unknown feature — fail open to avoid blocking accidental typos in dev
  if (!PLAN_REQUIRED[feature as Feature]) {
    return { allowed: true, reason: '', plan: 'free' };
  }

  const f    = feature as Feature;
  const plan = await getActivePlan(businessId);
  const isPaid = plan === 'pro' || plan === 'enterprise';

  // ── upload_document: free plan has a 5/month cap ─────────────────────────
  if (f === 'upload_document') {
    if (isPaid) return { allowed: true, reason: '', plan };

    const used = await getMonthlyUploadCount(businessId);
    if (used >= FREE_UPLOAD_LIMIT) {
      return {
        allowed: false,
        reason:  `Free plan allows ${FREE_UPLOAD_LIMIT} document uploads per month. You have used ${used}/${FREE_UPLOAD_LIMIT}. Upgrade to Pro for unlimited uploads.`,
        plan,
      };
    }
    return {
      allowed: true,
      reason:  `${FREE_UPLOAD_LIMIT - used} of ${FREE_UPLOAD_LIMIT} free uploads remaining this month.`,
      plan,
    };
  }

  // ── full_task_list: free plan sees only 3 tasks ───────────────────────────
  if (f === 'full_task_list') {
    if (isPaid) return { allowed: true, reason: '', plan };
    return {
      allowed: false,
      reason:  `Free plan displays up to ${FREE_TASK_LIMIT} tasks. Upgrade to Pro to see your full task list.`,
      plan,
    };
  }

  // ── All other features: simple plan tier check ────────────────────────────
  const required = PLAN_REQUIRED[f];
  if (plan === 'enterprise') return { allowed: true, reason: '', plan };
  if (plan === 'pro' && required !== 'enterprise') return { allowed: true, reason: '', plan };

  return {
    allowed: false,
    reason:  `${FEATURE_LABELS[f]} is available on the ${planLabel(required)} plan and above. You are currently on the ${planLabel(plan)} plan.`,
    plan,
  };
}

// ─── useFeatureAccess hook ────────────────────────────────────────────────────

export interface UseFeatureAccessResult {
  allowed:     boolean;
  loading:     boolean;
  plan:        string;
  showUpgrade: boolean;
}

/**
 * React hook — resolves the current user's business automatically.
 *
 * @example
 *   const { allowed, loading, showUpgrade } = useFeatureAccess('export_report');
 */
export function useFeatureAccess(feature: Feature | string): UseFeatureAccessResult {
  const [state, setState] = useState<UseFeatureAccessResult>({
    allowed:     false,
    loading:     true,
    plan:        'free',
    showUpgrade: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setState({ allowed: false, loading: false, plan: 'free', showUpgrade: true });
          return;
        }

        // 2. Resolve their business (first active business linked to this user)
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!business) {
          // No business yet — fail open so onboarding isn't blocked
          if (!cancelled) setState({ allowed: true, loading: false, plan: 'free', showUpgrade: false });
          return;
        }

        // 3. Check feature
        const result = await checkFeatureAccess(business.id, feature);
        if (!cancelled) {
          setState({
            allowed:     result.allowed,
            loading:     false,
            plan:        result.plan,
            showUpgrade: !result.allowed,
          });
        }
      } catch {
        // On any unexpected error, fail open — don't block the UI
        if (!cancelled) setState({ allowed: true, loading: false, plan: 'free', showUpgrade: false });
      }
    }

    run();
    return () => { cancelled = true; };
  }, [feature]);

  return state;
}

// ─── UpgradePrompt component ──────────────────────────────────────────────────

interface UpgradePromptProps {
  feature: Feature | string;
  /** Optional override message. Defaults to the reason from checkFeatureAccess. */
  message?: string;
  className?: string;
}

const MIN_PLAN_LABEL: Record<Feature, string> = {
  upload_document:  'Pro',
  export_report:    'Pro',
  whatsapp_alerts:  'Pro',
  full_task_list:   'Pro',
  priority_handling:'Pro',
};

/**
 * Dismissible upgrade banner shown when a feature is gated.
 *
 * @example
 *   const { showUpgrade } = useFeatureAccess('export_report');
 *   {showUpgrade && <UpgradePrompt feature="export_report" />}
 */
export function UpgradePrompt({ feature, message, className = '' }: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const featureLabel = FEATURE_LABELS[feature as Feature] ?? feature;
  const planNeeded   = MIN_PLAN_LABEL[feature as Feature] ?? 'Pro';
  const displayMsg   = message ?? `${featureLabel} requires the ${planNeeded} plan.`;

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 shadow-sm ${className}`}
    >
      {/* Icon */}
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />

      {/* Body */}
      <div className="flex-1">
        <p className="font-semibold leading-snug">
          Upgrade to {planNeeded} to unlock {featureLabel}
        </p>
        <p className="mt-0.5 text-indigo-700">{displayMsg}</p>

        <Link
          href="/pricing"
          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          Upgrade Now
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
