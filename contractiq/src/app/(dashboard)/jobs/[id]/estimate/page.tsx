'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LineItem, Estimate, Job, ConfidenceLevel } from '@/lib/types/database'

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function calcTotals(items: LineItem[], laborHours: number, laborRate: number, markupPct: number) {
  const materialSubtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const laborCost = laborHours * laborRate
  const subtotal = materialSubtotal + laborCost
  const markupAmount = subtotal * (markupPct / 100)
  const grandTotal = subtotal + markupAmount
  return { materialSubtotal, laborCost, subtotal, markupAmount, grandTotal }
}

interface ShareModalProps {
  shareUrl: string
  jobAddress: string | null
  onClose: () => void
  onShared: () => void
}

function ShareModal({ shareUrl, jobAddress, onClose, onShared }: ShareModalProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onShared()
    } catch {
      // fallback: select the URL text
    }
  }

  async function shareNative() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Your Proposal from WolfXM Propose',
          text: jobAddress
            ? `Here is your proposal for ${jobAddress}`
            : 'Here is your project proposal',
          url: shareUrl,
        })
        onShared()
      } catch {
        // user cancelled — fall through to copy
        await copyLink()
      }
    } else {
      await copyLink()
    }
  }

  function sendSMS() {
    const body = encodeURIComponent(`Hi, here is your proposal: ${shareUrl}`)
    window.open(`sms:?body=${body}`)
    onShared()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl shadow-2xl p-6 pb-safe space-y-5 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto -mt-2 mb-2" />

        <div>
          <h2 className="text-xl font-bold text-gray-900">Send to Homeowner</h2>
          <p className="text-sm text-gray-500 mt-1">Share this proposal link with your client</p>
        </div>

        {/* URL display */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-2">
          <p className="text-sm text-gray-600 truncate flex-1">{shareUrl}</p>
          <button
            onClick={copyLink}
            className="flex-shrink-0 text-slate-900 font-semibold text-sm hover:text-slate-800"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {'share' in (typeof navigator !== 'undefined' ? navigator : {}) && (
            <button
              onClick={shareNative}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold hover:bg-slate-800 active:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          )}

          <button
            onClick={copyLink}
            className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? '✓ Link Copied!' : 'Copy Link'}
          </button>

          <button
            onClick={sendSMS}
            className="w-full bg-green-50 text-green-700 border border-green-200 py-3.5 rounded-xl font-semibold hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Send SMS
          </button>
        </div>

        <button onClick={onClose} className="w-full text-gray-400 text-sm py-2">
          Close
        </button>
      </div>
    </div>
  )
}

