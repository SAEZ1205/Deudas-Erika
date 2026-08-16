import type { AdvisorCase } from '../types/case'

export function buildHandoffCase(input: Omit<AdvisorCase, 'id' | 'status'>): AdvisorCase {
  return { id: `CASE-${Date.now()}`, status: 'PENDING', ...input }
}
