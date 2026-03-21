'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileCheck,
  Shield,
  Bell,
  FolderOpen,
  Users,
  CalendarClock,
  CreditCard,
  Star,
  MessageSquare,
  Clock,
  CheckCircle2,
  ChevronRight,
  Smartphone,
  Lock,
  Zap,
  ArrowRight,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    icon: Clock,
    title: 'Documents at 11 PM on the due date',
    description:
      'Your clients wait until the last moment — then flood you with photos from WhatsApp when the portal is about to close.',
  },
  {
    icon: MessageSquare,
    title: '40+ clients across WhatsApp groups',
    description:
      'You\'re chasing follow-ups in a dozen groups, manually tracking who has sent what, with zero audit trail.',
  },
  {
    icon: CalendarClock,
    title: 'One missed deadline every quarter',
    description:
      'With so many filings across so many clients, something slips. A penalty. An angry call. A lost client.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Add your clients',
    description: 'Invite clients by email or GSTIN. They join in one click — no setup required on their end.',
  },
  {
    step: '02',
    title: 'Clients get reminders & upload documents',
    description: 'Automated WhatsApp reminders go out. Clients upload directly to their secure vault — no WhatsApp forwarding.',
  },
  {
    step: '03',
    title: 'Everything organised, on time',
    description: 'Track every filing across all clients on one dashboard. Deadlines met. No chasing. More clients served.',
  },
];

const FEATURES = [
  {
    icon: Bell,
    color: 'bg-indigo-100 text-indigo-700',
    title: 'Automated WhatsApp Reminders',
    description: 'Clients get timely nudges before every deadline — GSTR-1, GSTR-3B, TDS, PF/ESI — so you never have to chase.',
  },
  {
    icon: CalendarClock,
    color: 'bg-blue-100 text-blue-700',
    title: 'Compliance Deadline Calendar',
    description: 'A full Indian compliance calendar auto-generated for each client. Monthly + annual filings, all tracked.',
  },
  {
    icon: FolderOpen,
    color: 'bg-emerald-100 text-emerald-700',
    title: 'Secure Document Vault',
    description: 'Clients upload invoices, GST returns, and acknowledgements to a structured, encrypted vault — not a WhatsApp chat.',
  },
  {
    icon: Users,
    color: 'bg-violet-100 text-violet-700',
    title: 'CA–Business Collaboration',
    description: 'Review documents, mark tasks complete, and communicate with clients — all inside one workflow.',
  },
  {
    icon: Star,
    color: 'bg-amber-100 text-amber-700',
    title: 'Priority Client Management',
    description: 'Pro and enterprise clients are surfaced first. Assign priority flags so high-value work never gets buried.',
  },
  {
    icon: CreditCard,
    color: 'bg-rose-100 text-rose-700',
    title: 'Built-in Razorpay Billing',
    description: 'Collect annual retainer fees from clients directly through the platform. Invoices and payment history included.',
  },
];

const CA_FEATURES = [
  'Unlimited client dashboard',
  'Automated WhatsApp alerts',
  'Compliance deadline calendar',
  'Document review workflow',
  'Client invite via email / GSTIN',
  'PDF compliance reports',
];