export default function EstimatePage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [jobSummary, setJobSummary] = useState<string>('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [laborHours, setLaborHours] = useState(0)
  const [markupPct, setMarkupPct] = useState(20)
  const [laborRate, setLaborRate] = useState(75)
  const [existingShareUrl, setExistingShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: jobData } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (!jobData) {
      router.push('/dashboard')
      return
    }
    setJob(jobData)

    const { data: estimateData } = await supabase
      .from('estimates')
      .select('*')
      .eq('job_id', jobId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (estimateData) {
      setEstimate(estimateData)
      setLineItems(estimateData.line_items as LineItem[])
      setLaborHours(estimateData.labor_hours)
      setMarkupPct(estimateData.markup_pct)
      setLaborRate(estimateData.labor_rate)

      try {
        const raw = JSON.parse(estimateData.ai_raw_response)
        setJobSummary(raw.jobSummary ?? '')
      } catch {
        setJobSummary('')
      }

      // Check if proposal exists
      const { data: proposalData } = await supabase
        .from('proposals')
        .select('share_token')
        .eq('estimate_id', estimateData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (proposalData?.share_token) {
        const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
        setExistingShareUrl(`${base}/proposal/${proposalData.share_token}`)
      }
    }

    setLoading(false)
  }, [jobId, router])

  useEffect(() => { loadData() }, [loadData])

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: 'New item', unit: 'ea', qty: 1, unitPrice: 0, total: 0 },
    ])
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveEstimate() {
    if (!estimate) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const totals = calcTotals(lineItems, laborHours, laborRate, markupPct)

    const { error: err } = await supabase
      .from('estimates')
      .update({
        line_items: lineItems,
        labor_hours: laborHours,
        markup_pct: markupPct,
        grand_total: totals.grandTotal,
      })
      .eq('id', estimate.id)

    if (err) setError(err.message)
    setSaving(false)
  }

  async function handleSendToHomeowner() {
    if (!estimate) return
    setSendLoading(true)
    setError(null)

    // If a proposal already exists, just open the modal
    if (existingShareUrl) {
      setShareUrl(existingShareUrl)
      setShareModalOpen(true)
      setSendLoading(false)
      return
    }

    // Save latest edits first
    await saveEstimate()

    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimate_id: estimate.id, job_id: jobId }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'PDF generation failed')
      setSendLoading(false)
      return
    }

    const { share_url } = await res.json()
    setShareUrl(share_url)
    setExistingShareUrl(share_url)
    setShareModalOpen(true)
    setSendLoading(false)
  }

  async function handleShared() {
    const supabase = createClient()
    await supabase.from('jobs').update({ status: 'sent' }).eq('id', jobId)
    setJob((j) => j ? { ...j, status: 'sent' } : j)
  }

  async function handleRegenerate() {
    if (!job) return
    setRegenLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: photos } = await supabase
      .from('job_photos')
      .select('storage_url')
      .eq('job_id', jobId)
      .order('order')

    const res = await fetch('/api/generate-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        description: job.description,
        job_type: job.job_type,
        photo_urls: photos?.map((p) => p.storage_url) ?? [],
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Regeneration failed')
      setRegenLoading(false)
      return
    }

    await loadData()
    setRegenLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🤖</div>
          <p className="text-gray-500">Loading estimate…</p>
        </div>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-gray-700 font-semibold">Estimate not found</p>
        <p className="text-gray-500 text-sm mt-1">The AI may have failed to generate one.</p>
        <button
          onClick={() => router.push(`/jobs/new`)}
          className="mt-4 bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
        >
          Try again — new job
        </button>
        <button onClick={() => router.push('/dashboard')} className="mt-3 block mx-auto text-slate-900 hover:underline text-sm">
          Back to dashboard
        </button>
      </div>
    )
  }

  const totals = calcTotals(lineItems, laborHours, laborRate, markupPct)

  return (
    <>
      {shareModalOpen && (
        <ShareModal
          shareUrl={shareUrl}
          jobAddress={job?.address ?? null}
          onClose={() => setShareModalOpen(false)}
          onShared={handleShared}
        />
      )}

      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/jobs/${jobId}`)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 capitalize">{job?.job_type} Estimate</h1>
              {job?.address && <p className="text-sm text-gray-400">{job.address}</p>}
            </div>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CONFIDENCE_STYLES[estimate.confidence_level]}`}
          >
            {estimate.confidence_level} confidence
          </span>
        </div>

        {/* AI Summary */}
        {jobSummary && (
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-1">AI Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed">{jobSummary}</p>
            {estimate.confidence_note && (
              <p className="text-xs text-slate-900 mt-2 italic">{estimate.confidence_note}</p>
            )}
          </div>
        )}

        {/* Warning flags */}
        {estimate.warning_flags && estimate.warning_flags.length > 0 && (
          <div className="space-y-2">
            {(estimate.warning_flags as string[]).map((flag, i) => (
              <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex gap-2">
                <span className="text-yellow-500 flex-shrink-0">⚠️</span>
                <p className="text-sm text-yellow-800">{flag}</p>
              </div>
            ))}
          </div>
        )}

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Line Items</h2>
            <button onClick={addLineItem} className="text-sm text-slate-900 font-medium hover:text-slate-800">
              + Add item
            </button>
          </div>

          <div className="space-y-2">
            {lineItems.map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                    className="flex-1 text-sm font-medium text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-slate-500 focus:outline-none px-0 py-0.5 bg-transparent"
                  />
                  <button
                    onClick={() => removeLineItem(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-gray-400 block mb-0.5">Qty</label>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateLineItem(i, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-slate-500"
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Unit</label>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateLineItem(i, 'unit', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Unit $</label>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-slate-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Total</label>
                    <p className="py-1.5 text-gray-900 font-medium">
                      {formatCurrency(item.qty * item.unitPrice)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Labor */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Labor</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hours</label>
              <input
                type="number"
                value={laborHours}
                onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-slate-500"
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rate ($/hr)</label>
              <input
                type="number"
                value={laborRate}
                onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-slate-500"
                min="0"
                step="1"
              />
            </div>
          </div>
        </div>

        {/* Markup slider */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Markup</h3>
            <span className="text-slate-900 font-bold text-lg">{markupPct}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            value={markupPct}
            onChange={(e) => setMarkupPct(parseInt(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>10%</span>
            <span>50%</span>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-900 text-white rounded-2xl p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-300">
            <span>Materials</span>
            <span>{formatCurrency(totals.materialSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-300">
            <span>Labor ({laborHours}h × ${laborRate}/hr)</span>
            <span>{formatCurrency(totals.laborCost)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-300">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-300">
            <span>Markup ({markupPct}%)</span>
            <span>{formatCurrency(totals.markupAmount)}</span>
          </div>
          <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between">
            <span className="text-lg font-bold">Grand Total</span>
            <span className="text-2xl font-bold text-slate-200">{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleSendToHomeowner}
            disabled={sendLoading || saving}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-base hover:bg-slate-800 active:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {sendLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating PDF…
              </>
            ) : existingShareUrl ? (
              '📤 Send to Homeowner'
            ) : (
              '📄 Generate & Send to Homeowner'
            )}
          </button>

          <div className="flex gap-3">
            <button
              onClick={saveEstimate}
              disabled={saving}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenLoading}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {regenLoading ? 'Regenerating…' : '🔄 Regenerate'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
