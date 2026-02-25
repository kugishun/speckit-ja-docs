了解。いただいた内容をそのまま **specKit に渡せる「指示」**として、**アクター / アクション / データ / 制約**で切って書き起こします（ローカル想定 / Next.js + Supabase / Discord Webhook）。

---

## specKit向け指示案（Actors / Actions / Data / Constraints）

### 目的

実決済は行わない「簡単な決済デモ」を作る。ユーザーが商品を選び、擬似的に支払い完了にすると、**Discord Webhookへ通知**し、完了画面を表示する。
取引情報は **Supabase** に保存する。ローカル環境で動作する。

---

## Actors（アクター）

### User（ユーザー）

* ログインして商品を選択し、擬似決済を完了できる
* 決済完了後に完了画面を閲覧できる

### Admin（管理者）

* ログインして取引一覧を確認できる（最低限：一覧表示）
* 必要に応じて通知失敗取引の状況確認ができる（詳細は後述の制約で拡張）

---

## Actions（アクション / 画面と処理フロー）

### 認証

1. ユーザー/管理者はログインできる
2. 未ログイン状態では決済関連ページにアクセスできない

（Supabase Auth を利用。ロールは user_metadata などで判別）

### ユーザーのフロー

1. **商品選択画面**

   * 商品一覧を表示
   * 商品を選択して「決済へ」

2. **決済画面**

   * 選択した商品の情報（商品名、金額JPY）を表示
   * 「支払い確認へ」

3. **支払い確認画面**

   * 商品名・金額・ユーザー名を確認
   * 「支払い完了」ボタンで擬似決済を確定

4. **支払い完了処理（サーバー側）**

   * 取引レコードを Supabase に作成

     * 取引IDを生成
     * ステータスを更新しながら進める（例：pending → succeeded）
   * Discord Webhook に通知を送信（取引ID・金額・商品名）
   * 通知結果を取引レコードに反映（通知成功/失敗、リトライ回数など）

5. **完了画面**

   * 取引結果（成功）と取引IDを表示
   * Discord通知の状態も表示（成功/失敗/再試行中）

### 管理者のフロー

1. **取引一覧画面**

   * 取引（payments）を時系列で一覧表示
   * ステータスと通知状態が確認できる

---

## Data（データ設計）

### Supabase テーブル：`payments`

保持する項目（必須）

* `id`（UUID or 取引IDの主キー）
* `transaction_id`（表示用の取引ID：ユニーク）
* `user_id`（auth.uid 参照）
* `user_name`（表示名。Authプロフィールから取得して保存）
* `product_name`
* `amount_jpy`（integer）
* `status`（例：`pending` / `succeeded` / `failed`）
* `created_at`（timestamp）

Discord通知に必要な項目

* `transaction_id`
* `amount_jpy`
* `product_name`

（※通知リトライ用の列は Constraints で拡張定義）

### 商品データ

* 最小実装：`products` テーブル or 静的JSON
* 各商品：`product_name`, `amount_jpy`

（ローカルデモなら静的でもOK）

---

## Constraints（制約 / 技術・運用・セキュリティ）

### 技術スタック

* Next.js（App Router想定）
* Supabase（DB + Auth）
* Discord 通知は Webhook
* ローカル環境前提（`.env.local` に Supabase URL/KEY と Webhook URL を置く）

### セキュリティ / 権限

* Discord Webhook URL は **クライアントに露出させない**（サーバー側の API route / server action 経由）
* RLS を有効化

  * ユーザーは自分の取引のみ閲覧可能
  * 管理者は全取引閲覧可能

### Discord通知（Webhook）とリトライ

* Discord通知は「取引作成後」に送る
* 送信失敗時はリトライする
* リトライの詳細（回数・間隔・上限）を決める必要があるので、いったん以下を仮仕様として実装する：

  * 最大リトライ回数：3回
  * リトライ間隔：指数バックオフ（例：5s / 15s / 45s）
  * 最終的に失敗なら「通知失敗」として管理画面に表示

### 同時アクセス

