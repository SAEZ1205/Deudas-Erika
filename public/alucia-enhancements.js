(() => {
  const API = 'http://127.0.0.1:8787/api/lucia';
  const SCENARIOS = [
  'current',
  'proration',
  'reconnection',
  'discount',
  'unverified'
  ];
  const OFFERS = {
    current:{name:'500 GB',price:'S/59.90',benefit:'350 GB más',bonus:'Movistar TV app Lite',banner:'/promos/inicio-postpago.png'},
    discount:{name:'170 GB',price:'S/45.90',benefit:'20 GB más',bonus:'100 GB por 7 meses',banner:'/promos/plan-30gb.png'},
    proration:{name:'250 GB',price:'S/49.90',benefit:'100 GB más',bonus:'Movistar TV app Lite',banner:'/promos/inicio-cambiate.png'},
    reconnection:{name:'280 GB',price:'S/55.90',benefit:'130 GB más',bonus:'Movistar TV app Lite',banner:'/promos/inicio-postpago.png'},
    unverified:{
      name:'500 GB',
      price:'S/59.90',
      benefit:'Más datos',
      bonus:'Movistar TV app Lite',
      banner:'/promos/inicio-postpago.png'
    }
  };
  const FACTS = {
    current:{label:'condición normal',total:'S/59.90',previous:'S/59.90',detail:'El recibo se mantuvo igual. Solo se cobró el plan habitual y no se registraron extras ni ajustes.'},
    proration:{label:'prorrateo',total:'S/62.40',previous:'S/59.90',detail:'El plan no subió. Se cobraron S/2.50 por cinco días de un servicio adicional activo dentro del ciclo.'},
    reconnection:{label:'reconexión',total:'S/69.90',previous:'S/59.90',detail:'El plan no cambió. El aumento de S/10.00 corresponde a un cargo único por reconexión después de una suspensión.'},
    discount:{label:'descuento',total:'S/39.90',previous:'S/59.90',detail:'El precio base sigue siendo S/59.90. Este mes una bonificación de S/20.00 redujo el total a S/39.90.'},
    unverified:{
      label:'cargo sin evidencia',
      total:'S/41.89',
      previous:'S/31.90',
      detail:'Detectamos un cargo nuevo de S/9.99, pero no existe evidencia suficiente para confirmar su origen.'
    }
  };

  let scenario = sessionStorage.getItem('alucia:scenario') || 'current';
  let history = [];
  let smartPanel = null;
  let recognition = null;
  let voiceOutput = true;

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function scenarioFromText(text){
  const t = norm(text);

    if(
      t.includes('cargo no verificable') ||
      t.includes('cargo sin evidencia') ||
      t.includes('cargo no identificado')
    ) return 'unverified';

    if(t.includes('reconexion') || t.includes('reconexión')) return 'reconnection';
    if(t.includes('prorrateo')) return 'proration';
    if(t.includes('descuento') || t.includes('bonificacion') || t.includes('bonificación')) return 'discount';
    if(t.includes('normal') || t.includes('recibo actual')) return 'current';

    return null;
  }

  function detectScenario(){
    const active = document.querySelector('.receipt-demo-options button.active,.demo-scenario-options button.active');
    const detected = active ? scenarioFromText(active.textContent) : null;
    if(detected) scenario = detected;
    if(!SCENARIOS.includes(scenario)) scenario = 'current';
    sessionStorage.setItem('alucia:scenario', scenario);
    return scenario;
  }

  function resetConversation(nextScenario){
    scenario = nextScenario || detectScenario();
    history = [];
    sessionStorage.setItem('alucia:scenario', scenario);
    if(smartPanel) renderConversation();
  }

  function greeting(){
    const f = FACTS[scenario] || FACTS.current;
    return `Hola, soy LucIA. Ya cargué la demo de ${f.label}. Pregúntame como hablas normalmente: “xq vino así”, “ese cobro de qué es” o “cuánto pagué antes”.`;
  }

  function fallback(message){
    const t = norm(message); const f = FACTS[scenario]; const offer = OFFERS[scenario];
    if(/asesor|humano|persona|operador/.test(t)) return {answer:'Claro. Este punto lo debe continuar un asesor. Voy a conservar el contexto de la conversación para que no tengas que repetir todo.',suggestHuman:true};
    if(/oferta|promo|plan mejor|mas gigas|más gigas|mejorar mi plan/.test(t)) return {answer:`Para esta demo te recomiendo ${offer.name} por ${offer.price} al mes. ${offer.benefit} y ${offer.bonus}.`,showOffer:true,offer};
    if(/mes pasado|julio|anterior|antes/.test(t)) return {answer:`El recibo anterior fue de ${f.previous}. El actual es ${f.total}.`};
    if(/prorr|proporcional/.test(t)) return {answer:scenario==='proration'?'Prorrateo significa cobrar solo la parte proporcional del periodo usado. En esta demo son S/2.50 por cinco días y el plan base sigue en S/59.90.':'Puedo explicarte qué es el prorrateo, pero en esta demo activa no aparece uno aplicado.'};
    if(/reconex|reactiv|suspend/.test(t)) return {answer:scenario==='reconnection'?'El S/10.00 adicional corresponde a la reconexión después de una suspensión. Es un cargo único; tu plan base sigue en S/59.90.':'En esta demo activa no encuentro un cargo de reconexión.'};
    if(/descuent|bonific/.test(t)) return {answer:scenario==='discount'?'Este mes se aplicó una bonificación de S/20.00. Por eso el total baja de S/59.90 a S/39.90.':'En esta demo activa no encuentro un descuento aplicado.'};
    if(/por que|porque|pq|xq|caro|subio|subió|aumento|cobro|recibo|monto|total|eso|no entendi|no entendí/.test(t)) return {answer:f.detail};
    if(/hola|buenas|oe|hey/.test(t)) return {answer:greeting()};
    if(/gracias|ya entendi|ya entendí|ah ya|ok|listo/.test(t)) return {answer:'Perfecto, dejamos aclarada esa parte. Puedes seguir preguntándome por otro mes, consumo, beneficios u ofertas.'};
    return {answer:'No encuentro esa respuesta en la evidencia disponible de esta demo. Para no inventarte información, este punto sí debe revisarlo un asesor.',suggestHuman:true};
  }

  async function askBackend(message){
    try{
      const r = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,scenario,history:history.slice(-12)})});
      if(r.ok) return await r.json();
    }catch{}
    return fallback(message);
  }

  function speak(text){
    if(!voiceOutput || !('speechSynthesis' in window) || !text) return;

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);

    u.lang = 'es-MX';
    u.rate = 0.94;
    u.pitch = 1.11;
    u.volume = 1;

    const voices = speechSynthesis.getVoices();

    const preferredVoice =
      voices.find(v =>
        v.name === 'Microsoft Dalia Online (Natural) - Spanish (Mexico)'
      ) ||
      voices.find(v =>
        /Dalia/i.test(v.name) && /^es-MX$/i.test(v.lang)
      ) ||
      voices.find(v =>
        /^es-MX$/i.test(v.lang)
      ) ||
      voices.find(v =>
        /^es/i.test(v.lang)
      ) ||
      null;

    if(preferredVoice){
      u.voice = preferredVoice;
    }

    speechSynthesis.speak(u);
  }

  function messageHtml(role,text,source){
    return `<div class="chat-message ${role==='user'?'user':''}"><div><p>${escapeHtml(text)}</p>${source?`<small>${escapeHtml(source)}</small>`:''}</div></div>`;
  }

  function offerHtml(offer){
    return `<section class="offer-card alucia-offer-card">
      <img class="alucia-offer-banner" src="${escapeHtml(offer.banner)}" alt="Oferta Movistar">
      <small>OFERTA RECOMENDADA</small>
      <h3>${escapeHtml(offer.name)} · ${escapeHtml(offer.price)} al mes</h3>
      <p>${escapeHtml(offer.benefit)}</p>
      <span>${escapeHtml(offer.bonus)}</span>
      <button type="button" class="ui-button primary alucia-upgrade">Mejorar mi plan</button>
    </section>`;
  }

  function humanHtml(){
    return `<section class="handoff-card alucia-human-card"><div><p class="handoff-eyebrow">DERIVACIÓN</p><strong>Necesito un asesor humano</strong><p>LucIA no inventará una respuesta que no esté respaldada por los datos disponibles.</p><button type="button" class="ui-button secondary alucia-human">Hablar con asesor</button></div></section>`;
  }

  function renderConversation(){
    if(!smartPanel) return;
    const scroll = smartPanel.querySelector('.alucia-scroll');
    if(!scroll) return;
    let html = messageHtml('bot',greeting(),'Escenario activo: '+FACTS[scenario].label);
    let needsHuman = false;

    for(const m of history){
      html += messageHtml(m.role,m.text,m.source);

      if(m.role==='bot' && m.offer){
        html += offerHtml(m.offer);
      }

      if(m.role==='bot' && m.suggestHuman){
        needsHuman = true;
      }
    }

    if(needsHuman){
      html += humanHtml();
    }
    
    if(history.length===0){
      html += `<div class="quick-questions alucia-quick">
        <button data-q="¿Por qué vino así mi recibo?">¿Por qué vino así?</button>
        <button data-q="¿Cuánto pagué el mes pasado?">Mes pasado</button>
      </div>`;
    }
    scroll.innerHTML = html;
    scroll.scrollTop = scroll.scrollHeight;
  }

  async function sendMessage(text){
    text = (text || '').trim(); if(!text || !smartPanel) return;
    history.push({role:'user',text}); renderConversation();
    const input = smartPanel.querySelector('.alucia-input'); if(input) input.value='';
    const scroll = smartPanel.querySelector('.alucia-scroll');
    scroll.insertAdjacentHTML('beforeend','<div class="typing-indicator"><i></i><i></i><i></i></div>'); scroll.scrollTop=scroll.scrollHeight;
    const result = await askBackend(text);
    const bot = {role:'bot',text:result.answer || 'No pude responder en este momento.',source:result.source || '',offer:result.showOffer?(result.offer || OFFERS[scenario]):null,suggestHuman:!!result.suggestHuman};
    history.push(bot); renderConversation(); speak(bot.text);
  }

  function startRecognition(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){alert('El reconocimiento de voz requiere Chrome o Edge actualizado.');return;}
    if(recognition){try{recognition.stop()}catch{} recognition=null;return;}
    const input = smartPanel?.querySelector('.alucia-input'); if(!input) return;
    recognition = new SR(); recognition.lang='es-PE'; recognition.continuous=false; recognition.interimResults=false;
    const mic = smartPanel.querySelector('.alucia-mic'); if(mic) mic.textContent='⏹';
    recognition.onresult = e => { input.value=e.results?.[0]?.[0]?.transcript || ''; input.focus(); };
    recognition.onend = () => { recognition=null; if(mic) mic.textContent='🎙'; };
    recognition.onerror = () => { recognition=null; if(mic) mic.textContent='🎙'; };
    recognition.start();
  }

  function enhanceChat(backdrop){
    if(!backdrop || backdrop.dataset.aluciaSmart==='1') return;
    const original = backdrop.querySelector('.chat-panel'); if(!original) return;
    backdrop.dataset.aluciaSmart='1'; original.style.display='none';
    const originalClose = original.querySelector('header button');
    const panel = document.createElement('section');
    panel.className='chat-panel alucia-smart-chat';
    panel.innerHTML=`<header><div><span class="lucia-avatar compact"><img src="/lucia/lucia-chat-wave.png" alt="LucIA"></span><span><strong>LucIA</strong><small><i></i> En línea · respuestas con evidencia</small></span></div><div class="alucia-header-actions"><button type="button" class="alucia-speaker" title="Voz de LucIA">🔊</button><button type="button" class="alucia-close" aria-label="Cerrar">✕</button></div></header>
      <div class="trust-strip">✓ Gemini redacta; los montos y causas vienen del motor financiero</div>
      <div class="chat-scroll alucia-scroll"></div>
      <form class="chat-input alucia-input-row"><button type="button" class="alucia-mic" title="Hablar">🎙</button><input class="alucia-input" autocomplete="off" placeholder="Escríbele a LucIA..."><button type="submit" class="alucia-send" aria-label="Enviar">➤</button></form>`;
    backdrop.appendChild(panel); smartPanel=panel; detectScenario(); renderConversation();
    panel.querySelector('.alucia-close').onclick=()=>{smartPanel=null; panel.remove(); original.style.display=''; if(originalClose) originalClose.click();};
    panel.querySelector('.alucia-speaker').onclick=e=>{voiceOutput=!voiceOutput; if(!voiceOutput && 'speechSynthesis' in window) speechSynthesis.cancel(); e.currentTarget.textContent=voiceOutput?'🔊':'🔇';};
    panel.querySelector('.alucia-mic').onclick=startRecognition;
    panel.querySelector('form').onsubmit=e=>{e.preventDefault();sendMessage(panel.querySelector('.alucia-input').value);};
    panel.addEventListener('click',e=>{
      const q=e.target.closest('[data-q]'); if(q) sendMessage(q.dataset.q);
      const up=e.target.closest('.alucia-upgrade'); if(up) sendMessage('Quiero mejorar mi plan con esta oferta');
      const human=e.target.closest('.alucia-human'); if(human) sendMessage('Quiero hablar con un asesor humano');
    });
  }

  function rewriteReceiptTargets(){
    const s = detectScenario();
    document.querySelectorAll('.pdf-modal iframe[src*="recibo-"],.pdf-modal a[href*="recibo-"],a[href*="/recibos/recibo-"]').forEach(el=>{
      const attr = el.tagName==='IFRAME'?'src':'href'; const raw=el.getAttribute(attr)||''; const name=raw.split('/').pop();
      if(name && /^recibo-.*\.pdf$/i.test(name)) el.setAttribute(attr,`/recibos/${s}/${name}`);
    });
  }

  function injectUnverifiedScenario() {
    const container =
      document.querySelector('.receipt-demo-options') ||
      document.querySelector('.demo-scenario-options')

    if (!container) return

    // Evitar duplicados
    const alreadyExists = [...container.querySelectorAll('button')].some(btn =>
      norm(btn.textContent).includes('cargo sin evidencia')
    )

    if (alreadyExists) return

    // Usamos "Dashboard del asesor" como plantilla visual
    const template = [...container.querySelectorAll('button')].find(btn =>
      norm(btn.textContent).includes('dashboard del asesor')
    )

    if (!template) return

    const button = template.cloneNode(true)

    button.classList.remove('active')
    button.classList.add('alucia-unverified-option')

    // Cambiar los textos sin alterar la estructura visual del botón
    const walker = document.createTreeWalker(
      button,
      NodeFilter.SHOW_TEXT
    )

    let node

    while ((node = walker.nextNode())) {
      const text = node.nodeValue.trim()

      if (text === '4') {
        node.nodeValue = node.nodeValue.replace('4', '5')
      }

      if (text === 'Dashboard del asesor') {
        node.nodeValue = node.nodeValue.replace(
          'Dashboard del asesor',
          'Cargo sin evidencia'
        )
      }

      if (text === 'Ver la bandeja del Call Center') {
        node.nodeValue = node.nodeValue.replace(
          'Ver la bandeja del Call Center',
          'Requiere validación de un asesor'
        )
      }
    }

    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()

      container.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('active')
      })

      button.classList.add('active')

      scenario = 'unverified'

      sessionStorage.setItem(
        'alucia:scenario',
        'unverified'
      )

      resetConversation('unverified')
      setTimeout(() => {
        applyUnverifiedReceiptUI()
      }, 100)

      // Cerrar el modal del selector
      const modal =
        button.closest('[role="dialog"]') ||
        button.closest('.modal') ||
        button.closest('.receipt-demo-modal') ||
        button.closest('.demo-modal')

      if (modal) {
        const closeButton = [...modal.querySelectorAll('button')].find(btn => {
          const text = norm(btn.textContent)
          const label = norm(btn.getAttribute('aria-label'))

          return (
            text === '×' ||
            text === 'x' ||
            label.includes('cerrar')
          )
        })

        if (closeButton) {
          closeButton.click()
        }
      }

      rewriteReceiptTargets()
    })

    container.appendChild(button)
  }

  function applyUnverifiedReceiptUI() {
    if (scenario !== 'unverified') return

    // Cambiar total visible
    const textElements = [...document.querySelectorAll('body *')]

    for (const el of textElements) {
      if (el.children.length > 0) continue

      const text = (el.textContent || '').trim()

      if (text === 'S/59.90') {
        el.textContent = 'S/41.89'
      }

      if (text === 'Pendiente de pago') {
        el.textContent = 'Requiere revisión'
      }

      if (text === 'Conoce la fecha de vencimiento de tu recibo') {
        el.textContent = 'Detectamos un cargo adicional de S/9.99'
      }

      if (
        text === 'Tu recibo de agosto vence el 15 de agosto de 2026.'
      ) {
        el.textContent =
          'No existe evidencia suficiente para confirmar el origen del cargo.'
      }
    }
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');
    if(btn){const next=scenarioFromText(btn.textContent); if(next && next!==scenario){scenario=next;sessionStorage.setItem('alucia:scenario',next);resetConversation(next);setTimeout(rewriteReceiptTargets,80);}}
  },true);

  const observer = new MutationObserver(()=>{
    const backdrop = document.querySelector('.chat-backdrop')

    if (backdrop) enhanceChat(backdrop)

    injectUnverifiedScenario()

    if (scenario === 'unverified') {
      applyUnverifiedReceiptUI()
    }
    
    rewriteReceiptTargets()
  });

  document.addEventListener('DOMContentLoaded',()=>{
    detectScenario()

    observer.observe(document.body,{
      subtree:true,
      childList:true
    })

    injectUnverifiedScenario()
    rewriteReceiptTargets()
    });
})();
