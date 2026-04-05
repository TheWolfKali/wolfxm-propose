import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { JobStatus, JobType } from '@/lib/types/database'
import JobActionButtons from './JobActionButtons'

const STATUS_STYLES: Record<JobStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
}

const JOB_TYPE_LABELS: Record<JobType, string> = {
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

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch job
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('contractor_id', user.id)
    .single()

  if (!job) notFound()

  // Fetch photos (signed URLs)
  const serviceClient = await createServiceClient()
  const { data: photos } = await supabase
    .from('job_photos')
    .select('storage_url, order')
    .eq('job_id', id)
    .order('order')

  const signedPhotos: string[] = []
  if (photos && photos.length > 0) {
    const { data: signed } = await serviceClient.storage
      .from('job-photos')
      .createSignedUrls(
        photos.map((p) => p.storage_url),
        3600
      )
    if (signed) {
      signedPhotos.push(...signed.map((s) => s.signedUrl))
    }
  }

  // Fetch latest estimate
  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('job_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch proposal
  const proposal = estimate
    ? (
        await supabase
          .from('proposals')
          .select('*')
          .eq('estimate_id', estimate.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data
    : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const shareUrl = proposal?.share_token ? `${siteUrl}/proposal/${proposal.share_token}` : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">
            {JOB_TYPE_LABELS[job.job_type as JobType] ?? job.job_type}
          </h1>
          {job.address && <p className="text-sm text-gray-500 truncate">{job.address}</p>}
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[job.status as JobStatus]}`}>
          {job.status}
        </span>
      </div>

      {/* Job info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Job Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Type</p>
            <p className="font-medium text-gray-900 mt-0.5">
              {JOB_TYPE_LABELS[job.job_type as JobType] ?? job.job_type}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Created</p>
            <p className="font-medium text-gray-900 mt-0.5">{formatDate(job.created_at)}</p>
          </div>
          {job.address && (
            <div className="col-span-2">
              <p className="text-gray-500 text-xs">Address</p>
              <p className="font-medium text-gray-900 mt-0.5">{job.address}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-gray-500 text-xs">Description</p>
            <p className="text-gray-700 mt-0.5 text-sm leading-relaxed">{job.description}</p>
          </div>
        </div>
      </div>

      {/* Photos */}
      {signedPhotos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Photos ({signedPhotos.length})
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {signedPhotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Job photo ${i + 1}`}
                  className="aspect-square w-full object-cover rounded-xl"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Estimate */}
      {estimate ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Estimate</h2>
            <Link
              href={`/jobs/${id}/estimate`}
              className="text-sm text-slate-900 font-medium hover:text-slate-700"
            >
              Edit
            </Link>
          </div>
          <div className="space-y-1.5 text-sm">
            {(estimate.line_items as { description: string; qty: number; unitPrice: number; unit: string }[]).map(
              (item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-gray-700 truncate flex-1">{item.description}</span>
                  <span className="text-gray-500 flex-shrink-0">
                    {item.qty} {item.unit}
                  </span>
                  <span className="text-gray-900 font-medium flex-shrink-0">
                    {formatCurrency(item.qty * item.unitPrice)}
                  </span>
                </div>
              )
            )}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
            <span className="font-bold text-gray-900">Grand Total</span>
            <span className="font-bold text-slate-900 text-lg">{formatCurrency(estimate.grand_total)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 text-center">
          <p className="text-gray-500 text-sm">No estimate yet</p>
          <Link
            href={`/jobs/${id}/estimate`}
            className="mt-3 inline-block bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            Generate Estimate
          </Link>
        </div>
      )}

      {/* Proposal status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Proposal Status</h2>
        {proposal ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sent</span>
              <span className="text-gray-900">{proposal.sent_at ? formatDate(proposal.sent_at) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Viewed</span>
              <span className={proposal.viewed_at ? 'text-slate-900 font-medium' : 'text-gray-400'}>
                {proposal.viewed_at ? formatDate(proposal.viewed_at) : 'Not yet'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Approved</span>
              <span className={proposal.approved_at ? 'text-green-600 font-bold' : 'text-gray-400'}>
                {proposal.approved_at ? formatDate(proposal.approved_at) : 'Pending'}
              </span>
            </div>
            {shareUrl && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Share link</p>
                <p className="text-xs text-slate-900 break-all">{shareUrl}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No proposal generated yet</p>
        )}
      </div>

      {/* Action buttons */}
      <JobActionButtons
        jobId={id}
        estimateId={estimate?.id ?? null}
        shareUrl={shareUrl}
        jobStatus={job.status as JobStatus}
      />
    </div>
  )
}
