'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UpgradeLimitModalProps {
  open: boolean;
  onClose: () => void;
  limitType: 'storage' | 'whatsapp';
  currentUsage?: string;
  maxAllowed?: string;
}

export default function UpgradeLimitModal({
  open,
  onClose,
  limitType,
  currentUsage,
  maxAllowed,
}: UpgradeLimitModalProps) {
  const router = useRouter();

  if (!open) return null;

  const title = limitType === 'storage' ? 'Storage Limit Reached' : 'WhatsApp Credits Exhausted';
  const description =
    limitType === 'storage'
      ? `You've used ${currentUsage || 'all'} of your ${maxAllowed || '100MB'} storage. Upgrade to get more space.`
      : `You have no WhatsApp alert credits remaining. Upgrade to continue sending alerts.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">{description}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-slate-200 rounded-xl p-4 text-center">
              <h4 className="font-semibold text-slate-900 mb-1">Free</h4>
              <p className="text-xs text-slate-600 mb-3">Current Plan</p>
              <ul className="text-xs text-slate-600 space-y-1 text-left">
                <li>• 100MB Storage</li>
                <li>• 50 WhatsApp Credits</li>
                <li>• Basic Compliance</li>
              </ul>
            </div>

            <div className="border-2 border-blue-900 rounded-xl p-4 text-center bg-blue-50 relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-900 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                RECOMMENDED
              </div>
              <h4 className="font-semibold text-blue-900 mb-1">Pro</h4>
              <p className="text-xs text-blue-700 mb-3">₹999/mo</p>
              <ul className="text-xs text-blue-900 space-y-1 text-left">
                <li>• 2GB Storage</li>
                <li>• Unlimited Alerts</li>
                <li>• Priority Support</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                onClose();
                router.push('/pricing');
              }}
              className="flex-1 bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white font-semibold h-12"
            >
              <Zap className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
            <Button onClick={onClose} variant="outline" className="h-12">
              Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
