/**
 * Azure Entra ID Sign-Out Endpoint
 * セッションをクリアしてログアウト
 */
import { NextResponse } from 'next/server';
import { clearSession, getLogoutUrl } from '@/lib/azure-auth';

export async function GET() {
  try {
    // セッションをクリア
    await clearSession();

    // Azure ADのログアウトURLにリダイレクト
    const logoutUrl = getLogoutUrl();
    return NextResponse.redirect(logoutUrl);
  } catch (error) {
    console.error('Sign-out error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
