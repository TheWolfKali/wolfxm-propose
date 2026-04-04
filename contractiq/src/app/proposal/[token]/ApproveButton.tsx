'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ApproveButton({
  proposalId,
  companyName,
}: {
  proposalId: string
  companyName: string
}) {
  const [loading, setLoading] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('proposals')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', proposalId)

    if (err) {
      setError('Could not approve proposal. Please contact the contractor.')
      setLoading(false)
      return
    }

    setApproved(true)
    setLoading(false)
  }

  if (approved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-green-800 font-bold text-xl">Proposal Approved!</p>
        <p className="text-green-700 mt-2 leading-relaxed">
          {companyName} will be in touch shortly to schedule the work.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handleApprove}
        disabled={loading}
        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
      >
        {loading ? 'Approving…' : '✅ Approve This Proposal'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        By approving, you agree to the payment terms above.
      </p>
    </div>
  )
}
