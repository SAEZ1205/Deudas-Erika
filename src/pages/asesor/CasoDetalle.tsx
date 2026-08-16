import { useState } from 'react'
import { advisorCases } from '../../data/mocks/advisorCases'

type CallState = 'idle' | 'calling' | 'success' | 'error'
const WELCOME_KEY = 'lucia-advisor-entry-active-v2'

export default function CasoDetalle() {
  const id = decodeURIComponent(window.location.pathname.split('/').pop() || '')
  const c = advisorCases.find(x => x.id === id) || advisorCases[0]
  const [taken, setTaken] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [callState, setCallState] = useState<CallState>('idle')
  const [callMessage, setCallMessage] = useState('')

  async function callAdvisor() {
    if (callState === 'calling') return
    setCallState('calling')
    setCallMessage('Conectando con telefonía…')
    try {
      const response = await fetch('http://127.0.0.1:8790/api/calls/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: c.id })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo iniciar la llamada.')
      }
      setCallState('success')
      setCallMessage(`Llamada enviada a ${data.toMasked || 'tu celular'}. Revisa tu teléfono.`)
      window.setTimeout(() => setCallState('idle'), 7000)
    } catch (error) {
      setCallState('error')
      setCallMessage(error instanceof Error ? error.message : 'No se pudo iniciar la llamada.')
      window.setTimeout(() => setCallState('idle'), 7000)
    }
  }

  function exitAdvisor() {
    sessionStorage.removeItem(WELCOME_KEY)
  }

  const callLabel = callState === 'calling'
    ? '⏳ Iniciando llamada…'
    : callState === 'success'
      ? '✅ Llamada enviada'
      : callState === 'error'
        ? '⚠️ Reintentar llamada'
        : '📞 Llamarme con el resumen'

  return (
    <main className="h-screen min-h-screen overflow-x-hidden overflow-y-auto bg-[#eef6fa] text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-[#007ac3] via-[#009ee3] to-[#12b3ea] px-5 py-3 text-white shadow-lg md:px-7">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-white px-2 py-1 shadow-sm"><img src="/advisor/movistar-logo.webp" className="h-8 w-auto object-contain" /></div><div><b>LucIA · Atención a clientes</b><p className="text-xs text-white/80">Detalle del caso</p></div></div>
        <a href="/" onClick={exitAdvisor} className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur transition hover:bg-white/20">Volver a Mi Movistar</a>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <a href="/asesor" className="inline-flex rounded-2xl border border-sky-200 bg-white px-4 py-2 font-black text-sky-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">‹ Volver a la bandeja</a>

        <div className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-xl ring-1 ring-slate-100">
          <div className="grid gap-5 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <img src={c.gender === 'female' ? '/advisor/avatar-female.webp' : '/advisor/avatar-male.webp'} className="h-24 w-24 rounded-[28px] object-cover shadow-lg ring-4 ring-sky-100" />
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">{c.id} · VERIFIED</p><h1 className="mt-2 text-3xl font-black">{c.fullName}</h1><p className="mt-1 text-slate-500">{c.reason}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{c.clientHash}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{c.phone}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{c.cycle}</span></div></div>
            <div className={`rounded-2xl px-4 py-3 text-center text-xs font-black ${resolved ? 'bg-emerald-100 text-emerald-700' : taken ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{resolved ? 'RESUELTO' : taken ? 'EN ATENCIÓN' : 'PENDIENTE'}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={callAdvisor} disabled={callState === 'calling'} className="rounded-2xl bg-gradient-to-r from-[#008fda] to-[#22b8ef] px-5 py-3 font-black text-white shadow-[0_10px_25px_rgba(0,150,220,.22)] transition hover:-translate-y-1 hover:shadow-xl disabled:cursor-wait disabled:opacity-70">{callLabel}</button>
          <button onClick={() => setTaken(true)} className="rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 font-black text-white shadow-[0_10px_25px_rgba(60,80,200,.18)] transition hover:-translate-y-1 hover:shadow-xl">✓ Tomar caso</button>
          <button onClick={() => setResolved(true)} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-5 py-3 font-black text-white shadow-[0_10px_25px_rgba(0,170,100,.18)] transition hover:-translate-y-1 hover:shadow-xl">✓ Marcar como resuelto</button>
          {callMessage && <span className={`rounded-full px-4 py-2 text-xs font-bold ${callState === 'error' ? 'bg-rose-50 text-rose-700' : callState === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{callMessage}</span>}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-100">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sky-600">Información del cliente</p>
            <h2 className="mt-2 text-2xl font-black">Datos útiles para atender</h2>
            <div className="mt-5 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">Nombre completo</span><b className="text-right">{c.fullName}</b></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">Hash cliente</span><b>{c.clientHash}</b></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">Línea</span><b>{c.phone}</b></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">Recibo</span><b>{c.receipt}</b></div>
              <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">Ciclo</span><b>{c.cycle}</b></div>
              <div className="py-3"><span className="text-slate-500">Motivo corto</span><p className="mt-1 font-bold">{c.shortSummary}</p></div>
            </div>
            <div className="mt-5"><p className="font-black">Evidencia encontrada</p><div className="mt-3 space-y-2">{c.evidence.map(e => <div key={e} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">✓ {e}</div>)}</div></div>
          </section>

          <section className="overflow-hidden rounded-[28px] bg-[#eef4f7] shadow-lg ring-1 ring-slate-100">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#008fd3] to-[#11aae6] px-5 py-4 text-white">
              <div className="flex items-center gap-3"><img src="/lucia/lucia-chat-wave.png" className="h-11 w-11 rounded-full bg-white object-contain p-1" /><div><h2 className="text-xl font-black">LucIA</h2><p className="text-xs font-bold text-white/90">🟢 En línea · respuestas con evidencia</p></div></div><span>💬</span>
            </div>
            <div className="bg-[#d9f1fb] px-5 py-2 text-[11px] font-bold text-sky-800">✓ Respuestas basadas en tu recibo</div>
            <div className="max-h-[430px] space-y-4 overflow-y-auto p-5">{c.conversation.map((m, i) => <div key={i} className={`flex ${m.role === 'client' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${m.role === 'client' ? 'bg-[#079fdf] text-white' : 'bg-white text-slate-800'}`}>{m.text}{m.role === 'lucia' && i > 0 && <div className="mt-3 text-[10px] font-semibold text-sky-700">Evidencia disponible en el caso</div>}</div></div>)}</div>
          </section>
        </div>

        <button onClick={callAdvisor} disabled={callState === 'calling'} className="group relative mt-5 w-full overflow-hidden rounded-[30px] border-2 border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-0 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-wait disabled:opacity-75">
          <div className="grid min-h-[210px] md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative h-full min-h-[200px] overflow-hidden bg-gradient-to-br from-[#dff5ff] to-white"><div className="absolute inset-8 rounded-full bg-sky-300/20 blur-2xl" /><img src="/advisor/lucia-voice.webp" alt="LucIA resumen por llamada" className="absolute bottom-0 left-1/2 h-[94%] -translate-x-1/2 object-contain" /></div>
            <div className="p-6 md:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">📞 Resumen por llamada real</p><h2 className="mt-2 text-2xl font-black text-slate-800">LucIA te llama y te cuenta lo importante</h2><p className="mt-3 max-w-3xl leading-relaxed text-slate-600">{c.luciaSummary}</p><div className="mt-4 inline-flex rounded-full bg-[#079fdf] px-4 py-2 text-xs font-black text-white shadow-sm transition group-hover:bg-[#008cc8]">{callLabel}</div></div>
          </div>
        </button>

        <div className="h-10" />
      </section>
    </main>
  )
}
