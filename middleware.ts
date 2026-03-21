import { NextRequest, NextResponse } from 'next/server';

// Auth is handled client-side via useAuth / authGuard hooks.
// This middleware is a thin pass-through; it exists only so Next.js
// does not serve the matcher routes as static files.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard-owner/:path*',
    '/dashboard-ca/:path*',
    '/dashboard-admin/:path*',
    '/vault/:path*',
    '/admin/:path*',
    '/analytics/:path*',
  ],
};
