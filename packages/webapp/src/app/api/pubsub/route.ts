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
    // 認証セッションからusernameを取得（フォールバックはENVのDEV_USER_ID）
    const session = await getSession();
    const username = session?.account?.username ?? process.env.DEV_USER_ID ?? null;
    if (!username) {
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

    // Get workerId from query parameter
    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('workerId');

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    // Generate client access token with group permissions
    const token = await serviceClient.getClientAccessToken({
      userId: `webapp-${username}`,
      roles: [`webpubsub.joinLeaveGroup.webapp/worker/${workerId}`, `webpubsub.sendToGroup.webapp/worker/${workerId}`],
      expirationTimeInMinutes: 60,
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
