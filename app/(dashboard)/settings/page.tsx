'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { sanitizeText } from '@/lib/sanitize';
import { User, Phone, Building2, CheckCircle, AlertCircle, Save, Mail } from 'lucide-react';

const COMPLIANCE_TYPES = [
  { key: 'GST',         label: 'GST Filing',           desc: 'GSTR-1, GSTR-3B, Annual Return' },
  { key: 'TDS',         label: 'TDS / TCS',            desc: 'Quarterly returns, payments' },
  { key: 'PF_ESI',      label: 'PF & ESI',             desc: 'Monthly contributions, returns (requires employees)' },
  { key: 'ROC',         label: 'ROC / MCA',            desc: 'Annual filings (companies & LLPs only)' },
  { key: 'Income_Tax',  label: 'Income Tax',           desc: 'Advance tax, ITR filing' },
];

export default function SettingsPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Business owner extras
  const [business, setBusiness] = useState<any>(null);
  const [gstin, setGstin] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [applicableTypes, setApplicableTypes] = useState<string[]>([]);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSuccess, setBizSuccess] = useState(false);
  const [bizError, setBizError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const loadBusiness = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('businesses')
      .select('id, business_name, gstin, entity_type, applicable_compliance_types')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) {
      setBusiness(data);
      setBusinessName(data.business_name || '');
      setGstin(data.gstin || '');
      setEntityType(data.entity_type || '');
      setApplicableTypes(data.applicable_compliance_types || COMPLIANCE_TYPES.map(c => c.key));
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user && profile?.user_type === 'business_owner') {
      loadBusiness();
    }
  }, [authLoading, user, profile, loadBusiness]);

  useEffect(() => {
    document.title = 'Settings — Complifile';
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: sanitizeText(fullName), phone: sanitizeText(phone) })
        .eq('id', user!.id);
      if (error) { setSaveError(error.message); return; }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setBizSaving(true);
    setBizError('');
    setBizSuccess(false);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          business_name: sanitizeText(businessName),
          gstin: sanitizeText(gstin).toUpperCase(),
          entity_type: entityType,
          applicable_compliance_types: applicableTypes,
        })
        .eq('id', business.id);
      if (error) { setBizError(error.message); return; }
      setBizSuccess(true);
      setTimeout(() => setBizSuccess(false), 3000);
    } finally {
      setBizSaving(false);
    }
  };

  const toggleComplianceType = (key: string) => {
    setApplicableTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  if (authLoading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const isCA = profile?.user_type === 'chartered_accountant';
  const isOwner = profile?.user_type === 'business_owner';

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-6">
        <h1 className="section-title">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile and preferences</p>
      </div>

      {/* ── Profile Section ── */}
      <div className="card-base p-6 mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Profile Information
        </h2>

        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700">Profile saved successfully.</p>
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p className="text-sm text-rose-700">{saveError}</p>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed. Contact support if needed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Phone Number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 font-medium capitalize">
              {isCA ? 'Chartered Accountant' : isOwner ? 'Business Owner' : profile?.user_type}
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* ── Business Section (owners only) ── */}
      {isOwner && (
        <div className="card-base p-6 mb-6">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Business Details
          </h2>

          {bizSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700">Business details saved successfully.</p>
            </div>
          )}
          {bizError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <p className="text-sm text-rose-700">{bizError}</p>
            </div>
          )}

          {business ? (
            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">Required to generate your full compliance calendar.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Entity Type</label>
                <select
                  value={entityType}
                  onChange={e => setEntityType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select entity type…</option>
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="pvt_ltd">Private Limited</option>
                  <option value="public_ltd">Public Limited</option>
                  <option value="opc">One Person Company (OPC)</option>
                  <option value="trust">Trust / NGO</option>
                </select>
              </div>

              {/* Applicable Compliance Types */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Applicable Compliances
                </label>
                <p className="text-xs text-slate-400 mb-3">Uncheck compliances that don't apply to your business. Tasks for unchecked types will be hidden.</p>
                <div className="space-y-2">
                  {COMPLIANCE_TYPES.map(ct => (
                    <label
                      key={ct.key}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        applicableTypes.includes(ct.key)
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-white border-slate-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={applicableTypes.includes(ct.key)}
                        onChange={() => toggleComplianceType(ct.key)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{ct.label}</p>
                        <p className="text-xs text-slate-500">{ct.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={bizSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 text-sm"
              >
                <Save className="w-4 h-4" />
                {bizSaving ? 'Saving…' : 'Save Business Details'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">No business found. Please complete onboarding first.</p>
          )}
        </div>
      )}

      {/* ── CA specialisations (CA only) ── */}
      {isCA && (
        <div className="card-base p-6">
          <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Your Practice
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Your CA account is <span className="font-semibold text-emerald-600">free forever</span>. Manage clients from the CA Command Centre.
          </p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p>• To add a client, use the <strong>Invite Client</strong> tab in CA Command Centre</p>
            <p>• Share your referral link to onboard new business owners directly under your account</p>
            <p>• Client data is only accessible after the client accepts your invite</p>
          </div>
        </div>
      )}
    </div>
  );
}
