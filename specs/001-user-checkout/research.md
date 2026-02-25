# 研究レポート: ユーザーチェックアウト機能

**作成日**: 2026-02-25  
**入力**: spec.md, plan.md, constitution.md  
**目的**: 技術選択の正当化と実装パターンの確立

---

## 概要

仕様明確化セッション完了済みのため、NEEDS CLARIFICATION は **ゼロ**。本レポートは **技術実装パターンと選択理由** をドキュメント化します。

---

## 1. Next.js App Router + Server Action の統合

### 決定事項

**採択**: Server Action で payment 作成ロジック実装、API ルートで読み取り専用クエリを実装

### 理由

| 選択肢 | メリット | デメリット | 判定 |
|-------|---------|---------|------|
| **Server Action** (採択) | 型安全（TypeScript）、CSRF 保護標準、Webhook URL 秘匿化容易、form/mutation に最適 | 串列実行（複数同時リクエスト時） | ✅ BEST for payment |
| API Route | 並列処理対応、REST スタンダード、複数 HTTP メソッド対応 | CSRF 手動管理、Webhook 秘匿化が複雑 | ✅ BEST for query |

### 実装パターン

```typescript
// app/checkout/payment/confirm/actions.ts - Server Action
"use server"
export async function submitPayment(formData: FormData) {
  const supabaseAdmin = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
  // Payment 作成
  const result = await supabaseAdmin
    .from('payments')
    .insert([{ user_id, product_name, amount_jpy, status: 'succeeded' }])
    .select()
  // Webhook URL はサーバーサイドのみで利用
  await notifyDiscord(result[0].transaction_id) // クライアント非露出
  return result[0]
}

// app/api/products/route.ts - API Route  
export async function GET() {
  const supabaseClient = createClient()
  const { data } = await supabaseClient.from('products').select('*')
  return Response.json(data)
}
```

---

## 2. RLS (Row-Level Security) ポリシー実装

### 決定事項

**採択**: Supabase RLS で payment / discord_notifications / products テーブルを保護

### RLS ポリシー設計

#### payments テーブル

```sql
-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ユーザーポリシー: 自分の取引のみ表示
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- Server (Service Role): すべてのレコード作成
CREATE POLICY "Service can create payments"
  ON payments FOR INSERT
  WITH CHECK (true);  -- Service role bypass
```

#### discord_notifications テーブル

```sql
-- Enable RLS
ALTER TABLE discord_notifications ENABLE ROW LEVEL SECURITY;

-- ユーザーポリシー: 自分の payment に紐づく通知のみ表示
CREATE POLICY "Users can view own notifications"
  ON discord_notifications FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );
```

#### products テーブル

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ユーザーポリシー: すべての商品を読み取り可能
CREATE POLICY "Public can view products"
  ON products FOR SELECT
  USING (true);
```

### Service Role Key 使い分け

| 処理 | キー | 理由 |
|-----|------|------|
| Payment 作成 | Service Role | RLS バイパス（管理者権限：トランザクション必ず記録） |
| 通知更新 | Service Role | RLS バイパス（非同期リトライ処理） |
| 商品読み取り | Anon / User | RLS で全員読み取り可能（ユーザーキー利用） |
| Payment 読み取り | User | RLS で自分のみ表示（ユーザーキー利用） |

---

## 3. リアルタイムポーリング最適化

### 決定事項

**採択**: クライアント側の setInterval ポーリング（1秒間隔、60秒上限）

### パフォーマンス分析

| 条件 | リクエスト数 | サーバー負荷 | ネットワーク |
|------|-----------|----------|-----------|
| 1秒間隔×60秒 | 60回/ユーザー | 低（SELECT 軽量） | ~6KB payload |
| WebSocket | 常時接続 | 中（接続管理） | 確定的サーバー依存 |

**結論**: ポーリング採択（デモ規模、最小複雑性）

### 実装パターン

```typescript
// components/CompletedStep.tsx
"use client"
import { useEffect, useState } from 'react'

