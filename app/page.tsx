'use client'

import Link from 'next/link'
import { useSupabase } from './providers'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const { user, isLoading, signOut } = useSupabase()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || isLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="card">
          <p className="text-center">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-screen p-4">
        <div className="card max-w-md w-full">
          <h1 className="text-3xl font-bold mb-6 text-center">
            ユーザーチェックアウト
          </h1>
          <p className="text-gray-600 mb-8 text-center">
            デモ決済フロー - 商品選択から支払い完了まで
          </p>
          <div className="space-y-4">
            <Link href="/auth/login" className="btn-primary btn w-full block text-center">
              ログイン
            </Link>
            <Link href="/auth/signup" className="btn-secondary btn w-full block text-center">
              アカウント作成
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-8 text-center">
            このデモは Supabase による認証を使用しています
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      <div className="card max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">
          ユーザーチェックアウト
        </h1>
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">
            ログイン中: <strong>{user.email}</strong>
          </p>
        </div>
        <div className="space-y-4">
          <Link
            href="/checkout"
            className="btn-primary btn w-full block text-center"
          >
            チェックアウトを開始
          </Link>
          <button
            onClick={async () => {
              await signOut()
              router.push('/')
            }}
            className="btn-secondary btn w-full"
          >
            ログアウト
          </button>
        </div>
      </div>
    </main>
  )
}
