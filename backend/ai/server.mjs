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
const DATA_ENGINE_URL =
  process.env.DATA_ENGINE_URL ||
  'http://127.0.0.1:8000'


const demoClients = {
  reconnection: {
    customerKey: 40185997,
    subscriberKey: 190919663
  },

  proration: {
    customerKey: 48597019,
    subscriberKey: 200853636
  },

  unverified: {
    customerKey: 48425384,
    subscriberKey: 144739258
  }
}


async function getFinancialFacts(scenario) {

  const client = demoClients[scenario]

  if (!client) {
    return null
  }

  try {

    const response = await fetch(
      `${DATA_ENGINE_URL}/api/analysis/` +
      `${client.customerKey}/` +
      `${client.subscriberKey}`
    )

    if (!response.ok) {
      console.error(
        'DataEngine respondiÃ³:',
        response.status
      )

      return null
    }

    return await response.json()

  } catch (error) {

    console.error(
      'No se pudo consultar DataEngine:',
      error.message
    )

    return null
  }
}
const money = (n) => `S/${Number(n).toFixed(2)}`
const norm = (s='') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const offers = {
  current: { id:'POST-500', name:'500 GB', price:59.90, benefit:'MÃ¡s datos', banner:'/promos/lucia-normal-500.webp' },
  discount: { id:'POST-170', name:'170 GB', price:45.90, benefit:'Plan gamer', banner:'/promos/lucia-discount-170.webp' },
  proration: { id:'POST-250', name:'250 GB', price:49.90, benefit:'Plan familiar', banner:'/promos/lucia-proration-250.webp' },
  reconnection: { id:'POST-280', name:'280 GB', price:55.90, benefit:'Apps y llamadas ilimitadas', banner:'/promos/lucia-reconnection-280.webp' },
}

