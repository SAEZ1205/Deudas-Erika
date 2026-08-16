import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import twilio from 'twilio'
import { advisorCallCases, buildAdvisorCallSummary } from './advisor-call-data.mjs'

async function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(resolve(file), 'utf8')
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i < 1) continue
        const key = line.slice(0, i).trim()
        const value = line.slice(i + 1).trim()
        if (value && !process.env[key]) process.env[key] = value
      }
    } catch {}
  }
}
await loadEnv()

const port = Number(process.env.LUCIA_CALLS_PORT || 8790)

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function maskPhone(phone = '') {
  if (phone.length < 7) return '••••••'
  return `${phone.slice(0, 3)}******${phone.slice(-3)}`
}

function escapeXml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'GET' && url.pathname === '/api/calls/health') {
    return json(res, 200, { ok: true, configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER && process.env.ADVISOR_PHONE) })
  }
  if (req.method !== 'POST' || url.pathname !== '/api/calls/summary') {
    return json(res, 404, { ok: false, error: 'not_found' })
  }

  let body = ''
  for await (const chunk of req) body += chunk

  try {
    const { caseId = '' } = JSON.parse(body || '{}')
    const caseData = advisorCallCases[caseId]
    if (!caseData) return json(res, 404, { ok: false, code: 'CASE_NOT_FOUND', message: 'No se encontró el caso solicitado.' })

    const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim()
    const token = (process.env.TWILIO_AUTH_TOKEN || '').trim()
    const from = (process.env.TWILIO_FROM_NUMBER || '').trim()
    const to = (process.env.ADVISOR_PHONE || '').trim()

    if (!sid || !token || !from || !to) {
      return json(res, 503, { ok: false, code: 'TWILIO_NOT_CONFIGURED', message: 'La telefonía todavía no está configurada.' })
    }

    const summary = buildAdvisorCallSummary(caseData)
    const twiml = `<Response><Say language="es-MX">${escapeXml(summary)}</Say></Response>`
    console.log(`[CALL] Solicitud para ${caseId}`)
    const client = twilio(sid, token)
    const call = await client.calls.create({ to, from, twiml })
    console.log(`[CALL] Llamada creada ${call.sid}`)

    return json(res, 200, { ok: true, callSid: call.sid, caseId, toMasked: maskPhone(to) })
  } catch (error) {
    console.error('[CALL] Error:', error?.message || error)
    return json(res, 500, { ok: false, code: 'CALL_FAILED', message: 'No se pudo iniciar la llamada.' })
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`LucIA llamadas: http://127.0.0.1:${port}/api/calls/summary`)
})
