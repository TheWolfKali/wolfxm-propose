import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { z } from 'zod'

const RequestSchema = z.object({
  job_id: z.string().uuid(),
  description: z.string().min(1),
  job_type: z.string(),
  photo_urls: z.array(z.string()),
})

const LineItemSchema = z.object({
  description: z.string(),
  unit: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  total: z.number(),
})

const GeminiResponseSchema = z.object({
  jobSummary: z.string(),
  lineItems: z.array(LineItemSchema),
  laborHours: z.number(),
  warningFlags: z.array(z.string()),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  confidenceNote: z.string(),
})

const SYSTEM_PROMPT = `You are an expert construction estimator with 20 years of residential contracting experience specializing in foundations, crawlspaces, framing, and general remodeling. Analyze the provided job site photos and contractor description carefully.

Look for: extent of visible damage, materials present, access difficulty, moisture issues, structural concerns, scope of work required.

Return ONLY valid JSON, no other text:
{
  "jobSummary": "string",
  "lineItems": [{ "description": "string", "unit": "string", "qty": number, "unitPrice": number, "total": number }],
  "laborHours": number,
  "warningFlags": ["string"],
  "confidenceLevel": "high" | "medium" | "low",
  "confidenceNote": "string"
}`

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse + validate body
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }
    const { job_id, description, job_type, photo_urls } = parsed.data

    // Verify job belongs to this contractor
    const { data: job } = await supabase
      .from('jobs')
      .select('id, contractor_id')
      .eq('id', job_id)
      .eq('contractor_id', user.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch contractor settings
    const { data: contractor } = await supabase
      .from('contractors')
      .select('labor_rate, markup_pct')
      .eq('id', user.id)
      .single()

    const laborRate = contractor?.labor_rate ?? 75
    const markupPct = contractor?.markup_pct ?? 20

    // Build Gemini content parts
    const serviceClient = await createServiceClient()
    const parts: Part[] = []

    // Download and encode photos as base64
    for (const photoPath of photo_urls) {
      try {
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from('job-photos')
          .download(photoPath)

        if (downloadError || !fileData) {
          console.warn(`Failed to download photo ${photoPath}:`, downloadError?.message)
          continue
        }

        const arrayBuffer = await fileData.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
          },
        })
      } catch (err) {
        console.warn(`Error processing photo ${photoPath}:`, err)
      }
    }

    // Add text part
    parts.push({
      text: `${SYSTEM_PROMPT}\n\nJob Type: ${job_type}\nContractor Description: ${description}`,
    })

    // Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const textPart = parts.find((p) => 'text' in p) as { text: string } | undefined
    const content = parts.length > 1 ? parts : (textPart?.text ?? '')
    const result = await model.generateContent(content)
    const rawText = result.response.text()

    // Parse JSON from response (strip any markdown fences)
    let jsonText = rawText
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonText = fenceMatch[1]

    const aiData = GeminiResponseSchema.parse(JSON.parse(jsonText))

    // Calculate financials
    const materialSubtotal = aiData.lineItems.reduce((sum, item) => sum + item.total, 0)
    const laborCost = aiData.laborHours * laborRate
    const subtotal = materialSubtotal + laborCost
    const markupAmount = subtotal * (markupPct / 100)
    const grandTotal = subtotal + markupAmount

    // Recalculate line item totals to ensure consistency
    const normalizedLineItems = aiData.lineItems.map((item) => ({
      ...item,
      total: item.qty * item.unitPrice,
    }))

    // Save estimate to DB
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .insert({
        job_id,
        ai_raw_response: rawText,
        line_items: normalizedLineItems,
        labor_hours: aiData.laborHours,
        labor_rate: laborRate,
        markup_pct: markupPct,
        grand_total: grandTotal,
        warning_flags: aiData.warningFlags,
        confidence_level: aiData.confidenceLevel,
        confidence_note: aiData.confidenceNote,
        version: 1,
      })
      .select()
      .single()

    if (estimateError || !estimate) {
      throw new Error(estimateError?.message ?? 'Failed to save estimate')
    }

    return NextResponse.json({
      estimate,
      jobSummary: aiData.jobSummary,
      materialSubtotal,
      laborCost,
      subtotal,
      markupAmount,
      grandTotal,
    })
  } catch (err) {
    console.error('generate-estimate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
