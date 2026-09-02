# ECサイト AIカスタマーサポート MVP

`teiansyo`（提案書）・`teigisyo`（定義書）に基づくAIカスタマーサポートチャットボットのMVP実装。

## 技術スタック

- Next.js 16 / React 19 / TypeScript / Tailwind CSS 4
- Supabase (Postgres / pgvector / Auth / Realtime)
- Claude Haiku（問い合わせ分類）/ Claude Sonnet（回答生成）
- Voyage AI `voyage-3-lite`（Embedding）
- Resend（メール通知）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの準備

1. [Supabase](https://supabase.com/) でアカウント作成、新規プロジェクトを作成（Tokyoリージョン推奨）
2. Authentication > Providers で **Anonymous Sign-ins** を有効化
   （顧客はログイン不要で匿名セッションによりチャットを利用するため）
3. Project Settings > API から以下を取得:
   - Project URL
   - anon public key
   - service_role key（**絶対にフロントエンドへ公開しないこと**）

### 3. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` に取得したキーを設定する。

### 4. データベースのマイグレーション適用

Supabase CLIでリモートプロジェクトへリンクし、マイグレーションを適用する
（ローカルにDocker環境がある場合は `supabase start` でローカルスタックを使うことも可能）。

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

適用されるマイグレーション（`supabase/migrations/`）:

- `0001_extensions.sql` — pgvector, pgcrypto拡張
- `0002_tables.sql` — `conversations` / `messages` / `knowledge_items` / `operators`
- `0003_rls_policies.sql` — Row Level Security ポリシー
- `0004_match_function.sql` — FAQベクトル検索用RPC関数 `match_knowledge_items`

### 5. オペレーター（管理画面利用者）アカウントの作成

自己登録UIは今回のMVPでは作成しない。Supabase StudioのAuthenticationからユーザーを作成し、
`operators` テーブルへ手動でレコードを追加する（`id` はAuthユーザーのUUID、`email`, `name`, `role` を設定）。

### 6. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開く。

`/api/health` で `knowledge_items` テーブルへの接続確認ができる。

## ディレクトリ構成

```
app/
  chat/        顧客向けチャット画面
  admin/       管理画面（ログイン/一覧/詳細）
  api/         Route Handlers（chat, admin, health）
components/
  chat/        顧客チャットUIコンポーネント
  admin/       管理画面コンポーネント
lib/
  ai/          Claude Haiku分類・Sonnet回答生成
  rag/         Embedding生成・FAQベクトル検索
  supabase/    Supabaseクライアント（browser / server / admin）
  resend/      メール通知
data/
  faq.csv      FAQ元データ（ナレッジベースの取り込み元）
supabase/
  migrations/  DBマイグレーション
types/         共通型定義
scripts/       FAQ取り込み等の実行スクリプト
```

## 開発フェーズ

1. 前半: 基盤構築（本READMEの内容まで）
2. 中盤: コア機能（FAQ取り込み・RAG・チャットUI・エスカレーション判定）
3. 後半: 管理画面（ログイン・一覧・返信・Realtime・メール通知）
4. 仕上げ: 統合テスト（`case4-test-conversations.csv` の8シナリオで検証）

詳細は開発計画を参照。

## 技術引き継ぎドキュメント

アーキテクチャ・データモデル・既知の制約などは [docs/HANDOFF.md](docs/HANDOFF.md) を参照。
