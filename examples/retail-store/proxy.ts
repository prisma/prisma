import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;
  if (!userId) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
