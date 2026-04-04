export type JobType = 'foundation' | 'crawlspace' | 'framing' | 'roofing' | 'remodel' | 'other'
export type JobStatus = 'draft' | 'sent' | 'approved' | 'declined'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface Contractor {
  id: string // = auth.uid
  email: string
  company_name: string
  logo_url: string | null
  labor_rate: number
  markup_pct: number
  zip: string | null
  license_no: string | null
  created_at: string
}

export interface Job {
  id: string
  contractor_id: string
  job_type: JobType
  description: string
  status: JobStatus
  address: string | null
  created_at: string
}

export interface JobPhoto {
  id: string
  job_id: string
  storage_url: string
  order: number
}

export interface LineItem {
  description: string
  unit: string
  qty: number
  unitPrice: number
  total: number
}

export interface Estimate {
  id: string
  job_id: string
  ai_raw_response: string
  line_items: LineItem[]
  labor_hours: number
  labor_rate: number
  markup_pct: number
  grand_total: number
  warning_flags: string[]
  confidence_level: ConfidenceLevel
  confidence_note: string
  version: number
  created_at: string
}

export interface Proposal {
  id: string
  estimate_id: string
  pdf_url: string | null
  share_token: string
  sent_at: string | null
  viewed_at: string | null
  approved_at: string | null
}

// Joined types for UI
export interface JobWithEstimate extends Job {
  estimates?: Estimate[]
  job_photos?: JobPhoto[]
}

export interface EstimateCalculation {
  materialSubtotal: number
  laborCost: number
  subtotal: number
  markupAmount: number
  grandTotal: number
}
