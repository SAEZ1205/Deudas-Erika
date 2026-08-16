import type { BillingScenario } from '../types/billing'

export async function getBillingScenarios(): Promise<Record<string, BillingScenario>> {
  const response = await fetch('http://127.0.0.1:8787/api/scenarios')
  if (!response.ok) throw new Error('No se pudieron cargar los escenarios')
  return response.json()
}
