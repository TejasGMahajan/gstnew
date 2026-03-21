'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

// Mock data for notifications until we have a real backend implementation
const mockNotifications = [
  { id: 1, title: 'GST Registration Approved', time: '10 min ago', read: false },
  { id: 2, title: 'PF Return Due Next Week', time: '2 hours ago', read: false },
  { id: 3, title: 'Document uploaded successfully', time: '1 day ago', read: true },
];

export function NotificationBell() {
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group hover:bg-slate-100 rounded-full w-10 h-10 outline-none">
          <Bell className="h-5 w-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full bg-red-500 hover:bg-red-600 border-2 border-white shadow-sm text-[10px] font-bold text-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 rounded-xl shadow-xl border-slate-200 overflow-hidden mt-2 z-50 bg-white">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <DropdownMenuLabel className="font-semibold text-slate-900 text-base">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto p-0 text-blue-600 hover:text-blue-800 hover:bg-transparent font-medium text-xs">
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto w-full flex flex-col">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
          ) : (
            notifications.map(notification => (
              <DropdownMenuItem 
                key={notification.id} 
                className={`flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-slate-50 rounded-none border-b border-slate-50 last:border-0 outline-none ${notification.read ? 'opacity-70' : 'bg-blue-50/10'}`}
                onClick={(e) => {
                  e.preventDefault();
                  markRead(notification.id);
                }}
              >
                <div className="flex items-start justify-between w-full">
                  <span className={`text-sm font-medium ${notification.read ? 'text-slate-700' : 'text-slate-900'}`}>
                    {notification.title}
                  </span>
                  {!notification.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />}
                </div>
                <span className="text-xs text-slate-500">{notification.time}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <div className="p-2 border-t border-slate-100 bg-slate-50">
           <Button variant="ghost" className="w-full text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-200/50">View all notifications</Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
