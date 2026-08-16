import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

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

const scenarios = JSON.parse(await readFile(new URL('../data/demo/scenarios.json', import.meta.url), 'utf8'))
const money = (n) => `S/${Number(n).toFixed(2)}`
const norm = (s='') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const offers = {
  current: { id:'POST-500', name:'500 GB', price:59.90, benefit:'Más datos', banner:'/promos/lucia-normal-500.webp' },
  discount: { id:'POST-170', name:'170 GB', price:45.90, benefit:'Plan gamer', banner:'/promos/lucia-discount-170.webp' },
  proration: { id:'POST-250', name:'250 GB', price:49.90, benefit:'Plan familiar', banner:'/promos/lucia-proration-250.webp' },
  reconnection: { id:'POST-280', name:'280 GB', price:55.90, benefit:'Apps y llamadas ilimitadas', banner:'/promos/lucia-reconnection-280.webp' },
}

function deterministic(message, scenario='current', history=[]) {
  const s = scenarios[scenario] || scenarios.current
  const t = norm(message)
  const answer = (text, extra={}) => ({ answer:text, source:(s.evidence||[]).join(' · '), suggestHuman:false, showOffer:false, ...extra })
  if (/(asesor|humano|operador|hablar con alguien)/.test(t)) return answer('Claro. Voy a conservar el contexto para que un asesor continúe sin pedirte que repitas todo.', { suggestHuman:true })
  if (/(oferta|promo|mejorar.*plan|mas gigas|otro plan)/.test(t)) {
    const resolved = scenario === 'current' || history.some(m => m.role === 'user' && /(ya entendi|ah ya|listo|gracias|ok)/.test(norm(m.text||'')))
    if (!resolved) return answer('Primero terminemos de aclarar el cobro actual. Después revisamos una oferta sin mezclar una venta con tu duda.')
    const o = offers[scenario]
    return answer(`Puedo mostrarte ${o.name} por ${money(o.price)} al mes.`, { showOffer:true, offer:o })
  }
  if (/(mes pasado|julio|anterior|cuanto pague)/.test(t)) return answer(`El recibo anterior fue de ${money(s.previous_receipt.total)} y el actual es ${money(s.current_receipt.total)}.`)
  if (/(prorr|proporcional)/.test(t)) return answer(scenario === 'proration' ? `Se cobraron solo los días usados: ${money(Math.abs(s.difference))}. Tu plan base no subió.` : 'En este recibo no aparece un prorrateo aplicado.')
  if (/(reconex|reactiv|suspend)/.test(t)) return answer(scenario === 'reconnection' ? `El adicional de ${money(Math.abs(s.difference))} corresponde a la reconexión. Tu plan base no cambió.` : 'En este recibo no aparece un cargo de reconexión.')
  if (/(descuent|bonific)/.test(t)) return answer(scenario === 'discount' ? `Este mes se aplicó una bonificación de ${money(Math.abs(s.difference))}.` : 'En este recibo no aparece una bonificación aplicada.')
  if (/(por que|porque|pq|xq|caro|subio|aumento|cobro|recibo|monto|total|eso|no entendi)/.test(t)) return answer(s.explanation)
  if (/^(hola|holi|buenas|oe|hey)/.test(t)) return answer('Hola 🙂. ¿Qué quieres revisar de tu recibo?')
  if (/^(ah ya|ya entendi|entendi|ok|listo|gracias)/.test(t)) return answer('Perfecto, dejamos aclarada esa parte. ¿Qué más quieres revisar?')
  return answer('No encuentro esa información en la evidencia disponible. Para no inventarte una respuesta, este punto debe revisarlo un asesor.', { suggestHuman:true })
}

async function withGemini(message, scenario, history, base) {
  const key = (process.env.GEMINI_API_KEY || '').trim()
  if (!key) return base
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim()
  const facts = scenarios[scenario] || scenarios.current
  const system = `Eres LucIA, asistente de facturación. Habla en español natural y breve. HECHOS=${JSON.stringify(facts)}. No inventes montos, fechas, cargos ni causas. Gemini solo redacta; la verdad financiera viene de HECHOS.`
  const prior = history.slice(-10).map(m => `${m.role==='user'?'Usuario':'LucIA'}: ${m.text||''}`).join('\n')
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({ systemInstruction:{parts:[{text:system}]}, contents:[{role:'user',parts:[{text:`${prior}\nUsuario: ${message}\nRespuesta base: ${base.answer}`}]}], generationConfig:{temperature:.2,maxOutputTokens:220} })
    })
    if (!r.ok) return base
    const data = await r.json()
    const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim()
    return text ? {...base, answer:text} : base
  } catch { return base }
}

const port = Number(process.env.LUCIA_PORT || 8787)
http.createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'GET' && url.pathname === '/api/health') { res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true,gemini:!!process.env.GEMINI_API_KEY})) }
  if (req.method === 'GET' && url.pathname === '/api/scenarios') { res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify(scenarios)) }
  if (req.method !== 'POST' || url.pathname !== '/api/lucia') { res.writeHead(404); return res.end('Not found') }
  let body=''; for await (const chunk of req) body += chunk
  try {
    const {message='',scenario='current',history=[]} = JSON.parse(body || '{}')
    const base = deterministic(message,scenario,history)
    const response = await withGemini(message,scenario,history,base)
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(response))
  } catch { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'bad_request'})) }
}).listen(port,'127.0.0.1',()=>console.log(`LucIA backend: http://127.0.0.1:${port}/api/lucia`))
