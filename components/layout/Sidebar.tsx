'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, BarChart3, CreditCard, LogOut,
  Shield, ChevronRight, FileCheck, Settings,
  Menu, X,
} from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const ownerNav: NavItem[] = [
  { label: 'Overview',        href: '/dashboard-owner', icon: LayoutDashboard },
  { label: 'Compliance Tasks', href: '/tasks',           icon: FileCheck },
  { label: 'Document Vault',  href: '/vault',           icon: Shield },
  { label: 'Analytics',       href: '/analytics',       icon: BarChart3 },
  { label: 'Pricing & Plans', href: '/pricing',         icon: CreditCard },
  { label: 'Settings',        href: '/settings',        icon: Settings },
];

const caNav: NavItem[] = [
  { label: 'Client Dashboard', href: '/dashboard-ca',  icon: LayoutDashboard },
  { label: 'Analytics',        href: '/analytics',     icon: BarChart3 },
  { label: 'Settings',         href: '/settings',      icon: Settings },
];

const adminNav: NavItem[] = [
  { label: 'Admin Panel', href: '/dashboard-admin', icon: LayoutDashboard },
  { label: 'Analytics',   href: '/analytics',       icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav =
    profile?.user_type === 'chartered_accountant' ? caNav :
    profile?.user_type === 'admin' ? adminNav : ownerNav;

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/dashboard-owner' || href === '/dashboard-ca' || href === '/dashboard-admin'
      ? pathname === href
      : pathname.startsWith(href);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Logo size={34} dark tagline />
      </div>

      {/* User badge */}
      <div className="px-4 py-3 mx-3 mt-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-300 text-sm font-bold">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.full_name ?? 'Loading…'}</p>
            <p className="text-slate-400 text-xs capitalize">
              {profile?.user_type === 'chartered_accountant' ? 'Chartered Accountant' :
               profile?.user_type === 'admin' ? 'Administrator' : 'Business Owner'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-5 space-y-1">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'sidebar-item',
                active ? 'sidebar-item-active' : 'sidebar-item-inactive',
              )}
            >
              <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-indigo-400' : 'text-slate-500')} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 text-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 mt-4 border-t border-white/10 pt-4 space-y-1">
        <button
          onClick={handleSignOut}
          className="sidebar-item sidebar-item-inactive w-full text-left text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-slate-900 text-white p-2 rounded-lg shadow-lg"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-60 bg-[#0F172A] transition-transform duration-200',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
