// FILE: app/pricing/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle, X, FileCheck, ArrowLeft, Star } from 'lucide-react';

interface SubscriptionData {
  plan_type: string;
  business_id: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    subtitle: 'CAs only — forever',
    price: '₹0',
    period: '/forever',
    popular: false,
    color: 'border-slate-200',
    btnClass: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    features: [
      { label: 'Unlimited client dashboard', included: true },
      { label: 'Compliance calendar', included: true },
      { label: 'Document review', included: true },
      { label: 'CA invite link', included: true },
      { label: '5 doc uploads/month (business)', included: true },
      { label: 'WhatsApp/SMS alerts', included: false },
      { label: 'Document vault (full)', included: false },
      { label: 'Full task calendar (15+/year)', included: false },
      { label: 'Priority CA handling', included: false },
      { label: 'PDF export reports', included: false },
    ],
    razorpayAmount: null,
  },
  {
    key: 'pro',
    name: 'Pro',
    subtitle: 'For growing businesses',
    price: '₹999',
    period: '/year',
    popular: true,
    color: 'border-indigo-500 shadow-2xl shadow-indigo-100',
    btnClass: 'bg-indigo-600 text-white hover:bg-indigo-700',
    features: [
      { label: 'All Free features', included: true },
      { label: 'WhatsApp/SMS alerts', included: true },
      { label: '2GB document vault', included: true },
      { label: 'Full task calendar (15+/year)', included: true },
      { label: 'Priority CA handling', included: true },
      { label: 'PDF export reports', included: true },
      { label: 'Multi-CA support', included: false },
      { label: 'Custom filing schedules', included: false },
      { label: '10GB vault', included: false },
    ],
    razorpayAmount: 99900, // in paise
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    subtitle: 'For large businesses',
    price: '₹2,999',
    period: '/year',
    popular: false,
    color: 'border-purple-200',
    btnClass: 'bg-purple-600 text-white hover:bg-purple-700',
    features: [
      { label: 'All Pro features', included: true },
      { label: '10GB document vault', included: true },
      { label: 'Multi-CA support', included: true },
      { label: 'Custom filing schedules', included: true },
      { label: 'Priority support', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'Dedicated account manager', included: true },
    ],
    razorpayAmount: 299900, // in paise
  },
] as const;

