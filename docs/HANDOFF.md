# 技術引き継ぎドキュメント

このドキュメントは、本プロジェクト（ECサイト向けAIカスタマーサポートチャットボット）を
引き継ぐ開発者向けの技術資料です。非エンジニア向けの資料は別途
「セットアップガイド」「運用マニュアル」（Googleドキュメント）を参照してください。

対象読者: このコードベースを保守・拡張するエンジニア。

## 1. 技術スタック

| 領域 | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router, Turbopack) |
| 言語 | TypeScript |
| UI | React 19 / Tailwind CSS 4 |
| DB / Auth / Realtime | Supabase (Postgres + pgvector) |
| LLM (分類・回答生成) | Anthropic Claude (Haiku: 分類 / Sonnet: 回答生成) |
| Embedding (FAQ検索) | Voyage AI (`voyage-3-lite`) |
| メール通知 | Resend |
| ホスティング | Vercel |
| ソース管理 | GitHub (`miyuc75-creator/cs-chatbot`) |

バリデーションは `zod`、CSVパースは `csv-parse` を使用。

## 2. ディレクトリ構成

```
app/
  page.tsx                  ルート("/") → /chat へリダイレクトのみ
  layout.tsx                ルートレイアウト
  chat/page.tsx             顧客向けチャット画面
  admin/
    login/page.tsx          オペレーターログイン
    page.tsx                問い合わせ一覧(Server Component, RLS依存)
    [id]/page.tsx            問い合わせ詳細(Server Component)
    faq/page.tsx             FAQ管理(一覧・追加・編集・削除、非エンジニア向け)
    settings/page.tsx        通知メールアドレス・営業時間設定(非エンジニア向け)
  api/
    chat/route.ts            顧客メッセージ送信のコアロジック(分類→FAQ検索→エスカレーション判定→回答生成)
    chat/escalate/route.ts   顧客からの「オペレーターに相談」ボタン
    admin/faq/route.ts       FAQ一覧取得・新規追加(Embedding自動生成)
    admin/faq/[id]/route.ts  FAQ更新(Embedding再生成)・削除
    admin/settings/route.ts  通知メールアドレス・営業時間の取得・更新
    admin/reply/route.ts     オペレーター返信
    admin/status/route.ts    ステータス変更(対応中/完了)
    health/route.ts          ヘルスチェック(knowledge_items件数を返す)

components/
  chat/        顧客チャットUI(ChatWindow, MessageBubble, StatusBanner)
  admin/       管理画面UI(ConversationList, ConversationDetail, AdminMessageBubble, LoginForm, LogoutButton, FaqManager, SettingsForm)

lib/
  ai/
    classify.ts       Claude Haikuで問い合わせをカテゴリ分類+質問分解+action判定
    respond.ts        Claude SonnetでFAaiベース回答を生成
    escalate.ts       エスカレーション要否の判定ロジック(ビジネスルールの中核)
    business-hours.ts 営業時間判定(app_settingsから取得。MOCK_NOWで「現在時刻」のみ開発時上書き可能)
    client.ts         Anthropicクライアント初期化
  rag/
    embed.ts          Voyage AIでEmbedding生成(query/document)
    search.ts         pgvectorのRPC(match_knowledge_items)呼び出し・複数質問のマージ
  supabase/
    client.ts         ブラウザ用Supabaseクライアント(@supabase/ssr, Cookie連携)
    server.ts         Server Component/Route Handler用(Cookie読み書き)
    admin.ts          service roleクライアント(RLSバイパス、API Route内でのみ使用)
    require-operator.ts  管理画面の認可ガード
    cookie-options.ts 本番のみCookieをSameSite=None; Secureにする(Shopify等へのiframe埋め込み対応)
  resend/notify.ts    エスカレーション発生時のメール通知
  labels.ts           カテゴリ/ステータスの日本語ラベル

types/
  database.ts   Supabaseテーブル型・Database型定義(手書き。生成コマンドは未整備)
  chat.ts       API入出力・EscalationDecision型
  faq.ts        FAQ CSV/レコード型

supabase/migrations/  DBマイグレーション(6ファイル、番号順に適用)
scripts/import-faq.ts FAQ CSV→Embedding生成→knowledge_items全洗い替え投入(初期シード用、現在は/admin/faqが正の更新経路)
data/faq.csv           FAQ初期シードデータ(以後の実運用データはknowledge_itemsテーブルが正)
proxy.ts                Next.js 16のmiddleware相当(旧middleware.ts)。Supabaseセッションcookieのリフレッシュ
public/widget.js        ECサイト等へ埋め込む1行スクリプト本体(下記セクション11参照)
docs/HANDOFF.md         本ドキュメント
case4-test-conversations.csv  統合テストシナリオ(8件、後述)
teigisyo / teiansyo     クライアントから提供された定義書・提案書(要件の一次情報源)
```

