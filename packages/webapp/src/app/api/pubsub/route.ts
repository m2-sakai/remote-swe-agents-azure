import { NextRequest, NextResponse } from 'next/server';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { DefaultAzureCredential } from '@azure/identity';
import { getSession } from '@/lib/azure-auth';

export const dynamic = 'force-dynamic';

/**
 * WebPubSub接続用のクライアントアクセストークンを生成
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[pubsub/route] Incoming request:', {
      url: request.url,
      method: 'GET',
      time: new Date().toISOString(),
    });

    // 認証セッションからusernameを取得（フォールバックはENVのDEV_USER_ID）
    const session = await getSession();
    const username = session?.account?.username ?? process.env.DEV_USER_ID ?? null;
    console.log('[pubsub/route] Resolved user:', {
      hasSession: !!session,
      username,
      devFallback: !session && !!process.env.DEV_USER_ID,
    });
    if (!username) {
      console.warn('[pubsub/route] Unauthorized: no username');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const endpoint = process.env.AZURE_WEB_PUBSUB_ENDPOINT;
    if (!endpoint) {
      console.error('[pubsub/route] AZURE_WEB_PUBSUB_ENDPOINT is not set');
      return NextResponse.json({ error: 'WebPubSub not configured' }, { status: 500 });
    }

    const hubName = 'remoteswehub';
    const credential = new DefaultAzureCredential();
    const serviceClient = new WebPubSubServiceClient(endpoint, credential, hubName);
    console.log('[pubsub/route] Client initialized:', { endpoint, hubName });

    // Get workerId from query parameter
    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('workerId');
    console.log('[pubsub/route] Query params:', { workerId });

    if (!workerId) {
      console.warn('[pubsub/route] Missing workerId');
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    // Generate client access token with group permissions
    const token = await serviceClient.getClientAccessToken({
      userId: `webapp-${username}`,
      roles: [`webpubsub.joinLeaveGroup.webapp/worker/${workerId}`, `webpubsub.sendToGroup.webapp/worker/${workerId}`],
      expirationTimeInMinutes: 60,
    });
    console.log('[pubsub/route] Token generated:', {
      baseUrl: token.baseUrl,
      urlDomain: (() => {
        try {
          const u = new URL(token.url);
          return u.hostname;
        } catch {
          return 'n/a';
        }
      })(),
      channelName: `webapp/worker/${workerId}`,
      expiresInMinutes: 60,
      userId: `webapp-${username}`,
    });

    return NextResponse.json({
      url: token.url,
      token: token.token,
      baseUrl: token.baseUrl,
      channelName: `webapp/worker/${workerId}`,
    });
  } catch (error) {
    const err = error as any;
    console.error('[pubsub/route] Error generating token:', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
