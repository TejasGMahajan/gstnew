'use client';

import { useState } from 'react';
import { FileCheck, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';

interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: PageHeaderAction[];
  userInfo?: {
    name: string;
    detail: string;
  };
  onSignOut?: () => void;
}

export default function PageHeader({
  title,
  subtitle,
  badge,
  actions = [],
  userInfo,
  onSignOut,
}: PageHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0 group cursor-pointer">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                  {title}
                </h1>
                {badge}
              </div>
              {subtitle && (
                <p className="text-sm font-medium text-slate-500 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <NotificationBell />
            
            <div className="w-px h-6 bg-slate-200 mx-2"></div>

            {userInfo && (
              <div className="text-right mr-2 hidden lg:block">
                <p className="text-sm font-semibold text-slate-900 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{userInfo.name}</p>
              </div>
            )}
            {actions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant || 'outline'}
                onClick={action.onClick}
                className={action.className || 'border-slate-300 hover:bg-slate-100'}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
            {onSignOut && (
              <Button variant="outline" onClick={onSignOut} className="border-slate-300 hover:bg-slate-100">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-slate-200 space-y-2">
            {userInfo && (
              <div className="pb-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900">{userInfo.name}</p>
                <p className="text-xs text-slate-600">{userInfo.detail}</p>
              </div>
            )}
            {actions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant || 'outline'}
                onClick={() => {
                  action.onClick();
                  setMobileMenuOpen(false);
                }}
                className={`w-full justify-start ${action.className || 'border-slate-300 hover:bg-slate-100'}`}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
            {onSignOut && (
              <Button
                variant="outline"
                onClick={() => {
                  onSignOut();
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start border-slate-300 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