function deterministic(
  message,
  scenario = 'current',
  history = [],
  financialFacts = null
) {

  // --------------------------------------------------
  // FUENTE DE DATOS
  // --------------------------------------------------

  const s =
    financialFacts ||
    scenarios[scenario] ||
    scenarios.current


  const t = norm(message)


  // --------------------------------------------------
  // NORMALIZAR FORMATO VIEJO / DATA ENGINE
  // --------------------------------------------------

  const previousTotal =
    s.previous_bill?.total ??
    s.previous_receipt?.total ??
    null

  const currentTotal =
    s.current_bill?.total ??
    s.current_receipt?.total ??
    null

  const difference =
    s.difference ??
    (
      previousTotal != null &&
      currentTotal != null
        ? Number(
            (
              currentTotal - previousTotal
            ).toFixed(2)
          )
        : null
    )


  const engineScenario =
    s.scenario ||
    scenario


  const evidenceStatus =
    s.evidence_status ||
    'VERIFIED'


  const requiresHandoff =
    s.requires_handoff ??
    false


  const charges =
    Array.isArray(s.charges)
      ? s.charges
      : []


  const evidence =
    Array.isArray(s.evidence)
      ? s.evidence
      : []


  // --------------------------------------------------
  // FUENTE LEGIBLE
  // --------------------------------------------------

  const sourceText = evidence
    .map(item => {

      if (typeof item === 'string') {
        return item
      }

      if (!item || typeof item !== 'object') {
        return ''
      }

      const parts = [
        item.source,
        item.event,
        item.description
      ].filter(Boolean)

      return parts.join(': ')
    })
    .filter(Boolean)
    .join(' Â· ')


  // --------------------------------------------------
  // RESPUESTA BASE
  // --------------------------------------------------

  const answer = (
    text,
    extra = {}
  ) => ({
    answer: text,
    source: sourceText,
    suggestHuman: requiresHandoff,
    showOffer: false,
    evidenceStatus,
    ...extra
  })


  // --------------------------------------------------
  // EXPLICACIÃ“N SEGÃšN DATA ENGINE
  // --------------------------------------------------

  let explanation =
    s.explanation ||
    'No encuentro una causa confirmada en la evidencia disponible.'


  if (engineScenario === 'RECONNECTION') {

    const reconnectionCharge =
      charges.find(
        charge =>
          norm(charge.description || '')
            .includes('reconexion')
      )

    const amount =
      reconnectionCharge?.amount ??
      Math.abs(difference || 0)

    explanation =
      `El recibo actual es de ${money(currentTotal)} ` +
      `y el anterior fue de ${money(previousTotal)}. ` +
      `La diferencia es de ${money(Math.abs(difference))}. ` +
      `En el recibo aparece un cargo por reconexiÃ³n de ` +
      `${money(amount)}, respaldado por registros de ` +
      `suspensiÃ³n y reactivaciÃ³n del servicio.`
  }


  else if (engineScenario === 'PRORATION') {

    const amount =
      s.proration_amount ??
      charges.find(
        charge =>
          norm(charge.group || '')
            .includes('proporcional')
      )?.amount

    explanation =
      `El recibo actual es de ${money(currentTotal)} ` +
      `y el anterior fue de ${money(previousTotal)}. ` +
      `La diferencia total es de ${money(Math.abs(difference))}. ` +
      `En el recibo actual aparece un cargo fijo proporcional ` +
      `de ${money(amount)}. ` +
      `AdemÃ¡s, existe una orden de cambio terminada asociada ` +
      `al mismo servicio.`

    if (
      Array.isArray(s.limitations) &&
      s.limitations.length > 0
    ) {
      explanation +=
        ` No puedo confirmar el cÃ¡lculo exacto por dÃ­as ` +
        `porque la evidencia disponible no permite validarlo.`
    }
  }


  else if (engineScenario === 'UNVERIFIED_CHARGE') {

    const charge =
      charges[0]

    const description =
      charge?.description ||
      'un cargo nuevo'

    const amount =
      charge?.amount

    explanation =
      `DetectÃ© ${description}` +
      (
        amount != null
          ? ` por ${money(amount)}`
          : ''
      ) +
      ` en el recibo actual. ` +
      `Sin embargo, no encontrÃ© evidencia suficiente ` +
      `para confirmar el origen de ese cargo. ` +
      `Para evitar darte una explicaciÃ³n no verificada, ` +
      `este caso debe revisarlo un asesor.`
  }


  // --------------------------------------------------
  // SOLICITUD DE ASESOR
  // --------------------------------------------------

  if (
    /(asesor|humano|operador|hablar con alguien)/
      .test(t)
  ) {

    return answer(
      'Claro. Voy a conservar el contexto para que un asesor continÃºe sin pedirte que repitas todo.',
      {
        suggestHuman: true
      }
    )
  }


  // --------------------------------------------------
  // OFERTAS
  // --------------------------------------------------

  if (
    /(oferta|promo|mejorar.*plan|mas gigas|otro plan)/
      .test(t)
  ) {

    const resolved =
      scenario === 'current' ||
      history.some(
        m =>
          m.role === 'user' &&
          /(ya entendi|ah ya|listo|gracias|ok)/
            .test(
              norm(
                m.text || ''
              )
            )
      )


    if (!resolved) {

      return answer(
        'Primero terminemos de aclarar el cobro actual. DespuÃ©s revisamos una oferta sin mezclar una venta con tu duda.'
      )
    }


    const o =
      offers[scenario] ||
      offers.current


    return answer(
      `Puedo mostrarte ${o.name} por ${money(o.price)} al mes.`,
      {
        showOffer: true,
        offer: o
      }
    )
  }


  // --------------------------------------------------
  // RECIBO ANTERIOR
  // --------------------------------------------------

  if (
    /(mes pasado|julio|anterior|cuanto pague)/
      .test(t)
  ) {

    if (
      previousTotal == null ||
      currentTotal == null
    ) {

      return answer(
        'No tengo suficiente informaciÃ³n para comparar ambos recibos.'
      )
    }


    return answer(
      `El recibo anterior fue de ${money(previousTotal)} y el actual es de ${money(currentTotal)}. La diferencia es de ${money(Math.abs(difference))}.`
    )
  }


  // --------------------------------------------------
  // PRORRATEO
  // --------------------------------------------------

  if (
    /(prorr|proporcional)/
      .test(t)
  ) {

    if (
      engineScenario === 'PRORATION' ||
      scenario === 'proration'
    ) {

      const amount =
        s.proration_amount ??
        charges.find(
          charge =>
            norm(charge.group || '')
              .includes('proporcional')
        )?.amount


      return answer(
        `En el recibo aparece un cargo fijo proporcional de ${money(amount)}. TambiÃ©n encontramos una orden de cambio terminada asociada al servicio. No puedo reconstruir el cÃ¡lculo exacto por dÃ­as con la evidencia disponible.`
      )
    }


    return answer(
      'En la evidencia disponible no aparece un cargo fijo proporcional confirmado.'
    )
  }


  // --------------------------------------------------
  // RECONEXIÃ“N
  // --------------------------------------------------

  if (
    /(reconex|reactiv|suspend)/
      .test(t)
  ) {

    if (
      engineScenario === 'RECONNECTION' ||
      scenario === 'reconnection'
    ) {

      const reconnectionCharge =
        charges.find(
          charge =>
            norm(charge.description || '')
              .includes('reconexion')
        )

      const amount =
        reconnectionCharge?.amount ??
        Math.abs(difference || 0)


      return answer(
        `Se detectÃ³ un cargo por reconexiÃ³n de ${money(amount)}. La evidencia tambiÃ©n registra una suspensiÃ³n y una reactivaciÃ³n con cargo para el mismo servicio.`
      )
    }


    return answer(
      'En la evidencia disponible no aparece un cargo de reconexiÃ³n confirmado.'
    )
  }


  // --------------------------------------------------
  // DESCUENTOS
  // --------------------------------------------------

  if (
    /(descuent|bonific)/
      .test(t)
  ) {

    if (
      scenario === 'discount'
    ) {

      return answer(
        `Este mes se aplicÃ³ una bonificaciÃ³n de ${money(Math.abs(difference))}.`
      )
    }


    return answer(
      'En la evidencia disponible no aparece una bonificaciÃ³n confirmada.'
    )
  }


  // --------------------------------------------------
  // PREGUNTA GENERAL DEL RECIBO
  // --------------------------------------------------

  const asksAboutBill =
  /(por\s*que|porque|pq|xq|caro|subio|aumento|cobr|cargo|recibo|monto|total|salio|aparecio|de\s*donde|donde|diferencia|variar|vario|cambio|no\s*entiendo|no\s*entendi)/
    .test(t)


  if (asksAboutBill) {

    if (
      evidenceStatus === 'NONE' ||
      requiresHandoff
    ) {

      return answer(
        explanation,
        {
          suggestHuman: true
        }
      )
    }

    return answer(
      explanation
    )
  }


  // --------------------------------------------------
  // SALUDO
  // --------------------------------------------------

  if (
    /^(hola|holi|buenas|oe|hey)/
      .test(t)
  ) {

    return answer(
      'Hola ðŸ™‚. Â¿QuÃ© quieres revisar de tu recibo?'
    )
  }


  // --------------------------------------------------
  // CONFIRMACIÃ“N DEL USUARIO
  // --------------------------------------------------

  if (
    /^(ah ya|ya entendi|entendi|ok|listo|gracias)/
      .test(t)
  ) {

    return answer(
      'Perfecto, dejamos aclarada esa parte. Â¿QuÃ© mÃ¡s quieres revisar?'
    )
  }


  // --------------------------------------------------
  // FALLBACK SEGURO
  // --------------------------------------------------

  return answer(
    'No encuentro esa informaciÃ³n en la evidencia disponible. Para no inventarte una respuesta, este punto debe revisarlo un asesor.',
    {
      suggestHuman: true
    }
  )
}

