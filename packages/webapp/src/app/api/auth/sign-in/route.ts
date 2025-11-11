/**
 * Azure Entra ID Sign-In Endpoint
 * ユーザーをAzure ADログインページにリダイレクト
 */
import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/azure-auth';

export async function GET() {
  try {
    const authUrl = await getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Sign-in error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate sign-in' },
      { status: 500 }
    );
  }
}