* 想定しない（ロックや高負荷対策は不要）

---

了解。**Discord通知は payments と分離**して、リトライ仕様を確定した「指示（specKit向け）」を出します。ローカル前提なので、**DBで状態管理 + 手動再送 + 簡易バックオフ**が実装しやすく、デモとしても見栄えがします。

---

## Discordリトライ仕様（確定版）

### 方針

* 擬似決済（payments）は **Discord通知の成功/失敗に関わらず成功扱い**にできる（通知は別管理）
* Discord通知は **別テーブル `discord_notifications`** で管理する
* 通知は **サーバー側のみ**が Webhook を叩く（Webhook URL は秘匿）

---

## Data（通知用の別テーブル）

### `discord_notifications`（1 payment に対して 1件を基本）

* `id` UUID（PK）
* `payment_id` UUID（FK → payments.id、ユニーク制約：1決済につき1通知）
* `status` enum/text

  * `queued`（送信待ち）
  * `sending`（送信中ロック）
  * `sent`（送信成功）
  * `retrying`（リトライ待ち）
  * `failed`（最終失敗）
* `attempt_count` int（初期0、送信実行ごとに +1）
* `max_attempts` int（固定：**5**）
* `next_attempt_at` timestamp（次の送信予定時刻）
* `last_attempt_at` timestamp
* `last_error` text（HTTPコードやエラー概要）
* `webhook_url_hash` text（任意：Webhookを直接保存せず、設定識別のためのハッシュだけ）
* `created_at` timestamp
* `updated_at` timestamp

> Discordへ送る内容（取引ID・金額・商品名）は、`payments` を join して組み立てる（通知テーブルに重複保存しない）。

---

## Actions（通知のライフサイクル）

### 1) 決済完了時の処理

* payments を作成（status=succeeded）
* `discord_notifications` を作成

  * `status=queued`
  * `attempt_count=0`
  * `max_attempts=5`
  * `next_attempt_at=now()`（即時送信対象）

### 2) 送信ワーカー（ローカル）

ローカル想定なので、どちらかで実装（どちらでもOK）：

* (推奨) Next.js のサーバー側で **「ポーリングAPI + クライアントの定期呼び出し」**

  * 管理画面（または完了画面）が開いている間、一定間隔で `/api/discord-notify/dispatch` を叩く
* または Node の簡易スクリプト（`npm run worker`）で定期実行

### 3) dispatch の対象

* `status in (queued, retrying)` かつ `next_attempt_at <= now()` のレコードを取得
* 取得したら **sending に更新してロック**（二重送信防止）
* Discord Webhook 送信（payment を join して本文作成）
* 結果でステータス更新

---

## Retry（リトライ）仕様

### 最大試行回数

* **max_attempts = 5**
* `attempt_count` が 5 に達したら `failed` で終了

### リトライ間隔（指数バックオフ）

* 1回目失敗：+10秒
* 2回目失敗：+30秒
* 3回目失敗：+90秒
* 4回目失敗：+300秒
* 5回目失敗：終了（failed）

（配列で固定して実装すると簡単：`[10, 30, 90, 300]`）

### 成功条件

* Discord Webhook が **2xx** を返したら `sent`
* それ以外（4xx/5xx/ネットワークエラー）は失敗扱い

  * ただし **4xxでも一律リトライ**（デモ用に単純化）
  * `last_error` に `status code + response snippet` を保存

### 再送（手動）

* 管理者は `failed` の通知を **手動で再キュー**できる

  * `status=queued`
  * `attempt_count=0`（または維持しても良いが、デモは0リセットが分かりやすい）
  * `next_attempt_at=now()`
  * `last_error` をクリア

---

## Constraints（権限 / RLS）

### 読み取り

* ユーザー：自分の payment に紐づく通知のみ閲覧可
* 管理者：全件閲覧可

### 書き込み

* `discord_notifications` の作成：決済完了サーバー処理のみ
* `dispatch` による status 更新：サーバーのみ（Service role key 使用）
* 手動再送：管理者のみ

---


