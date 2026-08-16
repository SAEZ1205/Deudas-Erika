import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// =====================================================
// VARIABLES DE ENTORNO
// =====================================================

async function loadEnv() {
  // .env.local tiene prioridad sobre .env.
  // Las variables ya definidas por el sistema conservan prioridad.
  const protectedKeys = new Set(Object.keys(process.env))

  for (const file of ['.env.local', '.env']) {
    try {
      const text = await readFile(resolve(file), 'utf8')

      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()

        if (!line || line.startsWith('#')) continue

        const i = line.indexOf('=')

        if (i < 1) continue

        const key = line.slice(0, i).trim()
        const value = line.slice(i + 1).trim()

        if (!value || protectedKeys.has(key)) continue

        // El primer archivo que define la variable gana.
        // Como .env.local se procesa primero, tiene prioridad.
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    } catch {}
  }
}

await loadEnv()

// =====================================================
// ESCENARIOS LEGACY / FALLBACK CONTROLADO
// =====================================================

const scenarios = JSON.parse(
  await readFile(
    new URL('../data/demo/scenarios.json', import.meta.url),
    'utf8'
  )
)

const ALLOW_DEMO_FALLBACK =
  ['1', 'true', 'yes']
    .includes(
      String(
        process.env.ALLOW_DEMO_FALLBACK || ''
      ).toLowerCase()
    )

// =====================================================
// DATA ENGINE
// =====================================================

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

const DATA_DRIVEN_SCENARIOS =
  new Set(
    Object.keys(demoClients)
  )

