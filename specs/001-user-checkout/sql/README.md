# SQL 初期化スクリプト

場所: `specs/001-user-checkout/sql/init_schema.sql`

目的:
- `products`, `payments`, `discord_notifications` テーブルの作成
- RLS（Row-Level Security）ポリシーの有効化と設定
- 初期データ（3 商品）の挿入

使い方 (Supabase Console):

1. Supabase プロジェクトにログインします: https://app.supabase.com
2. 対象プロジェクトを選択
3. 左メニューの `SQL` → `New query` を開く
4. `specs/001-user-checkout/sql/init_schema.sql` の中身をコピーしてエディタに貼り付ける
5. `RUN` をクリックしてスクリプトを実行

注記:
- RLS ポリシーを有効化しますが、サービス側の挿入（Server Action 等）は **Service Role Key** を使用して行ってください。
  Service Role Key を使うと RLS をバイパスして挿入できます。キーは `.env.local` に設定してください（`SUPABASE_SERVICE_ROLE_KEY`）。
- `pgcrypto` 拡張を利用して UUID を生成します。もし拡張が利用できない環境では管理者にご確認ください。
- 実行後、`public.products` に初期商品が挿入されます。

トラブルシュート:
- 実行に失敗する場合は SQL エラーメッセージを確認し、RLS を有効化する権限があるか（プロジェクトオーナー）を確認してください。
- `auth.uid()` を参照するポリシーは Supabase のユーザートークンでのクエリ時に機能します。サービス側でのクエリは Service Role Key を利用してください。

次のステップ:
- スクリプト実行後、`app/api/products/route.ts` と連携して動作確認を行ってください（`curl` またはブラウザで `/api/products` を確認）。
