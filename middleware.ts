import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';

// ─── Role → home dashboard ────────────────────────────────────────────────────
const ROLE_DASHBOARD: Record<string, string> = {
  business_owner:       '/dashboard-owner',
  chartered_accountant: '/dashboard-ca',
};

// ─── Route → required role ────────────────────────────────────────────────────
// Each entry matches a route prefix and the role that must own it.
const ROLE_PROTECTED: Array<{ prefix: string; role: string }> = [
  { prefix: '/dashboard-owner', role: 'business_owner' },
  { prefix: '/dashboard-ca',    role: 'chartered_accountant' },
  { prefix: '/vault',           role: 'business_owner' },
];

// ─── Middleware ───────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  // createMiddlewareClient reads + refreshes the Supabase session from cookies
  // and writes updated tokens back into the response via Set-Cookie.
  // The `res` object MUST be passed to createMiddlewareClient — do not replace it.
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh the session (re-sets the cookie if the access token was rotated).
  // getSession() reads from the cookie; it does NOT hit the Supabase DB.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // ── /admin: email-based guard ─────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || session.user.email !== adminEmail) {
      // Wrong user — send back to login, not their dashboard (admin is sensitive)
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Email matches → allow through (cookie already refreshed in `res`)
    return res;
  }

  // ── Role-protected routes ──────────────────────────────────────────────────
  const matched = ROLE_PROTECTED.find(({ prefix }) => pathname.startsWith(prefix));

  if (matched) {
    // Not logged in at all
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', pathname); // so login page can redirect back
      return NextResponse.redirect(loginUrl);
    }

    // Fetch role from profiles table.
    // NOTE: This is one DB round-trip per request on protected routes.
    // To eliminate it, store user_type in Supabase user_metadata at signup
    // and read it here via session.user.user_metadata.user_type instead.
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', session.user.id)
      .single();

    const userRole = profile?.user_type as string | undefined;

    if (userRole !== matched.role) {
      // Logged in but wrong role → send to their own dashboard
      const home = userRole ? (ROLE_DASHBOARD[userRole] ?? '/login') : '/login';
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  // Unprotected routes (/login, /signup, /onboarding, /pricing, /) pass through.
  // `res` already carries the refreshed session cookie.
  return res;
}

// Only run on the routes that need guarding — skip all static assets and API routes.
export const config = {
  matcher: [
    '/dashboard-owner/:path*',
    '/dashboard-ca/:path*',
    '/vault/:path*',
    '/admin/:path*',
  ],
};
