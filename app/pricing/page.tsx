'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Check, Zap, Users, Shield, Bell, HardDrive, TrendingUp, LogOut } from 'lucide-react';
import Script from 'next/script';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Plan {
  id: string;
  name: string;
  price_annual: number;
  price_quarterly: number;
  features: string[];
  popular?: boolean;
  suitable_for: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Forever',
    price_annual: 0,
    price_quarterly: 0,
    suitable_for: 'Single Proprietorships',
    features: [
      'Basic compliance dashboard',
      'Email alerts for deadlines',
      '100MB document storage',
      'Up to 3 compliance tasks',
      'Community support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price_annual: 999,
    price_quarterly: 299,
    suitable_for: 'LLPs & Small Businesses',
    popular: true,
    features: [
      'Everything in Free',
      'WhatsApp & SMS alerts',
      '2GB document vault',
      'Unlimited compliance tasks',
      'Smart calendar widget',
      'Audit trail & legal protection',
      'Priority email support',
      '500 WhatsApp credits/month'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_annual: 2999,
    price_quarterly: 899,
    suitable_for: 'Private Limited Companies',
    features: [
      'Everything in Pro',
      'Multi-user access (up to 5 users)',
      '10GB document vault',
      'Priority CA tools & workflows',
      'Advanced analytics dashboard',
      'Dedicated account manager',
      'Phone & WhatsApp support',
      'Unlimited WhatsApp credits',
      'Custom compliance templates'
    ]
  }
];

const TOPUPS = [
  {
    id: 'credits_500',
    name: '500 WhatsApp Alert Credits',
    price: 200,
    description: 'Extra WhatsApp notification credits'
  },
  {
    id: 'storage_10gb',
    name: '10GB Storage Expansion',
    price: 300,
    description: 'Additional vault storage space'
  }
];

export default function PricingPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'quarterly'>('annual');
  const [loading, setLoading] = useState(true);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && profile) {
      loadBusinessData();
    }
  }, [user, profile]);

  const loadBusinessData = async () => {
    try {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();

      if (!businessData) {
        router.push('/onboarding');
        return;
      }

      setBusiness(businessData);

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', businessData.id)
        .maybeSingle();

      setSubscription(subData);
    } catch (error) {
      console.error('Error loading business:', error);
      toast({ title: 'Error', description: 'Failed to load business data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleUpgrade = async (plan: Plan, cycle: 'annual' | 'quarterly') => {
    if (!business || !razorpayLoaded) {
      toast({ title: 'Please Wait', description: 'Payment system is loading...' });
      return;
    }

    if (plan.id === 'free') {
      toast({ title: 'Info', description: 'You are already on the free plan!' });
      return;
    }

    const amount = cycle === 'annual' ? plan.price_annual : plan.price_quarterly;

    try {
      const { data: order, error } = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount * 100,
          business_id: business.id,
          plan_type: plan.id,
          billing_cycle: cycle
        })
      }).then(res => res.json());

      if (error) {
        throw new Error(error);
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'ComplianceHub',
        description: `${plan.name} - ${cycle === 'annual' ? 'Annual' : 'Quarterly'} Subscription`,
        order_id: order.id,
        prefill: {
          name: profile?.full_name,
          email: profile?.email,
          contact: profile?.phone
        },
        notes: {
          business_id: business.id,
          plan_type: plan.id,
          billing_cycle: cycle
        },
        theme: {
          color: '#1e3a8a'
        },
        handler: function (response: any) {
          verifyPayment(response, order.id);
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast({ title: 'Payment Failed', description: error.message || 'Could not initiate payment.', variant: 'destructive' });
    }
  };

  const verifyPayment = async (response: any, orderId: string) => {
    try {
      const result = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          business_id: business.id
        })
      }).then(res => res.json());

      if (result.success) {
        toast({ title: 'Payment Successful! 🎉', description: 'Your subscription has been upgraded.' });
        loadBusinessData();
        router.push('/dashboard-owner');
      } else {
        toast({ title: 'Verification Failed', description: 'Payment verification failed. Please contact support.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Error verifying payment. Please contact support.', variant: 'destructive' });
    }
  };

  const handleTopup = async (topup: typeof TOPUPS[0]) => {
    if (!business || !razorpayLoaded) {
      toast({ title: 'Please Wait', description: 'Payment system is loading...' });
      return;
    }

    try {
      const { data: order, error } = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: topup.price * 100,
          business_id: business.id,
          plan_type: 'topup',
          billing_cycle: 'one_time'
        })
      }).then(res => res.json());

      if (error) {
        throw new Error(error);
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'ComplianceHub',
        description: topup.name,
        order_id: order.id,
        prefill: {
          name: profile?.full_name,
          email: profile?.email,
          contact: profile?.phone
        },
        notes: {
          business_id: business.id,
          topup_type: topup.id
        },
        theme: {
          color: '#1e3a8a'
        },
        handler: function (response: any) {
          toast({ title: 'Top-up Successful! 🎉', description: 'Your credits have been added.' });
          loadBusinessData();
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast({ title: 'Payment Failed', description: error.message || 'Could not initiate payment.', variant: 'destructive' });
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading pricing..." />;
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
                  <FileCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Pricing & Plans</h1>
                  <p className="text-sm text-slate-600">Choose the perfect plan for your business</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => router.push('/dashboard-owner')} variant="outline" className="border-slate-300 hover:bg-slate-100">
                  Back to Dashboard
                </Button>
                <Button variant="outline" onClick={handleSignOut} className="border-slate-300 hover:bg-slate-100">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {subscription && (
            <div className="mb-8 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Current Plan: {subscription.plan_type.toUpperCase()}</h3>
                  <p className="text-blue-100">
                    {subscription.plan_type === 'free'
                      ? 'Upgrade to unlock premium features'
                      : `Active until ${subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}`}
                  </p>
                </div>
                <Badge className="bg-white text-blue-900 text-lg px-4 py-2">
                  {subscription.status}
                </Badge>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white rounded-full p-1 shadow-md">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annual (Save 17%)
              </button>
              <button
                onClick={() => setBillingCycle('quarterly')}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  billingCycle === 'quarterly'
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quarterly
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {PLANS.map((plan) => {
              const price = billingCycle === 'annual' ? plan.price_annual : plan.price_quarterly;
              const isCurrentPlan = subscription?.plan_type === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`relative shadow-xl border-2 ${
                    plan.popular
                      ? 'border-blue-900 shadow-2xl scale-105'
                      : 'border-slate-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-4 py-1 text-sm shadow-lg">
                        MOST POPULAR
                      </Badge>
                    </div>
                  )}

                  <CardHeader className={`text-center pb-8 ${plan.popular ? 'bg-gradient-to-br from-blue-50 to-white' : ''}`}>
                    <CardTitle className="text-2xl font-bold text-slate-900">
                      {plan.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 mt-2">
                      {plan.suitable_for}
                    </CardDescription>
                    <div className="mt-6">
                      <span className="text-5xl font-bold text-blue-900">
                        ₹{price.toLocaleString()}
                      </span>
                      {price > 0 && (
                        <span className="text-slate-600">
                          /{billingCycle === 'annual' ? 'year' : 'quarter'}
                        </span>
                      )}
                    </div>
                    {price > 0 && (
                      <p className="text-sm text-slate-500 mt-2">
                        ₹{Math.round(price / (billingCycle === 'annual' ? 12 : 3))}/month
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrentPlan ? (
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan, billingCycle)}
                        className={`w-full font-semibold ${
                          plan.popular
                            ? 'bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600'
                            : 'bg-blue-900 hover:bg-blue-800'
                        }`}
                        disabled={!razorpayLoaded}
                      >
                        {plan.id === 'free' ? 'Current Plan' : 'Upgrade via UPI'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
              <CardTitle className="text-xl">Micro-Transactions & Top-Ups</CardTitle>
              <CardDescription className="text-slate-300">
                Need extra credits or storage? Purchase on-demand
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {TOPUPS.map((topup) => (
                  <Card key={topup.id} className="border-2 border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-lg text-slate-900">{topup.name}</h4>
                          <p className="text-sm text-slate-600 mt-1">{topup.description}</p>
                        </div>
                        {topup.id.includes('credits') ? (
                          <Bell className="h-6 w-6 text-blue-900" />
                        ) : (
                          <HardDrive className="h-6 w-6 text-blue-900" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-blue-900">₹{topup.price}</span>
                        <Button
                          onClick={() => handleTopup(topup)}
                          className="bg-blue-900 hover:bg-blue-800"
                          disabled={!razorpayLoaded}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Buy Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold text-slate-900 text-center mb-8">
              Why Choose ComplianceHub?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-blue-900" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">Secure & Compliant</h4>
                <p className="text-sm text-slate-600">
                  Bank-grade security with complete audit trails for legal protection
                </p>
              </div>
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">Increase Compliance</h4>
                <p className="text-sm text-slate-600">
                  Never miss a deadline with smart reminders and automated tracking
                </p>
              </div>
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">CA Collaboration</h4>
                <p className="text-sm text-slate-600">
                  Seamless workflows between businesses and their chartered accountants
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
