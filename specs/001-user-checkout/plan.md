# 実装計画: ユーザーチェックアウト機能

**ブランチ**: `001-user-checkout` | **作成日**: 2026-02-25 | **仕様**: [spec.md](spec.md)
**入力**: `/specs/001-user-checkout/spec.md`

**注記**: この計画ファイルは `/speckit.plan` コマンドで生成されました。詳細は `.specify/templates/plan-template.md` の実行ワークフロー参照。

## サマリー

ユーザーが商品を選択して疑似決済を完了できるデモ決済フロー（5画面）を実装します。
- 商品選択画面（Supabase products から動的取得）
- 決済画面（選択商品表示）
- 支払い確認画面（最終確認）
- 支払い完了処理（payments テーブルへのトランザクション作成）
- 完了画面（取引ID表示 + Discord 通知ステータスのリアルタイムポーリング）

技術アプローチ: Next.js App Router，Supabase Auth + PostgreSQL，Server Action でサーバー処理，クライアントでポーリング実装。

## 技術コンテキスト

**言語/バージョン**: TypeScript 5.x + Next.js 15.x (App Router)  
**主要依存**: Next.js, Supabase (auth + PostgreSQL), React 19.x  
**ストレージ**: PostgreSQL （Supabase）  
**テスト**: Jest, React Testing Library, Supabase テスト環境  
**ターゲットプラットフォーム**: Web (Node.js サーバー + ブラウザ)  
**プロジェクト種別**: Web サービス / SPA  
**パフォーマンス目標**: 
  - API 応答時間: 1000ms (p95)
  - Discord 通知ポーリング: 1秒間隔，最大60秒
  - 商品一覧表示: < 2秒
  - 支払い完了: < 1秒

**制約 & 注意**:
  - Discord Webhook URL は **必ずサーバーサイドのみ** - クライアント露出厳禁
  - RLS 有効化必須：payments, discord_notifications テーブル
  - ローカル環境対応（`.env.local` で環境変数管理）
  - 実装は最小限（デモ用、複雑性なし）

**スケール/スコープ**: 
  - 3 ユーザーストーリー（P1×1 + P2×2）
  - 5 画面 (商品選択→決済→支払確認→処理→完了)
  - 3 主要エンティティ (Product, Payment, User)
  - 3 主要 API 呼び出し (products 一覧、payment 作成、通知ステータス)

## 憲法チェック

*ゲート: Phase 0 研究前に合格必須。Phase 1 設計後に再チェック。*

### 適用される憲法原則（v0.1.0）

1. **I. ローカルファースト開発** ✅
   - 検証: 仕様で `.env.local` 環境変数管理を明示（Supabase URL/KEY、Discord Webhook）
   - 外部依存: Supabase + Discord Webhook のみ（セットアップ容易）
   
2. **II. 責任の分離** ✅
   - 検証: Spec の主要エンティティで payments と discord_notifications テーブルを分離
   - 独立ライフサイクル: payment は status=succeeded で決済作成、通知は別テーブルで管理
   
3. **III. 明示的リトライポリシー** ✅
   - 検証: 仕様 FR-008 でリアルタイムポーリング実装（1秒間隔）
   - 最大試行: 5 回（憲法定義）、指数バックオフ [10, 30, 90, 300]秒
   
4. **IV. セキュリティファースト設計** ✅
   - 検証: 仕様で Webhook URL **サーバーサイドのみ** と明記（Server Action）
   - RLS: payments, discord_notifications, products テーブルで有効化
   
5. **V. シンプルさ重視** ✅
   - 検証: ユーザーストーリー 3 個、エンティティ 3 個、画面 5 個に限定
   - 複雑性: なし（直接的なSQLクエリ、単純なステートマシン）

### ゲート評価

| ゲート | ステータス | 検証内容 |
|-------|----------|--------|
| **マンダトリ要件完備** | ✅ PASS | ユーザーストーリー、受け入れシナリオ、成功基準すべて定義済み |
| **技術スタック確定** | ✅ PASS | NEEDS CLARIFICATION なし。Next.js + Supabase + Discord Webhook で確定 |
| **憲法合致性** | ✅ PASS | 5原則すべてで spec が準拠。セキュリティ、責任分離、シンプルさ確認 |
| **スコープ妥理** | ✅ PASS | P1 フロー（5画面、3エンティティ）。複雑性なし |
| **曖昧性ゼロ** | ✅ PASS | 明確化セッション完了。NEEDS CLARIFICATION なし |