const COMPARISON_FEATURES = [
  { label: 'Compliance calendar', free: true, pro: true, enterprise: true },
  { label: 'Document vault (basic)', free: true, pro: true, enterprise: true },
  { label: 'CA collaboration', free: true, pro: true, enterprise: true },
  { label: 'Task management', free: '3 visible', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Document uploads', free: '5/month', pro: 'Unlimited', enterprise: 'Unlimited' },
  { label: 'Storage', free: '100 MB', pro: '2 GB', enterprise: '10 GB' },
  { label: 'WhatsApp alerts', free: false, pro: true, enterprise: true },
  { label: 'PDF export', free: false, pro: true, enterprise: true },
  { label: 'Priority CA', free: false, pro: true, enterprise: true },
  { label: 'Multi-CA', free: false, pro: false, enterprise: true },
  { label: 'Custom schedules', free: false, pro: false, enterprise: true },
  { label: 'Priority support', free: false, pro: false, enterprise: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-slate-300 mx-auto" />;
  return <span className="text-xs font-medium text-slate-700">{value}</span>;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById('razorpay-script')) { resolve(true); return; }
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  useEffect(() => { document.title = 'Pricing — Complifile'; }, []);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (user) {
      supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
        .then(({ data: biz }) => {
          if (!biz) return;
          setCurrentBusinessId(biz.id);
          supabase
            .from('subscriptions')
            .select('plan_type')
            .eq('business_id', biz.id)
            .eq('status', 'active')
            .maybeSingle()
            .then(({ data: sub }) => {
              setCurrentPlan(sub?.plan_type || 'free');
            });
        });
    }
  }, [user]);

  const handleUpgrade = async (planKey: string, amount: number) => {
    if (!user) { router.push('/signup?role=business_owner'); return; }
    if (!currentBusinessId) { router.push('/onboarding'); return; }

    setPaymentError('');
    setPaymentLoading(planKey);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Razorpay failed to load. Please check your connection.');

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Create Razorpay order (server-side — never trust client-sent amount)
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planKey, businessId: currentBusinessId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create order');
      }

      const order = await res.json();

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Complifile',
        description: `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} Plan`,
        order_id: order.id,
        prefill: {
          email: user.email,
        },
        handler: async (response: any) => {
          // Verify payment server-side
          const verifyRes = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              businessId: currentBusinessId,
              plan: planKey,
            }),
          });

          if (verifyRes.ok) {
            setCurrentPlan(planKey);
            alert(`🎉 Upgraded to ${planKey.charAt(0).toUpperCase() + planKey.slice(1)}! Refreshing dashboard...`);
            router.push('/dashboard');
          } else {
            setPaymentError('Payment verification failed. Contact support if amount was deducted.');
          }
        },
        modal: {
          ondismiss: () => setPaymentLoading(null),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setPaymentError('Payment failed: ' + resp.error.description);
        setPaymentLoading(null);
      });
      rzp.open();
    } catch (err: any) {
      setPaymentError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setPaymentLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user && (
              <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-900">Complifile</span>
            </div>
          </div>
          {!user && (
            <div className="flex items-center gap-3">
              <a href="/login" className="text-sm text-slate-600 hover:text-slate-900">Log in</a>
              <a href="/signup" className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Sign Up</a>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            CAs are always free. Businesses pay only for what they need. No hidden fees, no surprises.
          </p>
          {currentPlan && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-full">
              <Star className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-700 capitalize">Current plan: {currentPlan}</span>
            </div>
          )}
        </div>

        {/* Payment error */}
        {paymentError && (
          <div className="max-w-lg mx-auto mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
            {paymentError}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {PLANS.map((plan) => {
            const isCurrent = !!user && (currentPlan === plan.key || (!currentPlan && plan.key === 'free'));
            const isLower = plan.key === 'free' && currentPlan && currentPlan !== 'free';

            return (
              <div key={plan.key} className={`relative bg-white rounded-2xl border-2 p-8 ${plan.color} ${plan.popular ? 'scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{plan.name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{plan.subtitle}</p>
                  <div className="flex items-end gap-1 mt-3">
                    <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 mb-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${f.included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                      {f.included
                        ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <X className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                      }
                      {f.label}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 bg-slate-100 text-slate-500 text-sm font-semibold rounded-xl text-center">
                    Current Plan
                  </div>
                ) : isLower ? (
                  <div className="w-full py-2.5 text-slate-400 text-sm text-center">N/A (CAs only)</div>
                ) : plan.razorpayAmount === null ? (
                  <a href="/signup?role=chartered_accountant"
                    className={`block w-full py-2.5 text-sm font-semibold rounded-xl text-center transition-colors ${plan.btnClass}`}>
                    Sign Up as CA
                  </a>
                ) : user ? (
                  <button
                    onClick={() => handleUpgrade(plan.key, plan.razorpayAmount!)}
                    disabled={paymentLoading === plan.key}
                    className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-colors ${plan.btnClass} disabled:opacity-60`}
                  >
                    {paymentLoading === plan.key ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : `Upgrade to ${plan.name}`}
                  </button>
                ) : (
                  <a href={`/signup?role=business_owner`}
                    className={`block w-full py-2.5 text-sm font-semibold rounded-xl text-center transition-colors ${plan.btnClass}`}>
                    Sign Up to Get Started
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-5xl mx-auto">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">Full Feature Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-4 text-slate-700 font-semibold w-1/2">Feature</th>
                  <th className="text-center px-4 py-4 text-slate-700 font-semibold">Free</th>
                  <th className="text-center px-4 py-4 text-indigo-700 font-bold">Pro</th>
                  <th className="text-center px-4 py-4 text-purple-700 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5 text-slate-700">{row.label}</td>
                    <td className="px-4 py-3.5 text-center"><FeatureValue value={row.free} /></td>
                    <td className="px-4 py-3.5 text-center"><FeatureValue value={row.pro} /></td>
                    <td className="px-4 py-3.5 text-center"><FeatureValue value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ / CTA */}
        <div className="text-center mt-12">
          <p className="text-slate-500 text-sm">
            Questions? Email us at{' '}
            <a href="mailto:support@complifile.in" className="text-indigo-600 hover:underline">support@complifile.in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
