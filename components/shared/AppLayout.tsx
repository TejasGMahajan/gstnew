"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@/store/ui.store";

export function AppLayout({ children }: { children: ReactNode }) {
  const { sidebarOpen } = useUIStore();
  
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 overflow-y-auto w-full flex flex-col relative x-hidden">
        {children}
      </div>
    </div>
  );
}
