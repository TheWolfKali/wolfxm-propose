'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-64 px-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-4">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
