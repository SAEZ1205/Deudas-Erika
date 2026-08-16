import { useMemo, useState } from 'react'
import { advisorCases } from '../../data/mocks/advisorCases'

const statusMeta = {
  pending: { label: 'Atender', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  active: { label: 'En atención', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  resolved: { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  callback: { label: 'Callback', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
}

function elapsed(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor(ms / 60_000)
  if (h >= 24) return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(iso))
  if (h >= 1) return `hace ${h} h`
  return `hace ${Math.max(1, m)} min`
}

function downloadCsv() {
  const headers = ['ID caso','Hash cliente','Nombre completo','Teléfono','Fecha','Motivo','Resumen corto','Estado','Recibo','Ciclo','Evidencia']
  const rows = advisorCases.map(c => [c.id,c.clientHash,c.fullName,c.phone,new Date(c.createdAt).toLocaleString('es-PE'),c.reason,c.shortSummary,statusMeta[c.status].label,c.receipt,c.cycle,c.evidence.join(' | ')])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g,'""')}"`
  const csv = '\ufeff' + [headers, ...rows].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `casos-lucia-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DashboardAsesor() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [welcome, setWelcome] = useState(true)
  const counts = {
    total: advisorCases.length,
    pending: advisorCases.filter(c => c.status === 'pending').length,
    active: advisorCases.filter(c => c.status === 'active').length,
    resolved: advisorCases.filter(c => c.status === 'resolved').length,
    callback: advisorCases.filter(c => c.status === 'callback').length,
  }
  const filtered = useMemo(() => advisorCases.filter(c => {
    const haystack = `${c.clientHash} ${c.fullName} ${c.reason} ${c.shortSummary}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (status === 'all' || c.status === status)
  }), [query, status])

  return (
    <main className="min-h-screen h-screen overflow-y-auto overflow-x-hidden bg-[#edf6fb] text-slate-900">
      {welcome && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
          <button onClick={() => setWelcome(false)} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-xl font-black text-slate-500 shadow">×</button>
          <div className="grid gap-0 md:grid-cols-[1fr_.8fr]">
            <div className="p-7 md:p-8"><div className="mb-5 flex items-center gap-3"><img src="/favicon.svg" className="h-10 w-10"/><div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">LucIA · Atención</p><h2 className="text-2xl font-black">Cada cliente ya llega con contexto</h2></div></div><p className="leading-relaxed text-slate-600">Tus clientes esperan una atención clara y rápida. LucIA prepara el motivo, la evidencia y la conversación previa para que puedas enfocarte en resolver, no en hacer que repitan todo.</p><button onClick={() => setWelcome(false)} className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 font-black text-white shadow-lg">Ir a mis casos</button></div>
            <div className="relative min-h-[260px] bg-gradient-to-br from-sky-100 via-white to-cyan-50"><img src="/lucia/lucia-academy-pointer.png" className="absolute bottom-0 left-1/2 h-[95%] -translate-x-1/2 object-contain"/><div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/85 px-3 py-2 text-center text-xs font-bold text-sky-700 shadow backdrop-blur">“Yo preparo el contexto, tú das la mejor atención.”</div></div>
          </div>
        </div>
      </div>}

      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-[#008ad8] to-[#11a7e7] px-6 py-4 text-white shadow-lg">
        <div className="flex items-center gap-3"><img src="/favicon.svg" className="h-9 w-9 brightness-0 invert"/><div><b>LucIA · Consola de atención</b><p className="text-xs text-white/80">Bandeja operativa para asesores</p></div></div>
        <a href="/" className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold backdrop-blur">Volver a Mi Movistar</a>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-7">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#007ad6] via-[#029ee8] to-[#17b4ee] text-white shadow-xl">
          <div className="absolute -left-24 top-8 h-44 w-44 rounded-full bg-white/10 blur-sm"/><div className="absolute right-28 -top-20 h-64 w-64 rounded-full bg-white/10"/>
          <div className="grid min-h-[250px] lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative z-10 p-7 lg:p-9"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-100">Call center · bandeja operativa</p><h1 className="mt-2 text-4xl font-black tracking-tight lg:text-5xl">Casos de LucIA</h1><p className="mt-3 max-w-xl text-white/85">Prioriza rápido y entra a cada caso con el contexto preparado para atender sin pedir que el cliente repita todo.</p><div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Demo local · backend activo</div><div className="mt-6 flex flex-wrap gap-3"><button onClick={downloadCsv} className="rounded-2xl border-2 border-emerald-200 bg-white px-5 py-3 font-black text-emerald-700 shadow-sm transition hover:-translate-y-0.5">↓ Descargar Excel / CSV</button><button onClick={() => location.reload()} className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-3 font-black text-amber-700 shadow-sm transition hover:-translate-y-0.5">↻ Actualizar</button></div></div>
            <div className="relative min-h-[220px]"><img src="/lucia/lucia-academy-thumbs.png" className="absolute bottom-0 left-1/2 h-[94%] -translate-x-1/2 object-contain drop-shadow-2xl"/><div className="absolute bottom-5 right-5 max-w-[220px] rounded-2xl bg-white/90 px-4 py-3 text-slate-800 shadow-xl backdrop-blur"><p className="text-xs font-black uppercase tracking-wider text-sky-600">Tu copiloto de atención</p><p className="mt-1 text-sm font-bold">LucIA resume y ordena lo importante antes de cada caso.</p></div></div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Total', counts.total, 'from-sky-500 to-cyan-400', 'all'],['Atender', counts.pending, 'from-amber-400 to-orange-400', 'pending'],['En atención', counts.active, 'from-blue-500 to-indigo-400', 'active'],['Resueltos', counts.resolved, 'from-emerald-500 to-green-400', 'resolved'],['Callbacks', counts.callback, 'from-violet-500 to-fuchsia-400', 'callback'],
          ].map(([label, n, gradient, filter]) => <button onClick={() => setStatus(String(filter))} key={String(label)} className={`rounded-3xl bg-white p-4 text-left shadow-md ring-1 transition hover:-translate-y-0.5 ${status===filter?'ring-2 ring-sky-400':'ring-slate-100'}`}><div className={`h-2 rounded-full bg-gradient-to-r ${gradient}`} /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-3xl font-black">{n}</p></button>)}
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row"><input value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400" placeholder="Buscar hash, nombre o motivo" /><select value={status} onChange={e => setStatus(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3"><option value="all">Todos ({counts.total})</option><option value="pending">Atender ({counts.pending})</option><option value="active">En atención ({counts.active})</option><option value="resolved">Resueltos ({counts.resolved})</option><option value="callback">Callbacks ({counts.callback})</option></select><div className="self-center text-sm font-bold text-slate-400">{filtered.length} casos</div></div>
          <div className="hidden grid-cols-[1.3fr_.8fr_2fr_.7fr_.6fr] gap-4 bg-slate-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 md:grid"><span>Cliente</span><span>Fecha</span><span>Motivo</span><span>Estado</span><span className="text-right">Tiempo</span></div>
          <div className="divide-y divide-slate-100">{filtered.map(c => { const meta = statusMeta[c.status]; return <a key={c.id} href={`/asesor/caso/${c.id}`} className="group grid gap-4 px-5 py-5 transition hover:bg-sky-50/70 md:grid-cols-[1.3fr_.8fr_2fr_.7fr_.6fr] md:items-center"><div className="flex items-center gap-3"><img src={c.gender === 'female' ? '/advisor/avatar-female.webp' : '/advisor/avatar-male.webp'} className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-md ring-2 ring-sky-100" /><div><div className="font-black text-slate-800">{c.clientHash}</div><div className="text-xs text-slate-500">{c.fullName}</div></div></div><div className="text-sm font-semibold text-slate-500">{new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(c.createdAt))}</div><div><div className="font-bold text-slate-800">{c.reason}</div><div className="mt-1 text-sm text-slate-500">{c.shortSummary}</div></div><div><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span></div><div className="flex items-center justify-between gap-3 text-sm font-black text-slate-500 md:justify-end"><span>{elapsed(c.createdAt)}</span><span className="text-xl text-sky-500 transition group-hover:translate-x-1">›</span></div></a>})}{filtered.length === 0 && <div className="p-10 text-center text-sm font-semibold text-slate-400">No hay casos que coincidan con tu búsqueda.</div>}</div>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-r from-[#008fe4] via-[#5e72e4] to-[#8b5cf6] p-6 text-white shadow-xl"><div className="absolute -right-10 -top-14 h-52 w-52 rounded-full bg-white/10" /><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-white/75">Oferta destacada para asesores</p><h2 className="mt-1 text-3xl font-black">30 GB extra x 6 meses</h2><p className="mt-2 text-white/80">Muéstrala solo cuando el caso ya esté resuelto y realmente ayude al cliente.</p></div><button className="rounded-2xl bg-slate-900/80 px-6 py-3 font-black shadow-lg">Ver ofertas</button></div></div>
      </section>
    </main>
  )
}
