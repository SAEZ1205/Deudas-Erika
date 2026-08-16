import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function loadEnv(){
  try{for(const raw of (await readFile(resolve('.env.local'),'utf8')).split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const i=line.indexOf('=');if(i<1)continue;const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();if(!process.env[k])process.env[k]=v;}}catch{}
}
await loadEnv();
const SCENARIOS=JSON.parse(await readFile(resolve('backend/data/scenarios.json'),'utf8'));
const OFFERS=[
  {id:'POST-170',name:'170 GB',price:45.90,benefit:'20 GB mas',bonus:'100 GB por 7 meses',banner:'/promos/plan-30gb.png'},
  {id:'POST-250',name:'250 GB',price:49.90,benefit:'100 GB mas',bonus:'Movistar TV app Lite',banner:'/promos/inicio-cambiate.png'},
  {id:'POST-280',name:'280 GB',price:55.90,benefit:'130 GB mas',bonus:'Movistar TV app Lite',banner:'/promos/inicio-postpago.png'},
  {id:'POST-500',name:'500 GB',price:59.90,benefit:'350 GB mas',bonus:'Movistar TV app Lite',banner:'/promos/inicio-postpago.png'}
];
const norm=(s='')=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const money=n=>`S/${Number(n).toFixed(2)}`;
const evidenceText=s=>[...(s.evidence||[]),...(s.orders||[]).map(o=>`${o.description} (${o.status})`)].join(' · ');

function classify(message,history=[]){
  const t=norm(message);
  if(/(asesor|humano|persona|operador|call center|quiero llamar|hablar con alguien)/.test(t))return 'HUMAN';
  if(/(yo no pedi|nunca pedi|no reconozco|no autorice|no solicite|ese cargo no es mio)/.test(t))return 'DISPUTE';
  if(/(oferta|promo|promocion|mejorar.*plan|otro plan|mas gigas|recomiend.*plan)/.test(t))return 'OFFER';
  if(/(prorr|proporcional)/.test(t))return 'PRORATION';
  if(/(reconex|reactiv|restable|suspend)/.test(t))return 'RECONNECTION';
  if(/(descuent|bonific)/.test(t))return 'DISCOUNT';
  if(/(mes pasado|julio|anterior|antes cuanto|cuanto pague)/.test(t))return 'PREVIOUS';
  if(/(plan|precio base|cuanto cuesta)/.test(t))return 'PLAN';
  if(/(giga| gb |consum|datos|internet me queda|cuanto me queda)/.test(` ${t} `))return 'USAGE';
  if(/(beneficio|incluye|whatsapp|llamada ilimitada)/.test(t))return 'BENEFITS';
  if(/(por que|porque|pq|xq|caro|subio|aumento|cobro|recibo|monto|total|diferencia|cambio)/.test(t))return 'EXPLAIN';
  if(/^(a+h* ?ya|ah ?ya|ya|ok|okay|listo|entendi|entiendo|perfecto|gracias|dale|ta bien|esta bien)(\s|$)/.test(t))return 'ACK';
  if(/^(hola|holi|buenas|oe|hey|ola)(\s|$)/.test(t)&&t.split(' ').length<5)return 'GREETING';
  if(/^(eso|y eso|por que|porque|pq|xq|como asi|no entendi|que|y por que)$/.test(t))return 'FOLLOWUP';
  return 'UNKNOWN';
}

function resolvedByHistory(history=[]){
  return history.some(m=>m.role==='user'&&/^(a+h* ?ya|ah ?ya|ya entendi|entendi|entiendo|listo|perfecto|gracias|ok|okay)(\s|$)/i.test(norm(m.text||'')));
}
function offerFor(scenario){return scenario==='discount'?OFFERS[0]:scenario==='proration'?OFFERS[1]:scenario==='reconnection'?OFFERS[2]:OFFERS[3];}

