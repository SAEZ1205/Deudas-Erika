export type EvidenceStatus = 'VERIFIED' | 'PARTIAL' | 'NONE'

export interface Receipt {
  month: string
  number: string
  total: number
  status?: string
  pdfUrl?: string
}

export interface BillingScenario {
  id: string
  label: string
  service: string
  plan: { name: string; price: number }
  current_receipt: Receipt
  previous_receipt: Receipt
  difference: number
  cause: string
  evidence_status: EvidenceStatus
  evidence: string[]
  explanation: string
}
