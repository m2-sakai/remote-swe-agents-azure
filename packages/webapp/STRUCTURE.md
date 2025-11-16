# packages/webapp - プロジェクト構造ドキュメント

## 📋 概要

Next.js 15を使用したフルスタックWebアプリケーション。Azure Entra ID認証を使用し、AI エージェントとの対話型セッションを管理します。

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **UIライブラリ**: React 19, shadcn/ui, Radix UI
- **スタイリング**: Tailwind CSS v4
- **認証**: Azure Entra ID (MSAL)
- **国際化**: next-intl (日本語/英語)
- **バックエンド**: Azure services (Cosmos DB, Blob Storage, Key Vault)

## 📁 ディレクトリ構造

```
packages/webapp/
├── src/                          # ソースコード
│   ├── actions/                  # Server Actions（データ更新操作）
│   │   ├── api-key/             # APIキー管理アクション
│   │   ├── image/               # 画像アップロードアクション
│   │   └── upload/              # ファイルアップロードアクション
│   │
│   ├── app/                      # Next.js App Router
│   │   ├── (root)/              # ルートページ（ホーム）
│   │   ├── api/                 # API Routes（外部API、認証）
│   │   │   ├── auth/            # 認証エンドポイント
│   │   │   │   ├── sign-in/     # サインイン開始
│   │   │   │   ├── callback/    # 認証コールバック
│   │   │   │   └── sign-out/    # サインアウト
│   │   │   ├── cognito-token/   # レガシー: AWS Cognito用（将来削除予定）
│   │   │   ├── health/          # ヘルスチェックエンドポイント
│   │   │   └── sessions/        # セッションAPI（外部システム連携用）
│   │   ├── api-keys/            # APIキー管理ページ
│   │   ├── auth-callback/       # 認証コールバック処理ページ
│   │   ├── cost/                # コスト分析ページ
│   │   ├── custom-agent/        # カスタムエージェント設定ページ
│   │   ├── preferences/         # ユーザー設定ページ
│   │   ├── sessions/            # セッション管理
│   │   │   ├── (root)/          # セッション一覧
│   │   │   ├── new/             # 新規セッション作成
│   │   │   └── [workerId]/      # 個別セッション詳細（チャット画面）
│   │   ├── sign-in/             # サインインページ
│   │   ├── globals.css          # グローバルスタイル
│   │   └── layout.tsx           # ルートレイアウト
│   │
│   ├── components/               # Reactコンポーネント
│   │   ├── ui/                  # shadcn/ui コンポーネント
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   └── ... (他のUIコンポーネント)
│   │   ├── Header.tsx           # ヘッダーコンポーネント
│   │   ├── ImageUploader.tsx    # 画像アップローダー
│   │   ├── RefreshOnFocus.tsx   # フォーカス時リフレッシュ
│   │   └── ThemeToggle.tsx      # ダーク/ライトモード切り替え
│   │
│   ├── hooks/                    # カスタムReactフック
│   │   ├── use-event-bus.ts     # イベントバス（リアルタイム通知）
│   │   └── use-scroll-position.ts # スクロール位置管理
│   │
│   ├── i18n/                     # 国際化設定
│   │   ├── config.ts            # i18n設定
│   │   ├── db.ts                # データベース関連i18n
│   │   └── request.ts           # リクエスト処理i18n
│   │
│   ├── jobs/                     # バックグラウンドジョブ
│   │   ├── async-job-runner.ts  # 非同期ジョブランナー
│   │   └── async-jobs/          # ジョブ定義
│   │
│   ├── lib/                      # ユーティリティ・ライブラリ
│   │   ├── auth.ts              # 認証ヘルパー（セッション取得）
│   │   ├── azure-auth.ts        # Azure Entra ID認証（MSAL操作）
│   │   ├── msal-config.ts       # MSAL設定
│   │   ├── safe-action.ts       # Server Action クライアント（認証付き）
│   │   ├── events.ts            # イベント処理
│   │   ├── jobs.ts              # ジョブ管理
│   │   ├── message-formatter.ts # メッセージフォーマット
│   │   ├── origin.ts            # オリジンURL管理
│   │   └── utils.ts             # 汎用ユーティリティ
│   │
│   ├── messages/                 # 翻訳ファイル
│   │   ├── en.json              # 英語
│   │   └── ja.json              # 日本語
│   │
│   ├── utils/                    # ユーティリティ関数
│   │   └── session-status.ts    # セッションステータス管理
│   │
│   └── middleware.ts             # Next.js Middleware（認証チェック）
│
├── .env.local                    # 環境変数（開発環境）
├── .env.local.example            # 環境変数サンプル
├── .gitignore                    # Git除外設定
├── AUTHENTICATION.md             # 認証セットアップガイド
├── CLAUDE.md                     # 開発ガイドライン（Claude用）
├── README.md                     # プロジェクトREADME
├── components.json               # shadcn/ui設定
├── deploy.sh                     # デプロイスクリプト
├── eslint.config.mjs             # ESLint設定
├── next.config.ts                # Next.js設定
├── next-env.d.ts                 # Next.js型定義
├── package.json                  # 依存関係
├── postcss.config.mjs            # PostCSS設定
├── run.sh                        # ローカル実行スクリプト
└── tsconfig.json                 # TypeScript設定
```

