// import { NextRequest, NextResponse } from 'next/server';
// import { WebPubSubServiceClient } from '@azure/web-pubsub';
// import { getCurrentUserId } from '@/lib/user';

// export const dynamic = 'force-dynamic';

// /**
//  * WebPubSub接続用のクライアントアクセストークンを生成
//  */
// export async function GET(request: NextRequest) {
//   try {
//     const userId = await getCurrentUserId();
//     if (!userId) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const connectionString = process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING;
//     if (!connectionString) {
//       console.error('[pubsub/route] AZURE_WEB_PUBSUB_CONNECTION_STRING is not set');
//       return NextResponse.json({ error: 'WebPubSub not configured' }, { status: 500 });
//     }

//     const hubName = 'event-bus';
//     const serviceClient = new WebPubSubServiceClient(connectionString, hubName);

//     // Get workerId from query parameter
//     const { searchParams } = new URL(request.url);
//     const workerId = searchParams.get('workerId');

//     if (!workerId) {
//       return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
//     }

//     // Generate client access token with group permissions
//     const token = await serviceClient.getClientAccessToken({
//       userId: `webapp-${userId}`,
//       roles: [`webpubsub.joinLeaveGroup.webapp/worker/${workerId}`, `webpubsub.sendToGroup.webapp/worker/${workerId}`],
//       expirationTimeInMinutes: 60,
//     });

//     return NextResponse.json({
//       url: token.url,
//       token: token.token,
//       baseUrl: token.baseUrl,
//       channelName: `webapp/worker/${workerId}`,
//     });
//   } catch (error) {
//     console.error('[pubsub/route] Error generating token:', error);
//     return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
//   }
// }
