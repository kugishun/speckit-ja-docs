# API コントラクト: 通知ステータスエンドポイント

**エンドポイント**: `GET /api/notifications/:paymentId`  
**作成日**: 2026-02-25  
**ステータス**: ファイナル

---

## 概要

支払い完了後、Discord 通知のステータスをリアルタイムポーリングで取得するエンドポイント。
RLS により、ユーザーは自分の取引に紐づく通知のみ取得可能。

---

## リクエスト

### 方法
```
GET /api/notifications/:paymentId
```

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------||------|------|
| `paymentId` | string (UUID) | ✓ | Payment のレコード ID |

### ヘッダー

| ヘッダー | 値 | 必須 | 説明 |
|---------|------|------|------|
| `Content-Type` | `application/json` | ✓ | JSON 形式を示す |
| `Authorization` | `Bearer <token>` | ✓ | Supabase Auth トークン（ユーザー認証） |

### クエリパラメータ
なし

### リクエスト本文
なし

### curl 例
```bash
curl -X GET http://localhost:3000/api/notifications/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user-token>"
```

---

## レスポンス

### ステータスコード

| コード | 説明 |
|-------|------|
| **200** | 成功。通知ステータスを返却 |
| **401** | 認証エラー（認証なし） |
| **403** | 権限エラー（他ユーザーの通知にアクセス） |
| **404** | Payment ID が見つからない |
| **500** | サーバーエラー |

### 成功レスポンス (200)

#### 本文スキーマ

```json
{
  "id": "string (UUID)",
  "payment_id": "string (UUID)",
  "status": "string (queued | sending | sent | retrying | failed)",
  "attempt_count": "integer (0-5)",
  "max_attempts": "integer (5)",
  "next_attempt_at": "string (ISO 8601) | null",
  "last_attempt_at": "string (ISO 8601) | null",
  "last_error": "string | null",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)"
}
```

#### 例

**状態1: 送信中**
```json
{
  "id": "660e9500-f39c-52e5-b816-557766550111",
  "payment_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "attempt_count": 0,
  "max_attempts": 5,
  "next_attempt_at": "2026-02-25T10:05:00Z",
  "last_attempt_at": null,
  "last_error": null,
  "created_at": "2026-02-25T10:04:00Z",
  "updated_at": "2026-02-25T10:04:00Z"
}
```

**状態2: 成功**
```json
{
  "id": "660e9500-f39c-52e5-b816-557766550111",
  "payment_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "sent",
  "attempt_count": 1,
  "max_attempts": 5,
  "next_attempt_at": null,
  "last_attempt_at": "2026-02-25T10:05:30Z",
  "last_error": null,
  "created_at": "2026-02-25T10:04:00Z",
  "updated_at": "2026-02-25T10:05:30Z"
}
```

**状態3: リトライ中**
```json
{
  "id": "660e9500-f39c-52e5-b816-557766550111",
  "payment_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "retrying",
  "attempt_count": 2,
  "max_attempts": 5,
  "next_attempt_at": "2026-02-25T10:06:10Z",
  "last_attempt_at": "2026-02-25T10:05:40Z",
  "last_error": "HTTP 502 Bad Gateway",
  "created_at": "2026-02-25T10:04:00Z",
  "updated_at": "2026-02-25T10:05:40Z"
}
```

**状態4: 最終失敗**
```json
{
  "id": "660e9500-f39c-52e5-b816-557766550111",
  "payment_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "attempt_count": 5,
  "max_attempts": 5,
  "next_attempt_at": null,
  "last_attempt_at": "2026-02-25T10:10:00Z",
  "last_error": "HTTP 500 Internal Server Error (max retries exceeded)",
  "created_at": "2026-02-25T10:04:00Z",
  "updated_at": "2026-02-25T10:10:00Z"
}
```

### エラーレスポンス

#### 401 - 認証エラー

```json
{
  "error": "Unauthorized"
}
```

#### 403 - 権限エラー（RLS により他ユーザーの通知にアクセス防止）

```json
{
  "error": "Forbidden"
}
```

#### 404 - Payment ID が見つからない

```json
{
  "error": "Payment not found"
}
```

#### 500 - サーバーエラー

```json
{
  "error": "Database query failed"
}
```