## 🏗️ アーキテクチャパターン

### 1. **Server Components & Server Actions**

Next.js 15のApp Routerを使用し、Server ComponentsとServer Actionsパターンを採用。

#### Server Components（データ取得）

```typescript
// src/app/sessions/(root)/page.tsx
export default async function SessionsPage() {
  // Server Componentで直接データ取得
  const sessions = await getSessionsFromDB();
  return <SessionsList sessions={sessions} />;
}
```

#### Server Actions（データ更新）

```typescript
// src/app/sessions/(root)/actions.ts
'use server';

import { authActionClient } from '@/lib/safe-action';

export const createSessionAction = authActionClient.schema(createSessionSchema).action(async ({ parsedInput, ctx }) => {
  const { userId } = ctx; // 認証情報
  // データベース操作
  return result;
});
```

#### Client Components（UI・インタラクション）

```typescript
// src/app/sessions/(root)/components/SessionsList.tsx
'use client';

import { useAction } from 'next-safe-action/hooks';
import { createSessionAction } from '../actions';

export function SessionsList({ sessions }) {
  const { execute } = useAction(createSessionAction, {
    onSuccess: () => toast.success('Created!'),
    onError: (error) => toast.error(error.serverError),
  });

  return (
    // UI実装
  );
}
```

### 2. **認証フロー（Azure Entra ID）**

```
1. ユーザーアクセス → middleware.ts でセッションチェック
2. 未認証 → /sign-in へリダイレクト
3. Sign in button → GET /api/auth/sign-in
4. Azure ADログイン → GET /api/auth/callback（認証コード受取）
5. トークン取得 → セッションCookie設定
6. ホームページへリダイレクト
```

**関連ファイル:**

- `src/middleware.ts` - すべてのリクエストでセッション検証
- `src/lib/azure-auth.ts` - MSAL操作（トークン取得、セッション管理）
- `src/lib/msal-config.ts` - MSAL設定
- `src/lib/auth.ts` - 認証ヘルパー
- `src/lib/safe-action.ts` - Server Action認証クライアント

### 3. **国際化（i18n）**

next-intlを使用して日本語と英語をサポート。

```typescript
// Server Component
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('sessions');
  return <h1>{t('title')}</h1>;
}

// Client Component
'use client';
import { useTranslations } from 'next-intl';

export function Component() {
  const t = useTranslations('sessions');
  return <h1>{t('title')}</h1>;
}
```

**翻訳ファイル:**

- `src/messages/en.json` - 英語翻訳
- `src/messages/ja.json` - 日本語翻訳

### 4. **UIコンポーネント（shadcn/ui）**

Radix UIベースのshadcn/uiコンポーネントを使用。

```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
```

**カスタマイズ:**

- `src/app/globals.css` - CSS変数でテーマカスタマイズ
- `components.json` - shadcn/ui設定

## 📄 主要ファイルの説明

### 認証関連

| ファイル                             | 説明                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `src/middleware.ts`                  | 全リクエストで認証チェック。`SKIP_AUTH=true`で無効化可能  |
| `src/lib/azure-auth.ts`              | MSAL操作（ログインURL生成、トークン取得、セッション管理） |
| `src/lib/msal-config.ts`             | MSAL設定（Client ID, Tenant ID, スコープ）                |
| `src/lib/auth.ts`                    | セッション取得ヘルパー。開発環境でダミーユーザー返却      |
| `src/lib/safe-action.ts`             | Server Action認証クライアント。`authActionClient`を提供   |
| `src/app/api/auth/sign-in/route.ts`  | Azure ADログインURLにリダイレクト                         |
| `src/app/api/auth/callback/route.ts` | 認証コールバック。トークン取得してCookieに保存            |
| `src/app/sign-in/page.tsx`           | サインインページUI                                        |

### データ管理

