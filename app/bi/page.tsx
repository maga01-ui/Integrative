// Pagina Business Intelligence: statistiche aggregate dello studio
import { redirect } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { TrendingUp } from 'lucide-react'

export default async function BiPage({
  searchParams
}: {
  searchParams: Promise<{ anno?: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { anno: annoS } = await searchParams
  const anno = annoS ? Number(annoS) : new Date().getFullYear()
  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}

  const inizioAnno = new Date(anno, 0, 1)
  const fineAnno   = new Date(anno + 1, 0, 1)

  // Statistiche annuali
  const statiCompletati = { in: ['COMPLETATO'] as never[] }

  const [fatturatoAnno, appuntamentiEseguiti, nuoviPazienti, nuoviLead,
         appuntamentiPerTipo] = await Promise.all([

    // Fatturato dell'anno: somma importo delle fatture/ricevute emesse (non annullate)
    prisma.fattura.aggregate({
      where: { ...ws, stato: { not: 'ANNULLATA' }, dataEmissione: { gte: inizioAnno, lt: fineAnno } },
      _sum: { importo: true }
    }),

    // Appuntamenti completati
    prisma.appuntamento.count({
      where: { ...ws, stato: statiCompletati, inizio: { gte: inizioAnno, lt: fineAnno } }
    }),

    // Nuovi pazienti
    prisma.paziente.count({ where: { ...ws, createdAt: { gte: inizioAnno, lt: fineAnno } } }),

    // Nuovi lead
    prisma.lead.count({ where: { ...ws, dataLead: { gte: inizioAnno, lt: fineAnno } } }),

    // Appuntamenti per tipo prestazione
    prisma.appuntamento.groupBy({
      by: ['tipoPrestazione'],
      where: { ...ws, stato: statiCompletati, inizio: { gte: inizioAnno, lt: fineAnno } },
      _count: true,
      orderBy: { _count: { tipoPrestazione: 'desc' } }
    })
  ])

  // Fatturato per mese: somma importo fatture/ricevute emesse (non annullate), per dataEmissione
  const mesiLabels = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  const fatturatiMensili = await Promise.all(
    mesiLabels.map((_, i) =>
      prisma.fattura.aggregate({
        where: {
          ...ws,
          stato: { not: 'ANNULLATA' },
          dataEmissione: { gte: new Date(anno, i, 1), lt: new Date(anno, i + 1, 1) }
        },
        _sum: { importo: true }
      })
    )
  )

  // Altezze in pixel (max 120px) — evita il problema dei % su parent auto-height
  const BARRA_MAX_PX = 120
  const valoriMensili = fatturatiMensili.map(f => Number(f._sum.importo ?? 0))
  const maxFatturato  = Math.max(...valoriMensili, 1)

  // ── Conversioni annuali ──────────────────────────────────────────────────────

  // Lead arrivati nell'anno e quanti sono diventati bioscan (stato CONVERTITO)
  const [leadsDelAnno, leadsDiventaiBioscan] = await Promise.all([
    prisma.lead.count({ where: { ...ws, dataLead: { gte: inizioAnno, lt: fineAnno } } }),
    prisma.lead.count({ where: { ...ws, dataLead: { gte: inizioAnno, lt: fineAnno }, stato: 'CONVERTITO' } }),
  ])

  // Pazienti che hanno fatto un bioscan nell'anno
  const bioscanRaw = await prisma.appuntamento.findMany({
    where: {
      ...ws,
      tipoPrestazione: { contains: 'bioscan', mode: 'insensitive' },
      stato: 'COMPLETATO',
      inizio: { gte: inizioAnno, lt: fineAnno },
    },
    select: { pazienteId: true },
  })
  const bioscanPazIds = [...new Set(bioscanRaw.map(b => b.pazienteId))]

  // Tra quei pazienti, quanti hanno poi iniziato un programma di cura
  const bioscanConvertiti = bioscanPazIds.length === 0 ? 0 : await prisma.paziente.count({
    where: {
      id: { in: bioscanPazIds },
      assegnamenti: { some: {} },
    },
  })

  // Referti letti nell'anno, raggruppati per operatore (medico)
  const lettureRaw = await prisma.appuntamento.findMany({
    where: {
      ...ws,
      tipoPrestazione: { contains: 'lettura', mode: 'insensitive' },
      stato: 'COMPLETATO',
      inizio: { gte: inizioAnno, lt: fineAnno },
    },
    select: {
      pazienteId: true,
      medico: { select: { id: true, nome: true, cognome: true } },
    },
  })

  type OperatoreEntry = { nome: string; totReferti: number; convertiti: number }
  const opMap = new Map<string, OperatoreEntry>()
  // Set dei pazienteId che hanno un assegnamento a programma
  const pazConProgramma = bioscanPazIds.length === 0
    ? new Set<string>()
    : new Set(
        (await prisma.paziente.findMany({
          where: { id: { in: bioscanPazIds }, assegnamenti: { some: {} } },
          select: { id: true },
        })).map(p => p.id)
      )

  for (const l of lettureRaw) {
    const nomeOp = l.medico
      ? `${l.medico.nome} ${l.medico.cognome ?? ''}`.trim()
      : 'N/D'
    if (!opMap.has(nomeOp)) opMap.set(nomeOp, { nome: nomeOp, totReferti: 0, convertiti: 0 })
    const e = opMap.get(nomeOp)!
    e.totReferti++
    if (pazConProgramma.has(l.pazienteId)) e.convertiti++
  }
  const operatoriStats: OperatoreEntry[] = [...opMap.values()].sort((a, b) => b.totReferti - a.totReferti)

  // Helper percentuale
  function pct(n: number, tot: number) {
    if (tot === 0) return '0 %'
    return `${Math.round((n / tot) * 100)} %`
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-600">Business Intelligence</h1>
        <form method="GET" className="flex gap-2">
          <input
            name="anno"
            type="number"
            defaultValue={anno}
            min="2020" max="2030"
            className="w-24 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none"
          />
          <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Aggiorna
          </button>
        </form>
      </div>

      {/* KPI annuali */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Fatturato emesso',  value: `€ ${Number(fatturatoAnno._sum.importo ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0 })}` },
          { label: 'Sedute completate',      value: appuntamentiEseguiti },
          { label: 'Nuovi pazienti',         value: nuoviPazienti },
          { label: 'Nuovi lead',             value: nuoviLead },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-600">{value}</p>
          </div>
        ))}
      </div>

      {/* Grafico a barre: fatturato mensile (fatture/ricevute emesse) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Fatturato mensile {anno}</h2>
        <div className="flex items-end gap-1" style={{ height: `${BARRA_MAX_PX + 36}px` }}>
          {valoriMensili.map((val, i) => {
            // Altezza in pixel: almeno 3px come segnaposto, proporzionale al massimo
            const altPx = val > 0
              ? Math.max(Math.round((val / maxFatturato) * BARRA_MAX_PX), 8)
              : 3
            const isZero = val === 0
            return (
              <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1" style={{ height: `${BARRA_MAX_PX + 20}px` }}>
                {/* Importo al hover */}
                <span className={`text-xs text-slate-500 ${val > 0 ? 'opacity-0 group-hover:opacity-100' : 'invisible'} transition-opacity`}>
                  € {val.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                </span>
                {/* Barra */}
                <div
                  className={`w-full rounded-t-lg transition-all ${isZero ? 'bg-slate-100' : 'bg-slate-700'}`}
                  style={{ height: `${altPx}px` }}
                />
                {/* Etichetta mese */}
                <span className="text-xs text-slate-500">{mesiLabels[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Appuntamenti per tipo */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Sedute per tipo {anno}</h2>
        {appuntamentiPerTipo.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna seduta nell&apos;anno selezionato.</p>
        ) : (
          <ul className="space-y-3">
            {appuntamentiPerTipo.map((t) => {
              const tot = appuntamentiEseguiti || 1
              const pctVal = Math.round((t._count / tot) * 100)
              return (
                <li key={t.tipoPrestazione} className="flex items-center gap-4">
                  <span className="w-36 text-sm text-slate-700">{t.tipoPrestazione}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 8 }}>
                    <div className="h-full rounded-full bg-slate-800" style={{ width: `${pctVal}%` }} />
                  </div>
                  <span className="w-16 text-right text-sm text-slate-600">{t._count} ({pctVal}%)</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Conversioni annuali ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-slate-400" />
          <h2 className="text-xl font-semibold text-slate-700">Conversioni — anno {anno}</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">

          {/* 1. Leads → Bioscan */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Leads dell&apos;anno</p>
              <span className="text-sm font-bold text-slate-700">{pct(leadsDiventaiBioscan, leadsDelAnno)}</span>
            </div>
            <div className="space-y-3">
              <RigaConversione label="Leads arrivati"     valore={leadsDelAnno}        su={null} />
              <RigaConversione label="Diventati Bioscan"  valore={leadsDiventaiBioscan} su={null} />
            </div>
          </div>

          {/* 2. Bioscan → Programmi */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Bioscan completati</p>
              <span className="text-sm font-bold text-slate-700">{pct(bioscanConvertiti, bioscanPazIds.length)}</span>
            </div>
            <div className="space-y-3">
              <RigaConversione label="Bioscan effettuati"               valore={bioscanPazIds.length} su={null} />
              <RigaConversione label="Convertiti in percorso"           valore={bioscanConvertiti}    su={null} />
            </div>
          </div>

          {/* 3. Lettura referto per operatore */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Lettura referto</p>
              <span className="text-sm font-bold text-slate-700">
                {pct(
                  operatoriStats.reduce((s, o) => s + o.convertiti, 0),
                  operatoriStats.reduce((s, o) => s + o.totReferti,  0),
                )}
              </span>
            </div>
            {operatoriStats.length === 0 ? (
              <p className="text-sm text-slate-400">Nessun referto letto quest&apos;anno.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-3 pb-2 text-xs font-medium text-slate-400">
                  <span className="col-span-1">Operatore</span>
                  <span className="text-right">Referti</span>
                  <span className="text-right">Conversioni</span>
                </div>
                {operatoriStats.map(op => (
                  <div key={op.nome} className="grid grid-cols-3 items-center py-2.5 text-sm">
                    <span className="col-span-1 truncate pr-2 font-medium text-slate-800">{op.nome}</span>
                    <span className="text-right text-slate-600">{op.totReferti}</span>
                    <span className="text-right font-semibold text-slate-800">{op.convertiti}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}

// ── Riga conversione: numero + percentuale opzionale ─────────────────────────

function RigaConversione({ label, valore, su }: {
  label:  string
  valore: number
  su:     number | null  // null = non mostrare la percentuale
}) {
  const pctStr = su !== null && su > 0
    ? `${Math.round((valore / su) * 100)} %`
    : su === 0 ? '0 %' : null

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="flex items-baseline gap-1.5 text-right">
        <span className="text-lg font-semibold text-slate-800">{valore}</span>
        {pctStr !== null && (
          <span className="text-xs text-slate-400">{pctStr}</span>
        )}
      </span>
    </div>
  )
}
