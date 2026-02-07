import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip empty or root path
  if (pathname === '/') return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/mk${pathname}`;
  return NextResponse.rewrite(url);
}