async function withGemini(
  message,
  scenario,
  history,
  base,
  financialFacts = null
) {
  const key = (process.env.GEMINI_API_KEY || '').trim()
  if (!key) return base
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim()
  const facts =
    financialFacts ||
    scenarios[scenario] ||
    scenarios.current

  const system = `
  Eres LucIA, asistente de facturaciÃ³n de Movistar.

  Tu tarea es explicar al cliente su recibo
  en espaÃ±ol natural, breve y sencillo.

  FUENTE DE VERDAD:
  ${JSON.stringify(facts)}

  REGLAS OBLIGATORIAS:

  1. No inventes montos.
  2. No inventes cargos.
  3. No inventes fechas.
  4. No inventes promociones.
  5. No inventes causas.
  6. No deduzcas informaciÃ³n que no estÃ©
    explÃ­citamente respaldada por FUENTE DE VERDAD.

  Si evidence_status = "VERIFIED":
  puedes explicar la causa confirmada.

  Si evidence_status = "PARTIAL":
  explica Ãºnicamente lo que estÃ¡ comprobado
  y aclara quÃ© parte no puede confirmarse.

  Si evidence_status = "NONE":
  NO afirmes una causa.
  Indica que el cargo aparece en el recibo,
  pero su origen no puede confirmarse
  con la evidencia disponible.

  Si requires_handoff = true:
  indica que el caso debe ser revisado
  por un asesor.

  Gemini Ãºnicamente redacta.
  La verdad financiera siempre proviene
  de FUENTE DE VERDAD.
  `

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
    const financialFacts =
      await getFinancialFacts(scenario)

    const base = deterministic(
      message,
      scenario,
      history,
      financialFacts
    )

    const response = await withGemini(
      message,
      scenario,
      history,
      base,
      financialFacts
    )
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(response))
  } catch { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'bad_request'})) }
}).listen(port,'127.0.0.1',()=>console.log(`LucIA backend: http://127.0.0.1:${port}/api/lucia`))