**ゲート結果**: ✅ **Phase 0 進行可能**

---

## プロジェクト構造

### ドキュメンテーション（このフィーチャー）

```text
specs/001-user-checkout/
├── plan.md              # このファイル（/speckit.plan 出力）
├── spec.md              # 機能仕様書（完了）
├── research.md          # Phase 0 出力（生成予定）
├── data-model.md        # Phase 1 出力（生成予定）
├── quickstart.md        # Phase 1 出力（生成予定）
├── contracts/           # Phase 1 出力（生成予定）
│   ├── api-payment.md   # 支払い API コントラクト
│   └── api-products.md  # 商品一覧 API コントラクト
├── checklists/
│   └── requirements.md   # （已存在）
└── tasks.md             # Phase 2 出力（/speckit.tasks で生成）
```

### ソースコード（リポジトリ ルート）

```text
app/                                  # Next.js App Router
├── checkout/
│   ├── page.tsx                     # 商品選択画面
│   ├── payment/
│   │   ├── page.tsx                 # 決済画面
│   │   └── confirm/
│   │       ├── page.tsx             # 支払い確認画面
│   │       └── actions.ts           # Server Action (payment 作成)
│   ├── completed/
│   │   └── page.tsx                 # 完了画面 (ポーリング実装)
│   └── error.tsx                    # エラー表示
├── api/
│   ├── products/
│   │   └── route.ts                 # GET /api/products (一覧取得)
│   ├── notifications/
│   │   └── route.ts                 # GET /api/notifications/:id (通知ステータス)
│   └── payments/
│       └── route.ts                 # POST /api/payments (new payment) - or Server Action
├── layout.tsx                        # ルート Layout (Auth ラッパー)
└── auth/
    └── [...nextauth]/route.ts        # Supabase Auth callback

lib/
├── supabase.ts                      # Supabase クライアント (client, server)
├── types.ts                         # TypeScript 型（Product, Payment, etc）
├── db.ts                            # DB クエリ ヘルパー
└── validation.ts                    # バリデーション スキーマ

components/
├── ProductList.tsx                  # 商品一覧コンポーネント
├── PaymentForm.tsx                  # 決済フォーム
├── ConfirmationStep.tsx             # 支払い確認ステップ
├── CompletedStep.tsx                # 完了ステップ (ポーリング)
├── PollingNotification.tsx          # Discord 通知ステータス表示
└── ErrorBoundary.tsx                # エラーハンドリング

tests/
├── unit/
│   ├── components/                  # コンポーネント単体テスト
│   └── lib/                         # ライブラリテスト
├── integration/
│   ├── checkout-flow.test.ts        # 完全フロー統合テスト
│   └── payment-creation.test.ts     # 支払い作成テスト
└── contract/
    ├── api-products.test.ts         # 商品 API コントラクトテスト
    └── api-notifications.test.ts    # 通知 API コントラクトテスト

env.local                            # ローカル環境変数 (git ignore)
```

**構造決定**: Web アプリケーション（Next.js）を採用。
- フロントエンド: Next.js App Router (TypeScript)
- バックエンド: Next.js API ルート + Server Action
- DB: Supabase PostgreSQL (RLS 有効)
- リポジトリ構造: モノリシック単一プロジェクト（デモ規模）

---

## 複雑性トラッキング

> **fill ONLY if Constitution Check に違反が存在し正当化が必要な場合**

**ゲート結果**: ✅ **PASS - 違反なし**

---

## Phase 0: 研究完了 ✅

**成果物**: [research.md](research.md)

- [x] 技術選択理由ドキュメント化（Next.js + Supabase + Server Action）
- [x] セキュリティパターン確立（RLS ポリシー、Webhook URL 秘匿化）
- [x] 実装パターン提供（コード例）
- [x] テスト戦略定義
- [x] NEEDS CLARIFICATION ゼロ確認

---

## Phase 1: 設計 & コントラクト完了 ✅

### 成果物

| ファイル | ステータス | 説明 |
|---------|-----------|------|
| [data-model.md](data-model.md) | ✅ | 3 エンティティ（User, Product, Payment）、スキーマ SQL、バリデーション |
| [contracts/api-products.md](contracts/api-products.md) | ✅ | 商品一覧 GET エンドポイントコントラクト |
| [contracts/api-notifications.md](contracts/api-notifications.md) | ✅ | 通知ステータス GET エンドポイントコントラクト |
| [quickstart.md](quickstart.md) | ✅ | ローカル開発セットアップガイド（15～20分） |

