/**
 * TypeScript Type Definitions
 * Based on: data-model.md
 */

/**
 * User (Supabase Auth)
 */
export interface User {
  id: string // UUID (auth.uid)
  email: string
  displayName: string // user_metadata.display_name
  createdAt: string // ISO 8601
}

/**
 * Product (販売商品)
 */
export interface Product {
  id: string // UUID
  productName: string
  amountJpy: number // 日本円, > 0
  createdAt: string // ISO 8601
  updatedAt?: string // ISO 8601
}

/**
 * Payment (取引)
 */
export type PaymentStatus = 'pending' | 'succeeded' | 'failed'

export interface Payment {
  id: string // UUID (PK)
  transactionId: string // TXN-YYYYMMDD-5CHARS
  userId: string // FK to auth.users
  userName: string // Non-normalized from user_metadata
  productName: string // Non-normalized from products
  amountJpy: number // 日本円
  status: PaymentStatus
  createdAt: string // ISO 8601
  updatedAt?: string // ISO 8601
}

/**
 * Discord Notification
 */
export type NotificationStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'retrying'
  | 'failed'

export interface DiscordNotification {
  id: string // UUID
  paymentId: string // FK to payments
  status: NotificationStatus
  attemptCount: number // 0-5
  maxAttempts: number // 5
  nextAttemptAt: string | null // ISO 8601
  lastAttemptAt: string | null // ISO 8601
  lastError: string | null
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/**
 * API Response Types
 */
export interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}

export interface ProductsResponse {
  products: Product[]
}

export interface NotificationResponse {
  notification: DiscordNotification | null
}

export interface PaymentResponse {
  payment: Payment
  transactionId: string
}

export interface ErrorResponse {
  error: string
  code?: string
}