function deterministic(message,scenario='current',history=[]){
  const s=SCENARIOS[scenario]||SCENARIOS.current;
  const intent=classify(message,history);
  const source=evidenceText(s);
  const delta=Math.abs(Number(s.difference||0));
  const answer=(text,extra={})=>({answer:text,source,intent,needsResolutionCheck:false,suggestHuman:false,showOffer:false,...extra});
  switch(intent){
    case 'HUMAN': return answer('Claro. Voy a dejar preparado el caso con esta conversación y la evidencia del recibo para que un asesor continúe sin pedirte que repitas todo.',{suggestHuman:true});
    case 'DISPUTE': return answer(`Entiendo. En los datos sí aparece ${s.cause.toLowerCase()}, pero los registros del recibo no pueden demostrar por sí solos que tú autorizaste la operación. Para no asumir algo que no puedo verificar, este punto sí debe revisarlo un asesor.`,{suggestHuman:true});
    case 'OFFER': {
      if(scenario!=='current'&&!resolvedByHistory(history))return answer('Sí puedo revisar una opción para tu línea, pero primero terminemos de aclarar el cobro actual. No quiero mezclar una venta con una duda de facturación.');
      const o=offerFor(scenario);return answer(`Sí. Para esta demo te puedo mostrar ${o.name} por ${money(o.price)} al mes, con ${o.benefit}. Pulsa “Mejorar mi plan” si quieres continuar; no voy a simular una contratación todavía.`,{showOffer:true,offer:o});
    }
    case 'PRORATION': return answer(scenario==='proration'?`En sencillo: no te cobraron un mes completo del servicio adicional. Solo se cobraron los días usados y eso suma ${money(s.difference)}. Tu plan base sigue en ${money(s.plan.price)}.`:'El prorrateo es cobrar solo la parte proporcional de un servicio dentro del ciclo. En este recibo actual no tengo evidencia de un prorrateo.');
    case 'RECONNECTION': return answer(scenario==='reconnection'?`Sí. El adicional de ${money(s.difference)} corresponde a la reconexión después de una suspensión. El plan base sigue en ${money(s.plan.price)} y por eso el total queda en ${money(s.current_receipt.total)}.`:'Puedo explicarte qué es una reconexión, pero en este recibo actual no aparece un cargo de reconexión.');
    case 'DISCOUNT': return answer(scenario==='discount'?`Este mes tienes una bonificación de ${money(Math.abs(s.difference))}. El precio base sigue en ${money(s.plan.price)}, y el descuento baja el total a ${money(s.current_receipt.total)}.`:'En este recibo actual no encuentro una bonificación aplicada.');
    case 'PREVIOUS': return answer(`El recibo anterior fue de ${money(s.previous_receipt.total)}. El actual es ${money(s.current_receipt.total)}${delta?`, así que la diferencia es ${money(delta)}`:''}.`);
    case 'PLAN': return answer(`Tu plan base es ${s.plan.name} por ${money(s.plan.price)}. ${s.explanation}`);
    case 'USAGE': return answer('La interfaz muestra el consumo del escenario activo. Ese dato de uso es independiente de la explicación financiera del recibo; si preguntas por un cargo, uso la evidencia del recibo y no el consumo para justificarlo.');
    case 'BENEFITS': return answer('En la demo, los beneficios vigentes se muestran en la sección de beneficios del plan. No los uso para justificar cargos ni para inventar promociones.');
    case 'EXPLAIN': return answer(`${s.explanation}${scenario==='current'?'':` Frente al recibo anterior la variación es ${money(delta)}.`}`);
    case 'ACK': return answer('Perfecto, dejamos aclarada esa parte. Puedes seguir preguntándome por otro mes, consumo o beneficios; y si quieres ver una oferta, recién ahora puedo revisarla contigo.');
    case 'GREETING': return answer(`Hola 🙂. Estoy viendo tu escenario de ${s.label}. Pregúntame normal, incluso abreviado: “xq vino así”, “ese cobro de qué es” o “cuánto pagué antes”.`);
    case 'FOLLOWUP': return answer(`${s.explanation} ${scenario==='current'?'No hay una variación adicional que explicar.':`La diferencia comprobada es ${money(delta)}.`}`);
    default: return answer('No encuentro esa información en la evidencia disponible del recibo ni en las relaciones preparadas del dataset. Para no inventarte una respuesta, este caso debe revisarlo un asesor.',{suggestHuman:true});
  }
}

async function askGemini(message,scenario,history,base){
  const key=(process.env.GEMINI_API_KEY||'').trim(); if(!key)return null;
  const model=(process.env.GEMINI_MODEL||'gemini-2.5-flash').trim(); const s=SCENARIOS[scenario]||SCENARIOS.current;
  const system=`Eres ALUCIA/LucIA, asistente conversacional de facturacion Movistar en una demo academica. Habla en espanol natural, breve y claro. HECHOS_VERIFICADOS=${JSON.stringify(s)}. INTENCION=${base.intent}. RESPUESTA_DE_REFERENCIA=${base.answer}. REGLAS: 1) No inventes montos, fechas, cargos, ordenes ni autorizaciones. 2) Puedes deducir solo aritmetica directa que ya este contenida en los totales, por ejemplo diferencia=actual-anterior. 3) Si la evidencia no alcanza, dilo y deriva a humano. 4) Entiende abreviaciones y seguimiento. 5) No ofrezcas planes mientras exista una duda de facturacion sin resolver. 6) Maximo 2 o 3 frases salvo que pidan detalle.`;
  const prior=(history||[]).slice(-12).map(m=>`${m.role==='user'?'Usuario':'LucIA'}: ${m.text||''}`).join('\n');
  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:`${prior}\nUsuario: ${message}\nResponde solo como LucIA.`}]}],generationConfig:{temperature:.2,maxOutputTokens:220}})});
    if(!r.ok)return null;const data=await r.json();const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!text)return null;return {...base,answer:text,source:`Gemini + ${s.evidence_status}: ${evidenceText(s)}`};
  }catch{return null;}
}

const port=Number(process.env.LUCIA_PORT||8787);
http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&u.pathname==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,gemini:!!process.env.GEMINI_API_KEY,scenarios:Object.keys(SCENARIOS)}));}
  if(req.method==='GET'&&u.pathname==='/api/scenarios'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(SCENARIOS));}
  if(req.method!=='POST'||u.pathname!=='/api/lucia'){res.writeHead(404);return res.end('Not found');}
  let body='';for await(const c of req)body+=c;
  try{const {message='',scenario='current',history=[]}=JSON.parse(body||'{}');const base=deterministic(message,scenario,history);const response=await askGemini(message,scenario,history,base)||base;res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(response));}catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'bad_request'}));}
}).listen(port,'127.0.0.1',()=>console.log(`ALUCIA backend v2: http://127.0.0.1:${port}/api/lucia · Gemini ${process.env.GEMINI_API_KEY?'ACTIVO':'SIN KEY'}`));