| ファイル                       | 説明                             |
| ------------------------------ | -------------------------------- |
| `src/actions/`                 | Server Actions（データ更新操作） |
| `src/app/*/actions.ts`         | 各ページのServer Actions定義     |
| `src/app/*/schemas.ts`         | Zodスキーマ（バリデーション）    |
| `src/lib/jobs.ts`              | バックグラウンドジョブ管理       |
| `src/jobs/async-job-runner.ts` | 非同期ジョブランナー             |

### UI・コンポーネント

| ファイル                                  | 説明                                              |
| ----------------------------------------- | ------------------------------------------------- |
| `src/components/ui/*`                     | shadcn/uiコンポーネント（Button, Card, Dialog等） |
| `src/components/Header.tsx`               | アプリケーションヘッダー                          |
| `src/components/ThemeToggle.tsx`          | ダーク/ライトモード切り替え                       |
| `src/app/sessions/[workerId]/component/*` | チャット画面コンポーネント                        |
| `src/app/globals.css`                     | グローバルスタイル、Tailwind設定                  |

### 設定ファイル

| ファイル             | 説明                                            |
| -------------------- | ----------------------------------------------- |
| `next.config.ts`     | Next.js設定（standalone出力、TypeScript無視等） |
| `tsconfig.json`      | TypeScript設定（パスエイリアス `@/*`）          |
| `components.json`    | shadcn/ui設定                                   |
| `eslint.config.mjs`  | ESLint設定                                      |
| `postcss.config.mjs` | PostCSS設定                                     |
| `.env.local`         | 環境変数（開発環境）                            |

## 🔌 主要な依存関係

### コアフレームワーク

- **next**: ^15.3.3 - Next.jsフレームワーク
- **react**: ^19.0.0 - React
- **typescript**: ^5 - TypeScript

### Azure統合

- **@azure/msal-node**: ^2.15.0 - Microsoft Authentication Library（認証）
- **@azure/storage-blob**: ^12.25.0 - Blob Storage SDK
- **@azure/keyvault-secrets**: ^4.9.0 - Key Vault SDK
- **@azure/identity**: ^4.5.0 - Azure Identity

### UI・スタイリング

- **@radix-ui/\***: Radix UIコンポーネント群
- **tailwindcss**: ^4 - Tailwind CSS
- **lucide-react**: ^0.488.0 - アイコンライブラリ
- **next-themes**: ^0.4.6 - テーマ管理

### フォーム・バリデーション

- **react-hook-form**: ^7.62.0 - フォーム管理
- **@hookform/resolvers**: ^5.2.1 - フォームバリデーション
- **zod**: ^4.0.0 - スキーマバリデーション
- **next-safe-action**: ^8.0.8 - 型安全なServer Actions

### その他

- **next-intl**: ^4.1.0 - 国際化
- **react-markdown**: ^10.1.0 - Markdown表示
- **date-fns**: ^4.1.0 - 日付処理
- **sonner**: ^2.0.3 - トースト通知

### 内部パッケージ

- **@remote-swe-agents-azure/agent-core**: エージェントコアロジック（monorepo内）

## 🔑 環境変数

### 開発環境（.env.local）

```bash
# 認証設定
SKIP_AUTH=true                        # 認証スキップ（開発環境）
DEV_USER_ID=dev-user-001             # ダミーユーザーID
DEV_USER_EMAIL=dev@example.com       # ダミーユーザーメール

# アプリケーション設定
APP_ORIGIN=http://localhost:3011     # アプリケーションURL

# Azure Cosmos DB
AZURE_COSMOS_ENDPOINT=https://...
AZURE_COSMOS_CONNECTION_STRING=AccountEndpoint=...
AZURE_COSMOS_DATABASE_ID=remote-swe-agents

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=...
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER_NAME=remote-swe-agents

# Azure Key Vault
AZURE_KEYVAULT_URL=https://....vault.azure.net

# Azure Entra ID（認証スキップ時は不要）
AZURE_AD_CLIENT_ID=dummy
AZURE_AD_CLIENT_SECRET=dummy
AZURE_AD_TENANT_ID=dummy
AZURE_AD_REDIRECT_URI=http://localhost:3011/api/auth/callback

# Azure Functions
AZURE_FUNCTION_URL=http://localhost:7071/api/AsyncJobHandler
AZURE_FUNCTION_KEY=dummy

# イベント設定（オプション）
NEXT_PUBLIC_EVENT_HTTP_ENDPOINT=""
```

### 本番環境

本番環境では以下を変更:

- `SKIP_AUTH=false` - 認証を有効化
- Azure Entra IDの実際の値を設定
- App Service URLを設定
- 実際のAzureリソース接続情報を設定

## 🎯 主要機能

### 1. セッション管理

