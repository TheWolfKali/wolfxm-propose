'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { JobStatus } from '@/lib/types/database'

interface Props {
  jobId: string
  estimateId: string | null
  shareUrl: string | null
  jobStatus: JobStatus
}

export default function JobActionButtons({ jobId, estimateId, shareUrl, jobStatus }: Props) {
  const router = useRouter()
  const [declining, setDeclining] = useState(false)
  const [resending, setResending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function markDeclined() {
    setDeclining(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ status: 'declined' }).eq('id', jobId)
    router.refresh()
    setDeclining(false)
  }

  async function resendProposal() {
    if (!shareUrl) return
    setResending(true)
    try {
      const nav = navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> }
      if (nav.share) {
        await nav.share({ title: 'Your Proposal', url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // ignore
    }
    setResending(false)
  }

  return (
    <div className="space-y-3 pb-6">
      <Link
        href={`/jobs/${jobId}/estimate`}
        className="block w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-center hover:bg-blue-700 active:bg-blue-800 transition-colors"
      >
        Edit Estimate
      </Link>

      {shareUrl && (
        <button
          onClick={resendProposal}
          disabled={resending}
          className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {copied ? '✓ Link Copied!' : resending ? 'Sharing…' : '📤 Resend Proposal'}
        </button>
      )}

      {jobStatus !== 'declined' && (
        <button
          onClick={markDeclined}
          disabled={declining}
          className="w-full bg-red-50 text-red-600 border border-red-200 py-3.5 rounded-xl font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {declining ? 'Updating…' : 'Mark as Declined'}
        </button>
      )}
    </div>
  )
}
