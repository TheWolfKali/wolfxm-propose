'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { JobStatus } from '@/lib/types/database'

const STATUS_STYLES: Record<JobStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
}

const JOB_TYPE_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  crawlspace: 'Crawlspace',
  framing: 'Framing',
  roofing: 'Roofing',
  remodel: 'Remodel',
  other: 'Other',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

interface JobRow {
  id: string
  job_type: string
  description: string
  status: JobStatus
  address: string | null
  created_at: string
  estimates: { grand_total: number }[] | null
}

interface Props {
  initialJobs: JobRow[]
  userId: string
  pipelineValue: number
}

export default function DashboardClient({ initialJobs, userId, pipelineValue: initialPipeline }: Props) {
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs)
  const [pipeline, setPipeline] = useState(initialPipeline)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `contractor_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as JobRow
          setJobs((prev) => {
            const next = prev.map((j) =>
              j.id === updated.id ? { ...j, status: updated.status } : j
            )
            // Recalculate pipeline
            const newPipeline = next.reduce((sum, job) => {
              if (job.status === 'declined') return sum
              const latest = job.estimates?.[0]
              return sum + (latest?.grand_total ?? 0)
            }, 0)
            setPipeline(newPipeline)
            return next
          })

          if (updated.status === 'approved') {
            setToast('Job approved by homeowner!')
            setTimeout(() => setToast(null), 5000)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-green-600 text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 animate-pulse">
          <span className="text-xl">✅</span>
          <p className="font-semibold">{toast}</p>
          <button onClick={() => setToast(null)} className="ml-auto text-green-200 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your jobs &amp; proposals</p>
        </div>
        <Link
          href="/jobs/new"
          className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 active:bg-slate-700 transition-colors shadow-sm"
        >
          + New Job
        </Link>
      </div>

      {/* Pipeline value card */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white">
        <p className="text-slate-200 text-sm font-medium">Total Pipeline Value</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(pipeline)}</p>
        <p className="text-slate-300 text-xs mt-1">Excludes declined proposals</p>
      </div>

      {/* Jobs list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          All Jobs ({jobs.length})
        </h2>

        {jobs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <div className="text-4xl mb-3">🏗️</div>
            <p className="text-gray-600 font-medium">No jobs yet</p>
            <p className="text-gray-400 text-sm mt-1">Tap &ldquo;New Job&rdquo; to get started</p>
            <Link
              href="/jobs/new"
              className="mt-4 inline-block bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
            >
              Create your first job
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const estimate = job.estimates?.[0]
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[job.status]}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      {job.address && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{job.address}</p>
                      )}
                      <p className="text-sm text-gray-400 mt-1 line-clamp-1">{job.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {estimate ? (
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(estimate.grand_total)}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">No estimate</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