export function CompletedStep({ paymentId }: { paymentId: string }) {
  const [notificationStatus, setNotificationStatus] = useState('queued')
  const [attempts, setAttempts] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/notifications/${paymentId}`)
      const data = await res.json()
      setNotificationStatus(data.status)
      setAttempts(prev => prev + 1)
      
      // 完了または60秒経過で終了
      if (data.status === 'sent' || data.status === 'failed' || attempts >= 60) {
        clearInterval(interval)
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div>
      <p>通知ステータス: {notificationStatus}</p>
    </div>
  )
}
```

---

## 4. Discord Webhook 秘匿化（Server Action 経由）

### 決定事項

**採択**: Server Action で Webhook 呼び出し、クライアント側では URL 参照なし

### セキュリティパターン

```typescript
// app/checkout/payment/confirm/actions.ts
"use server"
import { createClient } from '@supabase/supabase-js'

const webhookUrl = process.env.DISCORD_WEBHOOK_URL! // サーバーのみアクセス

export async function submitPayment(formData: FormData) {
  // ... payment 作成 ...
  
  // 即座に通知キュー作成（リトライは async で背後実行）
  createNotificationQueue(payment.id)
  
  return payment
}

async function createNotificationQueue(paymentId: string) {
  const supabaseAdmin = createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await supabaseAdmin
    .from('discord_notifications')
    .insert([{
      payment_id: paymentId,
      status: 'queued',
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date().toISOString()
    }])
  
  // 非同期リトライ開始（別プロセス/スケジューラ）
  await triggerDispatcher()
}
```

### クライアント側（Webhook URL ゼロ露出）

```typescript
// ❌ こうしない!
const notifyDiscord = async (message: string) => {
  await fetch(process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ content: message })
  })
}

// ✅ こうする!
const submitPayment = async (formData: FormData) => {
  const result = await submitPaymentAction(formData)
  // Webhook 呼び出しはサーバーが実施済み
  return result
}
```

---

## 5. 商品マスタ管理方式

### 決定事項

**採択**: Supabase products テーブル（静的でなくDB管理、拡張性重視）

### 理由

| 方式 | 初期セットアップ | 扶養管理 | 将来拡張性 | 採点 |
|-----|-------------|--------|----------|------|
| **DB 管理**（採択） | やや複雑 | 容易（管理画面追加可） | 高（在庫管理等追加可） | ⭐⭐⭐⭐⭐ |
| 静的 JSON | シンプル | 困難（手動編集） | 低（コード変更必須） | ⭐⭐⭐ |

### 初期化スクリプト

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  amount_jpy INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

INSERT INTO products (product_name, amount_jpy) VALUES
  ('商品A - ¥1,000', 1000),
  ('商品B - ¥2,500', 2500),
  ('商品C - ¥5,000', 5000);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read products" ON products 
  FOR SELECT USING (true);
```

---

## 6. 取引 ID 生成戦略

### 決定事項

**採択**: UUID (payment.id) + 人間可読な transaction_id（ハイブリッド）

### スキーマ設計

```typescript
// lib/types.ts
export interface Payment {
  id: string                    // UUID (PK)
  transaction_id: string        // "TXN-20250225-A3B4C" (表示用)
  user_id: string              // auth.uid
  user_name: string            // Supabase Auth metadata
  product_name: string         // 非正規化
  amount_jpy: number
  status: 'pending' | 'succeeded' | 'failed'
  created_at: string           // ISO 8601
}

// 生成パターン
function generateTransactionId(date: Date): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')  // YYYYMMDD
  const randomSuffix = Math.random().toString(36).substr(2, 5).toUpperCase()
  return `TXN-${dateStr}-${randomSuffix}`  // "TXN-20250225-A3B4C"
}
```

---

## 7. エラーハンドリング & 再試行戦略

### 決定事項

**採択**: 
- Payment 作成失敗 → クライアント側でエラー画面表示
- Discord 通知失敗 → 自動リトライ（10/30/90/300秒）

### エラーパターン

| エラー | 発生箇所 | 対処 | ユーザー表示 |
|------|--------|------|----------|
| DB 接続失敗 | Payment 作成時 | 即座エラー | エラー画面「再度お試しください」 |
| RLS ポリシー違反 | Payment 読み取り時 | logging → ユーザーは空表示 | 「取引が見つかりません」 |
| Webhook 4xx | 初回送信 | リトライ開始 | ユーザーは見えない（管理画面のみ） |
| Webhook 5xx | リトライ中 | 指数バックオフ進行 | ユーザーは見えない（最終的に管理画面） |

### Server Action エラーハンドル

```typescript
"use server"
export async function submitPayment(formData: FormData) {
  try {
    const payment = await createPayment(...)
    await createNotificationQueue(payment.id)
    return { success: true, paymentId: payment.id }
  } catch (error) {
    console.error('[Payment Error]', error)
    if (error instanceof SupabaseError && error.code === 'PGRST116') {
      return { success: false, message: 'RLS ポリシー違反' }
    }
    return { success: false, message: '取引作成失敗。再度お試しください。' }
  }
}
```

---

## 8. テスト戦略

### 決定事項

**採択**: 3層テスト（単体 → 統合 → コントラクト）

### テスト構成

| レイヤー | ツール | 対象 | 目標 |
|---------|-------|------|------|
| **単体テスト** | Jest + React Testing Library | コンポーネント、util 関数 | 90% カバレッジ |
| **統合テスト** | Playwright / Vitest | 完全なチェックアウトフロー | すべてのシナリオ実行 |
| **コントラクトテスト** | Jest + Supabase emulator | API エンドポイント、RLS | API 仕様適合性 |

### テストスイート

```typescript
// tests/integration/checkout-flow.test.ts
describe('Checkout Flow - Complete Journey', () => {
  it('should successfully create payment from product selection to completion', async () => {
    // 1. ログイン
    // 2. 商品一覧から商品選択
    // 3. 決済画面確認
    // 4. 支払い確認画面確認
    // 5. Payment 作成（Server Action）
    // 6. 通知キュー作成確認
    // 7. ポーリングで通知ステータス更新確認
    // 8. 完了画面表示確認
  })
})