const BUSINESS_FEATURES = [
  'Secure document vault',
  'GSTR filing reminders',
  'Direct CA collaboration',
  'Payment via Razorpay',
  'Acknowledgement storage',
  'Priority support',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center shadow-sm">
        <FileCheck className="h-5 w-5 text-white" />
      </div>
      <span className="text-lg font-bold text-slate-900 tracking-tight">ComplianceHub</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-10 w-10 border-4 border-blue-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${
          scrolled ? 'shadow-md' : 'border-b border-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#how-it-works" className="hover:text-blue-900 transition-colors">How it works</a>
            <a href="#features" className="hover:text-blue-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/login')}
              className="text-slate-700 hover:text-blue-900"
            >
              Login
            </Button>
            <Button
              size="sm"
              onClick={() => router.push('/signup')}
              className="bg-blue-900 hover:bg-blue-800 text-white"
            >
              Get Started Free
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        {/* decorative CSS shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-700/20 blur-3xl" />
          <div className="absolute top-1/2 -left-24 w-72 h-72 rounded-full bg-indigo-600/15 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-blue-500/10 blur-2xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28 text-center">
          <Badge className="mb-5 bg-blue-800/60 text-blue-200 border-blue-700 hover:bg-blue-800/60 text-sm px-3 py-1">
            Built for Chartered Accountants in India
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Manage All Your GST Clients{' '}
            <span className="text-blue-400">in One Place</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop chasing documents on WhatsApp. Automate reminders, track deadlines,
            and serve more clients — without extra staff.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push('/signup?role=chartered_accountant')}
              className="bg-blue-500 hover:bg-blue-400 text-white h-13 px-8 text-base font-semibold shadow-lg shadow-blue-900/40"
            >
              Start Free as CA
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/signup')}
              className="border-slate-500 text-white hover:bg-slate-800 h-13 px-8 text-base font-semibold"
            >
              I&apos;m a Business
            </Button>
          </div>

          <p className="mt-5 text-sm text-slate-400">Free forever for CAs · No credit card required</p>
        </div>
      </section>

      {/* ── Trust Bar ──────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-b border-slate-200 py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-sm text-slate-600 text-center">
          <span className="font-semibold text-slate-700">Trusted by 50+ CAs in Maharashtra</span>
          <span className="hidden sm:block text-slate-300">|</span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-blue-700" />
            Bank-grade security
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            GSTIN verified
          </span>
          <span className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
            WhatsApp reminders
          </span>
        </div>
      </section>

      {/* ── Problem Section ────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Sound familiar?</h2>
            <p className="text-slate-500 text-lg">These are the real pains of running a CA practice today.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-red-200 hover:bg-red-50/30 transition-colors group"
              >
                <div className="h-11 w-11 rounded-xl bg-red-100 flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
                  <Icon className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2 text-base">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">How it works</h2>
            <p className="text-slate-500 text-lg">Up and running in under 10 minutes.</p>
          </div>

          <div className="flex flex-col gap-0">
            {HOW_IT_WORKS.map(({ step, title, description }, i) => (
              <div key={step} className="flex gap-6 items-start">
                {/* Connector line */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="h-12 w-12 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-md">
                    {step}
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="w-0.5 flex-1 bg-slate-200 my-2 min-h-[48px]" />
                  )}
                </div>
                <div className="pb-10 pt-2">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-500 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-4">
            <Button
              onClick={() => router.push('/signup?role=chartered_accountant')}
              className="bg-blue-900 hover:bg-blue-800 text-white px-8"
              size="lg"
            >
              Get started — it&apos;s free
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Everything your CA practice needs
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Purpose-built for Indian chartered accountants managing multiple business clients.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, color, title, description }) => (
              <div
                key={title}
                className="p-6 rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all bg-white group"
              >
                <div className={`h-11 w-11 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-slate-500 text-lg">
              CA access is <span className="font-semibold text-blue-900">always free</span>. Business clients pay.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CA Plan */}
            <div className="bg-white rounded-2xl border-2 border-blue-900 shadow-lg p-8 relative">
              <div className="absolute -top-3 left-6">
                <Badge className="bg-blue-900 text-white text-xs px-3 py-0.5">For CAs</Badge>
              </div>
              <div className="flex items-end gap-2 mb-1 mt-2">
                <span className="text-4xl font-extrabold text-slate-900">Free</span>
                <span className="text-slate-500 mb-1">forever</span>
              </div>
              <p className="text-slate-500 text-sm mb-6">Everything you need to manage your full client portfolio.</p>
              <ul className="space-y-3 mb-8">
                {CA_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-blue-900 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-blue-900 hover:bg-blue-800 text-white"
                onClick={() => router.push('/signup?role=chartered_accountant')}
              >
                Start Free as CA
              </Button>
            </div>

            {/* Business Plan */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 relative">
              <div className="absolute -top-3 left-6">
                <Badge className="bg-slate-700 text-white text-xs px-3 py-0.5">For Businesses</Badge>
              </div>
              <div className="flex items-end gap-2 mb-1 mt-2">
                <span className="text-4xl font-extrabold text-slate-900">₹999</span>
                <span className="text-slate-500 mb-1">/ year</span>
              </div>
              <p className="text-slate-500 text-sm mb-6">Your CA invites you. Pay once, stay compliant all year.</p>
              <ul className="space-y-3 mb-8">
                {BUSINESS_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => router.push('/signup')}
              >
                Sign Up as Business
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-slate-400 mt-6">
            Your CA invites you — ask them about ComplianceHub today.
          </p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-800 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <div className="h-14 w-14 rounded-2xl bg-blue-700/60 flex items-center justify-center">
              <Zap className="h-7 w-7 text-white" />
            </div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to stop chasing clients?</h2>
          <p className="text-blue-200 text-lg mb-8 max-w-xl mx-auto">
            Join CAs across Maharashtra who use ComplianceHub to run a tighter, more organised practice.
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/signup?role=chartered_accountant')}
            className="bg-white text-blue-900 hover:bg-blue-50 font-semibold px-10 h-12 shadow-lg"
          >
            Create your free CA account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center">
                  <FileCheck className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-semibold">ComplianceHub</span>
              </div>
              <p className="text-sm max-w-xs leading-relaxed">
                GST compliance management for chartered accountants and Indian businesses.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a
                href="#features"
                className="hover:text-white transition-colors"
              >
                Features
              </a>
              <button
                onClick={() => router.push('/login')}
                className="hover:text-white transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => router.push('/signup')}
                className="hover:text-white transition-colors"
              >
                Sign Up
              </button>
              <a href="mailto:support@compliancehub.in" className="hover:text-white transition-colors">
                Contact
              </a>
            </nav>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p>© {new Date().getFullYear()} ComplianceHub. All rights reserved.</p>
            <p>Made for Indian CAs · Powered by Supabase &amp; Razorpay</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
