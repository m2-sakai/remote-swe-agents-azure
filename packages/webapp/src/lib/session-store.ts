/**
 * Server-side session storage using Cosmos DB
 * Cookieサイズ制限回避のため、セッションIDのみをCookieに保存し、
 * 実際のトークン情報はCosmos DBに保存
 *
 * 既存のsessions.tsと同じパーティションキー設計を使用:
 * PK = 'auth-sessions', SK = sessionId
 */
import { getContainer } from '@remote-swe-agents-azure/agent-core/azure';
import { randomBytes } from 'crypto';

const CONTAINER_NAME = process.env.AZURE_COSMOS_CONTAINER_NAME || 'remote-swe-agents';
const PK = 'auth-sessions'; // 既存の'sessions'と区別するため

export interface AuthSessionData {
  id: string; // sessionId (Cosmos DBのドキュメントID)
  PK: string; // パーティションキー: 'auth-sessions'
  sessionId: string;
  accessToken: string;
  idToken: string;
  account: any;
  expiresOn: number;
  createdAt: number;
  updatedAt: number;
  ttl?: number; // Cosmos DBの自動削除用
}

/**
 * セッションIDを生成
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * セッションを保存
 * 既存sessions.tsのパターンに従う: container.item(id, PK).upsert()
 */
export async function saveSession(
  sessionData: Omit<AuthSessionData, 'id' | 'PK' | 'sessionId' | 'createdAt' | 'updatedAt' | 'ttl'>
): Promise<string> {
  const sessionId = generateSessionId();
  const now = Date.now();

  const item: AuthSessionData = {
    id: sessionId,
    PK,
    sessionId,
    ...sessionData,
    createdAt: now,
    updatedAt: now,
    ttl: 60 * 60 * 24 * 7, // 7日後に自動削除
  };

  try {
    const container = getContainer(CONTAINER_NAME);
    await container.items.upsert(item);

    return sessionId;
  } catch (error) {
    console.error('[SessionStore] Failed to save session:', error);
    throw new Error('Failed to save session');
  }
}

/**
 * セッションを取得
 * 既存sessions.tsのパターンに従う: container.item(id, PK).read()
 */
export async function getSession(sessionId: string): Promise<AuthSessionData | null> {
  try {
    const container = getContainer(CONTAINER_NAME);
    const { resource } = await container.item(sessionId, PK).read<AuthSessionData>();

    if (!resource) {
      return null;
    }

    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (resource.expiresOn && resource.expiresOn < now) {
      await deleteSession(sessionId);
      return null;
    }

    return resource;
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    console.error('[SessionStore] Failed to get session:', error);
    return null;
  }
}

/**
 * セッションを更新
 * 既存sessions.tsのupdateSessionパターンに従う
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<AuthSessionData, 'id' | 'PK' | 'sessionId' | 'createdAt'>>
): Promise<void> {
  try {
    const container = getContainer(CONTAINER_NAME);

    // Get existing item
    const { resource: existing } = await container.item(sessionId, PK).read<AuthSessionData>();

    if (!existing) {
      throw new Error('Session not found');
    }

    // Merge updates
    const updated: AuthSessionData = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    // Replace the item
    await container.item(sessionId, PK).replace(updated);
  } catch (error) {
    console.error('[SessionStore] Failed to update session:', error);
    throw new Error('Failed to update session');
  }
}

/**
 * セッションを削除
 * 既存sessions.tsのパターンに従う: container.item(id, PK).delete()
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const container = getContainer(CONTAINER_NAME);
    await container.item(sessionId, PK).delete();
  } catch (error: any) {
    // 404エラーは無視
    if (error.code !== 404) {
      console.error('[SessionStore] Failed to delete session:', error);
    }
  }
}
