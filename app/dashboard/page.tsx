// FILE: app/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FileCheck } from 'lucide-react';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!profile) {
      // Profile not loaded yet or new user without profile — go to onboarding
      router.replace('/onboarding');
      return;
    }

    switch (profile.user_type) {
      case 'chartered_accountant':
        router.replace('/dashboard-ca');
        break;
      case 'business_owner':
        router.replace('/dashboard-owner');
        break;
      case 'admin':
        router.replace('/dashboard-admin');
        break;
      default:
        router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
        <FileCheck className="w-7 h-7 text-white" />
      </div>
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">Loading your dashboard…</p>
    </div>
  );
}
