'use client';

import { useEffect } from 'react';
import { Logo } from '@/components/shared/Logo';

export default function TermsPage() {
  useEffect(() => { document.title = 'Terms of Service — Complifile'; }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/"><Logo size={32} /></a>
          <a href="/signup" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Sign up free →</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: March 2026 · Effective for all users registering from March 2026</p>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-700 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
              <p>By accessing or using Complifile ("the Platform", "we", "us"), whether as a Chartered Accountant (CA) or Business Owner, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.</p>
              <p className="mt-2">These terms constitute a legally binding agreement between you and Complifile. By clicking "I agree" or creating an account, you confirm that you have read, understood, and accepted these terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">2. Service Description</h2>
              <p>Complifile is a compliance tracking and document management platform designed for Indian Micro, Small and Medium Enterprises (MSMEs) and their Chartered Accountants. The Platform provides:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Automated compliance calendars for GST, TDS, PF/ESI, and ROC filings</li>
                <li>Secure cloud document storage and management</li>
                <li>CA–client collaboration tools</li>
                <li>Deadline reminders via WhatsApp and email (on paid plans)</li>
                <li>Compliance health analytics and reporting</li>
              </ul>
              <p className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-medium">
                ⚠ Important: Complifile is a compliance tracking tool only. It does <strong>not</strong> constitute chartered accountancy, legal, tax, or financial advice. All filing obligations and their accuracy remain the sole responsibility of the user and/or their appointed CA. Complifile shall not be liable for any missed filings, penalties, or non-compliance arising from use of the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">3. User Eligibility & Registration</h2>
              <p>You must be at least 18 years of age and legally capable of entering into a binding contract under applicable Indian law to use this Platform.</p>
              <p className="mt-2">When creating an account, you agree to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide accurate, current, and complete information</li>
                <li>Keep your account credentials confidential</li>
                <li>Notify us immediately of any unauthorised use of your account</li>
                <li>Not share your account with any third party</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">4. CA Account Terms</h2>
              <p>If you register as a Chartered Accountant, you additionally agree that:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>You hold a valid ICAI membership and are in good standing</li>
                <li>You will only access client data for clients who have explicitly linked you on the Platform</li>
                <li>You will comply with ICAI's Code of Ethics and professional standards at all times</li>
                <li>You will not use client data for any purpose other than providing professional services to that client</li>
                <li>You are responsible for the accuracy of compliance deadlines and tasks you create for clients</li>
              </ul>
              <p className="mt-2">CA accounts are free forever. Complifile reserves the right to verify ICAI membership and suspend accounts found to be fraudulent.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">5. User Obligations</h2>
              <p>All users agree not to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Upload false, misleading, or fraudulent documents</li>
                <li>Use the Platform for any unlawful purpose under Indian law</li>
                <li>Attempt to gain unauthorised access to any part of the Platform or other users' data</li>
                <li>Reverse-engineer, copy, or reproduce any part of the Platform</li>
                <li>Use automated scripts, bots, or scrapers against the Platform</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">6. Subscriptions & Payments</h2>
              <p>Business Owner paid plans (Pro and Enterprise) are billed annually via Razorpay, a licensed payment aggregator in India.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>All prices are in Indian Rupees (INR) and inclusive of applicable GST</li>
                <li>Subscriptions auto-renew unless cancelled at least 7 days before the renewal date</li>
                <li>No refunds are issued for partial months or unused periods after payment</li>
                <li>Complifile does not store card details — all payment data is handled by Razorpay</li>
                <li>In case of payment failure, access may be downgraded to the Free plan</li>
              </ul>
              <p className="mt-2">For billing disputes, contact <a href="mailto:support@complifile.in" className="text-indigo-600 hover:underline">support@complifile.in</a> within 7 days of the charge.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">7. Data & Privacy</h2>
              <p>Your use of the Platform is also governed by our <a href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>
              <p className="mt-2">In summary:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Your data is stored securely on servers located in India</li>
                <li>We do not sell your personal data to third parties</li>
                <li>Documents you upload are encrypted at rest and in transit</li>
                <li>CA users can only access data of clients who have explicitly granted them access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">8. Intellectual Property</h2>
              <p>All content, design, code, and trademarks on the Platform are the intellectual property of Complifile. You may not reproduce, distribute, or create derivative works without express written permission.</p>
              <p className="mt-2">You retain ownership of all documents and data you upload. By uploading, you grant Complifile a limited licence to store and display that content to you and your linked CA.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">9. Limitation of Liability</h2>
              <p>To the maximum extent permitted under applicable law:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Complifile is not liable for any missed filings, GST penalties, ROC fines, or non-compliance consequences arising from use or non-use of the Platform</li>
                <li>Complifile is not liable for any indirect, incidental, or consequential damages</li>
                <li>Our total liability to you shall not exceed the amount paid by you to Complifile in the 3 months preceding the claim</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">10. Account Termination</h2>
              <p>Complifile may suspend or terminate your account without notice if you:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Breach any of these Terms</li>
                <li>Engage in fraudulent or illegal activity</li>
                <li>Fail to pay subscription fees</li>
                <li>Are found to have provided false information during registration</li>
              </ul>
              <p className="mt-2">You may delete your account at any time by contacting support. Upon deletion, your data will be removed within 30 days except where retention is required by law.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">11. Modifications to Terms</h2>
              <p>We reserve the right to update these Terms at any time. Material changes will be notified via email or an in-app notice at least 14 days before taking effect. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">12. Governing Law & Dispute Resolution</h2>
              <p>These Terms are governed by the laws of India. Any disputes arising from these Terms or your use of the Platform shall be subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra, India.</p>
              <p className="mt-2">Before initiating legal proceedings, both parties agree to attempt resolution through good-faith negotiation for at least 30 days.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">13. Contact Us</h2>
              <p>For any questions regarding these Terms, contact us at:</p>
              <div className="mt-2 p-4 bg-slate-50 rounded-lg">
                <p className="font-semibold text-slate-900">Complifile</p>
                <p>Email: <a href="mailto:support@complifile.in" className="text-indigo-600 hover:underline">support@complifile.in</a></p>
                <p>Website: <a href="https://complifile.in" className="text-indigo-600 hover:underline">complifile.in</a></p>
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
