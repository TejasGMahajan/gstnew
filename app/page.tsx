'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { FileCheck, Building2, Shield, Clock } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-900 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-lg">
              <FileCheck className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            ComplianceHub
          </h1>
          <p className="text-xl md:text-2xl text-slate-700 mb-4">
            Tax & Regulatory Compliance Management
          </p>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
            Stay on top of your statutory deadlines. Manage GST, PF, ESI, and Income Tax compliance with ease.
            Built specifically for Indian MSMEs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push('/signup')}
              className="bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white h-14 px-8 text-lg font-semibold shadow-lg"
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/login')}
              className="border-blue-900 text-blue-900 hover:bg-blue-50 h-14 px-8 text-lg font-semibold"
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-blue-900" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Never Miss a Deadline
            </h3>
            <p className="text-slate-600">
              Track all your compliance deadlines in one dynamic timeline. Get reminders before it's too late.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-blue-900" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Built for MSMEs
            </h3>
            <p className="text-slate-600">
              Designed specifically for Indian small and medium businesses. Simple, powerful, and affordable.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-blue-900" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Secure Document Vault
            </h3>
            <p className="text-slate-600">
              Store all your compliance documents securely in one place. Access them anytime, anywhere.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
