# データモデル: ユーザーチェックアウト機能

**作成日**: 2026-02-25  
**入力**: spec.md, plan.md, research.md  
**関連ドキュメント**: [plan.md](plan.md), [research.md](research.md)

---

## エンティティ概要

このフィーチャーは 3 つのコアエンティティで構成されます：

| エンティティ | 目的 | 主要責務 |
|-----------|------|--------|
| **User** | 認証ユーザー | Supabase Auth により管理。登録名（display_name）を user_metadata に保持 |
| **Product** | 販売商品マスタ | 商品一覧表示。金額管理 |
| **Payment** | 取引レコード | トランザクション記録。ユーザーと商品の組み合わせ |

※ **Discord Notification** エンティティは別フェーズで定義（通知リトライフロー実装時）

---

## エンティティ詳細定義

### 1. User（ユーザー）

**ソース**: Supabase Auth (`auth.users`)

#### 属性

| 属性 | 型 | 制約 | 説明 |
|-----|-----|------|------|
| `id` (uid) | UUID | PK, 自動生成 | Supabase Auth の一意識別子 |
| `email` | TEXT | 一意、非null | ユーザーメールアドレス（ログイン用） |
| `user_metadata` | JSONB | 任意 | カスタムデータ。`{ "display_name": "太郎" }` 形式 |
| `created_at` | TIMESTAMP | 自動 | アカウント作成日時 |

#### バリデーション

