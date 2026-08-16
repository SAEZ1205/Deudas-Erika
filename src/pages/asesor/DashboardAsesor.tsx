import { useEffect, useMemo, useState } from 'react'
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

const WELCOME_KEY = 'lucia-advisor-entry-active-v2'

export default function DashboardAsesor() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [welcome, setWelcome] = useState(false)

  useEffect(() => {
    const alreadyInsideAdvisor = sessionStorage.getItem(WELCOME_KEY) === '1'
    if (!alreadyInsideAdvisor) {
      setWelcome(true)
      sessionStorage.setItem(WELCOME_KEY, '1')
    }
  }, [])

  function dismissWelcome() {
    setWelcome(false)
  }

  function exitAdvisor() {
    sessionStorage.removeItem(WELCOME_KEY)
  }

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
    <main className="h-screen min-h-screen overflow-x-hidden overflow-y-auto bg-[#edf6fb] text-slate-900">
      {welcome && (
        <div onClick={dismissWelcome} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] md:p-8">
          <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[690px] overflow-hidden rounded-[32px] border border-sky-100 bg-white shadow-[0_28px_90px_rgba(0,88,150,.30)]">
            <div className="grid min-h-[360px] md:grid-cols-[1.08fr_.92fr]">
              <div className="flex flex-col justify-center p-7 md:p-9">
                <img src="/advisor/movistar-logo.webp" alt="Movistar" className="mb-5 h-12 w-auto self-start object-contain object-left" />
                <p className="text-xs font-black uppercase tracking-[.2em] text-sky-600">Bienvenido al espacio de atención</p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-slate-900">Cada conversación puede cambiar la experiencia de un cliente.</h2>
                <p className="mt-4 leading-relaxed text-slate-600">LucIA ya organizó el contexto y la evidencia. Tú pones lo que ninguna automatización reemplaza: criterio, empatía y una solución clara.</p>
                <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">Toca fuera de esta tarjeta para comenzar →</div>
              </div>
              <div className="relative min-h-[300px] bg-gradient-to-br from-[#dff5ff] via-white to-[#bfeeff]">
                <div className="absolute inset-x-8 top-6 h-36 rounded-full bg-sky-300/20 blur-3xl" />
                <img src="/advisor/lucia-welcome.webp" alt="LucIA señalando" className="absolute bottom-0 left-1/2 h-[94%] -translate-x-1/2 object-contain drop-shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-[#007ac3] via-[#009ee3] to-[#12b3ea] px-5 py-3 text-white shadow-lg md:px-7">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white px-2 py-1 shadow-sm"><img src="/advisor/movistar-logo.webp" alt="Movistar" className="h-8 w-auto object-contain" /></div>
          <div><b>LucIA · Atención a clientes</b><p className="text-xs text-white/80">Bandeja operativa</p></div>
        </div>
        <a href="/" onClick={exitAdvisor} className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur transition hover:bg-white/20">Volver a Mi Movistar</a>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-7">
        <div className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#006fbb] via-[#009ee3] to-[#39c8ef] text-white shadow-[0_22px_55px_rgba(0,128,194,.25)]">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-[26%] top-0 h-64 w-64 rounded-full bg-cyan-200/15 blur-3xl" />
          <div className="grid min-h-[285px] lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative z-10 flex flex-col justify-center p-7 lg:p-10">
              <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-100">Call center · bandeja operativa</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight lg:text-5xl">Casos de LucIA</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90">Todo lo importante del cliente, ordenado antes de atenderlo: quién es, qué necesita, cuánto espera y qué evidencia ya revisó LucIA.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={downloadCsv} className="rounded-2xl border-2 border-emerald-200 bg-white px-5 py-3 font-black text-emerald-700 shadow-[0_8px_24px_rgba(0,0,0,.12)] transition hover:-translate-y-1 hover:shadow-xl">↓ Descargar Excel / CSV</button>
                <button onClick={() => location.reload()} className="rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-100 px-5 py-3 font-black text-amber-700 shadow-[0_8px_24px_rgba(0,0,0,.10)] transition hover:-translate-y-1 hover:shadow-xl">↻ Actualizar casos</button>
              </div>
            </div>
            <div className="relative min-h-[250px]">
              <div className="absolute bottom-5 right-8 h-[78%] w-[65%] rounded-full bg-white/15 blur-2xl" />
              <img src="/advisor/lucia-hero.webp" alt="LucIA empleada" className="absolute bottom-0 left-1/2 h-[94%] -translate-x-1/2 bg-transparent object-contain mix-blend-multiply drop-shadow-[0_24px_28px_rgba(0,60,100,.28)]" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Total', counts.total, 'from-sky-500 to-cyan-400', 'all'],
            ['Atender', counts.pending, 'from-amber-400 to-orange-400', 'pending'],
            ['En atención', counts.active, 'from-blue-500 to-indigo-400', 'active'],
            ['Resueltos', counts.resolved, 'from-emerald-500 to-green-400', 'resolved'],
            ['Callbacks', counts.callback, 'from-violet-500 to-fuchsia-400', 'callback'],
          ].map(([label, n, gradient, filter]) => (
            <button onClick={() => setStatus(String(filter))} key={String(label)} className={`rounded-3xl bg-white p-4 text-left shadow-md transition hover:-translate-y-1 hover:shadow-xl ${status===filter?'ring-2 ring-sky-400':'ring-1 ring-slate-100'}`}>
              <div className={`h-2 rounded-full bg-gradient-to-r ${gradient}`} /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-3xl font-black">{n}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
            <input value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" placeholder="Buscar hash, nombre o motivo" />
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold"><option value="all">Todos ({counts.total})</option><option value="pending">Atender ({counts.pending})</option><option value="active">En atención ({counts.active})</option><option value="resolved">Resueltos ({counts.resolved})</option><option value="callback">Callbacks ({counts.callback})</option></select>
            <div className="self-center text-sm font-bold text-slate-400">{filtered.length} casos</div>
          </div>
          <div className="hidden grid-cols-[1.3fr_.8fr_2fr_.7fr_.6fr] gap-4 bg-slate-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 md:grid"><span>Cliente</span><span>Fecha</span><span>Motivo</span><span>Estado</span><span className="text-right">Tiempo</span></div>
          <div className="divide-y divide-slate-100">
            {filtered.map(c => { const meta = statusMeta[c.status]; return (
              <a key={c.id} href={`/asesor/caso/${c.id}`} className="group grid gap-4 px-5 py-5 transition hover:bg-sky-50/70 md:grid-cols-[1.3fr_.8fr_2fr_.7fr_.6fr] md:items-center">
                <div className="flex items-center gap-3"><img src={c.gender === 'female' ? '/advisor/avatar-female.webp' : '/advisor/avatar-male.webp'} className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-md ring-2 ring-sky-100" /><div><div className="font-black text-slate-800">{c.clientHash}</div><div className="text-xs text-slate-500">{c.fullName}</div></div></div>
                <div className="text-sm font-semibold text-slate-500">{new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(c.createdAt))}</div>
                <div><div className="font-bold text-slate-800">{c.reason}</div><div className="mt-1 text-sm text-slate-500">{c.shortSummary}</div></div>
                <div><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span></div>
                <div className="flex items-center justify-between gap-3 text-sm font-black text-slate-500 md:justify-end"><span>{elapsed(c.createdAt)}</span><span className="text-xl text-sky-500 transition group-hover:translate-x-1">›</span></div>
              </a>
            )})}
            {filtered.length === 0 && <div className="p-10 text-center text-sm font-semibold text-slate-400">No hay casos que coincidan con tu búsqueda.</div>}
          </div>
        </div>
        <div className="h-10" />
      </section>
    </main>
  )
}
