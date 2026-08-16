(() => {
  const SCENARIOS = new Set(['current','proration','reconnection','discount']);
  let restoring = false;
  let voiceEnabled = true;
  let recognition = null;
  let lastSpoken = '';

  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  function findScenarioSelect() {
    return [...document.querySelectorAll('select')].find(s => [...s.options].some(o => SCENARIOS.has(o.value)));
  }

  function currentScenario() {
    const s = findScenarioSelect();
    return s && SCENARIOS.has(s.value) ? s.value : (sessionStorage.getItem('alucia:scenario') || 'current');
  }

  function rewriteReceiptLinks() {
    const scenario = currentScenario();
    document.querySelectorAll('a[href*="/recibos/recibo-"]').forEach(a => {
      const raw = a.getAttribute('href') || '';
      const name = raw.split('/').pop();
      if (name && name.endsWith('.pdf')) a.setAttribute('href', `/recibos/${scenario}/${name}`);
    });
  }

  function resetChatOnScenarioChange() {
    const s = findScenarioSelect();
    if (!s || s.dataset.aluciaBound) return;
    s.dataset.aluciaBound = '1';
    const saved = sessionStorage.getItem('alucia:scenario');
    if (saved && SCENARIOS.has(saved) && s.value !== saved) {
      restoring = true;
      s.value = saved;
      s.dispatchEvent(new Event('change', {bubbles:true}));
      setTimeout(() => { restoring = false; rewriteReceiptLinks(); }, 50);
    }
    s.addEventListener('change', () => {
      if (restoring || !SCENARIOS.has(s.value)) return;
      sessionStorage.setItem('alucia:scenario', s.value);
      sessionStorage.setItem('alucia:resetAfterMode', '1');
      location.reload();
    });
  }

  function findChatInput() {
    const candidates = [...document.querySelectorAll('textarea,input[type="text"],input:not([type])')]
      .filter(visible)
      .filter(el => !/buscar|search/i.test(el.placeholder || ''));
    return candidates.at(-1) || null;
  }

  function ensureVoiceControls() {
    const input = findChatInput();
    if (!input || input.dataset.aluciaVoiceBound) return;
    input.dataset.aluciaVoiceBound = '1';
    const parent = input.parentElement;
    if (!parent) return;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    const mic = document.createElement('button');
    mic.type = 'button';
    mic.className = 'alucia-mic';
    mic.title = 'Hablar con ALUCIA';
    mic.setAttribute('aria-label','Hablar con ALUCIA');
    mic.textContent = '🎙️';
    Object.assign(mic.style,{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',border:'0',background:'#019BE1',color:'#fff',width:'34px',height:'34px',borderRadius:'50%',cursor:'pointer',zIndex:'5',fontSize:'16px',boxShadow:'0 2px 8px rgba(0,0,0,.15)'});
    if (!input.style.paddingRight) input.style.paddingRight = '48px';
    parent.appendChild(mic);

    mic.addEventListener('click', () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert('El reconocimiento de voz no está disponible en este navegador. Usa Chrome o Edge actualizado.'); return; }
      if (recognition) { try { recognition.stop(); } catch {} recognition = null; mic.textContent='🎙️'; return; }
      recognition = new SR();
      recognition.lang = 'es-PE';
      recognition.interimResults = false;
      recognition.continuous = false;
      mic.textContent = '⏹️';
      recognition.onresult = e => {
        const text = e.results?.[0]?.[0]?.transcript || '';
        input.value = text;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        input.focus();
      };
      recognition.onerror = () => { mic.textContent='🎙️'; recognition=null; };
      recognition.onend = () => { mic.textContent='🎙️'; recognition=null; };
      recognition.start();
    });
  }

  function ensureVoiceToggle() {
    if (document.getElementById('alucia-voice-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'alucia-voice-toggle';
    btn.type = 'button';
    btn.title = 'Activar/desactivar lectura de ALUCIA';
    btn.setAttribute('aria-label','Activar o desactivar voz de ALUCIA');
    btn.textContent = '🔊';
    Object.assign(btn.style,{position:'fixed',right:'18px',bottom:'86px',border:'0',background:'#fff',color:'#0B2739',width:'38px',height:'38px',borderRadius:'50%',cursor:'pointer',zIndex:'9999',fontSize:'17px',boxShadow:'0 3px 14px rgba(0,0,0,.18)'});
    btn.onclick = () => { voiceEnabled = !voiceEnabled; if (!voiceEnabled) speechSynthesis.cancel(); btn.textContent = voiceEnabled ? '🔊' : '🔇'; };
    document.body.appendChild(btn);
  }

  function speakLatestLucia() {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const input = findChatInput();
    if (!input) return;
    const container = input.closest('section,main,div') || document.body;
    const texts = [...container.querySelectorAll('p,div,span')]
      .filter(visible)
      .map(el => (el.innerText || '').trim())
      .filter(t => t.length > 20 && t.length < 700)
      .filter(t => !/Escribe|Enviar|Preguntas rápidas|OFERTA CONTEXTUAL/i.test(t));
    const latest = texts.at(-1);
    if (!latest || latest === lastSpoken) return;
    if (/LucIA|recibo|plan|cobro|prorr|reconex|descuento|asesor|gigas|consulta/i.test(latest)) {
      lastSpoken = latest;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(latest);
      u.lang = 'es-PE'; u.rate = 1.02; u.pitch = 1.0;
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find(v => /es-PE/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang)) || null;
      speechSynthesis.speak(u);
    }
  }

  const observer = new MutationObserver(() => {
    resetChatOnScenarioChange();
    rewriteReceiptLinks();
    ensureVoiceControls();
    ensureVoiceToggle();
    clearTimeout(window.__aluciaSpeakTimer);
    window.__aluciaSpeakTimer = setTimeout(speakLatestLucia, 500);
  });

  document.addEventListener('DOMContentLoaded', () => {
    resetChatOnScenarioChange(); rewriteReceiptLinks(); ensureVoiceControls(); ensureVoiceToggle();
    observer.observe(document.body,{subtree:true,childList:true});
  });
})();
