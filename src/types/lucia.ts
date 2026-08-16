export type LuciaRole = 'user' | 'bot'
export interface LuciaMessage { role: LuciaRole; text: string; source?: string }
export interface LuciaResponse { answer: string; source?: string; intent?: string; suggestHuman?: boolean; showOffer?: boolean; offer?: unknown }
