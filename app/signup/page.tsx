'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileCheck, CircleAlert as AlertCircle } from 'lucide-react';
import { UserType } from '@/lib/supabase/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function SignUpPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { toast }    = useToast();

  // ?ca=<caProfileId>&role=business_owner  — from a CA's invite link
  const caParam   = searchParams.get('ca');
  const roleParam = searchParams.get('role') as UserType | null;

  const [userType, setUserType] = useState<UserType | null>(
    roleParam === 'business_owner' || roleParam === 'chartered_accountant' ? roleParam : null,
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userType) {
      setError('Please select your user type');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            user_type: userType,
            full_name: fullName,
            email,
            phone: phone || null,
          });

        if (profileError) throw profileError;

        // If they arrived via a CA invite link, persist the CA id so
        // onboarding can create the client_relationship after business setup.
        if (caParam) {
          localStorage.setItem('pending_ca_id', caParam);
        }

        toast({ title: 'Account Created! 🎉', description: 'Welcome to ComplianceHub!' });
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl shadow-xl border-slate-200">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
              <FileCheck className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-slate-900">
            Create Your Account
          </CardTitle>
          <CardDescription className="text-base text-slate-600">
            Join India's most trusted compliance management platform
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {!userType ? (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  I am a...
                </h3>
                <p className="text-sm text-slate-600">
                  Select your role to get started
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setUserType('business_owner')}
                  className="group relative p-6 border-2 border-slate-200 rounded-xl hover:border-blue-900 hover:shadow-lg transition-all duration-200 bg-white"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Building2 className="h-8 w-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h4 className="font-semibold text-lg text-slate-900">
                        Business Owner
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Manage compliance for your MSME
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setUserType('chartered_accountant')}
                  className="group relative p-6 border-2 border-slate-200 rounded-xl hover:border-blue-900 hover:shadow-lg transition-all duration-200 bg-white"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileCheck className="h-8 w-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h4 className="font-semibold text-lg text-slate-900">
                        Chartered Accountant
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        Help businesses stay compliant
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-2">
                  {userType === 'business_owner' ? (
                    <Building2 className="h-5 w-5 text-blue-900" />
                  ) : (
                    <FileCheck className="h-5 w-5 text-blue-900" />
                  )}
                  <span className="font-semibold text-slate-900">
                    {userType === 'business_owner' ? 'Business Owner' : 'Chartered Accountant'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUserType(null)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Change
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-900">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    className="border-slate-300 focus:border-blue-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-900">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="border-slate-300 focus:border-blue-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-900">
                    Phone Number (Optional)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="border-slate-300 focus:border-blue-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-900">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Create a strong password"
                    className="border-slate-300 focus:border-blue-900"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white h-12 text-base font-semibold shadow-lg"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <div className="text-center text-sm text-slate-600">
                Already have an account?{' '}
                <a href="/login" className="text-blue-900 hover:underline font-semibold">
                  Sign In
                </a>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