- **一覧表示**: `/sessions` - 全セッション表示
- **新規作成**: `/sessions/new` - 新しいエージェントセッション作成
- **チャット**: `/sessions/[workerId]` - エージェントとの対話

### 2. カスタムエージェント

- **設定**: `/custom-agent` - カスタムエージェントの定義・編集
- プロンプト、ツール、設定のカスタマイズ

### 3. APIキー管理

- **管理**: `/api-keys` - APIキーの作成・削除
- 外部システムからのAPI呼び出し用

### 4. コスト分析

- **分析**: `/cost` - AI利用コストの可視化
- 日別・セッション別のコスト内訳

### 5. ユーザー設定

- **設定**: `/preferences` - グローバル設定、プロンプトカスタマイズ

## 🔒 セキュリティ

### 認証・認可

- Azure Entra ID（MSAL）を使用
- すべてのページが`middleware.ts`で保護
- Server Actionsは`authActionClient`で自動的に認証チェック
- 開発環境では`SKIP_AUTH=true`で認証スキップ可能

### セッション管理

- HTTPOnly Cookieでセッション保存
- トークン有効期限チェック（5分バッファ）
- HTTPS必須（本番環境）

### API認証

- Bearer Token認証（APIキー）
- `/api/sessions/*` エンドポイントで使用

## 🚀 開発ワークフロー

### ローカル開発

```bash
cd packages/webapp
npm install
npm run dev  # http://localhost:3011
```

### ビルド

```bash
npm run build
```

**ビルド設定:**

- `output: 'standalone'` - スタンドアロン出力（Docker対応）
- `outputFileTracingRoot` - monorepo対応
- `eslint.ignoreDuringBuilds: true` - ビルド時ESLint無視
- `typescript.ignoreBuildErrors` - 条件付きでTypeScriptエラー無視

### フォーマット

```bash
npm run format        # コードフォーマット
npm run format:check  # フォーマットチェック
```

## 📝 コーディング規約

### Server Components vs Client Components

**Server Components（デフォルト）:**

- データ取得を直接実行
- async/await可能
- クライアントサイドJavaScript不要

```typescript
// src/app/page.tsx
export default async function Page() {
  const data = await fetchData(); // 直接データ取得
  return <ClientComponent data={data} />;
}
```

**Client Components（'use client'）:**

- ユーザーインタラクション
- useState、useEffect等のフック使用
- ブラウザAPI使用

```typescript
// src/app/components/Component.tsx
'use client';

export function Component({ data }) {
  const [state, setState] = useState();
  return <button onClick={...}>Click</button>;
}
```

### Server Actions

**パターン:**

1. `actions.ts` - Server Actions定義（'use server'）
2. `schemas.ts` - Zodスキーマ定義
3. Client Componentで`useAction`フック使用

```typescript
// actions.ts
'use server';
export const myAction = authActionClient.schema(schema).action(...);

// Component.tsx
'use client';
const { execute } = useAction(myAction);
```

### 国際化

すべてのラベルは`next-intl`を使用:

```typescript
const t = await getTranslations('section');
<h1>{t('title')}</h1>
```

翻訳は`src/messages/en.json`と`ja.json`に追加。

### TypeScript

- 型安全性を最優先
- `any`の使用を避ける
- Zodスキーマで実行時バリデーション

### コメント

- 複雑なロジック以外はコメント不要
- コメントは英語で記述

## 🐛 トラブルシューティング

### ビルドエラー

**TypeScriptエラーでビルド失敗:**

```bash
# 一時的にTypeScriptエラーを無視
SKIP_TS_BUILD=true npm run build
```

**ESLintエラーでビルド失敗:**
設定済み（`eslint.ignoreDuringBuilds: true`）

### 認証エラー

**開発環境で認証をスキップ:**

```bash
# .env.local
SKIP_AUTH=true
```

**本番環境で"Session is not valid":**

- `SKIP_AUTH=false`を確認
- Azure Entra ID設定を確認
- Cookie設定を確認（HTTPS必須）

### モノレポ関連

**agent-coreが見つからない:**

```bash
# ルートディレクトリで
npm install

# webappで
cd packages/webapp
npm install
```

## 📚 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Azure Entra ID Documentation](https://learn.microsoft.com/entra/identity/)
- [MSAL Node](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
- [shadcn/ui](https://ui.shadcn.com/)
- [next-intl](https://next-intl-docs.vercel.app/)

## 📝 メモ

### レガシーコード

- `src/app/api/cognito-token/` - AWS Cognito用（削除予定）
- 一部のコメントにAWSへの参照が残っている

### 今後の改善点

- TypeScriptの厳密化
- テストの追加
- パフォーマンス最適化
- エラーハンドリングの改善
