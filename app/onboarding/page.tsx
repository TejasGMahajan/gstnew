'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CircleAlert as AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function buildComplianceTasks(businessId: string) {
  const today = new Date();
  const tasks: Array<{ business_id: string; task_name: string; due_date: string; status: string }> = [];

  // Monthly tasks — next 12 months starting from the current month
  const monthly = [
    { task_name: 'GSTR-1 Filing',  day: 11 },
    { task_name: 'GSTR-3B Filing', day: 20 },
    { task_name: 'PF/ESI Payment', day: 15 },
    { task_name: 'TDS Payment',    day: 7  },
  ];

  for (let i = 0; i < 12; i++) {
    const totalMonth = today.getMonth() + i;
    const year  = today.getFullYear() + Math.floor(totalMonth / 12);
    const month = totalMonth % 12;
    for (const t of monthly) {
      tasks.push({
        business_id: businessId,
        task_name:   t.task_name,
        due_date:    new Date(year, month, t.day).toISOString().split('T')[0],
        status:      'pending',
      });
    }
  }

  // Annual tasks — current Indian financial year (April–March)
  // If we are in Jan–Mar the FY started last calendar year; otherwise this year
  const fyStartYear  = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  const nextCalYear  = fyStartYear + 1; // filing deadlines fall in the next calendar year

  const annual = [
    { task_name: 'MSME Form 1 (H1)',          month: 3,  day: 30 }, // Apr 30
    { task_name: 'Income Tax Return',          month: 6,  day: 31 }, // Jul 31
    { task_name: 'DIR-3 KYC',                 month: 8,  day: 30 }, // Sep 30
    { task_name: 'MSME Form 1 (H2)',          month: 9,  day: 31 }, // Oct 31
    { task_name: 'GST Annual Return (GSTR-9)', month: 11, day: 31 }, // Dec 31
  ];

  for (const t of annual) {
    tasks.push({
      business_id: businessId,
      task_name:   t.task_name,
      due_date:    new Date(nextCalYear, t.month, t.day).toISOString().split('T')[0],
      status:      'pending',
    });
  }

  return tasks;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('businesses')
        .insert({
          owner_id: user!.id,
          business_name: businessName,
          gstin: gstin || null,
          pan: pan || null,
          business_type: businessType || null,
          address: address || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        await supabase.from('compliance_tasks').insert(buildComplianceTasks(data.id));

        // Auto-link to a CA if the user arrived via an invite link (?ca=...)
        const pendingCaId = localStorage.getItem('pending_ca_id');
        if (pendingCaId) {
          await supabase.from('client_relationships').insert({
            ca_profile_id: pendingCaId,
            business_id:   data.id,
            status:        'pending',
          });
          localStorage.removeItem('pending_ca_id');
        }

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while setting up your business');
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
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-slate-900">
            Set Up Your Business
          </CardTitle>
          <CardDescription className="text-base text-slate-600">
            Enter your business details to get started with compliance management
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-slate-900">
                  Business Name <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  placeholder="Enter your business name"
                  className="border-slate-300 focus:border-blue-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gstin" className="text-slate-900">
                    GSTIN (Optional)
                  </Label>
                  <Input
                    id="gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className="border-slate-300 focus:border-blue-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pan" className="text-slate-900">
                    PAN (Optional)
                  </Label>
                  <Input
                    id="pan"
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                    className="border-slate-300 focus:border-blue-900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType" className="text-slate-900">
                  Business Type (Optional)
                </Label>
                <Input
                  id="businessType"
                  type="text"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g., Proprietorship, Partnership, Private Limited"
                  className="border-slate-300 focus:border-blue-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-slate-900">
                  Business Address (Optional)
                </Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your business address"
                  rows={3}
                  className="border-slate-300 focus:border-blue-900"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white h-12 text-base font-semibold shadow-lg"
            >
              {loading ? 'Setting Up...' : 'Continue to Dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
