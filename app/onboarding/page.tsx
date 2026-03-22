// FILE: app/onboarding/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { sanitizeText } from '@/lib/sanitize';
import { FileCheck, CheckCircle, AlertCircle, Building2, ChevronRight } from 'lucide-react';

// ─── GSTIN Validation ────────────────────────────────────────────────────────

function validateGSTIN(gstin: string): string | null {
  if (!gstin) return null; // optional
  if (gstin.length !== 15) return 'GSTIN must be exactly 15 characters.';
  const stateCode = parseInt(gstin.slice(0, 2), 10);
  if (isNaN(stateCode) || stateCode < 1 || stateCode > 37) return 'Invalid state code in GSTIN (first 2 digits must be 01–37).';
  const panPart = gstin.slice(2, 12);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panPart)) return 'GSTIN characters 3–12 must be a valid PAN format.';
  if (gstin[13] !== 'Z') return 'GSTIN character 14 must be Z.';
  return null;
}

function validatePAN(pan: string): string | null {
  if (!pan) return null; // optional
  if (pan.length !== 10) return 'PAN must be exactly 10 characters.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) return 'PAN must be in format: ABCDE1234F';
  return null;
}

// ─── Compliance Tasks Generator ──────────────────────────────────────────────

function generateComplianceTasks(businessId: string, entityType: string, turnoverBracket: string) {
  const now = new Date();
  const year = now.getFullYear();
  const tasks: {
    business_id: string;
    task_name: string;
    task_type: string;
    due_date: string;
    status: string;
    priority: string;
    description: string;
  }[] = [];

  const addTask = (name: string, type: string, dueDate: Date, priority: 'high' | 'medium' | 'low', desc: string) => {
    tasks.push({
      business_id: businessId,
      task_name: name,
      task_type: type,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'created',
      priority,
      description: desc,
    });
  };

  // Monthly tasks for next 3 months
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const m = baseDate.getMonth();
    const y = baseDate.getFullYear();

    // GSTR-1 — 11th of next month
    const gstr1Date = new Date(y, m + 1, 11);
    addTask(`GSTR-1 (${baseDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
      'GST', gstr1Date, 'high', 'Outward supplies return. Due by 11th of following month.');

    // GSTR-3B — 20th of next month
    const gstr3bDate = new Date(y, m + 1, 20);
    addTask(`GSTR-3B (${baseDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
      'GST', gstr3bDate, 'high', 'Monthly summary return and tax payment. Due by 20th of following month.');

    // TDS Payment — 7th of next month
    const tdsDate = new Date(y, m + 1, 7);
    addTask(`TDS Payment (${baseDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
      'TDS', tdsDate, 'high', 'Monthly TDS deposit with government. Due by 7th of following month.');

    // PF/ESI — 15th of next month
    const pfDate = new Date(y, m + 1, 15);
    addTask(`PF & ESI (${baseDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
      'PF_ESI', pfDate, 'medium', 'Provident Fund and ESI contribution deposit. Due by 15th of following month.');
  }

  // Annual tasks
  // ITR Filing
  addTask('Income Tax Return (ITR)', 'Income Tax', new Date(year, 6, 31), 'high', 'Annual income tax return filing. Due July 31.');

  // GSTR-9 Annual
  addTask('GSTR-9 Annual Return', 'GST', new Date(year, 11, 31), 'high', 'Annual GST reconciliation return. Due December 31.');

  // Entity-specific tasks
  if (['llp', 'pvt_ltd', 'opc'].includes(entityType.toLowerCase())) {
    // MSME Form 1 H1
    addTask('MSME Form 1 (H1)', 'ROC', new Date(year, 3, 30), 'medium', 'MSME outstanding payment return for H1 (Oct–Mar). Due April 30.');
    // MSME Form 1 H2
    addTask('MSME Form 1 (H2)', 'ROC', new Date(year, 9, 31), 'medium', 'MSME outstanding payment return for H2 (Apr–Sep). Due October 31.');
    // DIR-3 KYC
    addTask('DIR-3 KYC (Directors)', 'ROC', new Date(year, 8, 30), 'medium', 'Annual director KYC verification. Due September 30.');
    // GSTR-9C (if turnover > 5Cr)
    if (turnoverBracket === '>5cr') {
      addTask('GSTR-9C Reconciliation Statement', 'GST', new Date(year, 11, 31), 'high', 'Audited annual GST reconciliation. Due December 31.');
    }
  }

  // Quarterly TDS returns
  const quarters = [
    { label: 'Q1 (Apr–Jun)', month: 7, day: 31 },
    { label: 'Q2 (Jul–Sep)', month: 10, day: 31 },
    { label: 'Q3 (Oct–Dec)', month: 0, day: 31, yearOffset: 1 },
    { label: 'Q4 (Jan–Mar)', month: 4, day: 31 },
  ];

  for (const q of quarters) {
    const d = new Date(year + (q.yearOffset || 0), q.month, q.day);
    addTask(`TDS Return (${q.label})`, 'TDS', d, 'high', `Quarterly TDS return filing for ${q.label}.`);
  }

  return tasks;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {Array.from({ length: total }).map((_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <div key={i} className="flex items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              isCompleted ? 'bg-indigo-600 text-white' :
              isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
              'bg-slate-100 text-slate-400'
            }`}>
              {isCompleted ? <CheckCircle className="w-5 h-5" /> : stepNum}
            </div>
            {i < total - 1 && (
              <div className={`w-12 sm:w-20 h-0.5 ${stepNum < current ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Onboarding Page ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tasksCreated, setTasksCreated] = useState(0);

  // Step 1 fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [address, setAddress] = useState('');

  // Step 2 fields
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [turnoverBracket, setTurnoverBracket] = useState('');

  const [gstinError, setGstinError] = useState('');
  const [panError, setPanError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Check if user already has a business
  useEffect(() => {
    if (user) {
      supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) router.replace('/dashboard');
        });
    }
  }, [user, router]);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) { setError('Business name is required.'); return; }
    if (!businessType) { setError('Please select a business type.'); return; }
    setError('');
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate GSTIN and PAN
    const gstErr = validateGSTIN(gstin.toUpperCase().trim());
    const panErr = validatePAN(pan.toUpperCase().trim());
    if (gstErr) { setGstinError(gstErr); return; }
    if (panErr) { setPanError(panErr); return; }
    setGstinError('');
    setPanError('');

    if (!turnoverBracket) { setError('Please select a turnover bracket.'); return; }
    if (!user) { router.replace('/login'); return; }

    setSubmitting(true);
    try {
      // Insert business
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          owner_id: user.id,
          business_name: sanitizeText(businessName),
          business_type: businessType,
          address: address ? sanitizeText(address) : null,
          gstin: gstin ? gstin.toUpperCase().trim() : null,
          pan: pan ? pan.toUpperCase().trim() : null,
        })
        .select()
        .single();

      if (bizError) throw new Error(bizError.message);
      if (!business) throw new Error('Failed to create business.');

      // Create compliance tasks
      const tasks = generateComplianceTasks(business.id, businessType, turnoverBracket);
      const { error: tasksError } = await supabase.from('compliance_tasks').insert(tasks);
      if (tasksError) {
        console.error('[Onboarding] Task creation error:', tasksError.message);
      }

      // Free subscription record
      try {
        await supabase.from('subscriptions').insert({
          business_id: business.id,
          plan_type: 'free',
          status: 'active',
        });
      } catch { /* subscription already exists */ }

      // Handle pending CA link
      const pendingCaId = typeof window !== 'undefined' ? localStorage.getItem('pending_ca_id') : null;
      if (pendingCaId) {
        try {
          await supabase.from('client_relationships').insert({
            ca_profile_id: pendingCaId,
            business_id: business.id,
            status: 'pending',
          });
        } catch { /* relationship already exists */ }
        localStorage.removeItem('pending_ca_id');
      }

      setTasksCreated(tasks.length);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">ComplianceHub</span>
          </div>
          <p className="text-slate-500 text-sm mt-2">Let's set up your business</p>
        </div>

        <StepIndicator current={step} total={3} />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {/* ── Step 1: Business Details ── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Business Details</h2>
              <p className="text-slate-500 text-sm mb-6">Tell us about your business</p>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label htmlFor="biz-name" className="block text-sm font-medium text-slate-700 mb-1.5">Business Name *</label>
                  <input
                    id="biz-name"
                    name="business_name"
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    autoComplete="organization"
                    placeholder="Sharma Traders Pvt. Ltd."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="biz-type" className="block text-sm font-medium text-slate-700 mb-1.5">Business Type *</label>
                  <select
                    id="biz-type"
                    name="business_type"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select business type</option>
                    <option value="proprietorship">Proprietorship</option>
                    <option value="partnership">Partnership</option>
                    <option value="llp">LLP (Limited Liability Partnership)</option>
                    <option value="pvt_ltd">Private Limited Company</option>
                    <option value="opc">OPC (One Person Company)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="biz-address" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Business Address <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="biz-address"
                    name="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    placeholder="123, Main Street, Mumbai, Maharashtra - 400001"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Tax & Compliance Info ── */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Tax & Compliance Info</h2>
              <p className="text-slate-500 text-sm mb-6">Optional but helps us set up your compliance calendar accurately</p>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleStep2} className="space-y-4">
                <div>
                  <label htmlFor="biz-gstin" className="block text-sm font-medium text-slate-700 mb-1.5">
                    GSTIN <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="biz-gstin"
                    name="gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => { setGstin(e.target.value.toUpperCase()); setGstinError(''); }}
                    maxLength={15}
                    placeholder="27AABCU9603R1ZX"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono ${gstinError ? 'border-rose-300' : 'border-slate-300'}`}
                  />
                  {gstinError && <p className="text-xs text-rose-600 mt-1">{gstinError}</p>}
                  <p className="text-xs text-slate-400 mt-1">15-character GST Identification Number</p>
                </div>

                <div>
                  <label htmlFor="biz-pan" className="block text-sm font-medium text-slate-700 mb-1.5">
                    PAN <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="biz-pan"
                    name="pan"
                    type="text"
                    value={pan}
                    onChange={(e) => { setPan(e.target.value.toUpperCase()); setPanError(''); }}
                    maxLength={10}
                    placeholder="AABCU9603R"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono ${panError ? 'border-rose-300' : 'border-slate-300'}`}
                  />
                  {panError && <p className="text-xs text-rose-600 mt-1">{panError}</p>}
                </div>

                <div>
                  <label htmlFor="biz-turnover" className="block text-sm font-medium text-slate-700 mb-1.5">Annual Turnover Bracket *</label>
                  <select
                    id="biz-turnover"
                    name="turnover_bracket"
                    value={turnoverBracket}
                    onChange={(e) => setTurnoverBracket(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select turnover bracket</option>
                    <option value="<20l">Below ₹20 Lakhs</option>
                    <option value="20l-1.5cr">₹20 Lakhs – ₹1.5 Crore</option>
                    <option value="1.5cr-5cr">₹1.5 Crore – ₹5 Crore</option>
                    <option value=">5cr">Above ₹5 Crore</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-60"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Setting up...
                      </span>
                    ) : 'Create Business'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6">
                <CheckCircle className="w-9 h-9 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">You're all set!</h2>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Your compliance calendar is ready.{' '}
                <span className="font-semibold text-indigo-600">{tasksCreated} tasks</span> have been created automatically based on your business type.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                {[
                  { icon: '📅', label: 'Compliance Calendar', desc: 'Pre-filled with all your deadlines' },
                  { icon: '📁', label: 'Document Vault', desc: 'Secure cloud storage ready' },
                  { icon: '🔔', label: 'Deadline Alerts', desc: 'Upgrade to Pro for WhatsApp alerts' },
                  { icon: '👨‍💼', label: 'CA Dashboard', desc: 'Invite your CA to collaborate' },
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-slate-50 rounded-xl">
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {step < 3 && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Step {step} of 2 — Your data is encrypted and stored securely.
          </p>
        )}
      </div>
    </div>
  );
}
