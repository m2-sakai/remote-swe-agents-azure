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

    // セッション情報を作成
    const session = {
      accessToken: tokenResponse.accessToken,
      idToken: tokenResponse.idToken,
      account: tokenResponse.account,
      expiresOn: tokenResponse.account?.idTokenClaims?.exp || Math.floor(Date.now() / 1000) + 3600,
    };

    // HTTPSかどうかを判定（本番環境では必ずHTTPS）
    const isProduction = process.env.NODE_ENV === 'production' || appOrigin.startsWith('https://');

    console.log('[Auth] Session saved:', {
      hasAccessToken: !!session.accessToken,
      hasAccount: !!session.account,
      expiresOn: session.expiresOn,
      expiresInMinutes: session.expiresOn ? Math.floor((session.expiresOn - Date.now() / 1000) / 60) : 'N/A',
      isProduction,
    });

    // ホームページにリダイレクト（Cookieをレスポンスに設定）
    console.log('[Auth] Session set! Redirecting to home page.');
    const response = NextResponse.redirect(new URL('/', appOrigin));
    response.cookies.set('session', JSON.stringify(session), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Token acquisition error:', error);
    return NextResponse.redirect(new URL('/sign-in?error=token_failed', appOrigin));
  }
}
