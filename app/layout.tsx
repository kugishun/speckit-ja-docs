import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'ユーザーチェックアウト',
  description: 'デモ決済フロー - 商品選択・決済・完了',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
