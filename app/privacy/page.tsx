'use client';

import { useEffect } from 'react';
import { Logo } from '@/components/shared/Logo';

export default function PrivacyPage() {
  useEffect(() => { document.title = 'Privacy Policy — Complifile'; }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/"><Logo size={32} /></a>
          <a href="/signup" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Sign up free →</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: March 2026 · Applies to all Complifile users</p>

          <div className="space-y-8 text-slate-700 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">1. What We Collect</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Data</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 border-b border-slate-200">Why We Collect It</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-4 py-3">Name, email, phone</td><td className="px-4 py-3">Account creation & communication</td></tr>
                    <tr><td className="px-4 py-3">GSTIN, entity type, company name</td><td className="px-4 py-3">Auto-generate compliance calendar</td></tr>
                    <tr><td className="px-4 py-3">Documents you upload</td><td className="px-4 py-3">Secure vault storage & CA review</td></tr>
                    <tr><td className="px-4 py-3">Payment info (via Razorpay)</td><td className="px-4 py-3">Subscription billing — we never store card details</td></tr>
                    <tr><td className="px-4 py-3">Usage data & logs</td><td className="px-4 py-3">Platform improvement & security</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">2. How We Use Your Data</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>To provide and improve the Complifile service</li>
                <li>To send compliance deadline reminders (email and WhatsApp, if enabled)</li>
                <li>To allow your linked CA to access your compliance data</li>
                <li>To process payments for paid subscriptions</li>
                <li>To respond to support queries</li>
                <li>To comply with legal obligations under Indian law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">3. Who We Share Data With</h2>
              <p>We do <strong>not</strong> sell your data. We share it only with:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Your CA</strong> — only if you have explicitly linked them on the Platform</li>
                <li><strong>Razorpay</strong> — for payment processing (governed by Razorpay's Privacy Policy)</li>
                <li><strong>WhatsApp Business API</strong> — to send reminders, only if you opt in</li>
                <li><strong>Supabase</strong> — our database and storage provider (data stored in India)</li>
                <li><strong>Law enforcement</strong> — only if required by a valid legal order</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">4. Data Storage & Security</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>All data is stored on servers located in India</li>
                <li>Documents are encrypted at rest using AES-256 and in transit using TLS 1.3</li>
                <li>Access to your data within our team is restricted on a need-to-know basis</li>
                <li>We perform regular security reviews and vulnerability assessments</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">5. Your Rights</h2>
              <p>Under applicable Indian law, you have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Access</strong> — request a copy of all data we hold about you</li>
                <li><strong>Correction</strong> — ask us to correct inaccurate data</li>
                <li><strong>Deletion</strong> — request deletion of your account and data (within 30 days)</li>
                <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
                <li><strong>Opt-out</strong> — unsubscribe from marketing emails at any time</li>
              </ul>
              <p className="mt-2">To exercise any of these rights, email <a href="mailto:support@complifile.in" className="text-indigo-600 hover:underline">support@complifile.in</a>.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">6. Cookies</h2>
              <p>Complifile uses only essential cookies necessary for authentication and session management. We do not use advertising or tracking cookies.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">7. Data Retention</h2>
              <p>We retain your data for as long as your account is active. If you delete your account, all personal data will be removed within 30 days, except where retention is required by law (e.g., financial records under the Companies Act or GST rules).</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">8. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notice at least 14 days before they take effect.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">9. Contact</h2>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-semibold text-slate-900">Complifile — Privacy Team</p>
                <p>Email: <a href="mailto:support@complifile.in" className="text-indigo-600 hover:underline">support@complifile.in</a></p>
              </div>
            </section>

          </div>
        </div>
      </main>

      <footer className="text-center py-8 text-xs text-slate-400">
        © 2026 Complifile. All rights reserved. ·{' '}
        <a href="/privacy" className="hover:text-slate-600">Privacy Policy</a> ·{' '}
        <a href="/terms" className="hover:text-slate-600">Terms of Service</a>
      </footer>
    </div>
  );
}