## 3. データモデル

`supabase/migrations/0002_tables.sql` で定義。

- `conversations`: `id`, `customer_id`(auth.users参照), `status`, `category`, timestamps
  - status: `ai_active` | `waiting_operator` | `operator_active` | `completed`
  - category: `return_exchange` | `product_question` | `general_question` | `complaint` | `undetermined`
- `messages`: `id`, `conversation_id`, `sender`(`customer`|`ai`|`operator`), `content`, `created_at`
- `knowledge_items`: `id`, `question`, `answer`, `category`, `embedding vector(512)`, `created_at`
- `operators`: `id`(auth.users参照), `email`, `name`, `role`
- `app_settings`: `id`(常に1固定の単一行), `escalation_emails`(`text[]`、`0009`で単一文字列から配列化), `business_start_hour`, `business_end_hour`, `updated_at`(`0008_app_settings.sql` / `0009_escalation_emails_array.sql`)

RPC: `match_knowledge_items(query_embedding, match_count)` — pgvectorのコサイン類似度検索(`0004_match_function.sql`)。

### RLS (Row Level Security)

`0003_rls_policies.sql` で全テーブルにRLSを有効化。要点:

- `conversations`/`messages`: 顧客は `customer_id = auth.uid()` の自分の行のみselect/insert可能。オペレーターは`operators`テーブルに存在すれば全件select可能(update/insertも同様に権限分岐)。
- `knowledge_items`: 顧客(anon/authenticated、operators非該当)からは引き続き一切アクセス不可(デフォルト拒否)。FAQ検索(`/api/chat`)は必ず`lib/supabase/admin.ts`のservice roleクライアント経由で行う設計。一方`0007_knowledge_items_operator_crud.sql`でoperatorsには全CRUD権限を付与済みで、`/api/admin/faq*`はCookieベースの通常クライアント+RLSでオペレーター限定アクセスを担保している(`/api/admin/reply`等と同じパターン)。
- Supabase Realtimeの`postgres_changes`もRLSに従う。**実際にAブラウザ→B別セッションで購読しても他人のメッセージが届かないことを検証済み**(下記セクション6参照)。

`0005_security_hardening.sql`でpgvector拡張のスキーマ移動、関数のsearch_path固定などLinter指摘への対応済み。
`0006_realtime.sql`で`messages`/`conversations`をRealtime publicationに追加。
`app_settings`も同様にoperators限定のselect/update RLSポリシーを持つ(insert/deleteは不可、id=1の単一行をUPDATEのみで運用する設計)。

## 4. コアフロー: `POST /api/chat` (`app/api/chat/route.ts`)

1. Cookieから顧客の匿名認証セッションを取得(未認証なら401)
2. リクエストをzodでバリデーション
3. `conversationId`があれば既存会話を取得(customer_id一致を確認)、なければ新規作成
4. 顧客メッセージをservice roleクライアントで`messages`にinsert
5. 会話が既に`ai_active`でない(＝既に有人対応済み)場合、AIは処理せず定型の受付メッセージのみ返す
   - **重要な仕様**: 一度有人対応にエスカレーションした会話は、以後AIが一切介入しない(定義書「9. 有人対応条件」)。同じ会話内でFAQで答えられる質問を送っても定型文しか返らないのは仕様。新しい会話(ページリロード)なら通常通りAIが応答する。
6. `analyzeInquiry()` (Claude Haiku)でカテゴリ分類・質問分解・action判定
7. `complaint`/`undetermined`/`return_exchange`+action の場合はFAQ検索自体をスキップ(Embedding APIコール節約)
8. それ以外は`searchKnowledgeItemsForQuestions()`でFAQをベクトル検索
   - **フォールバック**: この呼び出しが例外を投げた場合(Voyage AIの障害・レート制限など)、500エラーにせず`search_unavailable`理由で有人対応へエスカレーションする(`d59a8fe`で修正)