async function getFinancialFacts(scenario) {
  const client =
    demoClients[scenario]

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
        'DataEngine respondió:',
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

async function resolveScenarioFacts(scenario) {
  if (
    !DATA_DRIVEN_SCENARIOS
      .has(scenario)
  ) {
    return {
      facts:
        scenarios[scenario] ||
        scenarios.current,
      dataSource: 'legacy-scenario',
      unavailable: false
    }
  }

  const financialFacts =
    await getFinancialFacts(
      scenario
    )

  if (financialFacts) {
    return {
      facts: financialFacts,
      dataSource: 'data-engine',
      unavailable: false
    }
  }

  if (ALLOW_DEMO_FALLBACK) {
    console.warn(
      `DataEngine no disponible para "${scenario}". ` +
      'Se usa fallback demo porque ALLOW_DEMO_FALLBACK=true.'
    )

    return {
      facts:
        scenarios[scenario] ||
        scenarios.current,
      dataSource: 'demo-fallback',
      unavailable: false
    }
  }

  return {
    facts: null,
    dataSource: 'unavailable',
    unavailable: true
  }
}

// =====================================================
// UTILIDADES
// =====================================================

const money = (n) => {
  const value =
    Number(n)

  return Number.isFinite(value)
    ? `S/${value.toFixed(2)}`
    : null
}

const norm = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function normalizeHistory(
  history = [],
  currentMessage = ''
) {
  const clean =
    Array.isArray(history)
      ? history.filter(Boolean)
      : []

  if (clean.length === 0) {
    return []
  }

  const last =
    clean[clean.length - 1]

  const isCurrentMessageAlreadyIncluded =
    last?.role === 'user' &&
    norm(last?.text || '') ===
      norm(currentMessage)

  return isCurrentMessageAlreadyIncluded
    ? clean.slice(0, -1)
    : clean
}

function friendlyChargeDescription(
  description = ''
) {
  const clean =
    String(description)
      .replace(/\s+/g, ' ')
      .trim()

  if (!clean) {
    return 'un cargo nuevo'
  }

  const gb =
    clean.match(
      /(\d+(?:[.,]\d+)?)\s*gb/i
    )

  const days =
    clean.match(
      /(\d+)\s*d[ií]as?/i
    )

  if (gb && days) {
    return (
      `un paquete de ${gb[1]} GB ` +
      `por ${days[1]} días`
    )
  }

  if (gb) {
    return `un paquete de ${gb[1]} GB`
  }

  return clean
}

function humanSourceLabel(
  source = ''
) {
  const key =
    norm(source)

  if (key.includes('facturacion')) {
    return 'Facturación'
  }

  if (key.includes('orden')) {
    return 'Órdenes'
  }

  if (
    key.includes('nota') &&
    key.includes('credito')
  ) {
    return 'Notas de crédito'
  }

  if (key.includes('planta')) {
    return 'Planta'
  }

  return String(source).trim()
}

function buildSourceText(
  evidence = []
) {
  const labels =
    [
      ...new Set(
        evidence
          .map(item => {
            if (
              !item ||
              typeof item !== 'object'
            ) {
              return ''
            }

            return humanSourceLabel(
              item.source || ''
            )
          })
          .filter(Boolean)
      )
    ]

  if (labels.length === 0) {
    return ''
  }

  if (labels.length === 1) {
    return (
      `Respaldado con datos de ` +
      `${labels[0]}.`
    )
  }

  const last =
    labels[labels.length - 1]

  const first =
    labels
      .slice(0, -1)
      .join(', ')

  return (
    `Respaldado con datos de ` +
    `${first} y ${last}.`
  )
}

function extractMoneyValues(
  text = ''
) {
  const values =
    new Set()

  const source =
    String(text)

  for (
    const match of source.matchAll(
      /S\/\s*(\d+(?:[.,]\d{1,2})?)/gi
    )
  ) {
    values.add(
      Number(
        match[1]
          .replace(',', '.')
      ).toFixed(2)
    )
  }

  for (
    const match of source.matchAll(
      /(\d+(?:[.,]\d{1,2})?)\s+soles\b/gi
    )
  ) {
    values.add(
      Number(
        match[1]
          .replace(',', '.')
      ).toFixed(2)
    )
  }

  return values
}

function generatedAmountsAreSafe(
  generatedText,
  baseText
) {
  const allowed =
    extractMoneyValues(baseText)

  const generated =
    extractMoneyValues(
      generatedText
    )

  for (const value of generated) {
    if (!allowed.has(value)) {
      return false
    }
  }

  return true
}

function cleanModelText(
  text = ''
) {
  return String(text)
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(
      /^\s*[-•]\s+/gm,
      ''
    )
    .trim()
}

// =====================================================
// OFERTAS DEMO
// =====================================================

const offers = {
  current: {
    id: 'POST-500',
    name: '500 GB',
    price: 59.90,
    benefit: 'Más datos',
    banner:
      '/promos/lucia-normal-500.webp'
  },

  discount: {
    id: 'POST-170',
    name: '170 GB',
    price: 45.90,
    benefit: 'Plan gamer',
    banner:
      '/promos/lucia-discount-170.webp'
  },

  proration: {
    id: 'POST-250',
    name: '250 GB',
    price: 49.90,
    benefit: 'Plan familiar',
    banner:
      '/promos/lucia-proration-250.webp'
  },

  reconnection: {
    id: 'POST-280',
    name: '280 GB',
    price: 55.90,
    benefit:
      'Apps y llamadas ilimitadas',
    banner:
      '/promos/lucia-reconnection-280.webp'
  }
}

// =====================================================
// CONCEPTOS EN LENGUAJE SIMPLE
// =====================================================

const CONCEPTS = {
  prorrateo: {
    aliases: [
      'prorrateo',
      'ajuste proporcional',
      'cobro proporcional',
      'cargo proporcional'
    ],

    definition:
      'Es un ajuste que puede aparecer cuando cambia alguna condición del servicio durante el periodo de facturación. El cobro se adapta a ese cambio según corresponda.'
  },

  reconexion: {
    aliases: [
      'reconexion',
      'reactivacion',
      'cargo por reconexion'
    ],

    definition:
      'Es un cargo que puede aparecer cuando un servicio que estaba suspendido vuelve a activarse.'
  },

  'fin de descuento': {
    aliases: [
      'fin de descuento',
      'fin de promocion',
      'promocion vencida'
    ],

    definition:
      'Ocurre cuando termina una promoción temporal y el recibo vuelve al precio que corresponde sin ese beneficio.'
  },

  'cambio de plan': {
    aliases: [
      'cambio de plan',
      'cambio de servicio'
    ],

    definition:
      'Es una modificación de las condiciones del servicio. Si ocurre durante un periodo de facturación, puede generar ajustes en el recibo.'
  },

  'cuota de equipo': {
    aliases: [
      'cuota de equipo',
      'equipo financiado'
    ],

    definition:
      'Es el pago mensual correspondiente a un equipo financiado y puede aparecer separado del cargo del plan.'
  },

  'nota de credito': {
    aliases: [
      'nota de credito',
      'ajuste a favor'
    ],

    definition:
      'Es un ajuste a favor del cliente que reduce total o parcialmente un importe facturado.'
  },

  'cargo unico': {
    aliases: [
      'cargo unico',
      'cobro unico'
    ],

    definition:
      'Es un cobro que se aplica una sola vez y no necesariamente vuelve a aparecer en los siguientes recibos.'
  },

  'cargo recurrente': {
    aliases: [
      'cargo recurrente',
      'cobro recurrente'
    ],

    definition:
      'Es un cobro que puede repetirse periódicamente mientras el servicio asociado permanezca activo.'
  },

  'renta adelantada': {
    aliases: [
      'renta adelantada'
    ],

    definition:
      'Es un cobro correspondiente a un periodo de servicio que se factura por adelantado.'
  },

  'renta vencida': {
    aliases: [
      'renta vencida'
    ],

    definition:
      'Es un cobro correspondiente a un periodo de servicio que ya transcurrió.'
  }
}

function findConceptInText(
  raw = ''
) {
  const t =
    norm(raw)

  for (
    const [concept, config]
    of Object.entries(CONCEPTS)
  ) {
    const hit =
      config.aliases.some(
        alias =>
          t.includes(
            norm(alias)
          )
      )

    if (hit) {
      return concept
    }
  }

  return null
}

// =====================================================
// CONTEXTO CONVERSACIONAL
// =====================================================

function findLastConcept(
  history = []
) {
  const recent =
    history
      .slice(-8)
      .reverse()

  for (
    const message
    of recent
  ) {
    const concept =
      findConceptInText(
        message?.text || ''
      )

    if (concept) {
      return concept
    }
  }

  return null
}

function countConfusion(
  history = []
) {
  return history.filter(
    message => {
      if (
        message?.role !== 'user'
      ) {
        return false
      }

      const text =
        norm(
          message?.text || ''
        )

      return (
        /\b(no entendi|no entiendo|sigo sin entender|todavia no entiendo|aun no entiendo|explicame otra vez|explicalo de nuevo|no me queda claro|tengo dudas)\b/
          .test(text)
      )
    }
  ).length
}

// =====================================================
// DETECCIÓN DE INTENCIÓN
// =====================================================

function detectIntent(
  raw,
  history = []
) {
  const t =
    norm(raw)

  if (!t) {
    return {
      intent: 'OTRO'
    }
  }

  // 1. Solicitud explícita de humano.
  if (
    /\b(asesor|humano|operador|persona real|hablar con alguien|hablar con una persona|llamar|llamen)\b/
      .test(t)
  ) {
    return {
      intent:
        'SOLICITAR_HUMANO'
    }
  }

  // 2. Cliente desconoce o disputa un cargo.
  if (
    /\b(nunca pedi|no pedi|no reconozco|no solicite|yo no active|yo no lo active|que es este cobro|que cobro es este|ese cobro no es mio)\b/
      .test(t)
  ) {
    return {
      intent:
        'CARGO_NO_RECONOCIDO'
    }
  }

  // 3. Pregunta conceptual explícita.
  const conceptHit =
    findConceptInText(t)

  if (
    conceptHit &&
    /\b(que es|q es|que significa|explicame|como funciona|no entiendo que|no entiendo el|no entiendo la)\b/
      .test(t)
  ) {
    return {
      intent:
        'EXPLICAR_CONCEPTO',
      concept:
        conceptHit
    }
  }

  // 4. Pregunta contextual: "¿y eso qué es?"
  if (
    /\b(eso|ese cobro|ese cargo|ese ajuste)\b/
      .test(t) &&
    /\b(que es|q es|que significa|como funciona)\b/
      .test(t)
  ) {
    const lastConcept =
      findLastConcept(
        history
      )

    if (lastConcept) {
      return {
        intent:
          'EXPLICAR_CONCEPTO',
        concept:
          lastConcept
      }
    }
  }

  // 5. Usuario no comprendió la explicación.
  if (
    /\b(no entendi|no entiendo|sigo sin entender|todavia no entiendo|aun no entiendo|explicame otra vez|explicalo de nuevo|no me queda claro|tengo dudas)\b/
      .test(t)
  ) {
    return {
      intent:
        'NO_COMPRENDIO'
    }
  }

  // 6. Usuario confirma comprensión.
  if (
    /\b(si quedo claro|si entendi|ya entendi|ah ya|ya esta claro|listo gracias|gracias ya entendi|ok gracias|entendido)\b/
      .test(t)
  ) {
    return {
      intent:
        'CONFIRMAR_COMPRENSION'
    }
  }

  // 7. Pregunta por monto de ajuste/prorrateo.
  const lastConcept =
    findLastConcept(
      history
    )

  if (
    /\b(cuanto|que monto|monto)\b/
      .test(t) &&
    (
      /\b(ajuste|prorrateo|proporcional|ese cobro|ese cargo)\b/
        .test(t) ||
      lastConcept ===
        'prorrateo'
    )
  ) {
    return {
      intent:
        'CONSULTAR_MONTO_AJUSTE'
    }
  }

  // 8. Pregunta si un cargo se repetirá.
  if (
    /\b(volvera|volver a salir|otra vez|proximo mes|siguiente mes|se repite|se repetira|recurrente)\b/
      .test(t)
  ) {
    return {
      intent:
        'CONSULTAR_REPETICION'
    }
  }

  if (
    /\b(que es ese paquete|que es el paquete|que paquete es|que incluye ese paquete|ese paquete que es)\b/
      .test(t)
  ) {
    return {
      intent: 'EXPLICAR_CARGO'
    }
  }

  // 9. Pregunta por variación del recibo.
  if (
    /\b(pq|porque|por que|xq|mas caro|subio|aumento|mas alto|vario|cambio el recibo|diferencia|de donde salio|por que cambio)\b/
      .test(t)
  ) {
    return {
      intent:
        'EXPLICAR_VARIACION'
    }
  }

  // 10. Recibo anterior.
  if (
    /\b(mes pasado|recibo anterior|cuanto pague antes|cuanto pague el mes pasado|anterior)\b/
      .test(t)
  ) {
    return {
      intent:
        'CONSULTAR_RECIBO_ANTERIOR'
    }
  }

  // 11. Consulta general del recibo.
  if (
    /\b(recibo|cuanto debo|ver mi recibo|monto total|total del recibo)\b/
      .test(t)
  ) {
    return {
      intent:
        'CONSULTAR_RECIBO'
    }
  }

  // 12. Consulta sobre plan.
  if (
    /\b(que plan tengo|mi plan|megas de mi plan|gigas de mi plan)\b/
      .test(t)
  ) {
    return {
      intent:
        'CONSULTAR_PLAN'
    }
  }

  // 13. Ofertas.
  if (
    /\b(oferta|promo|promocion|mejorar plan|mas gigas|otro plan)\b/
      .test(t)
  ) {
    return {
      intent:
        'CONSULTAR_OFERTA'
    }
  }

  // 14. Saludo.
  if (
    /^(hola|holi|buenas|oe|hey)\b/
      .test(t)
  ) {
    return {
      intent: 'SALUDO'
    }
  }

  return {
    intent: 'OTRO'
  }
}

// =====================================================
// MOTOR DETERMINÍSTICO
// =====================================================

function deterministic(
  message,
  scenario = 'current',
  history = [],
  financialFacts = null
) {
  const s =
    financialFacts ||
    scenarios[scenario] ||
    scenarios.current

  const t =
    norm(message)

  const intentResult =
    detectIntent(
      message,
      history
    )

  const intent =
    intentResult.intent

  // --------------------------------------------------
  // NORMALIZAR FORMATO LEGACY / DATA ENGINE
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
              currentTotal -
              previousTotal
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
    Boolean(
      s.requires_handoff
    )

  const charges =
    Array.isArray(s.charges)
      ? s.charges
      : []

  const evidence =
    Array.isArray(s.evidence)
      ? s.evidence
      : []

  const sourceText =
    buildSourceText(
      evidence
    )

  const answer = (
    text,
    extra = {}
  ) => {
    const {
      showSource = false,
      suggestHuman = false,
      ...rest
    } = extra

    return {
      answer: text,
      source:
        showSource
          ? sourceText
          : '',
      suggestHuman,
      showOffer: false,
      evidenceStatus,
      intent,
      ...rest
    }
  }

  // --------------------------------------------------
  // RESPUESTA SEGURA DEL ESCENARIO
  // --------------------------------------------------

  let explanation =
    s.explanation ||
    'No encuentro una causa confirmada en la información disponible.'

  if (
    engineScenario ===
    'RECONNECTION'
  ) {
    const reconnectionCharge =
      charges.find(
        charge =>
          norm(
            charge.description || ''
          ).includes(
            'reconexion'
          )
      )

    const amount =
      reconnectionCharge?.amount ??
      (
        difference != null
          ? Math.abs(
              difference
            )
          : null
      )

    explanation =
      `Tu recibo subió ${money(Math.abs(difference))} por un cargo de reconexión. ` +
      `Pude confirmar que el servicio estuvo suspendido y luego fue reactivado.`
  }

  else if (
    engineScenario ===
    'PRORATION'
  ) {
    const amount =
      s.proration_amount ??
      charges.find(
        charge =>
          norm(
            charge.group || ''
          ).includes(
            'proporcional'
          )
      )?.amount

    explanation =
      `Tu recibo subió ${money(Math.abs(difference))} este mes. ` +
      `Durante el periodo hubo un cambio en tu servicio y por eso aparece ` +
      `un cobro proporcional. Pude confirmar ese cambio.`

    if (
      Array.isArray(s.limitations) &&
      s.limitations.length > 0
    ) {
      explanation +=
        ` No tengo información suficiente para mostrarte ` +
        `cómo se calculó exactamente día por día.`
    }
  }

  else if (
    engineScenario ===
    'UNVERIFIED_CHARGE'
  ) {
    const charge =
      charges[0]

    const description =
      friendlyChargeDescription(
        charge?.description || ''
      )

    const amount =
      charge?.amount

    explanation =
      `Encontré ${description}` +
      (
        amount != null
          ? ` por ${money(amount)}`
          : ''
      ) +
      ` en tu recibo. ` +
      `Lo que no puedo confirmar es cómo se originó ese cargo. ` +
      `Como no tengo información suficiente para explicarte su origen con seguridad, prefiero que un asesor lo revise contigo.`
  }

  // --------------------------------------------------
  // ROUTING POR INTENCIÓN
  // --------------------------------------------------

  if (
    intent ===
    'SOLICITAR_HUMANO'
  ) {
    return answer(
      'Claro. Voy a conservar lo que ya revisamos para que el asesor pueda continuar desde aquí.',
      {
        suggestHuman: true
      }
    )
  }

  if (
    intent ===
    'CARGO_NO_RECONOCIDO'
  ) {
    if (
      evidenceStatus === 'NONE' ||
      requiresHandoff
    ) {
      return answer(
        'Entiendo. Como no tengo información suficiente para confirmar cómo se originó ese cargo, no voy a asumir que tú lo solicitaste. Lo mejor es que un asesor lo revise contigo.',
        {
          showSource: true,
          suggestHuman: true
        }
      )
    }

    if (
      engineScenario ===
      'PRORATION'
    ) {
      return answer(
        'Entiendo. Puedo confirmar que hubo un cambio registrado y que aparece un ajuste proporcional, pero eso no me permite saber si tú solicitaste personalmente ese cambio. Si no lo reconoces, lo mejor es que un asesor lo revise contigo.',
        {
          showSource: true,
          suggestHuman: true
        }
      )
    }

    if (
      engineScenario ===
      'RECONNECTION'
    ) {
      return answer(
        'Entiendo. Puedo confirmar que hubo una suspensión y posterior reactivación del servicio, pero eso no me permite saber si tú solicitaste personalmente esa gestión. Si no la reconoces, lo mejor es que un asesor lo revise contigo.',
        {
          showSource: true,
          suggestHuman: true
        }
      )
    }

    return answer(
      'Entiendo. Puedo confirmar que el cobro aparece en los registros disponibles, pero eso no me permite saber si tú lo solicitaste personalmente. Si no lo reconoces, puedo derivarte con un asesor.',
      {
        showSource: true,
        suggestHuman: true
      }
    )
  }

  if (
    intent ===
    'EXPLICAR_CONCEPTO'
  ) {
    const concept =
      intentResult.concept

    const definition =
      CONCEPTS[concept]
        ?.definition

    if (definition) {
      return answer(
        definition,
        {
          concept
        }
      )
    }
  }
  if (
    intent === 'EXPLICAR_CARGO'
  ) {
    if (
      engineScenario === 'UNVERIFIED_CHARGE'
    ) {
      const charge = charges[0]

      const description =
        friendlyChargeDescription(
          charge?.description || ''
        )

      const amount =
        charge?.amount

      return answer(
        `Es ${description}` +
        (
          amount != null
            ? ` que aparece en tu recibo por ${money(amount)}`
            : ''
        ) +
        `. Puedo decirte qué cargo es, pero no tengo información suficiente para confirmar cómo se originó.`
      )
    }

    return answer(
      'Puedo explicarte el cargo si aparece identificado en la información disponible.'
    )
  }
  
  if (
    intent ===
    'NO_COMPRENDIO'
  ) {
    const previousConfusions =
      countConfusion(
        history
      )

    if (
      previousConfusions >= 1
    ) {
      return answer(
        'Entiendo. Para ayudarte mejor, puedo derivarte con un asesor y conservar lo que ya revisamos para que continúe desde aquí.',
        {
          suggestHuman: true,
          reformulationStage: 2
        }
      )
    }

    if (
      engineScenario ===
        'PRORATION' ||
      scenario ===
        'proration'
    ) {
      return answer(
        'Claro. Hubo un cambio en tu servicio durante este periodo y por eso aparece un ajuste en el recibo. Puedo confirmar ese cambio, pero no tengo información suficiente para mostrarte cómo se calculó exactamente.',
        {
          reformulationStage: 1
        }
      )
    }

    if (
      engineScenario ===
        'RECONNECTION' ||
      scenario ===
        'reconnection'
    ) {
      const reconnectionCharge =
        charges.find(
          charge =>
            norm(
              charge.description || ''
            ).includes(
              'reconexion'
            )
        )

      const amount =
        reconnectionCharge?.amount ??
        (
          difference != null
            ? Math.abs(
                difference
              )
            : null
        )

      return answer(
        `Claro. Pude confirmar que el servicio estuvo suspendido y después fue reactivado. Por esa reconexión aparece un cargo de ${money(amount)} en tu recibo.`,
        {
          reformulationStage: 1
        }
      )
    }

    if (
      engineScenario ===
        'UNVERIFIED_CHARGE' ||
      evidenceStatus ===
        'NONE'
    ) {
      return answer(
        'En este caso no puedo simplificar una causa porque no tengo información suficiente para confirmarla. Para no inventar una explicación, lo correcto es que lo revise un asesor.',
        {
          suggestHuman: true,
          reformulationStage: 2
        }
      )
    }

    return answer(
      'Puedo explicarlo de otra manera, pero con la información disponible no tengo más datos confirmados para agregar. Si todavía tienes dudas, puedo derivarte con un asesor.',
      {
        reformulationStage: 1
      }
    )
  }

  if (
    intent ===
    'CONFIRMAR_COMPRENSION'
  ) {
    return answer(
      'Perfecto. Me alegra que haya quedado claro. Si quieres, podemos revisar otra parte de tu recibo.'
    )
  }

  if (
    intent ===
    'CONSULTAR_MONTO_AJUSTE'
  ) {
    if (
      engineScenario ===
        'PRORATION' ||
      scenario ===
        'proration'
    ) {
      const amount =
        s.proration_amount ??
        charges.find(
          charge =>
            norm(
              charge.group || ''
            ).includes(
              'proporcional'
            )
        )?.amount

      if (amount != null) {
        return answer(
          `El cobro proporcional que aparece en tu recibo es de ${money(amount)}.`,
          {
            showSource: true
          }
        )
      }
    }

    return answer(
      'Con la información disponible no puedo identificar un monto de ajuste confirmado.'
    )
  }

  if (
    intent ===
    'CONSULTAR_REPETICION'
  ) {
    return answer(
      'Con la información disponible no puedo confirmar si ese cargo volverá a aparecer en otro recibo.'
    )
  }

  if (
    intent ===
    'EXPLICAR_VARIACION'
  ) {
    if (
      evidenceStatus ===
        'NONE' ||
      requiresHandoff
    ) {
      return answer(
        explanation,
        {
          showSource: true,
          suggestHuman: true
        }
      )
    }

    return answer(
      explanation,
      {
        showSource: true
      }
    )
  }

  if (
    intent ===
    'CONSULTAR_RECIBO_ANTERIOR'
  ) {
    if (
      previousTotal == null
    ) {
      return answer(
        'No tengo suficiente información para consultar el recibo anterior.'
      )
    }

    return answer(
      `El recibo anterior fue de ${money(previousTotal)}.`,
      {
        showSource: true
      }
    )
  }

  if (
    intent ===
    'CONSULTAR_RECIBO'
  ) {
    if (
      currentTotal == null
    ) {
      return answer(
        'No tengo suficiente información para consultar el total actual.'
      )
    }

    return answer(
      `Tu recibo actual es de ${money(currentTotal)}.`,
      {
        showSource: true
      }
    )
  }

  if (
    intent ===
    'CONSULTAR_PLAN'
  ) {
    return answer(
      'Por ahora puedo ayudarte con la explicación de tu recibo. Para revisar el detalle de tu plan puedes ir a la sección Mi plan o pedir ayuda a un asesor.'
    )
  }

  if (
    intent ===
    'CONSULTAR_OFERTA'
  ) {
    const resolved =
      scenario === 'current' ||
      history.some(
        m =>
          m?.role === 'user' &&
          /\b(ya entendi|ah ya|listo|gracias|ok|entendido)\b/
            .test(
              norm(
                m?.text || ''
              )
            )
      )

    if (!resolved) {
      return answer(
        'Primero terminemos de aclarar el cobro actual. Después podemos revisar una oferta sin mezclar una venta con tu duda.'
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

  if (
    intent ===
    'SALUDO'
  ) {
    return answer(
      'Hola. ¿Qué quieres revisar de tu recibo?'
    )
  }

  return answer(
    'No estoy segura de haber entendido. Puedes preguntarme, por ejemplo, por qué cambió tu recibo, qué significa un cobro o de dónde salió un cargo.'
  )
}

// =====================================================
// GEMINI: SOLO REDACCIÓN SELECTIVA
// =====================================================

function shouldUseGemini(
  base
) {
  if (!base) {
    return false
  }

  if (
    base.suggestHuman
  ) {
    return false
  }

  if (
    base.evidenceStatus ===
      'NONE' ||
    base.evidenceStatus ===
      'UNAVAILABLE'
  ) {
    return false
  }

  return (
    base.intent ===
    'EXPLICAR_VARIACION'
  )
}

async function withGemini(
  message,
  scenario,
  history,
  base,
  financialFacts = null
) {
  const key =
    (
      process.env.GEMINI_API_KEY ||
      ''
    ).trim()

  if (
    !key ||
    !shouldUseGemini(base)
  ) {
    return base
  }

  const model =
    (
      process.env.GEMINI_MODEL ||
      'gemini-3.6-flash'
    ).trim()

  const prior =
    history
      .slice(-4)
      .map(
        m =>
          `${
            m?.role === 'user'
              ? 'Usuario'
              : 'LucIA'
          }: ${m?.text || ''}`
      )
      .join('\n')

  const system = `
Eres LucIA, asistente de facturación de Movistar.

Tu única tarea es reescribir una respuesta segura ya validada.
No decides causas, no haces cálculos y no agregas hechos.

INTENT:
${base.intent}

EVIDENCE_STATUS:
${base.evidenceStatus}

RESPUESTA SEGURA:
${base.answer}

REGLAS:
- Conserva exactamente la verdad de RESPUESTA SEGURA.
- No inventes montos, fechas, cargos, causas, planes ni eventos.
- No agregues precisión que la respuesta segura no contiene.
- Si la respuesta segura expresa una limitación, consérvala.
- No conviertas una posibilidad en una afirmación.
- No atribuyas una acción al cliente si la respuesta segura no lo confirma.
- No uses Markdown.
- Devuelve únicamente texto plano.
  `.trim()

  const prompt = `
CONVERSACIÓN RECIENTE:
${prior || 'Sin conversación previa.'}

PREGUNTA ACTUAL:
${message}

Reescribe RESPUESTA SEGURA para una persona sin conocimientos de facturación.

Objetivo de estilo:
- responde directamente la duda;
- usa palabras comunes;
- usa frases cortas;
- responde idealmente en 2 o 3 frases;
- menciona solo los datos necesarios;
- no recites toda la evidencia;
- no saludes nuevamente;
- no cambies ningún monto;
- no agregues información nueva.

VOZ DE LucIA:
- habla siempre de "tú", nunca de "usted";
- suena cercana, clara y profesional;
- evita tono legal, administrativo o técnico;
- evita expresiones como "evidencia disponible", "figura registrado" o "validación";
- prefiere frases como "Pude confirmar", "En tu recibo aparece" y "Lo que no puedo confirmar es";
- no agregues empatía genérica si el usuario solo está pidiendo información;
- si el usuario expresa preocupación o rechazo de un cargo, reconoce brevemente esa preocupación;
- no uses emojis.

Para una pregunta sobre por qué cambió el recibo:
- prioriza cuánto cambió;
- explica la causa confirmada en palabras sencillas;
- conserva cualquier limitación importante;
- no es obligatorio mencionar el total anterior y actual;
- no es obligatorio mencionar el importe de todos los componentes.
  `.trim()

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      15000
    )

  try {
    const r =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          signal:
            controller.signal,

          headers: {
            'Content-Type':
              'application/json',
            'x-goog-api-key':
              key
          },

          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: system
                }
              ]
            },

            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],

            generationConfig: {
              maxOutputTokens:
                1024,

              thinkingConfig: {
                thinkingLevel:
                  'minimal'
              }
            }
          })
        }
      )

    clearTimeout(
      timeout
    )

    if (!r.ok) {
      const errorText =
        await r.text()

      console.error(
        'Gemini respondió:',
        r.status,
        errorText
      )

      return base
    }

    const data =
      await r.json()

    const candidate =
      data
        ?.candidates?.[0]

    const finishReason =
      candidate
        ?.finishReason

    const rawText =
      candidate
        ?.content?.parts
        ?.filter(
          part =>
            !part.thought
        )
        .map(
          part =>
            part.text || ''
        )
        .join('')
        .trim()

    console.log(
      'Gemini:',
      {
        model,
        finishReason,
        outputTokens:
          data
            ?.usageMetadata
            ?.candidatesTokenCount
      }
    )

    if (
      finishReason ===
      'MAX_TOKENS'
    ) {
      console.warn(
        'Gemini alcanzó MAX_TOKENS. Se usa la respuesta segura.'
      )

      return base
    }

    if (!rawText) {
      return base
    }

    const text =
      cleanModelText(
        rawText
      )

    if (
      !generatedAmountsAreSafe(
        text,
        base.answer
      )
    ) {
      console.warn(
        'Gemini introdujo un monto no permitido. Se usa la respuesta segura.'
      )

      return base
    }

    return {
      ...base,
      answer: text
    }
  } catch (error) {
    clearTimeout(
      timeout
    )

    if (
      error?.name ===
      'AbortError'
    ) {
      console.warn(
        'Gemini tardó más de 15 segundos. Se usa la respuesta segura.'
      )
    } else {
      console.error(
        'No se pudo consultar Gemini:',
        error?.message
      )
    }

    return base
  }
}

