export interface AdvisorCase {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'
  scenario: string
  customer?: string
  summary: string
  reason: string
}
