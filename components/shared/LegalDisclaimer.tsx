'use client';

import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

interface LegalDisclaimerProps {
  type: 'banner' | 'inline';
  context?: 'filing' | 'data_edit' | 'general';
}

export default function LegalDisclaimer({ type, context = 'general' }: LegalDisclaimerProps) {
  const messages: Record<string, { icon: React.ReactNode; title: string; text: string }> = {
    filing: {
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />,
      title: 'Filing Disclaimer',
      text: 'This platform generates filing data for your convenience. All data must be verified by a qualified Chartered Accountant before submission to government portals. ComplianceOS does not validate the legality or accuracy of your financial data.',
    },
    data_edit: {
      icon: <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />,
      title: 'Data Responsibility',
      text: 'All changes to compliance data are logged and tracked. The editing user bears responsibility for the accuracy of modified values. CA-reviewed data carries the responsible CA\'s professional liability.',
    },
    general: {
      icon: <Shield className="h-5 w-5 text-slate-600 flex-shrink-0" />,
      title: 'Platform Disclaimer',
      text: 'ComplianceOS is a compliance management tool. It does not provide legal, financial, or tax advice. Consult a qualified professional for compliance decisions.',
    },
  };

  const msg = messages[context];

  if (type === 'banner') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
        {msg.icon}
        <div>
          <p className="text-sm font-semibold text-amber-900">{msg.title}</p>
          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{msg.text}</p>
        </div>
      </div>
    );
  }

  return (
    <p className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
      {msg.icon}
      <span>{msg.text}</span>
    </p>
  );
}
