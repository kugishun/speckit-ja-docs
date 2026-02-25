'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      <div className="card max-w-md w-full border-l-4 border-red-500">
        <h2 className="text-2xl font-bold mb-4 text-red-600">エラーが発生しました</h2>
        <p className="text-gray-600 mb-6">
          申し訳ございません。エラーが発生しました。もう一度お試しください。
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
        <button onClick={() => reset()} className="btn-primary btn w-full">
          もう一度試す
        </button>
      </div>
    </main>
  )
}
