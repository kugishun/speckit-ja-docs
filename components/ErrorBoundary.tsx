'use client'

import React, { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="card border-l-4 border-red-500">
            <h2 className="text-xl font-bold text-red-600 mb-2">
              エラーが発生しました
            </h2>
            <p className="text-gray-600 mb-4">
              予期しないエラーが発生しました。ページをリロードしてください。
            </p>
            <details className="text-sm text-gray-500 whitespace-pre-wrap">
              <summary className="cursor-pointer font-semibold">
                詳細情報
              </summary>
              <pre className="mt-2">{this.state.error?.toString()}</pre>
            </details>
          </div>
        )
      )
    }

    return this.props.children
  }
}