- `email`: 有効なメール形式（[RFC 5322](https://tools.ietf.org/html/rfc5322)）
- `user_metadata.display_name`: 1～50 文字（日本語対応）

#### 関連スキーマ (Next.js)

```typescript
// lib/types.ts
export interface User {
  id: string            // UUID
  email: string
  displayName: string   // user_metadata.display_name
  createdAt: string     // ISO 8601
}
```

---

### 2. Product（商品）

**ソース**: Supabase テーブル `public.products`

#### スキーマ定義

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  amount_jpy INTEGER NOT NULL CHECK (amount_jpy > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- RLS: 全ユーザー読み取り可能
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (true);
```

#### 属性

| 属性 | 型 | 制約 | 説明 |
|-----|-----|------|------|
| `id` | UUID | PK, 自動生成 | 商品一意識別子 |
| `product_name` | TEXT | 非null, ≤255文字 | 商品名（表示用）|
| `amount_jpy` | INTEGER | 非null, > 0 | 金額（日本円、整数） |
| `created_at` | TIMESTAMP | 自動 | 商品作成日時 |
| `updated_at` | TIMESTAMP | 自動 | 最終更新日時 |

#### バリデーション

- `product_name`: 1～255 文字、非空白
- `amount_jpy`: 1～999,999,999 JPY

#### インデックス

```sql
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

#### 初期データ

```sql
INSERT INTO products (product_name, amount_jpy) VALUES
  ('スタータープラン - ¥1,000', 1000),
  ('プロプラン - ¥2,500', 2500),
  ('エンタープライズプラン - ¥5,000', 5000);
```

#### 関連スキーマ (Next.js)

```typescript
export interface Product {
  id: string
  productName: string
  amountJpy: number
  createdAt: string
}
```

---

### 3. Payment（取引）

**ソース**: Supabase テーブル `public.payments`

#### スキーマ定義

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount_jpy INTEGER NOT NULL CHECK (amount_jpy > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- RLS: ユーザーは自分の取引のみ表示可能
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Service Role (Server Action): データ作成
CREATE POLICY "service_insert_payments" ON payments
  FOR INSERT WITH CHECK (true);  -- Service role bypass
```

#### 属性

| 属性 | 型 | 制約 | 説明 |
|-----|-----|------|------|
| `id` | UUID | PK, 自動生成 | 取引内部識別子（UUID） |
| `transaction_id` | TEXT | 一意、非null | 表示用取引ID（人間可読） |
| `user_id` | UUID | 外部参照 auth.users(id) | ユーザー参照 |
| `user_name` | TEXT | 非null, ≤100文字 | ユーザー表示名（非正規化） |
| `product_name` | TEXT | 非null, ≤255文字 | 商品名（非正規化） |
| `amount_jpy` | INTEGER | 非null, > 0 | 決済金額（日本円） |
| `status` | TEXT (ENUM) | 'pending'/'succeeded'/'failed' | 取引ステータス |
| `created_at` | TIMESTAMP | 自動 | 取引作成日時 |
| `updated_at` | TIMESTAMP | 自動 | 最終更新日時 |

#### ライフサイクル

```
┌─────────────────────────┐
│ pending (初期状態)      │ ← Support Action で即座に succeeded へ遷移
│ (リトライなし)          │
└────────────────────────────┘

または Payment が immediately succeeded:

┌─────────────────────────────┐
│ succeeded (最終状態)        │
│ (トランザクション確定)      │
└─────────────────────────────┘

エラー時:

┌──────────────────────────┐
│ failed (最終状態)        │
│ (エラー画面表示)         │
└──────────────────────────┘
```

#### バリデーション

- `transaction_id`: 一意、形式「TXN-YYYYMMDD-5LETTERs」
- `user_id`: auth.users に存在する UUID
- `user_name`: 1～100 文字
- `product_name`: 1～255 文字
- `amount_jpy`: 1～999,999,999 JPY

#### インデックス

```sql
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
```

#### 関連スキーマ (Next.js)

```typescript
export interface Payment {
  id: string
  transactionId: string
  userId: string
  userName: string
  productName: string
  amountJpy: number
  status: 'pending' | 'succeeded' | 'failed'
  createdAt: string
  updatedAt: string
}
```

---

## リレーション図

```
┌──────────────────────┐
│   auth.users         │
│   (Supabase Auth)    │
│  ┌────────────────┐  │
│  │ id (UUID)      │  │ (PK)
│  │ email TEXT     │  │
│  │ user_metadata  │  │ ← display_name
│  └────────────────┘  │
└──────────────────────┘
           │
           │ (1:N)
           │ user_id FK
           │
      ┌────▼──────────────────┐
      │   payments            │
      │ ┌────────────────────┐ │
      │ │ id (PK) UUID       │ │
      │ │ transaction_id (U) │ │
      │ │ user_id (FK)       │ │ ← Supabase Auth
      │ │ user_name (TEXT)   │ │   (非正規化)
      │ │ product_name (TEXT)│ │
      │ │ amount_jpy         │ │
      │ │ status (ENUM)      │ │
      │ │ created_at         │ │
      │ └────────────────────┘ │
      └───────────────────────-┘

※ discord_notifications テーブルは別フェーズで定義
  payments との関係: 1:1 (payment_id FK)
```

---

## データフロー・ライフサイクル

### ユースケース: 商品購入から取引完了まで

```
Step 1: 商品選択画面
  ├─ UI: GET /api/products
  └─ DB Query: SELECT * FROM products
     └─ Response: List[Product]

Step 2: 決済画面
  └─ State: 選択商品情報をメモリ保持
     (DB未操作)

Step 3: 支払い確認画面
  └─ State: 選択商品 + ユーザー名を表示
     (Supabase Auth user_metadata.display_name より取得)

Step 4: 支払い完了アクション
  ├─ Server Action: submitPayment(
  │    userId, productId → productName, amountJpy)
  │
  ├─ DB: INSERT INTO payments (
  │    { id=gen_uuid(),
  │      transaction_id=gen_txn_id(),
  │      user_id, user_name, product_name, amount_jpy,
  │      status='succeeded'
  │    })
  │    RLS: Service Role key で INSERT
  │
  └─ Response: { transactionId, paymentId }

Step 5: 完了画面 (ポーリング開始)
  ├─ UI: GET /api/notifications/:paymentId
  │       (1秒間隔、最大60秒)
  │
  └─ DB Query: SELECT discord_notifications
              WHERE payment_id = :id
              ├─ status: 'queued' → '送信中...'
              ├─ status: 'sent' → '成功'
              └─ status: 'failed' → '失敗'
```

---

## スキーマ初期化スクリプト

### 全テーブル作成スクリプト

```sql
-- products テーブル
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  amount_jpy INTEGER NOT NULL CHECK (amount_jpy > 0),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_products" ON products
  FOR SELECT USING (true);

-- payments テーブル
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount_jpy INTEGER NOT NULL CHECK (amount_jpy > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_insert_payments" ON payments
  FOR INSERT WITH CHECK (true);

-- インデックス
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- 初期データ
INSERT INTO products (product_name, amount_jpy) VALUES
  ('スタータープラン - ¥1,000', 1000),
  ('プロプラン - ¥2,500', 2500),
  ('エンタープライズプラン - ¥5,000', 5000)
ON CONFLICT DO NOTHING;
```

---

## ローカル開発用: Supabase Emulator 対応

### docker-compose.yml

```yaml
version: '3.8'
services:
  supabase:
    image: supabase/supabase:latest
    environment:
      POSTGRES_PASSWORD: postgres
      JWT_SECRET: your-jwt-secret
    ports:
      - "5432:5432"
      - "54321:54321"  # Supabase API
    volumes:
      - ./supabase/migrations:/docker-entrypoint-initdb.d
```

### .env.local

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
DISCORD_WEBHOOK_URL=<your-webhook-url>
```

---

## 型定義 (TypeScript)

```typescript
// lib/types.ts

export interface User {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export interface Product {
  id: string
  productName: string
  amountJpy: number
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  transactionId: string
  userId: string
  userName: string
  productName: string
  amountJpy: number
  status: PaymentStatus
  createdAt: string
  updatedAt: string
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed'

export type NotificationStatus = 'queued' | 'sending' | 'sent' | 'retrying' | 'failed'

export interface DiscordNotification {
  id: string
  paymentId: string
  status: NotificationStatus
  attemptCount: number
  maxAttempts: number
  nextAttemptAt: string
  lastAttemptAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}
```

---

## 完了チェックリスト

- [x] 3 つのエンティティ完全定義（User, Product, Payment）
- [x] スキーマ SQL コード提供
- [x] RLS ポリシー定義
- [x] バリデーション規則明確化
- [x] リレーション図作成
- [x] ライフサイクル図作成
- [x] 初期化スクリプト提供
- [x] TypeScript 型定義提供

**ステータス**: ✅ **Phase 1 - Data Model 完了**
