/**
 * Azure Entra ID Authentication Callback
 * 認証後のリダイレクト先
 */
import { NextRequest, NextResponse } from 'next/server';
import { acquireTokenByCode } from '@/lib/azure-auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appOrigin = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3011';

  // エラーハンドリング
  if (error) {
    console.error('Authentication error:', error);
    return NextResponse.redirect(new URL('/sign-in?error=auth_failed', appOrigin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=no_code', appOrigin));
  }

  try {
    // 認証コードからトークンを取得
    const tokenResponse = await acquireTokenByCode(code);

    // 必要最小限の情報のみをCookieに保存（Cookieサイズを削減）
    const minimalSession = {
      userId: tokenResponse.account?.localAccountId || tokenResponse.account?.homeAccountId,
      username: tokenResponse.account?.username,
      name: tokenResponse.account?.name,
      expiresOn: tokenResponse.account?.idTokenClaims?.exp || Math.floor(Date.now() / 1000) + 3600,
    };

    // HTTPSかどうかを判定（本番環境では必ずHTTPS）
    const isProduction = process.env.NODE_ENV === 'production' || appOrigin.startsWith('https://');

    console.log('[Auth] Session saved:', {
      userId: !!minimalSession.userId,
      username: minimalSession.username,
      expiresOn: minimalSession.expiresOn,
      expiresInMinutes: minimalSession.expiresOn
        ? Math.floor((minimalSession.expiresOn - Date.now() / 1000) / 60)
        : 'N/A',
      isProduction,
    });

    // ホームページにリダイレクト（Cookieをレスポンスに設定）
    const response = NextResponse.redirect(new URL('/', appOrigin));

    const cookieValue = JSON.stringify(minimalSession);
    console.log('[Auth] Setting cookie with value length:', cookieValue.length);

    response.cookies.set('session', cookieValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('[Auth] Session set! Redirecting to home page.');

    return response;
  } catch (error) {
    console.error('Token acquisition error:', error);
    return NextResponse.redirect(new URL('/sign-in?error=token_failed', appOrigin));
  }
}
