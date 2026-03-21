"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Activity,
  Users,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useUIStore } from "@/store/ui.store";

const routes = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vault", label: "Document Vault", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/team", label: "Team Access", icon: Users },
  { href: "/pricing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div
      className={cn(
        "relative flex flex-col h-screen bg-white border-r border-slate-200 transition-all duration-300 shadow-sm z-40",
        sidebarOpen ? "w-64" : "w-20 hidden md:flex"
      )}
    >
      <div className="flex items-center justify-between p-4 h-16 border-b border-slate-100">
        {sidebarOpen ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">Compliance</span>
          </div>
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
        {routes.map((route) => {
          const isActive = pathname.startsWith(route.href);
          return (
            <Link key={route.href} href={route.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-11 transition-all",
                  isActive ? "bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  !sidebarOpen && "justify-center px-0"
                )}
              >
                <route.icon className={cn("w-5 h-5", sidebarOpen ? "mr-3" : "mr-0")} />
                {sidebarOpen && <span className="truncate">{route.label}</span>}
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center h-10 hover:bg-slate-100 text-slate-500"
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-2 w-full justify-center">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Collapse</span>
            </div>
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
