import type { LuciaMessage, LuciaResponse } from '../types/lucia'

const API = import.meta.env.VITE_LUCIA_API_URL || 'http://127.0.0.1:8787/api/lucia'

export async function askLucia(message: string, scenario: string, history: LuciaMessage[]): Promise<LuciaResponse> {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, scenario, history }),
  })
  if (!response.ok) throw new Error('LucIA backend no disponible')
  return response.json()
}
