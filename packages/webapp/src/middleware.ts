/**
 * Middleware for Azure Entra ID authentication
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This file is critical for webapp authentication mechanism.
// DO NOT remove any existing logic if you are not sure!

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 開発環境: 認証をスキップ
  if (process.env.SKIP_AUTH === 'true') {
    return response;
  }

  const appOrigin = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3011';

  try {
    // セッションIDのCookieをチェック
    const sessionIdCookie = request.cookies.get('session_id');

    if (!sessionIdCookie?.value) {
      return NextResponse.redirect(new URL('/sign-in', appOrigin));
    }

    // セッションIDがあれば認証済みと判断
    // 詳細な有効期限チェックはgetSession()で行う
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL('/sign-in', appOrigin));
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sign-in).*)',
  ],
};