// =====================================================
// RESPUESTA SEGURA SI DATA ENGINE NO ESTÁ DISPONIBLE
// =====================================================

function dataUnavailableResponse() {
  return {
    answer:
      'Ahora mismo no puedo verificar los datos de tu recibo. Prefiero no darte una explicación sin respaldo. Puedes intentarlo nuevamente o continuar con un asesor.',
    source: '',
    suggestHuman: true,
    showOffer: false,
    evidenceStatus:
      'UNAVAILABLE',
    intent:
      'DATA_UNAVAILABLE'
  }
}

// =====================================================
// SERVIDOR HTTP
// =====================================================

const port =
  Number(
    process.env.LUCIA_PORT ||
    8787
  )

http
  .createServer(
    async (
      req,
      res
    ) => {
      // ------------------------------------------------
      // CORS
      // ------------------------------------------------

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      )

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
      )

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,OPTIONS'
      )

      if (
        req.method ===
        'OPTIONS'
      ) {
        res.writeHead(204)
        return res.end()
      }

      const url =
        new URL(
          req.url,
          'http://localhost'
        )

      // ------------------------------------------------
      // HEALTH
      // ------------------------------------------------

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/api/health'
      ) {
        res.writeHead(
          200,
          {
            'Content-Type':
              'application/json; charset=utf-8'
          }
        )

        return res.end(
          JSON.stringify({
            ok: true,
            gemini:
              Boolean(
                process.env
                  .GEMINI_API_KEY
              ),
            dataEngineUrl:
              DATA_ENGINE_URL,
            allowDemoFallback:
              ALLOW_DEMO_FALLBACK
          })
        )
      }

      // ------------------------------------------------
      // ESCENARIOS LEGACY
      // ------------------------------------------------

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/api/scenarios'
      ) {
        res.writeHead(
          200,
          {
            'Content-Type':
              'application/json; charset=utf-8'
          }
        )

        return res.end(
          JSON.stringify(
            scenarios
          )
        )
      }

      // ------------------------------------------------
      // ENDPOINT LUCIA
      // ------------------------------------------------

      if (
        req.method !== 'POST' ||
        url.pathname !==
          '/api/lucia'
      ) {
        res.writeHead(404)

        return res.end(
          'Not found'
        )
      }

      let body = ''

      for await (
        const chunk of req
      ) {
        body += chunk
      }

      try {
        const {
          message = '',
          scenario = 'current',
          history = []
        } =
          JSON.parse(
            body || '{}'
          )

        const priorHistory =
          normalizeHistory(
            history,
            message
          )

        // ----------------------------------------------
        // 1. RESOLVER FUENTE DE DATOS
        // ----------------------------------------------

        const {
          facts,
          dataSource,
          unavailable
        } =
          await resolveScenarioFacts(
            scenario
          )

        // ----------------------------------------------
        // 2. SI DATA ENGINE FALLA EN UN CASO CORE,
        //    NO INVENTAR NI USAR FALLBACK SILENCIOSO
        // ----------------------------------------------

        if (unavailable) {
          const response =
            dataUnavailableResponse()

          res.writeHead(
            200,
            {
              'Content-Type':
                'application/json; charset=utf-8'
            }
          )

          return res.end(
            JSON.stringify({
              ...response,
              dataSource
            })
          )
        }

        // ----------------------------------------------
        // 3. GENERAR RESPUESTA SEGURA
        // ----------------------------------------------

        const base =
          deterministic(
            message,
            scenario,
            priorHistory,
            facts
          )

        // ----------------------------------------------
        // 4. GEMINI SOLO REDACTA CUANDO APORTA VALOR
        // ----------------------------------------------

        const response =
          await withGemini(
            message,
            scenario,
            priorHistory,
            base,
            facts
          )

        // ----------------------------------------------
        // 5. RESPUESTA FINAL
        // ----------------------------------------------

        res.writeHead(
          200,
          {
            'Content-Type':
              'application/json; charset=utf-8'
          }
        )

        res.end(
          JSON.stringify({
            ...response,
            dataSource
          })
        )
      } catch (error) {
        console.error(
          'Error procesando /api/lucia:',
          error?.message
        )

        res.writeHead(
          400,
          {
            'Content-Type':
              'application/json; charset=utf-8'
          }
        )

        res.end(
          JSON.stringify({
            error:
              'bad_request'
          })
        )
      }
    }
  )
  .listen(
    port,
    '127.0.0.1',
    () =>
      console.log(
        `LucIA backend: http://127.0.0.1:${port}/api/lucia`
      )
  )
