import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Thin pass-through: auth is handled client-side via AuthContext.
// Supabase localStorage auth cannot be read server-side without cookie-based auth helpers.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard-owner/:path*',
    '/dashboard-ca/:path*',
    '/dashboard-admin/:path*',
    '/vault/:path*',
    '/tasks/:path*',
    '/analytics/:path*',
    '/admin/:path*',
  ],
};