9. `decideEscalation()`でエスカレーション要否を判定(閾値: 類似度0.5未満は低信頼度として有人対応。元は0.6だったが実測比較の上で変更、詳細はescalate.tsのコメントとセクション6参照)
10. エスカレーションする場合: ステータス更新→定型応答をinsert→`notifyEscalation()`でResendメール送信
11. しない場合: `generateAnswer()` (Claude Sonnet)でFAQ+会話履歴を元に回答生成→insert
    - **フォールバック**: `analyzeInquiry()`・`generateAnswer()`もAnthropic API側の過負荷(529)や認証エラーで失敗し得る。両方ともtry/catchし、失敗時は`ai_unavailable`理由で有人対応へエスカレーションする共通ヘルパー`escalateConversation()`を使う(以前はここが未処理で500エラーになっていた)

## 5. 環境変数

`.env.local.example` 参照。本番(Vercel)では以下の方針で登録済み:

| 変数 | 種別 | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Config | ブラウザに公開される前提の値 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | 同上。Vercel CLIは「credentialらしき値」として警告するが、RLSで保護される設計上公開して問題ない |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | RLSを全てバイパスする。サーバーサイド(API Route)以外で絶対に使わないこと |
| `ANTHROPIC_API_KEY` | Secret | |
| `VOYAGE_API_KEY` | Secret | 後述の既知の制約あり |
| `RESEND_API_KEY` | Secret | |
| `ESCALATION_EMAIL_TO` | Secret | **未使用(レガシー)**。通知先は`app_settings.escalation_emails`(複数登録可、`/admin/settings`で編集)に移行済み。削除して問題ない |
| `NEXT_PUBLIC_APP_URL` | Config | 通知メール内リンクの生成に使用。本番URL確定後に設定必須 |
| `MOCK_NOW` | 開発専用 | 営業時間判定のテスト用時刻上書き。**本番では絶対に設定しないこと** |

Vercelへの環境変数登録時のハマりどころ: `vercel env add` に値を標準入力パイプで渡す(`echo value \| vercel env add ...`)方式は対話プロンプトの状態がずれて別の変数の値が混入する不具合を実際に踏んだ。**必ず `--value` フラグで明示的に渡すこと**。

## 6. これまでに実施した検証

すべて実機(ローカルdevサーバー / 本番Vercel)で確認済み。自動テストコードとしては存在しないため、大きな変更時は同様の手動/スクリプト検証を推奨。

- `case4-test-conversations.csv` の8シナリオ全て合格(FAQ自動応答×3、エスカレーション×2、ハルシネーション抑制、営業時間外、複数質問FAQ参照)
- RLS: 別セッション(別の匿名顧客)から他人の`conversations`/`messages`をREST APIで直接読もうとして空配列が返ること、オペレーターへのなりすましinsertが403で拒否されることを確認。加えて、**顧客が`operators`テーブルへ自己昇格しようとする攻撃**(403で拒否)、**自分の会話の`status`を直接UPDATEしようとする攻撃**、**自分のメッセージを事後改ざん・削除しようとする攻撃**(いずれも0行更新で無害化されることをservice role経由で確認)もテスト済み
- Realtime: 顧客Bのチャンネル購読では顧客Aの新着メッセージが届かないことを確認(RLSがRealtimeにも効いている)
- 管理画面: ログイン→返信→ステータス変更(対応中/完了)→顧客側へのRealtime即時反映を一通り確認
- Voyage AI障害時のフォールバック: APIキーを意図的に無効化し、500ではなく有人対応への正常なエスカレーションになることを確認
- Anthropic API障害時のフォールバック: 同様にAPIキーを無効化し、`analyzeInquiry`/`generateAnswer`どちらの失敗経路でも500にならず`ai_unavailable`で有人対応へ切り替わることを確認
- Realtime切断・再接続: `context.setOffline()`でオフラインを再現し、切断中にDBへ直接挿入されたメッセージが再接続後の`resync()`で正しく復元されることを確認。またメッセージ送信中に再接続が重なっても自分の発言が消えない(送信完了を待ってからresyncする)ことも回帰確認済み
- **AI応答精度の定量評価**: FAQ18問の言い換え質問(recall検証)+FAQ外8問(precision/ハルシネーション検証)、計26問で測定。
  - 類似度閾値0.6: recall 12/18(66.7%)、precision 8/8(100%、ハルシネーションなし)
  - 類似度閾値0.5(採用): recall 16/18(88.9%)、precision 7/8がクリーンにエスカレーション。残り1件(「芸能人起用」質問)はハルシネーションはしていない(AIが「FAQに記載がなくお答えできかねます」と正直に回答)が、会話ステータスが`ai_active`のままで有人対応に自動で切り替わらないという運用上の抜け穴が判明。顧客が自分で「オペレーターに相談」を押さない限り放置される。recall改善(+4件)の方が大きいと判断し0.5を採用したが、この抜け穴は未解消(セクション10参照)
