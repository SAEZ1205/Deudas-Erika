import { advisorCases } from '../../data/mocks/advisorCases'

export default function CasoDetalle() {
  const id = decodeURIComponent(window.location.pathname.split('/').pop() || '')
  const c = advisorCases.find(x => x.id === id) || advisorCases[0]
  return (
    <main className="min-h-screen h-screen overflow-y-auto overflow-x-hidden bg-[#eef6fa] text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-[#008ad8] to-[#0aa9e8] px-6 py-4 text-white shadow-lg">
        <div className="flex items-center gap-3"><img src="/favicon.svg" className="h-9 w-9 brightness-0 invert"/><b>LucIA · Consola de atención</b></div>
        <a href="/" className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold">Volver a Mi Movistar</a>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <a href="/asesor" className="inline-flex rounded-2xl border border-sky-200 bg-white px-4 py-2 font-bold text-sky-700 shadow-sm">‹ Volver a la bandeja</a>

        <div className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-xl ring-1 ring-slate-100">
          <div className="grid gap-5 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <img src={c.gender === 'female' ? '/advisor/avatar-female.webp' : '/advisor/avatar-male.webp'} className="h-24 w-24 rounded-[28px] object-cover shadow-lg ring-4 ring-sky-100" />
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">{c.id} · VERIFIED</p><h1 className="mt-2 text-3xl font-black">{c.fullName}</h1><p className="mt-1 text-slate-500">{c.reason}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{c.clientHash}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{c.phone}</span><span className="rounded-full bg-slate-100 px-3 py-1 font-bold">{c.cycle}</span></div></div>
            <div className="rounded-2xl bg-amber-100 px-4 py-3 text-center text-xs font-black text-amber-700">EN ATENCIÓN</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-2xl border-2 border-sky-300 bg-white px-5 py-3 font-black text-sky-700 shadow-sm">🔊 Resumen por voz</button>
          <button className="rounded-2xl bg-sky-500 px-5 py-3 font-black text-white shadow-lg">Tomar caso</button>
          <button className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white shadow-lg">Marcar como resuelto</button>
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
            <p className="mt-2 text-sm text-slate-500">El cliente no tendrá que repetir lo que ya conversó.</p>
            <div className="mt-5 max-h-[430px] space-y-4 overflow-y-auto pr-2">{c.conversation.map((m, i) => <div key={i} className={`flex ${m.role === 'client' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'client' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800'}`}><div className="mb-1 text-[10px] font-black uppercase opacity-60">{m.role === 'client' ? 'Cliente' : 'LucIA'}</div>{m.text}</div></div>)}</div>
          </section>
        </div>

        <section className="relative mt-5 overflow-hidden rounded-[28px] border-2 border-sky-200 bg-sky-50 p-6 shadow-lg">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-100/70" />
          <div className="relative grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <img src="/lucia/lucia-academy-pointer.png" className="h-36 w-36 rounded-[26px] bg-white object-contain p-2 shadow-md" />
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">LucIA te deja esto listo</p><h2 className="mt-2 text-2xl font-black text-slate-800">En simple: ¿qué está pasando con este cliente?</h2><p className="mt-3 max-w-3xl leading-relaxed text-slate-600">{c.luciaSummary}</p><div className="mt-4 inline-flex rounded-full bg-white px-3 py-2 text-xs font-bold text-sky-700 shadow-sm">Resumen generado con la conversación y evidencia disponible</div></div>
          </div>
        </section>

        <div className="h-10" />
      </section>
    </main>
  )
}
