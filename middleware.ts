
import { NextRequest, NextResponse } from 'next/server';

const FILE_EXT_RE = /\.[^/]+$/;

export const config = {
  matcher: [
    '/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!FILE_EXT_RE.test(pathname)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/mk${pathname}`;
  return NextResponse.rewrite(url);
}
