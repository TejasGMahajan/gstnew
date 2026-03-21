// FILE: lib/featureGate.tsx
'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ─── PLAN LIMITS ────────────────────────────────────────────────────────────

export const FREE_LIMITS = {
  docs_per_month: 5,
  tasks_visible: 3,
  whatsapp: false,
  export: false,
  storage_mb: 100,
} as const;

export const PRO_LIMITS = {
  docs_per_month: Infinity,
  tasks_visible: Infinity,
  whatsapp: true,
  export: true,
  storage_mb: 2048,
} as const;

export const ENTERPRISE_LIMITS = {
  docs_per_month: Infinity,
  tasks_visible: Infinity,
  whatsapp: true,
  export: true,
  storage_mb: 10240,
} as const;

export type PlanType = 'free' | 'pro' | 'enterprise';
export type FeatureKey =
  | 'whatsapp_reminders'
  | 'export_report'
  | 'document_upload'
  | 'full_task_calendar'
  | 'priority_ca'
  | 'multi_ca';

// ─── FEATURE → PLAN REQUIREMENTS ────────────────────────────────────────────

const FEATURE_PLAN_MAP: Record<FeatureKey, PlanType[]> = {
  whatsapp_reminders: ['pro', 'enterprise'],
  export_report: ['pro', 'enterprise'],
  document_upload: ['free', 'pro', 'enterprise'], // allowed on all plans but has monthly limit on free
  full_task_calendar: ['pro', 'enterprise'],
  priority_ca: ['pro', 'enterprise'],
  multi_ca: ['enterprise'],
};

// ─── getBusinessPlan ─────────────────────────────────────────────────────────

export async function getBusinessPlan(businessId: string): Promise<PlanType> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('plan_type, status')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 'free';

  const plan = data.plan_type as string;
  if (plan === 'enterprise') return 'enterprise';
  if (plan === 'pro') return 'pro';
  return 'free';
}

// ─── checkFeatureAccess ──────────────────────────────────────────────────────

export async function checkFeatureAccess(
  businessId: string,
  feature: FeatureKey
): Promise<{ allowed: boolean; plan: PlanType; reason?: string }> {
  const plan = await getBusinessPlan(businessId);
  const allowedPlans = FEATURE_PLAN_MAP[feature];

  if (!allowedPlans.includes(plan)) {
    return {
      allowed: false,
      plan,
      reason: `Feature '${feature}' requires ${allowedPlans.join(' or ')} plan. Current plan: ${plan}.`,
    };
  }

  // Extra check for document_upload: enforce monthly limit on free plan
  if (feature === 'document_upload' && plan === 'free') {
    const limitCheck = await checkDocumentUploadLimit(businessId);
    if (!limitCheck.allowed) {
      return {
        allowed: false,
        plan,
        reason: `Free plan allows ${FREE_LIMITS.docs_per_month} uploads/month. You've used ${limitCheck.used}.`,
      };
    }
  }

  return { allowed: true, plan };
}

// ─── checkDocumentUploadLimit ────────────────────────────────────────────────

export async function checkDocumentUploadLimit(
  businessId: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await getBusinessPlan(businessId);

  if (plan !== 'free') {
    return { allowed: true, used: 0, limit: Infinity };
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabaseAdmin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('uploaded_at', firstOfMonth);

  if (error) {
    // Fail open — don't block upload if we can't count
    return { allowed: true, used: 0, limit: FREE_LIMITS.docs_per_month };
  }

  const used = count ?? 0;
  const limit = FREE_LIMITS.docs_per_month;

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

// ─── UpgradePrompt component ─────────────────────────────────────────────────

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