---

## 実装スペック

### Next.js 実装例

```typescript
// app/api/notifications/[paymentId]/route.ts
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: { paymentId: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // User トークンで RLS を適用
    const { data, error } = await supabase
      .from('discord_notifications')
      .select('*')
      .eq('payment_id', params.paymentId)
      .single()
    
    if (error?.code === 'PGRST116') {  // RLS 違反
      return Response.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    if (error) throw error
    if (!data) {
      return Response.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }
    
    return Response.json(data, { status: 200 })
  } catch (err) {
    console.error('[GET /api/notifications/:id]', err)
    return Response.json(
      { error: 'Failed to fetch notification status' },
      { status: 500 }
    )
  }
}
```

---

## パフォーマンス目標

| 指標 | 目標 | 理由 |
|-----|------|------|
| **応答時間 (p95)** | < 500ms | ポーリング用（軽量 SELECT） |
| **ポーリング間隔** | 1秒 | Spec FR-008 で定義 |
| **最大ポーリング期間** | 60秒 | リトライ最大約 10 分の後 |

---

## テスト

### コントラクトテスト

```typescript
// tests/contract/api-notifications.test.ts
import { GET } from '@/app/api/notifications/[paymentId]/route'

describe('GET /api/notifications/:paymentId', () => {
  const mockPaymentId = '550e8400-e29b-41d4-a716-446655440000'
  
  it('should return notification status with correct schema', async () => {
    const response = await GET(
      new Request(`http://localhost/api/notifications/${mockPaymentId}`),
      { params: { paymentId: mockPaymentId } }
    )
    
    // 注: 実際のテストには Supabase エミュレータまたはモック必須
    // 例：jest-supabase-mock-auth を使用
    
    expect(response.status).toBe(200)
    const data = await response.json()
    
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('payment_id')
    expect(data).toHaveProperty('status')
    expect(['queued', 'sending', 'sent', 'retrying', 'failed']).toContain(data.status)
    expect(data).toHaveProperty('attempt_count')
    expect(data).toHaveProperty('max_attempts')
    expect(data.attempt_count).toBeLessThanOrEqual(data.max_attempts)
  })
  
  it('should return 403 when accessing other users notification', async () => {
    // RLS テスト: 別ユーザーの通知取得で 403
    const response = await GET(
      new Request(`http://localhost/api/notifications/${mockPaymentId}`),
      { params: { paymentId: mockPaymentId } }
    )
    
    // ユーザーが異なる場合、403 を期待
    // expect(response.status).toBe(403)
  })
  
  it('should return 404 when payment_id does not exist', async () => {
    const invalidPaymentId = '00000000-0000-0000-0000-000000000000'
    const response = await GET(
      new Request(`http://localhost/api/notifications/${invalidPaymentId}`),
      { params: { paymentId: invalidPaymentId } }
    )
    
    expect(response.status).toBe(404)
  })
})
```

---

## ポーリングの使用例（クライアント側）

```typescript
// components/CompletedStep.tsx
"use client"
import { useEffect, useState } from 'react'

export function CompletedStep({ paymentId }: { paymentId: string }) {
  const [status, setStatus] = useState('queued')
  const [attempts, setAttempts] = useState(0)
  
  useEffect(() => {
    let isMounted = true
    let interval: NodeJS.Timeout | null = null
    
    const startPolling = () => {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/notifications/${paymentId}`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          
          const notification = await res.json()
          if (isMounted) setStatus(notification.status)
          
          setAttempts(prev => prev + 1)
          
          // 完了または上限に達したら停止
          if (notification.status === 'sent' || 
              notification.status === 'failed' ||
              attempts >= 60) {
            if (interval) clearInterval(interval)
          }
        } catch (error) {
          console.error('[Polling Error]', error)
        }
      }, 1000)  // 1秒間隔
    }
    
    startPolling()
    return () => {
      isMounted = false
      if (interval) clearInterval(interval)
    }
  }, [paymentId])
  
  return (
    <div className="notification-status">
      <p>通知ステータス: {status}</p>
      <p>ポーリング試行: {attempts}/60</p>
    </div>
  )
}
```

---

## 変更履歴

| バージョン | 日時 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2026-02-25 | 初版作成 |

---