### アジェント コンテキスト更新

```bash
bash .specify/scripts/bash/update-agent-context.sh copilot
```

このコマンドで、Copilot コンテキストに **Next.js, Supabase, TypeScript, React** の新規技術が追加されます。

### Constitution Check 再評価 ✅

| 原則 | 状態 | 検証 |
|-----|------|------|
| **I. ローカルファースト開発** | ✅ PASS | quickstart.md で Docker Compose + `.env.local` セットアップ実装 |
| **II. 責任の分離** | ✅ PASS | data-model.md で Payment / discord_notifications テーブル分離確認 |
| **III. 明示的リトライポリシー** | ✅ PASS | contracts/api-notifications.md でステータス管理仕様確立 |
| **IV. セキュリティファースト設計** | ✅ PASS | research.md で Server Action 秘匿化パターン、RLS ポリシー実装パターン提供 |
| **V. シンプルさ重視** | ✅ PASS | データモデル（3エンティティ）、API（2エンドポイント）に限定 |

**再評価結果**: ✅ **すべての原則で PASS - 設計は憲法準拠**

---

## Phase 2: 実装タスク準備 ⏳

**次のステップ**: `/speckit.tasks` にて実装タスク自動生成

### 予想生成物

- `tasks.md`: ユーザーストーリー P1×1, P2×2 に基づく実装タスク（~30 タスク）
- ストーリーごとの独立したタスク群（並列実装対応）
- テストタスクを含む（TDD ワークフロー対応）

### 推奨所要時間見積

| タスク | 見積時間 |
|-------|---------|
| Foundation Setup (DB, Auth, API 基盤) | 2～3 時間 |
| P1 ストーリー実装（全5画面フロー） | 6～8 時間 |
| P2 ストーリー実装×2（独立コンポーネント） | 4～5 時間 |
| テスト & 統合テスト | 3～4 時間 |
| **合計** | **15～20 時間** |

---

## スケジュール & マイルストーン

| マイルストーン | ステータス | 完了日 |
|-------------|----------|------|
| ✅ 仕様書（spec.md） | 完了 | 2026-02-25 |
| ✅ 明確化セッション | 完了 | 2026-02-25 |
| ✅ 計画書（plan.md） | 完了 | 2026-02-25 |
| ✅ 研究レポート（research.md） | 完了 | 2026-02-25 |
| ✅ データモデル（data-model.md） | 完了 | 2026-02-25 |
| ✅ API コントラクト（contracts/） | 完了 | 2026-02-25 |
| ✅ 開発ガイド（quickstart.md） | 完了 | 2026-02-25 |
| ⏳ Task List (tasks.md) | 予定 | 2026-02-25 (後続/speckit.tasks) |
| ⏳ 実装（Phase 2） | 予定 | 2026-02-26+ |
| ⏳ テスト & QA | 予定 | 2026-02-28+ |
| ⏳ PR & マージ | 予定 | 2026-03-01+ |

---

## 品質ゲート

**Phase 1 完了条件**: ✅ すべて合格

- [x] すべての仕様需要が実装されたドキュメント化
- [x] データモデルが完全かつ一貫性あり
- [x] API コントラクトが明確でテスト可能
- [x] 開発ガイドが新規開発者対応可能
- [x] 憲法への準拠を再確認
- [x] 公開 & レビュー準備完了

**ゲート結果**: ✅ **PASS - Phase 2 着手可能**

---

## 参照ドキュメント

- [spec.md](spec.md) - 機能仕様書（ユーザーストーリー、要件）
- [research.md](research.md) - 技術研究レポート（実装パターン、セキュリティ）
- [data-model.md](data-model.md) - データモデル定義（スキーマ、RLS、型定義）
- [contracts/api-products.md](contracts/api-products.md) - 商品一覧 API コントラクト
- [contracts/api-notifications.md](contracts/api-notifications.md) - 通知ステータス API コントラクト
- [quickstart.md](quickstart.md) - 開発クイックスタートガイド
- [plan.md](plan.md) - このファイル（実装計画）
- `.specify/memory/constitution.md` - プロジェクト憲法 v0.1.0

---

**ステータス**: 🟢 **Phase 1 完了 → Phase 2 (実装) 準備完了**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
