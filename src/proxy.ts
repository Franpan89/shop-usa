import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Exact-match public routes (the marketing site) — checked with === so '/' never
// accidentally matches every path via startsWith.
const PUBLIC_EXACT_PATHS = ['/', '/login', '/set-password'];
// Prefix-match public routes (auth handshake callbacks).
const PUBLIC_PREFIX_PATHS = ['/auth/callback'];

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const isAppDomain = hostname.startsWith('app.');

  // shopusaenvios.com serves the marketing site at '/'; app.shopusaenvios.com
  // serves this same deployment for the internal app, so its bare root isn't
  // the marketing page — send it to the login gate, which then routes
  // staff/portal/unauthenticated visitors appropriately.
  if (isAppDomain && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublic =
    PUBLIC_EXACT_PATHS.includes(request.nextUrl.pathname) ||
    PUBLIC_PREFIX_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    // Staff land on /dashboard; requireStaff() bounces portal clients on to /portal.
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
