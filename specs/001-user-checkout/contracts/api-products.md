# API コントラクト: 商品一覧エンドポイント

**エンドポイント**: `GET /api/products`  
**作成日**: 2026-02-25  
**ステータス**: ファイナル

---

## 概要

商品一覧を取得するエンドポイント。ユーザー認証不要（RLS で全員読み取り可能）。

---

## リクエスト

### 方法
```
GET /api/products
```

### ヘッダー
| ヘッダー | 値 | 必須 | 説明 |
|---------|------|------|------|
| `Content-Type` | `application/json` | ✓ | JSON 形式を示す |

### クエリパラメータ
なし

### リクエスト本文
なし

### curl 例
```bash
curl -X GET http://localhost:3000/api/products \
  -H "Content-Type: application/json"
```

---

## レスポンス

### ステータスコード

| コード | 説明 |
|-------|------|
| **200** | 成功。商品一覧を返却 |
| **500** | サーバーエラー。DB接続失敗など |

### 成功レスポンス (200)

#### 本文スキーマ

```json
[
  {
    "id": "string (UUID)",
    "product_name": "string",
    "amount_jpy": "integer (> 0)",
    "created_at": "string (ISO 8601)"
  }
]
```

#### 例

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "product_name": "スタータープラン - ¥1,000",
    "amount_jpy": 1000,
    "created_at": "2026-02-25T10:00:00Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "product_name": "プロプラン - ¥2,500",
    "amount_jpy": 2500,
    "created_at": "2026-02-25T10:00:00Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "product_name": "エンタープライズプラン - ¥5,000",
    "amount_jpy": 5000,
    "created_at": "2026-02-25T10:00:00Z"
  }
]
```

### エラーレスポンス (500)

#### 本文スキーマ

```json
{
  "error": "string (エラー説明)"
}
```

#### 例

```json
{
  "error": "Database connection failed"
}
```

---

## 実装スペック

### Next.js 実装例

```typescript
// app/api/products/route.ts
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data, error } = await supabase
      .from('products')
      .select('id, product_name, amount_jpy, created_at')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return Response.json(data || [], { status: 200 })
  } catch (err) {
    console.error('[GET /api/products]', err)
    return Response.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
```

---

## パフォーマンス目標

| 指標 | 目標 | 理由 |
|-----|------|------|
| **応答時間 (p95)** | < 1000ms | Spec NFR-001 で定義 |
| **キャッシュ** | 60秒（CDN） | 商品情報は準静的 |
| **最大アイテム数** | 100 アイテム | デモ規模想定 |

---

## テスト

### コントラクトテスト

```typescript
// tests/contract/api-products.test.ts
import { GET } from '@/app/api/products/route'

describe('GET /api/products', () => {
  it('should return array of products with correct schema', async () => {
    const response = await GET(new Request('http://localhost/api/products'))
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    
    data.forEach(product => {
      expect(product).toHaveProperty('id')
      expect(product).toHaveProperty('product_name')
      expect(product).toHaveProperty('amount_jpy')
      expect(product).toHaveProperty('created_at')
      expect(typeof product.amount_jpy).toBe('number')
      expect(product.amount_jpy).toBeGreaterThan(0)
    })
  })
  
  it('should return empty array when no products exist', async () => {
    const response = await GET(new Request('http://localhost/api/products'))
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)  // 最低限空配列
  })
})
```

---

## 変更履歴

| バージョン | 日時 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2026-02-25 | 初版作成 |

---
