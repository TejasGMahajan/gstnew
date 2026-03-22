// FILE: app/signup/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { sanitizeText } from '@/lib/sanitize';
import {
  Building2, UserCheck, ArrowLeft, Eye, EyeOff,
  CheckCircle, AlertCircle, Mail, User, Phone, Lock
} from 'lucide-react';
import { Logo } from '@/components/shared/Logo';

type Role = 'business_owner' | 'chartered_accountant' | null;

type Step = 'role' | 'form' | 'success';

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const roleParam = searchParams.get('role') as Role;
  const caParam = searchParams.get('ca');

  const [step, setStep] = useState<Step>(roleParam ? 'form' : 'role');
  const [selectedRole, setSelectedRole] = useState<Role>(roleParam || null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signedUpEmail, setSignedUpEmail] = useState('');

  useEffect(() => { document.title = 'Sign Up — Complifile'; }, []);

  useEffect(() => {
    document.title = 'Sign Up — Complifile';
  }, []);

  useEffect(() => {
    if (caParam) {
      localStorage.setItem('pending_ca_id', caParam);
    }
  }, [caParam]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('form');
  };

  const validatePassword = (pw: string) => {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (!selectedRole) { setError('Please select a role.'); return; }

    setLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: sanitizeText(fullName),
            user_type: selectedRole,
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Try logging in.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setError('Signup failed. Please try again.');
        return;
      }

      // 2. Profile is created automatically by the handle_new_user trigger (SECURITY DEFINER).
      //    No client-side insert needed — email confirmation sessions are unconfirmed
      //    and would fail RLS anyway.

      // 3. Save pending_ca_id if ca param was present
      if (caParam) {
        localStorage.setItem('pending_ca_id', caParam);
      }

      setSignedUpEmail(email);
      setStep('success');
    } finally {
      setLoading(false);
    }
  };

  // ── Role Selection Screen ────────────────────────────────────────────────

  if (step === 'role') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <Logo size={44} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Join Complifile</h1>
            <p className="text-slate-500 text-sm mt-1">How will you be using Complifile?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleRoleSelect('business_owner')}
              className="group p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all text-left"
            >
              <Building2 className="w-10 h-10 text-indigo-600 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">I'm a Business Owner</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Track compliance deadlines, manage documents, and collaborate with your CA.
              </p>
              <div className="mt-4 text-xs font-semibold text-indigo-600">
                Free for 5 uploads/month →
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect('chartered_accountant')}
              className="group p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all text-left"
            >
              <UserCheck className="w-10 h-10 text-emerald-600 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">I'm a Chartered Accountant</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Manage all your clients' compliance from one dashboard, send reminders, and export reports.
              </p>
              <div className="mt-4 text-xs font-semibold text-emerald-600">
                Free forever for CAs →
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Success Screen ───────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Check your inbox!</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-1">
              We sent a confirmation link to
            </p>
            <p className="text-indigo-600 font-semibold text-sm mb-4">{signedUpEmail}</p>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
              <p className="text-xs text-amber-800">
                <strong>Check your spam folder</strong> if you don't see it within a minute. The link expires in 24 hours.
              </p>
            </div>
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Signup Form ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Logo size={44} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {selectedRole === 'chartered_accountant' ? 'Create CA Account' : 'Create Business Account'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {selectedRole === 'chartered_accountant' ? 'Free forever for CAs' : 'Start free, upgrade anytime'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {/* Role indicator */}
          <div className="flex items-center justify-between mb-6 p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              {selectedRole === 'chartered_accountant'
                ? <UserCheck className="w-4 h-4 text-emerald-600" />
                : <Building2 className="w-4 h-4 text-indigo-600" />
              }
              <span className="text-sm font-medium text-slate-700">
                {selectedRole === 'chartered_accountant' ? 'Chartered Accountant' : 'Business Owner'}
              </span>
            </div>
            <button
              onClick={() => { setStep('role'); setSelectedRole(null); }}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Change role
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder={selectedRole === 'chartered_accountant' ? 'CA Ramesh Kumar' : 'Ramesh Kumar'}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Phone (optional) */}
            <div>
              <label htmlFor="signup-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="signup-phone"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Must be at least 8 characters</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <a href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">Sign in</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
