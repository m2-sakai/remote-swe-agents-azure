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
    // セッションCookieをチェック
    const sessionCookie = request.cookies.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL('/sign-in', appOrigin));
    }

    // セッション情報をパース
    const session = JSON.parse(sessionCookie.value);
    const now = Math.floor(Date.now() / 1000);
    const expiresOn = session?.expiresOn || 0;
    const timeRemaining = expiresOn - now;

    // ユーザーIDと有効期限をチェック
    const authenticated =
      session?.userId &&
      session?.expiresOn &&
      // トークンの有効期限をチェック（5分のバッファ）
      timeRemaining > 300;

    if (authenticated) {
      return response;
    }

    return NextResponse.redirect(new URL('/sign-in', appOrigin));
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