- FAQ管理画面(`/admin/faq`): 追加・編集したFAQが実際にRAG検索(`/api/chat`)から即座に参照されること、削除したFAQが検索されなくなること、非operator(匿名顧客)からは引き続き`knowledge_items`に一切アクセスできないことを実機で確認済み
- 通知・営業時間設定画面(`/admin/settings`): 営業時間を0-24時に変更するとエスカレーション文言の「営業時間外」案内が実際に消えること、通知先メールアドレスの変更が保存・反映されることを確認済み(確認後、本番データは元の値に復元済み)
- 通知先メールアドレスの複数登録(`escalation_emails`配列): 管理画面から2件登録・保存できること、エスカレーション時に配列がResend APIへ正しく渡ることを確認済み(2件目はResendのサンドボックス制限で実際の送信は422になったが、実装自体の問題ではない。確認後、本番データは1件に復元済み)
- チャットウィジェット(`public/widget.js`): 別オリジンのページへの埋め込み・iframe開閉・チャット送受信・親ページリロード後のセッション永続化(Chromium/WebKit)・本番ビルドでのCookie属性(`SameSite=None; Secure`)を確認済み(詳細はセクション11)。**実際のShopify開発ストアへの埋め込みも実施し、ボタン表示からFAQ自動応答までEnd-to-Endで動作確認済み**(ストアのパスワード保護ページ通過を含む)
- 問い合わせ一覧のRealtime表示(`ConversationList`): 別セッションで新規会話を作成すると、一覧画面をリロードせずにトップへ即座に反映されることを確認済み。オフライン中に作成された会話も、再接続後のresyncで一覧に反映されることを確認済み

## 7. 既知の制約・技術的負債

- **Voyage AIのレート制限**: 支払い方法未登録だと3RPM/10K TPMに制限される。本番運用前に必ず支払い方法を登録すること(でないと軽い同時アクセスでもFAQ検索が失敗し、有人対応への意図しないフォールバックが多発する)。
- **Supabase匿名サインインのレート制限**: デフォルト30回/時間/IP。クライアントの判断で現状維持だが、実トラフィックが増えたら`Authentication > Rate Limits`で引き上げが必要。
- **React StrictModeでの匿名サインイン二重発火**: `components/chat/ChatWindow.tsx`で`useRef`ガードにより修正済み(修正前は開発時にレート制限を無駄に消費し、「セッション開始に失敗しました」の原因になっていた)。
- **オペレーターの自己登録UIなし**: 意図的な設計(README/定義書に明記)。追加はSupabase Studioでの手動作業が必要(運用マニュアル参照)。
- **`types/database.ts`は手書き**: `supabase gen types typescript`等での自動生成に切り替えると、マイグレーション変更時の型ズレを防げる。
- **自動テスト(unit/e2e)が存在しない**: 現状は手動検証のみ。CI導入時はPlaywright等でのe2eテスト整備を推奨。
- **`/admin/faq`での変更は`data/faq.csv`に反映されない**: `knowledge_items`テーブルが実運用データの正となり、CSVは初期シード時点のスナップショットのまま残る。CSVをバックアップ目的で最新化したい場合は、別途エクスポート機能を実装するか手動でテーブル内容をコピーする必要がある。
- **Resendの送信元が`onboarding@resend.dev`のまま**: Resendの無料/未検証ドメイン状態だと、実在しないテストドメイン宛のメールなどで送信が拒否される制限がある(実際に踏んだ)。実在するメールアドレス宛であれば通常問題ないが、本番運用では独自ドメインを検証してから送信元に設定することを推奨。

## 8. デプロイ

- GitHubリポジトリ(`main`ブランチ)とVercelプロジェクトが連携済み。`main`へのpushで自動的にProduction Deploymentが作成される。
- 個別デプロイURL(`cs-chatbot-xxxxxxxxx-....vercel.app`)は各デプロイごとに固有かつ恒久的に残る点に注意。**常に`https://cs-chatbot-green.vercel.app`(または独自ドメイン設定後はそのドメイン)を正としてアクセスすること**。個別デプロイURLはVercelのDeployment ProtectionによりSSO認証が必要。
- 環境変数を変更した場合、既存のデプロイには反映されないため、Vercelダッシュボードから明示的に`Redeploy`する必要がある。

## 9. ローカル開発

```bash
npm install
cp .env.local.example .env.local   # 値を設定
npm run dev                        # http://localhost:3000
npm run import:faq                 # data/faq.csvをknowledge_itemsへ反映
```

