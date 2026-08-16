import { useState } from 'react'
import { advisorCases } from '../../data/mocks/advisorCases'

export default function CasoDetalle() {
  const id = decodeURIComponent(window.location.pathname.split('/').pop() || '')
  const c = advisorCases.find(x => x.id === id) || advisorCases[0]
  const [taken, setTaken] = useState(false)
  const [resolved, setResolved] = useState(false)

  function speakSummary() {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(c.luciaSummary)
    u.lang = 'es-PE'
    u.rate = 1.02
    const voices = speechSynthesis.getVoices()
    u.voice = voices.find(v => /es-PE/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang)) || null
    speechSynthesis.speak(u)
  }

  return (
    <main className="h-screen min-h-screen overflow-x-hidden overflow-y-auto bg-[#eef6fa] text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-[#007ac3] via-[#009ee3] to-[#12b3ea] px-5 py-3 text-white shadow-lg md:px-7">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-white px-2 py-1 shadow-sm"><img src="/advisor/movistar-logo.webp" className="h-8 w-auto object-contain" /></div><div><b>LucIA · Atención a clientes</b><p className="text-xs text-white/80">Detalle del caso</p></div></div>
        <a href="/" className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur transition hover:bg-white/20">Volver a Mi Movistar</a>
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

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={speakSummary} className="rounded-2xl bg-gradient-to-r from-[#008fda] to-[#22b8ef] px-5 py-3 font-black text-white shadow-[0_10px_25px_rgba(0,150,220,.22)] transition hover:-translate-y-1 hover:shadow-xl">🔊 Resumen por voz</button>
          <button onClick={() => setTaken(true)} className="rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 font-black text-white shadow-[0_10px_25px_rgba(60,80,200,.18)] transition hover:-translate-y-1 hover:shadow-xl">✓ Tomar caso</button>
          <button onClick={() => setResolved(true)} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-5 py-3 font-black text-white shadow-[0_10px_25px_rgba(0,170,100,.18)] transition hover:-translate-y-1 hover:shadow-xl">✓ Marcar como resuelto</button>
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

          <section className="rounded-[28px] bg-white p-6 shadow-lg ring-1 ring-slate-100">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-xl">💬</div><div><p className="text-xs font-black uppercase tracking-[.16em] text-sky-600">Conversación previa</p><h2 className="text-2xl font-black">Chat con LucIA</h2></div></div>
            <p className="mt-2 text-sm text-slate-500">Todo lo que ya se habló queda aquí, para que el cliente no tenga que repetirlo.</p>
            <div className="mt-5 max-h-[430px] space-y-4 overflow-y-auto pr-2">{c.conversation.map((m, i) => <div key={i} className={`flex ${m.role === 'client' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${m.role === 'client' ? 'bg-[#079fdf] text-white' : 'bg-slate-100 text-slate-800'}`}><div className="mb-1 text-[10px] font-black uppercase opacity-60">{m.role === 'client' ? 'Cliente' : 'LucIA'}</div>{m.text}</div></div>)}</div>
          </section>
        </div>

        <button onClick={speakSummary} className="group relative mt-5 w-full overflow-hidden rounded-[30px] border-2 border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-0 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
          <div className="grid min-h-[210px] md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative h-full min-h-[200px] overflow-hidden bg-gradient-to-br from-[#dff5ff] to-white"><div className="absolute inset-8 rounded-full bg-sky-300/20 blur-2xl" /><img src="/advisor/lucia-voice.webp" alt="LucIA resumen por voz" className="absolute bottom-0 left-1/2 h-[94%] -translate-x-1/2 object-contain" /></div>
            <div className="p-6 md:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">🔊 Resumen por voz</p><h2 className="mt-2 text-2xl font-black text-slate-800">LucIA te cuenta lo importante en simple</h2><p className="mt-3 max-w-3xl leading-relaxed text-slate-600">{c.luciaSummary}</p><div className="mt-4 inline-flex rounded-full bg-[#079fdf] px-4 py-2 text-xs font-black text-white shadow-sm transition group-hover:bg-[#008cc8]">Toca esta tarjeta para escucharlo</div></div>
          </div>
        </button>

        <div className="h-10" />
      </section>
    </main>
  )
}
