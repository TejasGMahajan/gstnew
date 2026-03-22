// FILE: app/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar, FileCheck, Bell, Users, ShieldCheck, TrendingUp,
  AlertTriangle, FolderOpen, Clock, CheckCircle, ArrowRight,
  ChevronRight, Star, Menu, X
} from 'lucide-react';

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedCounter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current = Math.min(current + increment, target);
            setCount(Math.floor(current));
            if (current >= target) clearInterval(timer);
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* ── Navigation ── */}
      <nav className="border-b border-white/10 sticky top-0 z-50 bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">ComplianceHub</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              {loading ? (
                <div className="w-24 h-8 bg-slate-700 rounded animate-pulse" />
              ) : user ? (
                <a
                  href="/dashboard"
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Back to Dashboard
                </a>
              ) : (
                <>
                  <a href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">Log in</a>
                  <a
                    href="/signup"
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Sign Up Free
                  </a>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-slate-300">Features</a>
            <a href="#how-it-works" className="block text-sm text-slate-300">How It Works</a>
            <a href="#pricing" className="block text-sm text-slate-300">Pricing</a>
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              {user ? (
                <a href="/dashboard" className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg text-center">
                  Back to Dashboard
                </a>
              ) : (
                <>
                  <a href="/login" className="px-4 py-2 text-slate-300 text-sm text-center">Log in</a>
                  <a href="/signup" className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg text-center">
                    Sign Up Free
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Gradient background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute top-20 -left-20 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-medium mb-6">
            <Star className="w-3 h-3" />
            Built for Indian MSMEs & CAs
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight max-w-4xl mx-auto">
            Your CA's{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Compliance Operating System
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Indian MSMEs face <strong className="text-white">998 legal obligations per year</strong>. ClearTax and Zoho
            abandoned small businesses. ComplianceHub gives your CA a mission control — and you peace of mind.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/signup?role=chartered_accountant"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-base shadow-lg shadow-indigo-500/25"
            >
              Start Free as CA
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/signup?role=business_owner"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors text-base"
            >
              I'm a Business Owner
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <p className="mt-4 text-xs text-slate-500">No credit card required. Free for CAs forever.</p>
        </div>
      </section>

      {/* ── Stat Counters ── */}
      <section className="bg-white/5 border-y border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-extrabold text-white">
                <AnimatedCounter target={70} suffix="M+" />
              </div>
              <p className="text-slate-400 mt-2 text-sm">Indian MSMEs struggling with compliance</p>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-white">
                <AnimatedCounter target={998} suffix="" />
              </div>
              <p className="text-slate-400 mt-2 text-sm">Legal obligations per business per year</p>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-indigo-400">
                ₹<AnimatedCounter target={15} suffix="L+" />
              </div>
              <p className="text-slate-400 mt-2 text-sm">Average compliance cost (fines + fees)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Why compliance is broken for MSMEs</h2>
          <p className="mt-3 text-slate-400">The three problems every small business owner faces</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: AlertTriangle,
              color: 'text-rose-400',
              bg: 'bg-rose-500/10 border-rose-500/20',
              title: 'Missed Deadlines → Penalties',
              desc: 'GSTR-3B late by 1 day = ₹50/day penalty. Most MSMEs miss at least 4–6 filings per year because no one tracks them proactively.',
            },
            {
              icon: FolderOpen,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
              title: 'Lost Documents → Audit Risk',
              desc: 'Invoices in WhatsApp, returns in email, certificates on a USB drive. When GST audit comes, nobody can find anything.',
            },
            {
              icon: Clock,
              color: 'text-purple-400',
              bg: 'bg-purple-500/10 border-purple-500/20',
              title: 'CA Overload → Errors',
              desc: 'A single CA manages 50–200 clients. Without a system, critical tasks fall through the cracks — and you pay the price.',
            },
          ].map((item) => (
            <div key={item.title} className={`p-6 rounded-xl border ${item.bg}`}>
              <item.icon className={`w-8 h-8 ${item.color} mb-4`} />
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 Pillars ── */}
      <section id="features" className="py-20 bg-white/3 border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">The 4 Pillars of ComplianceHub</h2>
            <p className="mt-3 text-slate-400">Everything your CA needs. Everything you've been missing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Calendar,
                color: 'bg-indigo-500',
                title: 'Unified Compliance Calendar',
                desc: 'Auto-generated compliance schedule for your entity type — GSTR-1, GSTR-3B, TDS, PF/ESI, ROC filings — all in one place with smart deadline alerts.',
                badge: 'All Plans',
              },
              {
                icon: Bell,
                color: 'bg-emerald-500',
                title: 'WhatsApp Alerts',
                desc: 'Get reminded 7 days and 1 day before every deadline directly on WhatsApp. No app to install. Works on your CA\'s number or your business number.',
                badge: 'Pro & Enterprise',
              },
              {
                icon: ShieldCheck,
                color: 'bg-purple-500',
                title: 'Document Vault',
                desc: 'Secure, categorized cloud storage for all compliance documents — GST, PF-ESI, ROC, invoices. Full audit trail. One-click retrieval during GST audits.',
                badge: 'All Plans',
              },
              {
                icon: Users,
                color: 'bg-amber-500',
                title: 'CA Collaboration',
                desc: 'CAs manage all clients from one dashboard. Real-time status updates, document requests, penalty estimates, and compliance health scores per client.',
                badge: 'Free for CAs',
              },
            ].map((pillar) => (
              <div key={pillar.title} className="flex gap-4 p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-colors">
                <div className={`w-12 h-12 ${pillar.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <pillar.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-white">{pillar.title}</h3>
                    <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                      {pillar.badge}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{pillar.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">How It Works</h2>
          <p className="mt-3 text-slate-400">From signup to full compliance in under 5 minutes</p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: CheckCircle,
                title: 'CA Signs Up Free',
                desc: 'Create your CA account in 60 seconds. No credit card. No setup fee. Full access to the CA dashboard forever.',
              },
              {
                step: '02',
                icon: Users,
                title: 'Invite Your Clients',
                desc: 'Share a unique invite link with each client. They sign up as business owners and you\'re automatically linked.',
              },
              {
                step: '03',
                icon: TrendingUp,
                title: 'Dashboard Auto-Fills',
                desc: 'Based on entity type (Pvt Ltd, LLP, Proprietorship), the compliance calendar auto-populates with all due dates.',
              },
            ].map((step, i) => (
              <div key={step.step} className="relative text-center">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-800 border border-indigo-500/50 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-400">{i + 1}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance Calendar Preview ── */}
      <section className="py-16 bg-white/3 border-y border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Your Compliance Calendar, Pre-Built</h2>
            <p className="mt-2 text-slate-400 text-sm">Every deadline, every month — automatically tracked</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Filing</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Due Date</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Frequency</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Applicable To</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-semibold">Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { filing: 'GSTR-1', due: '11th of next month', freq: 'Monthly', applicable: 'GST registered', penalty: '₹50/day, max ₹2,000' },
                  { filing: 'GSTR-3B', due: '20th of next month', freq: 'Monthly', applicable: 'GST registered', penalty: '₹50/day, max ₹2,000' },
                  { filing: 'PF/ESI', due: '15th of next month', freq: 'Monthly', applicable: 'Employers (10+ staff)', penalty: '₹5/day per employee' },
                  { filing: 'TDS Payment', due: '7th of next month', freq: 'Monthly', applicable: 'TDS deductors', penalty: '1.5%/month interest' },
                  { filing: 'TDS Return (Q)', due: '31st after quarter', freq: 'Quarterly', applicable: 'TDS deductors', penalty: '₹200/day' },
                  { filing: 'ITR Filing', due: 'July 31', freq: 'Annual', applicable: 'All businesses', penalty: '₹5,000 late fee' },
                  { filing: 'GSTR-9 Annual', due: 'December 31', freq: 'Annual', applicable: 'GST registered', penalty: '₹200/day' },
                  { filing: 'DIR-3 KYC', due: 'September 30', freq: 'Annual', applicable: 'LLP/Pvt Ltd directors', penalty: '₹5,000 default' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{row.filing}</td>
                    <td className="px-4 py-3 text-indigo-300">{row.due}</td>
                    <td className="px-4 py-3 text-slate-400">{row.freq}</td>
                    <td className="px-4 py-3 text-slate-400">{row.applicable}</td>
                    <td className="px-4 py-3 text-rose-400 text-xs">{row.penalty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-slate-500 mt-4">
            + 20 more filings automatically tracked for LLP, Private Limited, and other entity types
          </p>
        </div>
      </section>

      {/* ── Pricing Preview ── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Simple, Transparent Pricing</h2>
          <p className="mt-3 text-slate-400">CAs are always free. Businesses pay only for what they need.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <div className="mb-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Free — CAs Only</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">₹0</span>
                <span className="text-slate-400 mb-1">/forever</span>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              {['Unlimited client dashboard', 'Compliance calendar', 'Document review', 'CA invite link', '5 doc uploads/month (client)'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="/signup?role=chartered_accountant" className="block text-center px-4 py-2.5 border border-white/20 text-white text-sm font-semibold rounded-lg hover:bg-white/10 transition-colors">
              Start Free as CA
            </a>
          </div>

          {/* Pro */}
          <div className="p-6 bg-indigo-600 border-2 border-indigo-400 rounded-xl shadow-2xl shadow-indigo-500/30 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
              Most Popular
            </div>
            <div className="mb-4">
              <p className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Pro</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">₹999</span>
                <span className="text-indigo-200 mb-1">/year</span>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              {['All Free features', 'WhatsApp/SMS alerts', '2GB document vault', '15+ tasks/year (full calendar)', 'Priority CA handling', 'PDF export reports'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-indigo-100">
                  <CheckCircle className="w-4 h-4 text-indigo-200 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="/signup?role=business_owner" className="block text-center px-4 py-2.5 bg-white text-indigo-700 text-sm font-bold rounded-lg hover:bg-indigo-50 transition-colors">
              Get Started
            </a>
          </div>

          {/* Enterprise */}
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <div className="mb-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Enterprise</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">₹2,999</span>
                <span className="text-slate-400 mb-1">/year</span>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              {['All Pro features', '10GB document vault', 'Multi-CA support', 'Custom filing schedules', 'Priority support', 'Advanced analytics'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="/signup?role=business_owner" className="block text-center px-4 py-2.5 border border-white/20 text-white text-sm font-semibold rounded-lg hover:bg-white/10 transition-colors">
              Get Started
            </a>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/pricing" className="text-indigo-400 text-sm hover:text-indigo-300 transition-colors">
            View full feature comparison →
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#080F1E] border-t border-white/10 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">ComplianceHub</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Made for Indian MSMEs. Built with ❤ for the 70 million small businesses that keep India running.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'How It Works', 'Compliance Calendar'].map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Users */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">For Users</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Sign Up as CA', href: '/signup?role=chartered_accountant' },
                  { label: 'Sign Up as Business', href: '/signup?role=business_owner' },
                  { label: 'Log In', href: '/login' },
                ].map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                {['Privacy Policy', 'Terms of Service', 'Refund Policy'].map(link => (
                  <li key={link}>
                    <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">© 2026 ComplianceHub. All rights reserved.</p>
            <p className="text-slate-500 text-sm">Made for Indian MSMEs 🇮🇳</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
