# クイックスタート: ユーザーチェックアウト開発ガイド

**対象**: 開発者向けローカル開発セットアップ  
**作成日**: 2026-02-25  
**所要時間**: 15～20 分

---

## 前提条件

- Node.js 18.x 以上
- npm または yarn
- Git
- Docker & Docker Compose（Supabase ローカル開発用）
- テキストエディタ（VS Code推奨）

---

## ステップ 1: リポジトリクローン

```bash
git clone <repository-url> speckit-app
cd speckit-app
git checkout 001-user-checkout
```

---

## ステップ 2: 依存関係のインストール

```bash
npm install
# または
yarn install
```

---

## ステップ 3: Supabase ローカル開発環境セットアップ

### 3.1 Docker Compose で Supabase startup

```bash
docker-compose up -d
```

Supabase が起動します（ポート: 5432 (PostgreSQL), 54321 (API)）。

### 3.2 確認

```bash
curl http://localhost:54321/health
```

`{"name":"supabase","version":"..."}` が返っていれば OK。

### 3.3 Supabase CLI でマイグレーション実行

```bash
npm install -g supabase
supabase db push
```

これにより、`data-model.md` で定義したテーブル（products, payments）が作成されます。

---

## ステップ 4: 環境変数設定

### 4.1 `.env.local` ファイル作成

```bash
cp .env.example .env.local
```

### 4.2 ``.env.local` を編集

```dotenv
# Supabase ローカル開発用
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>  # Supabase コンソールから取得

# Service Role Key（サーバーサイド用）
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>  # Supabase コンソールから取得

# Discord Webhook URL（テスト用には mock URL でも可）
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
```

### 4.3 キーの取得方法

Supabase コンソール (http://localhost:54321) にアクセス:
1. Project Settings → API
2. `Project URL` を `NEXT_PUBLIC_SUPABASE_URL`に
3. `anon public` キーを `NEXT_PUBLIC_SUPABASE_ANON_KEY` に
4. `service_role secret` キーを `SUPABASE_SERVICE_ROLE_KEY` に

---

## ステップ 5: テスト用サンプルデータ挿入

### 5.1 SQL エディタで初期データ挿入

Supabase コンソール (http://localhost:54321) → SQL Editor:

```sql
-- 商品マスタ初期データ
INSERT INTO public.products (product_name, amount_jpy) VALUES
  ('スタータープラン - ¥1,000', 1000),
  ('プロプラン - ¥2,500', 2500),
  ('エンタープライズプラン - ¥5,000', 5000);
```

実行をクリック。

### 5.2 確認

Supabase コンソール → Table Editor → products タブで商品が表示されていることを確認。

---

## ステップ 6: ローカルサーバー起動

```bash
npm run dev
```

ターミナルに以下が出力されます:

```
▲ Next.js 15.x (Standalone)
  ▲ Ready in 2.5s
  ▲ Local:        http://localhost:3000
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセス。

---

## ステップ 7: チェックアウトフロー動作確認

### 7.1 ユーザー登録

Supabase Auth (Supabase コンソール → Authentication) で新規ユーザー作成:

```
Email: test@example.com
Password: securepassword123
User Metadata: { "display_name": "太郎" }
```

### 7.2 ログイン

ブラウザで `/auth/login` にアクセスし、登録したメール/パスワードでログイン。

### 7.3 商品選択

ログイン後、`/checkout` にリダイレクト。商品一覧が表示されること確認。

### 7.4 商品選択 → 決済 → 確認 → 完了

1. 商品を選択 → 「決済へ」
2. 商品情報確認 → 「支払い確認へ」
3. 最終情報確認 → 「支払い完了」

成功すると **取引ID が表示**、完了画面で **Discord 通知ステータスがポーリング表示**されます。

### 7.5 データベース確認

Supabase コンソール → Table Editor → payments タブで新規取引レコード作成を確認。

---

## ステップ 8: 開発時よく使うコマンド

### サーバー起動

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

### テスト実行

```bash
npm run test
```

### Linter & Format

```bash
npm run lint
npm run format
```

### Supabase マイグレーション作成

```bash
supabase migration new <migration_name>
```

### Supabase コンソールアクセス

```bash
supabase studio
```

---

## ステップ 9: トラブルシューティング

### 症状: `NEXT_PUBLIC_SUPABASE_URL is undefined`

**原因**: `.env.local` ファイルが読み込まれていない

**解決策**:
1. `.env.local` のパスが正しいか確認（プロジェクトルート）
2. `npm run dev` を再起動
3. ブラウザキャッシュクリア

### 症状: `RLS policy violation`

**原因**: Service Role Key が設定されていない

**解決策**:
1. `SUPABASE_SERVICE_ROLE_KEY` を `.env.local` に追加
2. サーバー側のコードが Service Role キーを使っているか確認

### 症状: Discord Webhook エラー

**原因**: Webhook URL が無効または存在しない

**解決策**: 
- ローカル開発時は無効な URL でも動作確認可能（エラーはロック）
- テスト通知は管理画面で通知テーブルを確認

### 症状: RLS ポリシーのため Payment が見えない

**原因**: 別ユーザーで作成した取引にアクセス

**解決策**: 同一ユーザーでログインし直すか、Supabase Console で直接確認

---

## ステップ 10: 開発リワークフロー（推奨）

### コンポーネント開発

```bash
# 1. コンポーネント作成
# components/ProductList.tsx

# 2. 単体テスト作成
# tests/unit/components/ProductList.test.tsx

# 3. テスト実行
npm run test -- ProductList.test.tsx

# 4. ブラウザで手動確認
# http://localhost:3000/checkout
```

### Server Action 開発

```bash
# 1. Server Action 作成
# app/checkout/payment/confirm/actions.ts

# 2. 統合テスト作成
# tests/integration/checkout-flow.test.ts

# 3. ローカルで手動フローテスト
# http://localhost:3000/checkout → 商品選択 → 最後まで進める

# 4. Supabase で Payment レコード確認
```

### API エンドポイント開発

```bash
# 1. API ルート/Server Action 作成
# app/api/products/route.ts

# 2. コントラクトテスト作成
# tests/contract/api-products.test.ts

# 3. curl でテスト
curl http://localhost:3000/api/products

# 4. テスト実行
npm run test -- api-products.test.ts
```

---

## ステップ 11: 次のステップ

- ✅ ローカル開発環境セットアップ完了
- ⬜ 実装タスク実行（`/speckit.tasks` にて生成予定）
- ⬜ PR 作成 & レビュー
- ⬜ ステージング環境デプロイ

詳細は [tasks.md](tasks.md)（Phase 2, `/speckit.tasks` で生成）参照。

---

## 便利なリソース

| リソース | URL | 説明 |
|---------|-----|------|
| **Next.js ドキュメント** | https://nextjs.org/docs | フレームワーク公式 |
| **Supabase ドキュメント** | https://supabase.com/docs | DB + Auth 公式 |
| **React ドキュメント** | https://react.dev | UI ライブラリ公式 |
| **TypeScript ハンドブック** | https://www.typescriptlang.org/docs | 型定義参考 |
| **Supabase ローカル設定** | https://supabase.com/docs/guides/local-development | ローカルセットアップ詳細 |

---

## 質問 & サポート

- **技術的支援**: 仕様書 spec.md, 計画 plan.md, 研究 research.md 参照
- **API詳細**: contracts/ 配下のコントラクトファイル参照
- **データ設計**: data-model.md 参照

---

**クイックスタート完了**: 🎉 これでローカル開発環境が整いました。
Happy coding!
