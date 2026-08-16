import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function loadEnv() {
  try {
    const text = await readFile(resolve('.env.local'), 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 1) continue;
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}
await loadEnv();

const FACTS = {
  current: {
    label: 'condición normal', total: 59.90, previous: 59.90, plan: 59.90,
    cause: 'Sin variación', evidenceStatus: 'VERIFIED',
    evidence: ['Plan Móvil 40 GB S/59.90', 'Sin cargos adicionales en agosto', 'Recibo agosto S/59.90'],
    explanation: 'El recibo se mantuvo igual. Solo se cobró el plan habitual y no se registraron extras ni ajustes.',
    consumption: 'El plan incluye 40 GB y la interfaz muestra el consumo del escenario activo.'
  },
  reconnection: {
    label: 'reconexión', total: 69.90, previous: 59.90, plan: 59.90,
    cause: 'Cargo único por reconexión S/10.00', evidenceStatus: 'VERIFIED',
    evidence: ['Plan Móvil 40 GB S/59.90', 'Reconexión registrada S/10.00', 'Recibo agosto S/69.90'],
    explanation: 'El precio del plan no cambió. El aumento de S/10.00 corresponde al restablecimiento del servicio después de una suspensión.',
    consumption: 'Este cargo es único y no implica que el plan mensual haya subido.'
  },
  discount: {
    label: 'descuento', total: 39.90, previous: 59.90, plan: 59.90,
    cause: 'Bonificación aplicada de S/20.00', evidenceStatus: 'VERIFIED',
    evidence: ['Precio regular del plan S/59.90', 'Bonificación agosto -S/20.00', 'Recibo agosto S/39.90'],
    explanation: 'El precio base sigue siendo S/59.90. Este mes una bonificación de S/20.00 redujo el total a S/39.90.',
    consumption: 'El descuento modifica lo pagado este mes, no el precio base contratado.'
  },
  proration: {
    label: 'prorrateo', total: 62.40, previous: 59.90, plan : 59.90,
    cause: 'Monto proporcional de S/2.50 por cinco días', evidenceStatus: 'VERIFIED',
    evidence: ['Plan Móvil 40 GB S/59.90', 'Servicio adicional activo cinco días', 'Prorrateo S/2.50', 'Recibo agosto S/62.40'],
    explanation: 'El plan no subió. Se cobraron S/2.50 únicamente por cinco días de un servicio adicional activo dentro del ciclo.',
    consumption: 'Prorrateo significa cobrar solo la parte proporcional del periodo utilizado.'
  }
};

const OFFERS = [
  { name: '170 GB', price: 45.90, delta: 3.01, extra: '20 GB más', bonus: '100 GB por 7 meses' },
  { name: '250 GB', price: 49.90, delta: 7.01, extra: '100 GB más', bonus: 'Movistar TV app Lite' },
  { name: '280 GB', price: 55.90, delta: 13.01, extra: '130 GB más', bonus: 'Apps y llamadas ilimitadas' }
];

function norm(s='') { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
function wantsHuman(t){return /(asesor|persona|humano|operador|llamar|llamada|call center)/.test(t)}
function wantsOffer(t){return /(oferta|promo|promocion|mejorar.*plan|mas gigas|otro plan|recomiend.*plan|quiero*.plan)/.test(t)}
function isGreeting(t){return /^(hola|holi|buenas|oe|hey|ola)(\s|$)/.test(t) && t.split(' ').length < 5}
function ambiguous(t){return !t || /^(eso|y eso|porque|por que|pq|xq|como asi|no entendi|que)$/i.test(t)}
function isAcknowledgement(t){return /^(a+h* ?ya|ah ?yaxya|ok|okay|listo|entendi|entiendo|perfecto|gracias|dale|ta bien|esta bien)(\s|$)/.test(t)}


function fallback(message, scenario, history=[]) {
  const f=FACTS[scenario] || FACTS.current; const t=norm(message);
  if (isAcknowledgement(t)) return {answer:'Perfecto, entonces dejamos aclarada esa parte. Si quieres seguir preguntando sobre otro mes, consumo, beneficios.o revisar una oferta, dime nomás.', source:'Conversación LucIA',intent:'thanks',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (wantsHuman(t)) return {answer:'Claro. Puedo preparar el caso para un asesor con el contexto de esta conversación para que no tengas que repetir todo.',source:'Solicitud explícita del usuario',intent:'human',needsResolutionCheck:false,suggestHuman:true,showOffer:false};
  if (wantsOffer(t)) {
    const resolved=history.some(m=>m.role==='bot' && /consulta quedo resuelta|consulta quedó resuelta|dejamos aclarada|quedo aclarada|quedó aclarada/i.test(m.text||''));
    if (!resolved && scenario!=='current') return {answer:'Sí puedo revisar opciones para tu línea, pero primero terminemos de aclarar el cobro actual. Cuando quede resuelto, te recomiendo una oferta acorde a tu situación.',source:'Regla comercial: primero resolver la consulta',intent:offer,needsResolutionCheck:false,suggestHuman:false,showOffer:false};
    const o=OFFERS[scenario==='proration'?1:scenario==='discount'?0:2];
    return {answer:`Según este escenario, una opción de demo es ${o.name} por S/${o.price.toFixed(2)} al mes (${o.extra}). La mostraría como recomendación, no como solución al cobro, y solo después de resolver tu consulta.`,source:'Catálogo demo inspirado en promociones compartidas',intent:'offer',needsResolutionCheck:false,suggestHuman:false,showOffer:true};
  }
  if (isGreeting(t)) return {answer:`Hola 🙂. Estoy revisando tu escenario de ${f.label}. Puedes preguntarme como hablas normalmente: “xq vino así”, “qué es ese cobro”, “y eso por qué” o “explícamelo fácil”.`,source:`Escenario ${f.label}`,intent:'conversation',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (/prorr|proporcional/.test(t)) return {answer:scenario==='proration'?`En sencillo: no te cobraron un mes completo del servicio adicional. Solo cinco días, por eso aparecen S/2.50. Tu plan principal sigue en S/59.90.`:'El prorrateo es un cobro proporcional por los días que un servicio estuvo activo. En este escenario no encuentro un prorrateo aplicado al recibo actual.',source:f.evidence.join(' · '),intent:'proration',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (/reconex|restable|suspend/.test(t)) return {answer:scenario==='reconnection'?`Sí: el S/10.00 adicional corresponde a una reconexión. El plan sigue en S/59.90 y, al sumar el cargo único, agosto queda en S/69.90.`:'Puedo explicarte qué es una reconexión, pero en este escenario el recibo actual no muestra un cargo de reconexión.',source:f.evidence.join(' · '),intent:'reconnection_demo',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (/descuent|bonific|promo/.test(t)) return {answer:scenario==='discount'?`Este mes tienes una bonificación de S/20.00. El precio regular del plan sigue siendo S/59.90, pero el descuento baja el total a S/39.90.`:'En este escenario no encuentro un descuento aplicado al recibo actual.',source:f.evidence.join(' · '),intent:'discount_demo',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (/sub|caro|aument|cambio|difer|cobr|recibo|monto|total|por que|porque|pq|xq/.test(t) || ambiguous(t)) return {answer:`${f.explanation} ${scenario==='current'?'Por eso no hay una variación que explicar.':`La diferencia frente al recibo anterior es S/${Math.abs(f.total-f.previous).toFixed(2)}.`}`,source:f.evidence.join(' · '),intent:'increase',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (/plan|precio/.test(t)) return {answer:`Tu plan base es S/59.90. ${f.explanation}`,source:f.evidence.join(' · '),intent:'plan',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  if (/giga|gb|consum|dato/.test(t)) return {answer:f.consumption,source:'Consumo del escenario activo',intent:'usage',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
  const previousClarifications=history.filter(m=>m.role==='bot' && /puedes preguntarme|no me queda claro|reformula/i.test(m.text||'')).length;
  if (previousClarifications>=1) return {answer:'Todavía no tengo evidencia suficiente para afirmar una causa sin inventar. Si quieres, puedo preparar el caso para un asesor.',source:'Evidencia insuficiente tras intento de aclaración',intent:'unknown',needsResolutionCheck:false,suggestHuman:true,showOffer:false};
  return {answer:`No me queda claro qué parte quieres revisar. Puedo ayudarte con el total, la diferencia con el mes anterior, ${f.label}, consumo, beneficios u ofertas. Dímelo como te salga, incluso abreviado.`,source:'Necesito aclarar la intención',intent:'clarify',needsResolutionCheck:false,suggestHuman:false,showOffer:false};
}

async function askGemini(message, scenario, history) {
  const key=(process.env.GEMINI_API_KEY||'').trim();
  if (!key) return null;
  const model=(process.env.GEMINI_MODEL||'gemini-2.5-flash').trim();
  const f=FACTS[scenario]||FACTS.current;
  const system=`Eres LucIA, asistente de facturación móvil de una demo académica. Responde en español peruano neutral, natural y breve. Entiende errores, abreviaciones y preguntas de seguimiento. REGLA CRÍTICA: no inventes montos, fechas, cargos ni causas. Usa exclusivamente HECHOS_VERIFICADOS. Si la pregunta no se puede responder con esos hechos, pide aclaración; no mandes al asesor en el primer mensaje ambiguo. Si el usuario pide explícitamente humano, dilo. No vendas una oferta como solución a un reclamo. HECHOS_VERIFICADOS=${JSON.stringify(f)}. Las promociones disponibles son solo de demo y únicamente si el usuario las pide después de resolver su duda: ${JSON.stringify(OFFERS)}.`;
  const prior=(history||[]).slice(-10).map(m=>`${m.role==='user'?'Usuario':'LucIA'}: ${m.text}`).join('\n');
  const prompt=`${prior}\nUsuario: ${message}\nResponde solamente con el texto que diría LucIA.`;
  try {
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.25,maxOutputTokens:220}})});
    if(!r.ok) return null;
    const data=await r.json();
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if(!text) return null;
    const base=fallback(message,scenario,history);
    return {...base,answer:text,source:`Gemini + evidencia ${f.evidenceStatus}: ${f.evidence.join(' · ')}`};
  } catch { return null; }
}

const port=Number(process.env.LUCIA_PORT||8787);
http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method!=='POST'||new URL(req.url,'http://localhost').pathname!=='/api/lucia'){res.writeHead(404);return res.end('Not found');}
  let body=''; for await (const c of req) body+=c;
  try { const {message='',scenario='current',history=[]}=JSON.parse(body||'{}'); const answer=await askGemini(message,scenario,history)||fallback(message,scenario,history); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(answer)); }
  catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'bad_request'}));}
}).listen(port,'127.0.0.1',()=>console.log(`LucIA backend: http://127.0.0.1:${port}/api/lucia · Gemini ${process.env.GEMINI_API_KEY?'ACTIVO':'SIN KEY (fallback local)'}`));
