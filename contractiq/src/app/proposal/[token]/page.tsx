import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LineItem, Contractor, Job, Estimate, Proposal } from '@/lib/types/database'
import ApproveButton from './ApproveButton'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('share_token', token)
    .single()

  if (!proposal) notFound()

  // Track first view
  if (!proposal.viewed_at) {
    await supabase
      .from('proposals')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', proposal.id)
  }

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', (proposal as Proposal).estimate_id)
    .single()

  if (!estimate) notFound()

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', (estimate as Estimate).job_id)
    .single()

  if (!job) notFound()

  const { data: contractor } = await supabase
    .from('contractors')
    .select('company_name, email, license_no, zip, logo_url')
    .eq('id', (job as Job).contractor_id)
    .single()

  if (!contractor) notFound()

  const lineItems = (estimate as Estimate).line_items as LineItem[]
  const laborHours = (estimate as Estimate).labor_hours
  const laborRate = (estimate as Estimate).labor_rate
  const markupPct = (estimate as Estimate).markup_pct
  const materialSubtotal = lineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const laborCost = laborHours * laborRate
  const subtotal = materialSubtotal + laborCost
  const markupAmount = subtotal * (markupPct / 100)
  const grandTotal = subtotal + markupAmount

  const jobTypeLabel = (job as Job).job_type.charAt(0).toUpperCase() + (job as Job).job_type.slice(1)
  const isApproved = !!(proposal as Proposal).approved_at
  const co = contractor as Contractor & { logo_url?: string | null }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <div className="flex items-start gap-4">
            {co.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={co.logo_url}
                alt={co.company_name}
                className="w-14 h-14 rounded-xl object-cover bg-white/20 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-2xl font-bold">
                {co.company_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-slate-300 text-xs font-medium mb-0.5">Proposal from</p>
              <h1 className="text-xl font-bold leading-tight">{co.company_name}</h1>
              {co.license_no && (
                <p className="text-slate-300 text-sm mt-0.5">License #{co.license_no}</p>
              )}
              <p className="text-slate-300 text-sm truncate">{co.email}</p>
            </div>
          </div>
        </div>

        {/* Approved banner */}
        {isApproved && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-green-800 font-bold text-lg">✅ Proposal Approved</p>
            <p className="text-green-600 text-sm mt-1">
              Approved on {formatDate((proposal as Proposal).approved_at!)}
            </p>
          </div>
        )}

        {/* Job details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 text-lg mb-3">{jobTypeLabel} Work</h2>
          <div className="space-y-2 text-sm">
            {(job as Job).address && (
              <div className="flex gap-3">
                <span className="text-gray-400 w-16 flex-shrink-0">Address</span>
                <span className="text-gray-900 font-medium">{(job as Job).address}</span>
              </div>
            )}
            <div className="flex gap-3">
              <span className="text-gray-400 w-16 flex-shrink-0">Date</span>
              <span className="text-gray-900">{formatDate((proposal as Proposal).sent_at)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Scope of Work</p>
            <p className="text-sm text-gray-700 leading-relaxed">{(job as Job).description}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-bold text-gray-900">Line Items</h2>
          </div>

          <div className="border-t border-gray-100 divide-y divide-gray-100">
            {lineItems.map((item, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-gray-900 flex-1">{item.description}</span>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    {formatCurrency(item.qty * item.unitPrice)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.qty} {item.unit} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Materials</span>
              <span className="text-gray-900">{formatCurrency(materialSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Labor ({laborHours}h @ ${laborRate}/hr)</span>
              <span className="text-gray-900">{formatCurrency(laborCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Markup ({markupPct}%)</span>
              <span className="text-gray-900">{formatCurrency(markupAmount)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-200 items-center">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Payment Terms</h2>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li>• 50% deposit required to schedule work</li>
            <li>• Remaining balance due upon completion</li>
            <li>• Accepted: check, ACH, or credit card (3% fee)</li>
            <li>• 1-year labor warranty · Manufacturer warranty on materials</li>
          </ul>
          <p className="mt-4 text-sm font-semibold text-gray-700">
            This proposal is valid for 30 days.
          </p>
        </div>

        {/* PDF download */}
        {(proposal as Proposal).pdf_url && (
          <a
            href={(proposal as Proposal).pdf_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </a>
        )}

        {/* Approve button */}
        {!isApproved && (
          <ApproveButton
            proposalId={(proposal as Proposal).id}
            companyName={co.company_name}
          />
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by WolfXM Propose
        </p>
      </div>
    </div>
  )
}
