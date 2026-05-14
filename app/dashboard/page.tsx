// Dashboard: KPI principali dello studio
import { redirect } from 'next/navigation'
import {
  getTenantContext,
  primaPaginaAccessibile,
  teamScopeAppuntamento,
  teamScopeFattura,
  teamScopePaziente,
  teamScopePrescrizioneFito,
  isScopeTeamManager,
} from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { valoreFitoterapia } from '@/lib/fitoterapia'
import { Users, Calendar, FileText, Bell, Clock, Tag, ShieldCheck } from 'lucide-react'

export default async function DashboardPage() {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  // Se l'utente non ha il permesso "dashboard", lo dirottiamo alla prima
  // pagina a cui ha accesso (es. utenti MARKETING → /dashboard/marketing).
  // Senza questo controllo, dopo il login (che manda sempre a /dashboard)
  // l'utente vedrebbe i KPI della dashboard standard pur non avendone permesso.
  if ((ctx.permessi.dashboard ?? 'NONE') === 'NONE') {
    const dest = primaPaginaAccessibile(ctx.permessi)
    redirect(dest ?? '/login')
  }

  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}

  // ── Scope di visibilità per manager di team ─────────────────────────────────
  // Se l'utente loggato è un manager di team (e non SUPERADMIN), vede solo i
  // dati relativi al proprio team. I filtri sotto si auto-disattivano per
  // SUPERADMIN/utenti normali (restituiscono un oggetto vuoto).
  // Pre-calcolo in parallelo i 4 filtri di scope-team (oggetti vuoti per chi
  // non è team manager, altrimenti { pazienteId: { in: [...] } }).
  const [wsApp, wsFat, wsPaz, wsFito] = await Promise.all([
    teamScopeAppuntamento(ctx),
    teamScopeFattura(ctx),
    teamScopePaziente(ctx),
    teamScopePrescrizioneFito(ctx),
  ])
  const limitatoAlTeam = isScopeTeamManager(ctx)

  // ── Date ────────────────────────────────────────────────────────────────────
  const oggi        = new Date()
  const inizioOggi  = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())
  const fineOggi    = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1)
  const inizioMese  = new Date(oggi.getFullYear(), oggi.getMonth(), 1)
  const fineMese    = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1)

  const dowOggi   = oggi.getDay() === 0 ? 6 : oggi.getDay() - 1
  const inizioSett = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - dowOggi)
  const fineSett   = new Date(inizioSett.getFullYear(), inizioSett.getMonth(), inizioSett.getDate() + 7)

  const statiAttivi     = { in: ['FISSATO', 'CONFERMATO', 'COMPLETATO'] as never[] }
  const statiCompletati = { in: ['COMPLETATO'] as never[] }

  // ── KPI base ────────────────────────────────────────────────────────────────
  // Per il manager di team, "lead" non è team-scoped (i lead arrivano allo
  // studio prima che vengano assegnati ad un team), quindi quel conteggio
  // resta 0 — verrà comunque mostrato il box, ma indicherà che non si applica.
  const [
    totalePazienti, leadAttivi, appuntamentiOggi, fatturatoMese,
    atteseSett, atteseMese, fattoSett, fattoMese,
  ] = await Promise.all([
    prisma.paziente.count({ where: { ...ws, ...wsPaz, attivo: true } }),
    limitatoAlTeam
      ? Promise.resolve(0)
      : prisma.lead.count({ where: { ...ws, stato: { notIn: ['CONVERTITO', 'NON_INTERESSATO'] } } }),
    prisma.appuntamento.count({ where: { ...ws, ...wsApp, inizio: { gte: inizioOggi, lt: fineOggi } } }),
    prisma.fattura.aggregate({
      where: { ...ws, ...wsFat, stato: { not: 'ANNULLATA' }, dataEmissione: { gte: inizioMese, lt: fineMese } },
      _sum: { importo: true },
    }),
    prisma.appuntamento.aggregate({
      where: { ...ws, ...wsApp, stato: statiAttivi, inizio: { gte: inizioSett, lt: fineSett } },
      _sum: { prezzoApplicato: true },
    }),
    prisma.appuntamento.aggregate({
      where: { ...ws, ...wsApp, stato: statiAttivi, inizio: { gte: inizioMese, lt: fineMese } },
      _sum: { prezzoApplicato: true },
    }),
    prisma.appuntamento.aggregate({
      where: { ...ws, ...wsApp, stato: statiCompletati, inizio: { gte: inizioSett, lt: fineOggi } },
      _sum: { prezzoApplicato: true },
    }),
    prisma.appuntamento.aggregate({
      where: { ...ws, ...wsApp, stato: statiCompletati, inizio: { gte: inizioMese, lt: fineOggi } },
      _sum: { prezzoApplicato: true },
    }),
  ])

  const fatturato     = Number(fatturatoMese._sum.importo      ?? 0)
  // Importi base "appuntamenti" — la fitoterapia viene sommata dopo.
  const attesaSettApp = Number(atteseSett._sum.prezzoApplicato  ?? 0)
  const attesaMeseApp = Number(atteseMese._sum.prezzoApplicato  ?? 0)
  const fattoSettApp  = Number(fattoSett._sum.prezzoApplicato   ?? 0)
  const fattoMeseApp  = Number(fattoMese._sum.prezzoApplicato   ?? 0)

  // ── Valore fitoterapia da sommare ad atteso/fatto ──────────────────────────
  // Per la fitoterapia, "atteso" = tutte le prescrizioni con dataInizio nel
  // periodo (anche future), "fatto" = solo quelle con dataInizio <= oggi.
  // Il valore di una prescrizione è la somma (prezzoMese × durataM) per ogni
  // prodotto prescritto.
  const [fitoAttesaSett, fitoAttesaMese, fitoFattoSett, fitoFattoMese] = await Promise.all([
    valoreFitoterapia({ ...ws, ...wsFito, dataInizio: { gte: inizioSett, lt: fineSett } }),
    valoreFitoterapia({ ...ws, ...wsFito, dataInizio: { gte: inizioMese, lt: fineMese } }),
    valoreFitoterapia({ ...ws, ...wsFito, dataInizio: { gte: inizioSett, lt: fineOggi } }),
    valoreFitoterapia({ ...ws, ...wsFito, dataInizio: { gte: inizioMese, lt: fineOggi } }),
  ])

  // Totali combinati: appuntamenti + fitoterapia
  const attesaSettNum = attesaSettApp + fitoAttesaSett
  const attesaMeseNum = attesaMeseApp + fitoAttesaMese
  const fattoSettNum  = fattoSettApp  + fitoFattoSett
  const fattoMeseNum  = fattoMeseApp  + fitoFattoMese

  // Sconti del mese: somma (prezzoBase - prezzoApplicato) dove prezzoApplicato < prezzoBase
  const appMesePrezzi = await prisma.appuntamento.findMany({
    where: { ...ws, ...wsApp, stato: 'COMPLETATO', inizio: { gte: inizioMese, lt: fineMese } },
    select: { prezzoBase: true, prezzoApplicato: true },
  })
  const totaleSconto = appMesePrezzi.reduce((sum, a) => {
    const diff = Number(a.prezzoBase) - Number(a.prezzoApplicato)
    return sum + (diff > 0 ? diff : 0)
  }, 0)
  const numSconti = appMesePrezzi.filter(a => Number(a.prezzoApplicato) < Number(a.prezzoBase)).length

  function fmt(n: number) {
    return `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // ── Ultimi pazienti ──────────────────────────────────────────────────────────
  const ultimiPazienti = await prisma.paziente.findMany({
    where: { ...ws, ...wsPaz, attivo: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // ── Agenda di oggi ───────────────────────────────────────────────────────────
  const agendaOggi = await prisma.appuntamento.findMany({
    where: { ...ws, ...wsApp, inizio: { gte: inizioOggi, lt: fineOggi }, stato: { notIn: ['CANCELLATO'] } },
    select: {
      id: true, tipoPrestazione: true, inizio: true, stato: true,
      paziente: { select: { id: true, nome: true, cognome: true } },
      medico:   { select: { nome: true, cognome: true } },
    },
    orderBy: { inizio: 'asc' },
  })

  // ── Pazienti da richiamare (scaduti + oggi + prossimi 3 giorni) ──────────────
  const fineRichiamo = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 3)
  const daRichiamare = await prisma.paziente.findMany({
    where: { ...ws, ...wsPaz, attivo: true, statoCura: 'DA_RICHIAMARE', dataRichiamo: { lte: fineRichiamo } },
    select: { id: true, nome: true, cognome: true, telefono: true, dataRichiamo: true, note: true },
    orderBy: { dataRichiamo: 'asc' },
  })


  return (
    <div className="space-y-8">
      {/* Intestazione */}
      <div>
        <h1 className="text-3xl font-semibold text-slate-600">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Riepilogo del mese corrente.</p>
      </div>

      {/* Avviso scope ridotto: visibile solo al manager del team */}
      {limitatoAlTeam && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <ShieldCheck size={16} />
          Stai visualizzando i dati del tuo team
        </div>
      )}

      {/* ── KPI riga 1: contatori ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Users}    label="Pazienti attivi"    value={totalePazienti}   colore="blue" />
        <KpiCard icon={Users}    label="Lead attivi"        value={leadAttivi}       colore="amber" />
        <KpiCard icon={Calendar} label="Appuntamenti oggi"  value={appuntamentiOggi} colore="green" />
        <KpiCard icon={FileText} label="Fatturato del mese" value={fmt(fatturato)}   colore="purple" />
        <a href="/dashboard/sconti" className="col-span-2 lg:col-span-1 block">
          <KpiCard
            icon={Tag}
            label={`Sconti del mese${numSconti > 0 ? ` (${numSconti})` : ''}`}
            value={fmt(totaleSconto)}
            colore="rose"
          />
        </a>
      </div>

      {/* ── KPI riga 2: fatturato atteso / fatto ───────────────────────────
          Ogni box è cliccabile: rimanda alla pagina di dettaglio
          /dashboard/economico/[tipo] dove l'utente può vedere
          pazienti, prestazioni e operatori con totali e percentuali. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <a href="/dashboard/economico/atteso-settimana" className="block">
          <KpiCard icon={FileText} label="Atteso settimana"          value={fmt(attesaSettNum)} colore="teal" />
        </a>
        <a href="/dashboard/economico/atteso-mese" className="block">
          <KpiCard icon={FileText} label="Atteso mese"               value={fmt(attesaMeseNum)} colore="teal" />
        </a>
        <a href="/dashboard/economico/fatto-settimana" className="block">
          <KpiCard icon={FileText} label="Fatto settimana (ad oggi)" value={fmt(fattoSettNum)}  colore="indigo" />
        </a>
        <a href="/dashboard/economico/fatto-mese" className="block">
          <KpiCard icon={FileText} label="Fatto mese (ad oggi)"      value={fmt(fattoMeseNum)}  colore="indigo" />
        </a>
      </div>

      {/* ── Agenda oggi + Da richiamare ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Agenda di oggi */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={18} className="text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Agenda di oggi</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {agendaOggi.length}
            </span>
          </div>
          {agendaOggi.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun appuntamento oggi.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {agendaOggi.map(a => {
                const ora = a.inizio.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                const statoCls: Record<string, string> = {
                  FISSATO:         'bg-blue-100 text-blue-700',
                  CONFERMATO:      'bg-green-100 text-green-700',
                  COMPLETATO:      'bg-slate-100 text-slate-500',
                  NO_SHOW:         'bg-red-100 text-red-600',
                  DA_RIPROGRAMMARE:'bg-amber-100 text-amber-700',
                }
                return (
                  <li key={a.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 w-12 shrink-0 text-sm font-semibold text-slate-500">{ora}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {a.paziente.cognome ?? ''} {a.paziente.nome}
                      </p>
                      <p className="truncate text-xs text-slate-500">{a.tipoPrestazione}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statoCls[a.stato] ?? 'bg-slate-100 text-slate-500'}`}>
                      {a.stato.replace('_', ' ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Da richiamare */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={18} className="text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Da richiamare</h2>
            {daRichiamare.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                {daRichiamare.length}
              </span>
            )}
          </div>
          {daRichiamare.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun paziente da richiamare nei prossimi giorni.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {daRichiamare.map(p => {
                const data = p.dataRichiamo!
                const mezzanotte = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())
                const diffGiorni = Math.ceil((data.getTime() - mezzanotte.getTime()) / (1000 * 60 * 60 * 24))
                const etichetta = diffGiorni < 0
                  ? { testo: `${Math.abs(diffGiorni)}g scaduto`, cls: 'bg-red-100 text-red-700' }
                  : diffGiorni === 0
                  ? { testo: 'Oggi', cls: 'bg-amber-100 text-amber-700' }
                  : { testo: `tra ${diffGiorni}g`, cls: 'bg-slate-100 text-slate-500' }
                return (
                  <li key={p.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <a href={`/pazienti/${p.id}`} className="truncate text-sm font-medium text-slate-800 hover:underline">
                        {p.cognome ?? ''} {p.nome}
                      </a>
                      {p.note && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{p.note}</p>
                      )}
                      {p.telefono && (
                        <p className="text-xs text-slate-400">{p.telefono}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${etichetta.cls}`}>
                      {etichetta.testo}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

      </div>

      {/* ── Ultimi pazienti ───────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Ultimi pazienti aggiunti</h2>
        {ultimiPazienti.length === 0 ? (
          <p className="text-sm text-slate-400">Nessun paziente ancora.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimiPazienti.map(p => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-slate-800">{p.nome} {p.cognome ?? ''}</span>
                <span className="text-xs text-slate-400">{p.createdAt.toLocaleDateString('it-IT')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, colore }: {
  icon:   React.ElementType
  label:  string
  value:  string | number
  colore: 'blue' | 'amber' | 'green' | 'purple' | 'teal' | 'indigo' | 'rose'
}) {
  const colori = {
    blue:   'bg-blue-50 text-blue-600',
    amber:  'bg-amber-50 text-amber-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    teal:   'bg-teal-50 text-teal-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    rose:   'bg-rose-50 text-rose-600',
  }
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className={`mb-3 inline-flex rounded-2xl p-3 ${colori[colore]}`}>
        <Icon size={20} />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-600">{value}</p>
    </div>
  )
}

