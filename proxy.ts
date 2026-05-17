import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require a valid session.
// Better-Auth session check is done inside the dashboard server component too
// (double-enforcement per Next.js proxy guidance).
export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
