/**
 * Azure Entra ID Authentication Callback
 * 認証後のリダイレクト先
 */
import { NextRequest, NextResponse } from 'next/server';
import { acquireTokenByCode, setSession } from '@/lib/azure-auth';

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

    // セッションデータを構築
    const sessionData = {
      accessToken: tokenResponse.accessToken,
      idToken: tokenResponse.idToken,
      account: tokenResponse.account,
      expiresOn: tokenResponse.account?.idTokenClaims?.exp || Math.floor(Date.now() / 1000) + 3600,
    };

    // セッションを保存（Cosmos DB + Cookie）
    await setSession(sessionData);

    // HTTPSかどうかを判定（本番環境では必ずHTTPS）
    const isProduction = process.env.NODE_ENV === 'production' || appOrigin.startsWith('https://');

    // ホームページにリダイレクト
    const response = NextResponse.redirect(new URL('/', appOrigin));

    return response;
  } catch (error) {
    console.error('Token acquisition error:', error);
    return NextResponse.redirect(new URL('/sign-in?error=token_failed', appOrigin));
  }
}