DBマイグレーションはSupabase CLIでリモートにリンクして`supabase db push`、
またはSupabase StudioのSQL Editorで`supabase/migrations/`配下を番号順に実行。

## 11. 顧客向けチャットウィジェット(ECサイトへの埋め込み)

`/chat`ページをiframeで埋め込む形の、1行スクリプト方式のウィジェットを`public/widget.js`として提供している。

### 仕組み

1. 埋め込み先のサイトに以下の1行を追加してもらう。
   ```html
   <script src="https://cs-chatbot-green.vercel.app/widget.js"></script>
   ```
2. `widget.js`は自身の`<script src>`から自分のオリジンを特定し(`document.currentScript`)、画面右下に丸い吹き出しボタンを注入する。
3. ボタンクリックで`{origin}/chat`を指す`<iframe>`を開閉する(初回クリック時に`src`をセットして遅延読み込み)。
4. モバイル(幅480px以下)ではiframeが全画面表示になる。

### クロスオリジン対応(Cookie)

顧客の匿名認証セッションはCookieで管理されているため、埋め込み先(例: Shopifyストア)とアプリ本体(Vercel)が別オリジンになるiframe埋め込みでは、Cookieの`SameSite`属性が重要になる。

- `lib/supabase/cookie-options.ts`で本番環境のみ`SameSite=None; Secure`を設定している(`lib/supabase/client.ts`・`server.ts`・`proxy.ts`の3箇所で共通利用)。
- ローカル開発(`NODE_ENV !== "production"`)ではこの設定を無効化し、通常の`Lax`のままにしている(`Secure`属性はHTTPS必須で、`http://localhost`での挙動がブラウザにより不安定なため)。
- **既知の制約**: SafariのITP(Intelligent Tracking Prevention)は、Cookie属性に関わらずサードパーティCookieを既定でブロックする。そのため、Safari上でShopify等に埋め込んだ場合、ページ再読み込みのたびに匿名認証がやり直しになる(セッションが永続化されない)可能性が高い。Chrome/Edge/Firefoxでは現時点で問題なく永続化されることを確認済み(下記セクション6参照)。この制約を完全に解消するには、トップレベルでの認証リダイレクトフローやStorage Access APIの利用など、より大きな設計変更が必要。

### 検証済みの内容

- 別オリジン(ポート違いでシミュレート)のHTMLページに埋め込み、ボタン表示→iframe展開→チャット送受信→FAQ自動応答表示までEnd-to-Endで動作することを確認
- 親ページのリロードをまたいでセッション(匿名認証)が保持され、匿名サインインが再実行されないことをChromium・WebKit(Playwright)の両方で確認
- 本番相当のビルド(`npm run build && npm run start`)で、実際にCookieが`SameSite=None; Secure`属性で発行されることを確認
- **Shopify開発ストア(`theme.liquid`に`</head>`直後で埋め込み)で実際に検証済み**: パスワード保護ページの通過、チャットボタン表示、メッセージ送受信、FAQ自動応答までEnd-to-Endで確認。なお`{% style %}`ブロック内など誤った位置に貼ると`<script>`がCSSテキストとして無視され動作しないため、`</head>`直後または`<body>`直前への設置が必要(実際にこの配置ミスを一度経験した)。
- **未検証**: 実Safari(Playwright付属のWebKitではなくApple製Safari本体)でのITP挙動。

### Shopifyへの導入手順(概要)

1. Shopify管理画面 → 「オンラインストア」→「テーマ」→ 使用中のテーマの「…」→「コードを編集」
2. `Layout`フォルダの`theme.liquid`を開く
3. `</body>`の直前に上記の`<script>`タグを追加して保存
4. 実際のストアを開き、右下にチャットボタンが表示されることを確認

## 12. 今後の改善候補

- Voyage AI検索失敗時のリトライ/バックオフ実装(現状は1回失敗即エスカレーション)
- オペレーター管理UI(自己登録・一覧・削除)の追加
- 自動テスト(e2e)のCI組み込み
- `types/database.ts`の自動生成化
- **AIが自ら回答を断ったのに有人対応へ切り替わらない抜け穴の解消**: `generateAnswer()`の出力に「オペレーターにご確認」等の断り文言が含まれる場合、事後的に`waiting_operator`へ強制エスカレーションする仕組みを追加する(セクション6のprecision検証で発見、未実装)
- **会話検索機能**: `/admin`の一覧画面にキーワード/日付での検索・絞り込みが未実装(Realtime表示は`ConversationList`で対応済み)
- **Safari ITP対応**: サードパーティCookieブロックにより、Safari上でのウィジェット埋め込みではセッションが永続化されない制約が残る
