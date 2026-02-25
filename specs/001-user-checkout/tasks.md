# 実装タスク: ユーザーチェックアウト機能

**生成日**: 2026-02-25  
**ブランチ**: `001-user-checkout`  
**出力**: `/speckit.tasks` コマンド  
**対象ドキュメント**: spec.md, plan.md, research.md, data-model.md, contracts/

---

## 概要

本タスク分解は以下のドキュメント群から生成されました：
- **spec.md**: 3 ユーザーストーリー（P1×1, P2×2）、8 機能要件、6 成功基準
- **plan.md**: Next.js App Router + Supabase + Server Action アーキテクチャ
- **research.md**: 10 技術決定、実装パターン、セキュリティガイドライン
- **data-model.md**: 3 エンティティ（User, Product, Payment）、SQL スキーマ、RLS ポリシー
- **contracts/**: 2 API コントラクト（GET /api/products, GET /api/notifications/:id）

**総タスク数**: 58 タスク  
**推定工数**: 15-20 時間（コア実装 + テスト）  
**MVP スコープ**: Phase 1-3（US1：商品選択・決済フロー）

---

## タスク依存グラフ

```
Phase 1: セットアップ (必須基盤)
    ├─ T001: Next.js プロジェクト生成
    ├─ T002: TypeScript 型定義セットアップ
    ├─ T003-T005: Supabase 初期化（DB, Auth, RLS）
    └─ T006-T007: 環境変数・基本設定
          ↓
Phase 2: API 実装 (全ユーザーストーリーの前提)
    ├─ T008-T012: DB スキーマ初期化・インデックス
    ├─ T013-T018: API エンドポイント実装（products, notifications）
    └─ T019-T022: コントラクトテスト実装
          ↓
Phase 3: US1 実装 (P1 - 主要フロー)
    ├─ T023-T025: UI コンポーネント（ProductList, PaymentForm, Confirmation）
    ├─ T026-T029: Server Action・通知キュー実装
    ├─ T030-T032: 完了画面・ポーリング実装
    ├─ T033-T038: US1 統合テスト実装
    └─ T039: US1 デモ検証
          ├─ (P2 並列実行可)
          │
Phase 4: US2 実装 (P2 - 商品選択画面, 独立テスト可)
    ├─ T040-T042: 商品選択画面詳細テスト
    └─ T043: US2 デモ検証
          ├─ (P2 並列実行可)
          │
Phase 5: US3 実装 (P2 - 支払い確認画面, 独立テスト可)
    ├─ T044-T047: 支払い確認画面詳細テスト
    └─ T048: US3 デモ検証
          ↓
Phase 6: エラーハンドリング & ポーリング
    ├─ T049-T051: エラーシナリオテスト
    ├─ T052-T054: ポーリング・通知ステータステスト
    └─ T055: 端末を越えたポーリング同期
          ↓
Phase 7: QA & Polish
    ├─ T056: 全テストスイート実行
    ├─ T057: パフォーマンス検証（応答時間 1000ms p95）
    └─ T058: デプロイメント準備・ドキュメント完成

並列実行機会:
- US2 と US3 は US1 完了後に並列実装可（独立ストーリー）
- コンポーネント単体テストと API コントラクトテストは並列実行可
```

---

## Phase 1: セットアップ & 基盤

### Phase 概要
プロジェクト初期化、Supabase 認証・DB セットアップ、TypeScript 型定義、環境変数管理。  
**独立テスト方法**: ローカル開発環境でプロジェクト起動確認、`npm run dev` で正常動作確認  
**ゲートウェイ**: すべての後続フェーズの前提条件

### タスク一覧

- [X] T001 Create Next.js 15 project with App Router in `app/` directory
- [X] T002 [P] Configure TypeScript 5.x with strict mode enabled in `tsconfig.json`
- [ ] T003 Initialize Supabase project and obtain credentials (URL, ANON_KEY, SERVICE_ROLE_KEY)
- [X] T004 [P] Create `lib/types.ts` with TypeScript interfaces: User, Product, Payment, and related types per data-model.md
- [X] T005 [P] Create `lib/supabase.ts` Supabase client wrappers (client-side and server-side) per research.md Topic 1
- [X] T006 Create `.env.local` configuration with Supabase credentials and Discord Webhook URL placeholder
- [X] T007 [P] Setup `.gitignore` to exclude `.env.local` and sensitive files per research.md Topic 10
- [X] T008 [P] Create `app/layout.tsx` root layout with Auth wrapper and basic styling
- [X] T009 [P] Setup Supabase Auth session management in `app/layout.tsx` per research.md Topic 1
- [X] T010 [P] Create default error boundary `app/error.tsx` with fallback UI in `components/ErrorBoundary.tsx`

---

## Phase 2: Database & API 基盤

### Phase 概要
Supabase DB スキーマ初期化、RLS ポリシー設定、API エンドポイント実装（読み取り専用）、コントラクトテスト。  
**独立テスト方法**: `npm run test test/contract/` で API スキーマ検証パス確認。カール実行で GET /api/products 応答確認。  
**ゲートウェイ**: Phase 3（US1 実装）の前提条件

### タスク一覧

- [ ] T011 [P] Execute SQL initialization for `products` table with RLS policy "public_read_products" per data-model.md in Supabase Console
- [ ] T012 [P] Execute SQL initialization for `payments` table with RLS policies per data-model.md (users own reads + service insert) in Supabase Console
- [ ] T013 [P] Create and INSERT initial test products into products table (3 products: ¥1000, ¥2500, ¥5000)
- [ ] T014 [P] Create `app/api/products/route.ts` GET endpoint returning available products per contracts/api-products.md
- [ ] T015 [P] Create `app/api/notifications/[paymentId]/route.ts` GET endpoint returning notification status per contracts/api-notifications.md
- [ ] T016 Create `lib/db.ts` query helper functions: fetchProducts(), createPayment(), fetchNotification() for reusable DB access
- [ ] T017 [P] Create `lib/validation.ts` with validation schemas for Product, Payment using Zod/yup
- [ ] T018 [P] Implement error handling in API routes: 401 (auth), 403 (RLS), 404 (not found), 500 (server error) per research.md Topic 7
- [ ] T019 Create unit tests for query helpers in `tests/unit/lib/db.test.ts` - mock Supabase responses
- [ ] T020 Create contract test `tests/contract/api-products.test.ts` - verify response schema, status codes per contracts/api-products.md
- [ ] T021 Create contract test `tests/contract/api-notifications.test.ts` - verify notification status responses per contracts/api-notifications.md
- [ ] T022 Create contract tests for error scenarios: 401 (no auth), 403 (RLS violation), 404 (missing payment)

---

## Phase 3: ユーザーストーリー 1 実装 (P1) - 商品選択・決済フロー

### Phase 概要
5 画面フロー（商品選択 → 決済 → 支払い確認 → 処理 → 完了）の完全実装。Server Action で Payment 作成、ポーリングで Discord 通知ステータス監視。  
**独立テスト方法**: ユーザー認証後、商品選択 → 決済 → 完了画面ナビゲーション確認。Supabase payments テーブルにレコード (status=succeeded) 記録確認。完了画面のトランザクション ID 表示確認。ポーリングで通知ステータス更新確認。  
**成功基準 (spec.md)**: SC-001～SC-006 すべてクリア

### タスク一覧

- [ ] T023 [P] [US1] Create `components/ProductList.tsx` component displaying products with selection capability per plan.md structure
- [ ] T024 [P] [US1] Create `components/PaymentForm.tsx` component for payment amount display with confirmation button
- [ ] T025 [P] [US1] Create `components/ConfirmationStep.tsx` component showing final transaction details (product name, amount, user name)
- [ ] T026 [US1] Create `app/checkout/page.tsx` (Product Selection screen) - Route 1 of 5 per spec.md Story 1
- [ ] T027 [US1] Create `app/checkout/payment/page.tsx` (Payment screen) - Route 2 of 5, shows selected product details
- [ ] T028 [US1] Create `app/checkout/payment/confirm/page.tsx` (Confirmation screen) - Route 3 of 5, final review UI
- [ ] T029 [US1] Create `app/checkout/payment/confirm/actions.ts` Server Action `submitPayment()` calling createPayment() with Service Role key per research.md Topic 1
- [ ] T030 [US1] In submitPayment() action: generate transaction_id (TXN-YYYYMMDD-5CHARS format), insert payment record with status='succeeded' per research.md Topic 6
- [ ] T031 [US1] In submitPayment() action: create discord_notifications queue entry with status='queued' per research.md Topic 4
- [ ] T032 [US1] Create `app/checkout/completed/page.tsx` (Completed screen) - Route 4 of 5, displays transaction_id and status
- [ ] T033 [US1] Create `components/PollingNotification.tsx` component implementing client-side polling (1 sec interval, 60 sec max) per research.md Topic 3
- [ ] T034 [US1] Integrate PollingNotification into CompletedStep component to display Discord notification status lifecycle (queued → sending → sent/failed)
- [ ] T035 [P] [US1] Create navigation flow between screens with client state management (React Context or Client Component state)
- [ ] T036 [P] [US1] Create `tests/integration/checkout-flow.test.ts` - E2E test: login → product selection → payment → completion
- [ ] T037 [P] [US1] Create unit tests `tests/unit/components/ProductList.test.tsx`, `PaymentForm.test.tsx`, `ConfirmationStep.test.tsx` ~80% coverage
- [ ] T038 [P] [US1] Create unit test `tests/unit/lib/transaction-id.test.ts` verifying transaction_id generation format (TXN-YYYYMMDD-5CHARS)
- [ ] T039 [P] [US1] Manual verification: Execute full US1 checkout flow end-to-end; verify payment record in Supabase; verify transaction_id display; verify polling UI update

---

## Phase 4: ユーザーストーリー 2 実装 (P2) - 商品選択画面表示

### Phase 概要
商品選択画面の詳細動作検証（すべての商品表示、正確な金額表示、商品選択時の決済フロー遷移）。  
**独立テスト方法**: 商品選択画面を表示し、3 個すべての商品が一覧表示されることを確認。各商品の商品名・金額が正確に表示されることを確認。1 つ選択して決済フロー遷移確認。  
**成功基準 (spec.md)**: SC-001 (3分以内完了はUS1に依存) 、商品一覧表示精度 100%

### タスク一覧

- [ ] T040 [P] [US2] Create test `tests/integration/product-selection.test.ts` - verify all products displayed with correct names and amounts
- [ ] T041 [P] [US2] Create test for product selection flow - select product → click "決済へ" button → navigate to payment screen
- [ ] T042 [P] [US2] Verify product data persistence: product info passed correctly to payment screen via URL params or Context state
- [ ] T043 [P] [US2] Manual verification: US2 standalone demo - confirm 3 products display correctly; select one; verify transition to payment flow

---

## Phase 5: ユーザーストーリー 3 実装 (P2) - 支払い確認画面表示と完了

### Phase 概要
支払い確認画面での取引情報表示（user_name, product_name, amount）と「支払い完了」クリック後の Payment 作成・ポーリング開始。  
**独立テスト方法**: 支払い確認画面で正確な取引情報表示確認。「支払い完了」クリック → Payment レコード作成確認。完了画面へ遷移確認。transaction_id レスポンス確認。  
**成功基準 (spec.md)**: SC-002 (transaction_id 即座表示), SC-003 (100% 記録), SC-006 (user_name/product_name/amount_jpy 一致)

### タスク一覧

- [ ] T044 [P] [US3] Create test `tests/integration/confirmation-submit.test.ts` - verify "支払い完了" button triggers submitPayment action
- [ ] T045 [P] [US3] Verify transaction data accuracy: user_name, product_name, amount_jpy match input values to DB record
- [ ] T046 [P] [US3] Verify transaction_id response: returned in < 1000ms (p95 target) per spec.md NFR-001, shown immediately on completed screen
- [ ] T047 [P] [US3] Verify payment status consistency: re-querying same transaction_id on completed screen shows same data (SC-002)
- [ ] T048 [P] [US3] Manual verification: US3 standalone demo - confirm confirmation screen details accuracy; submit payment; verify transaction_id display; verify 1-sec polling starts

---

## Phase 6: エラーハンドリング & 通知ポーリング詳細

### Phase 概要
エラーシナリオ（Payment 作成失敗、RLS 違反、ネットワークエラー）、通知ステータス遷移（queued → sending/retrying → sent/failed）、ポーリング最適化。  
**独立テスト方法**: エラーシナリオモック下でエラー画面表示確認。通知ステータス遷移パターン確認。ポーリング停止条件（60秒 or 最終状態）確認。  
**ゲートウェイ**: 本番環境デプロイ前提

### タスク一覧

- [ ] T049 [P] Create error scenario test `tests/integration/payment-error.test.ts` - DB connection failure, RLS violation, Network timeout
- [ ] T050 [P] Modify submitPayment action to catch errors and return { success: false, message: ... } per research.md Topic 7
- [ ] T051 [P] Create `app/checkout/error.tsx` error display screen showing failure reason and "再度お試しください" button per spec.md Scenario エラー
- [ ] T052 [P] Create test `tests/integration/notification-polling.test.ts` - verify polling stops at 60 sec or terminal status (sent/failed)
- [ ] T053 [P] Create test for notification status lifecycle: queued → sending (mock delay) → sent (verify polling stops)
- [ ] T054 [P] Create test for failed notification scenario: max_attempts reached → status=failed → polling displays failure message
- [ ] T055 Create test for cross-tab notification sync - open completed screen in 2 tabs, verify both receive notification update simultaneously

---

## Phase 7: QA & Polish & ドキュメント完成

### Phase 概要
全テストスイート実行、パフォーマンス検証（API 1000ms p95 SLA）、デプロイメント準備、最終ドキュメント化。  
**ゲートウェイ**: ステージング環境 / 本番環境デプロイ

### タスク一覧

- [ ] T056 [P] Execute full test suite: `npm run test` - unit + integration + contract tests all pass with >80% coverage
- [ ] T057 [P] Performance verification: measure API response times (GET /api/products, GET /api/notifications) - confirm < 1000ms p95
- [ ] T058 [P] Verify polling performance: 1-sec interval polling under 100ms client-side latency per research.md Topic 3 benchmark

---

## 並列実行スケジュール例 (推奨)

### MVP 開発スケジュール (15-20 時間想定)

**Day 1 - Morning (2-3h): Phase 1-2 セットアップ**
```
T001-T010 (Phase 1, 6h)
T011-T022 (Phase 2, 8h) ← T001-T010 完了後開始
```

**Day 1 - Afternoon + Day 2 (8-10h): Phase 3 US1 実装**
```
T023-T025 (UI components, 4h) ← T001-T010 完了後開始（並列可）
T026-T034 (Pages + Server Action, 6h) ← T013-T015 完了後開始
T036-T039 (Integration tests + Demo, 2-3h) ← T023-T034 完了後
```

**Day 2-3 (2-3h): Phase 4-5 P2 Stories 実装**
```
T040-T043 (US2, ~1h) ← T023-T035 完了後
T044-T048 (US3, ~1h) ← T023-T035 完了後
```

**Day 3 (1-2h): Phase 6-7 エラー & QA**
```
T049-T055 (Error handling, 1h) ← T036-T048 完了後
T056-T058 (QA & Performance, 1h) ← T049-T055 完了後
```

**並列実行チャンス:**
- T002-T010 は T001 完了後すぐに並列開始可（5 個タスク）
- T040-T043 (US2) と T044-T048 (US3) は同時開始可（US1 完了後）
- T019-T021（ユニット & コントラクトテスト）は実装と並列実行可

---

## テスト検証チェックリスト

### Phase 1 ゲート
- [ ] `npm run dev` でコンパイル成功、ローカル起動確認
- [ ] Supabase 命日ッシュボード接続確認
- [ ] `.env.local` 設定確認（URL/KEY プレイスホルダー）

### Phase 2 ゲート
- [ ] `npm run test` で contract テストすべてパス
- [ ] `curl localhost:3000/api/products` が 200 + 商品配列返却確認
- [ ] 商品レコード 3 個 Supabase に存在確認

### Phase 3 (US1) ゲート
- [ ] ユーザー認証後、`/checkout` にアクセス可能
- [ ] 商品選択 → 決済 → 確認 → 完了画面ナビゲーション完全動作
- [ ] Supabase payments テーブルに新規レコード作成確認
- [ ] transaction_id 表示確認（TXN-YYYYMMDD-5CHARS 形式）
- [ ] ポーリングで通知ステータス表示更新確認
- [ ] 統合テスト `npm run test tests/integration/checkout-flow.test.ts` パス

### Phase 4-5 (US2, US3) ゲート
- [ ] US2 デモ: 商品一覧表示精度 100%
- [ ] US3 デモ: Payment 作成 + transaction_id 応答 < 1000ms

### Phase 6-7 QA ゲート
- [ ] `npm run test` すべてパス (>80% coverage)
- [ ] Performance: API p95 < 1000ms 確認
- [ ] エラーシナリオ: 失敗時エラー画面表示確認

---

## 依存トラッキング

| タスク ID | 前提タスク | 理由 |
|---------|---------|------|
| T004-T010 | T001 | Next.js プロジェクト生成完了が必須 |
| T011-T022 | T004, T005, T008, T009 | TypeScript 型・Supabase クライアント必須 |
| T023-T035 | T011-T022 | DB・API 基盤必須 |
| T036-T039 | T023-T035 | コンポーネント・ロジック実装完了 |
| T040-T048 | T023-T035 | US1 基盤上で US2/US3 検証 |
| T049-T055 | T036-T048 | 統合テスト後のエラーシナリオ |
| T056-T058 | T049-T055 | 最終 QA |

---

## 見積もり詳細

### 時間計算

| フェーズ | タスク数 | 時間見積 | 理由 |
|--------|--------|--------|------|
| **Phase 1** | 10 | 1-2h | CLI 初期化 + 型定義 |
| **Phase 2** | 12 | 2-3h | DB スキーマ + 2 API エンドポイント |
| **Phase 3** | 17 | 6-8h | 5 ページ + Server Action + ポーリング |
| **Phase 4** | 4 | 1h | 商品選択検証（P2 依存度低） |
| **Phase 5** | 5 | 1h | 支払い確認検証（P2 依存度低） |
| **Phase 6** | 7 | 2-3h | エラーハンドリング + ポーリング詳細テスト |
| **Phase 7** | 3 | 1h | QA + パフォーマンス検証 |
| **合計** | 58 | 14-20h | デモシステム MVP（テスト込み） |

### スキルレベル想定

- **Junior (1-2 年)**: 20-25 時間見積 (リサーチ + 質問多)
- **Mid (3-5 年)**: 14-18 時間見積（推奨スケジュール）
- **Senior (5+ 年)**: 10-12 時間見積 (Supabase/Next.js 経験者)

---

## 実装上の注意

### セキュリティ

- **Webhook URL**: `.env.local` に保管。クライアント (`NEXT_PUBLIC_*`) 非露出 ✅ research.md Topic 4
- **RLS ポリシー**: payments/discord_notifications テーブル必須有効化 ✅ research.md Topic 2
- **Service Role Key**: Server Action 内のみで使用。クライアント側ゼロ使用 ✅ research.md Topic 1

### パフォーマンス

- **API 応答時間**: GET /api/products, GET /api/notifications < 1000ms p95 ✅ spec.md NFR-001
- **ポーリング**: 1 秒間隔、最大 60 秒（キャンセル可能） ✅ spec.md NFR-002
- **データベース**: インデックス設定（user_id, created_at, transaction_id）✅ data-model.md

### テスト戦略

- **単体テスト**: コンポーネント・util 関数、Jest + React Testing Library
- **統合テスト**: 完全フロー E2E、Vitest + Supabase emulator
- **コントラクトテスト**: API エンドポイント仕様適合性、Jest
- **目標カバレッジ**: >80% (unit + integration 合算)

---

## リスク & 軽減策

| リスク | 影響度 | 軽減策 |
|--------|--------|--------|
| **Supabase RLS ポリシーバグ** | 高 | Phase 2 でコントラクトテスト必須。RLS テス既知パターン参照 |
| **ポーリング ネットワークエラー** | 中 | Phase 6 エラーシナリオテストで retry 検証。リトライロジック先行実装 |
| **Discord Webhook 秘匿化ミス** | 高 | Server Action 外での Webhook 参照禁止フラグを CI/CD に設定 |
| **Transaction ID 重複** | 中 | UUID + ランダムサフィックス使用。一意性テスト必須 (T038) |
| **ポーリング 60 秒タイムアウト** | 低 | 自動停止ロジック実装 (T033-T034). UI で「再読み込みボタン」提供 |

---

## デプロイメント前チェックリスト

- [ ] 全テストスイート正常完了 (`npm run test`)
- [ ] 本番環境 Supabase URL・KEY 設定完了 (`.env.production`)
- [ ] Discord Webhook URL 本番設定完了
- [ ] RLS ポリシー本番環境に反映確認
- [ ] API performance p95 < 1000ms 確認
- [ ] エラーハンドリング詳細テスト完了
- [ ] 管理画面・ログビュー準備（次フェーズ）

---

## 今後の拡張 (Phase 8+)

- **Phase 8**: Discord 通知リトライ dispatcher 実装（非同期バックグラウンドジョブ）
- **Phase 9**: 管理画面（取引一覧、商品管理、通知ステータスビュー）
- **Phase 10**: 決済履歴画面、レポート機能
- **Phase 11**: 複数ユーザー招待機能、ロール管理

---

## ドキュメント参照

- **仕様**: [spec.md](spec.md) - 3 ユーザーストーリー、受け入れシナリオ
- **計画**: [plan.md](plan.md) - プロジェクト構造、フェーズ分解
- **研究**: [research.md](research.md) - 10 技術決定、パターン
- **データモデル**: [data-model.md](data-model.md) - SQL スキーマ、RLS
- **API**: [contracts/api-products.md](contracts/api-products.md), [contracts/api-notifications.md](contracts/api-notifications.md)

---

**更新日**: 2026-02-25  
**次ステップ**: Phase 1 セットアップ開始 (T001)