// tests/contract/api-products.test.ts
describe('Products API Contract', () => {
  it('should return all products with correct schema', async () => {
    const res = await GET()
    const data = await res.json()
    expect(data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          product_name: expect.any(String),
          amount_jpy: expect.any(Number)
        })
      ])
    )
  })
})
```

---

## 9. デプロイメント & 環境管理

### 決定事項

**採択**: 環境変数を `.env.local` / `.env.production` で分離管理

### 環境変数リスト

| 変数名 | 本開発 | 本番 | 秘匿度 |
|--------|-------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | CI/CD | 公開 |
| `NEXT_PUBLIC_SUPABASE_KEY` | `.env.local` | CI/CD | 公開（anon） |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | CI/CD | 🔒 秘匿 |
| `DISCORD_WEBHOOK_URL` | `.env.local` | CI/CD | 🔒 秘匿 |

### .gitignore 追加

```
.env.local
.env.*.local
```

---

## 10. 概要: 技術選択マトリクス

| 決定 | 採択 | 代替案 | 理由 |
|-----|-----|--------|------|
| フレームワーク | Next.js 15 + TS | React SPA | SSR + SSG 対応、Server Action セキュリティ |
| DB | Supabase PG | DynamoDB | RLS 標準、auth 統合、ローカル対応 |
| Auth | Supabase Auth | NextAuth.js | 高速セットアップ、user_metadata 拡張 |
| Webhook 呼び出し | Server Action | API Route | CSRF 標準保護、型安全、Webhook URL 秘匿 |
| ポーリング | setInterval | WebSocket | デモ規模、複雑性最小化 |
| 商品管理 | DB テーブル | 静的 JSON | 拡張性、管理容易性 |
| エラー表示 | エラー画面 | トースト通知 | 重大な決済失敗に適切 |

---

## 完了チェックリスト

- [x] NEEDS CLARIFICATION ゼロ確認（明確化セッション完了）
- [x] 技術選択理由を文書化
- [x] セキュリティパターン（RLS、Webhook URL秘匿化）確立
- [x] テスト戦略定義
- [x] 環境変数管理確認
- [x] 実装パターンコード例添付

**ステータス**: ✅ **Phase 0 完了 → Phase 1 準備完了**
