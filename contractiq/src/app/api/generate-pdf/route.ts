import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { renderToBuffer, Document } from '@react-pdf/renderer'
import { ProposalDocument } from '@/lib/pdf/ProposalDocument'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import React from 'react'
import { LineItem, Contractor, Job } from '@/lib/types/database'

const RequestSchema = z.object({
  estimate_id: z.string().uuid(),
  job_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { estimate_id, job_id } = parsed.data

    const { data: estimate } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimate_id)
      .single()

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .eq('contractor_id', user.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { data: contractor } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    // Calculate financials
    const lineItems = estimate.line_items as LineItem[]
    const laborHours = estimate.labor_hours as number
    const laborRate = estimate.labor_rate as number
    const markupPct = estimate.markup_pct as number
    const materialSubtotal = lineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const laborCost = laborHours * laborRate
    const subtotal = materialSubtotal + laborCost
    const markupAmount = subtotal * (markupPct / 100)
    const grandTotal = subtotal + markupAmount

    const proposalDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Fetch contractor logo as base64 for PDF embedding
    let logoBase64: string | undefined
    if (contractor.logo_url) {
      try {
        const logoRes = await fetch(contractor.logo_url)
        if (logoRes.ok) {
          const arrayBuf = await logoRes.arrayBuffer()
          const mimeType = logoRes.headers.get('content-type') ?? 'image/png'
          logoBase64 = `data:${mimeType};base64,${Buffer.from(arrayBuf).toString('base64')}`
        }
      } catch {
        // Logo fetch failed — proceed without it
      }
    }

    // Generate PDF buffer
    const docElement = React.createElement(ProposalDocument, {
      contractor: contractor as Contractor,
      job: job as Job,
      lineItems,
      laborHours,
      laborRate,
      markupPct,
      materialSubtotal,
      laborCost,
      subtotal,
      markupAmount,
      grandTotal,
      proposalDate,
      logoBase64,
    }) as unknown as ReactElement<DocumentProps, typeof Document>

    const pdfBuffer = await renderToBuffer(docElement)

    // Upload PDF
    const shareToken = nanoid(12)
    const pdfPath = `proposals/${shareToken}.pdf`

    const serviceClient = await createServiceClient()
    const { error: uploadError } = await serviceClient.storage
      .from('proposals')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`PDF upload failed: ${uploadError.message}`)
    }

    const { data: { publicUrl } } = serviceClient.storage
      .from('proposals')
      .getPublicUrl(pdfPath)

    const { error: proposalError } = await supabase
      .from('proposals')
      .insert({
        estimate_id,
        pdf_url: publicUrl,
        share_token: shareToken,
        sent_at: new Date().toISOString(),
      })

    if (proposalError) {
      throw new Error(proposalError.message)
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get('origin') ?? ''
    const shareUrl = `${baseUrl}/proposal/${shareToken}`

    return NextResponse.json({ share_url: shareUrl, share_token: shareToken, pdf_url: publicUrl })
  } catch (err) {
    console.error('generate-pdf error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
