// ─────────────────────────────────────────────────────────────────────────────
// Pagina di dettaglio dei box economici della Dashboard.
//
// Mostra, per il "tipo" passato nell'URL (atteso-settimana, atteso-mese,
// fatto-settimana, fatto-mese), tre tabelle riepilogative (pazienti,
// prestazioni, operatori) con totale e percentuale, più la lista completa
// degli appuntamenti del periodo. Sono disponibili filtri per paziente,
// prestazione e operatore (i filtri vengono passati come query string).
//
// SCOPE DI VISIBILITÀ:
//   • SUPERADMIN      → vede tutto
//   • Manager di team → vede solo gli appuntamenti dei team che gestisce
//   • Altri           → vede tutto dello studio
// (vedi helper in lib/tenant.ts)
//
// PAGINAZIONE:
//   • Dettaglio appuntamenti      → 15 righe per pagina (param URL: p)
//   • Tabella Pazienti aggregata  → 10 righe per pagina (param URL: pp)
//   • Tabella Prestazioni aggreg. → 10 righe per pagina (param URL: pr)
//   • Tabella Operatori aggregata → 10 righe per pagina (param URL: po)
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation'
import {
  getTenantContext,
  teamScopeAppuntamento,
  teamScopePrescrizioneFito,
  isScopeTeamManager,
} from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { valoreFitoterapia } from '@/lib/fitoterapia'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

// ── Configurazione per ogni "tipo" di box ──────────────────────────────────
// Ogni box ha un periodo (settimana o mese), un insieme di stati di
// appuntamento da considerare, e un flag che indica se il periodo va tagliato
// alla data di oggi (utile per "fatto ad oggi").
type Periodo = 'settimana' | 'mese'
type Stato = 'FISSATO' | 'CONFERMATO' | 'COMPLETATO'

type Config = {
  titolo: string
  descrizione: string
  periodo: Periodo
  stati: Stato[]
  finePeriodoOggi: boolean
}

const CONFIGS: Record<string, Config> = {
  'atteso-settimana': {
    titolo: 'Atteso settimana',
    descrizione: 'Appuntamenti fissati, confermati o completati della settimana corrente.',
    periodo: 'settimana',
    stati: ['FISSATO', 'CONFERMATO', 'COMPLETATO'],
    finePeriodoOggi: false,
  },
  'atteso-mese': {
    titolo: 'Atteso mese',
    descrizione: 'Appuntamenti fissati, confermati o completati del mese corrente.',
    periodo: 'mese',
    stati: ['FISSATO', 'CONFERMATO', 'COMPLETATO'],
    finePeriodoOggi: false,
  },
  'fatto-settimana': {
    titolo: 'Fatto settimana (ad oggi)',
    descrizione: 'Appuntamenti completati nella settimana corrente fino ad oggi.',
    periodo: 'settimana',
    stati: ['COMPLETATO'],
    finePeriodoOggi: true,
  },
  'fatto-mese': {
    titolo: 'Fatto mese (ad oggi)',
    descrizione: 'Appuntamenti completati nel mese corrente fino ad oggi.',
    periodo: 'mese',
    stati: ['COMPLETATO'],
    finePeriodoOggi: true,
  },
}

// Quante righe per pagina per ciascuna tabella
const RIGHE_PER_PAGINA_DETT = 15
const RIGHE_PER_PAGINA_AGG  = 10

// Utility: formatta un numero come importo in euro
function fmt(n: number) {
  return `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Utility: rimuove duplicati da un array in base a una funzione "chiave"
function uniqBy<T, K>(arr: T[], key: (x: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const x of arr) {
    const k = key(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

// Tipo dei search params della pagina. Tutti opzionali e di tipo stringa
// (Next.js passa sempre stringhe, anche per numeri come la pagina corrente).
type SP = {
  pazienteId?: string
  prestazione?: string
  operatoreId?: string
  p?:  string  // pagina della tabella "Dettaglio appuntamenti"
  pp?: string  // pagina della tabella "Pazienti"
  pr?: string  // pagina della tabella "Prestazioni"
  po?: string  // pagina della tabella "Operatori"
}

// Costruisce un URL preservando i parametri attuali e applicando degli override.
// Le chiavi con valore '' o undefined vengono escluse dalla query string.
function buildUrl(
  base: string,
  current: SP,
  overrides: Partial<SP>,
): string {
  const merged: Record<string, string | undefined> = { ...current, ...overrides }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '') params.set(k, v)
  }
  const qs = params.toString()
  return `${base}${qs ? `?${qs}` : ''}`
}

// Converte un valore di "pagina" della query string in un intero ≥ 1.
// Se non valido, ritorna 1.
function parsePage(v: string | undefined): number {
  const n = Number(v ?? 1)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

export default async function EconomicoDettaglioPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>
  searchParams: Promise<SP>
}) {
  // ── Controllo accesso ────────────────────────────────────────────────────
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  // Solo chi ha accesso alla dashboard può vedere questa pagina
  if ((ctx.permessi.dashboard ?? 'NONE') === 'NONE') redirect('/dashboard')

  const { tipo } = await params
  const sp = await searchParams

  // Se il tipo non è valido, torno alla dashboard
  const cfg = CONFIGS[tipo]
  if (!cfg) redirect('/dashboard')

  // Where condition base: filtra per studio (multi-tenant)
  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}

  // Filtro per scope di team: vuoto se l'utente è SUPERADMIN, altrimenti
  // limita ai pazienti del team gestito (pre-calcolato in parallelo).
  const [wsTeam, wsTeamFito] = await Promise.all([
    teamScopeAppuntamento(ctx),
    teamScopePrescrizioneFito(ctx),
  ])
  const limitatoAlTeam = isScopeTeamManager(ctx)

  // ── Calcolo periodo (stessi confini usati nella dashboard) ──────────────
  const oggi = new Date()
  let inizio: Date
  let fine: Date

  if (cfg.periodo === 'settimana') {
    // Lunedì come primo giorno della settimana (in JS Date.getDay() ha 0 = domenica)
    const dow = oggi.getDay() === 0 ? 6 : oggi.getDay() - 1
    inizio = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - dow)
    fine   = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + 7)
  } else {
    inizio = new Date(oggi.getFullYear(), oggi.getMonth(), 1)
    fine   = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1)
  }

  // Per i box "fatto ad oggi", non includiamo gli appuntamenti futuri:
  // la fine del periodo viene tagliata alla mezzanotte di domani.
  if (cfg.finePeriodoOggi) {
    const domani = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1)
    if (domani < fine) fine = domani
  }

  // ── Filtri attivi (presi dalla query string) ─────────────────────────────
  // Il filtro "prestazione" può valere il nome di una prestazione standard
  // (es. "Bioscan", "Trattamento", …) oppure il valore speciale "Fitoterapia"
  // che indica le prescrizioni fitoterapiche (gestite separatamente).
  const FITO_LABEL = 'Fitoterapia'
  const filtroPaziente  = sp.pazienteId  ? { pazienteId: sp.pazienteId }  : {}
  const filtroOperatore = sp.operatoreId ? { medicoId:   sp.operatoreId } : {}

  // Filtro prestazione: lo applichiamo agli appuntamenti solo se è valorizzato
  // e diverso da "Fitoterapia". Se è "Fitoterapia" gli appuntamenti vengono
  // saltati del tutto.
  const filtroPrestazioneApp =
    sp.prestazione && sp.prestazione !== FITO_LABEL
      ? { tipoPrestazione: sp.prestazione }
      : {}

  // Flag per saltare interamente una fonte di dati in base al filtro prestazione
  const skipAppuntamenti = sp.prestazione === FITO_LABEL
  const skipFito         = !!(sp.prestazione && sp.prestazione !== FITO_LABEL)

  // ── Query: appuntamenti filtrati (per le tabelle aggregate e il dettaglio)
  const appuntamenti = skipAppuntamenti ? [] : await prisma.appuntamento.findMany({
    where: {
      ...ws,
      ...wsTeam,
      stato: { in: cfg.stati as never[] },
      inizio: { gte: inizio, lt: fine },
      ...filtroPaziente,
      ...filtroPrestazioneApp,
      ...filtroOperatore,
    },
    select: {
      id: true,
      inizio: true,
      tipoPrestazione: true,
      prezzoApplicato: true,
      stato: true,
      paziente: { select: { id: true, nome: true, cognome: true } },
      medico:   { select: { id: true, nome: true, cognome: true } },
    },
    orderBy: { inizio: 'asc' },
  })

  // ── Query: prescrizioni fitoterapia nel periodo ──────────────────────────
  // Per la fitoterapia consideriamo le prescrizioni con dataInizio nel periodo
  // e stato ATTIVA o CONCLUSA (escludiamo SOSPESA che non genera incasso).
  const prescrFito = skipFito ? [] : await prisma.prescrizioneFito.findMany({
    where: {
      ...ws,
      ...wsTeamFito,
      stato: { in: ['ATTIVA', 'CONCLUSA'] },
      dataInizio: { gte: inizio, lt: fine },
      ...filtroPaziente,
      ...filtroOperatore,
    },
    select: {
      id: true,
      dataInizio: true,
      stato: true,
      paziente: { select: { id: true, nome: true, cognome: true } },
      medico:   { select: { id: true, nome: true, cognome: true } },
      prodotti: {
        select: {
          durataM:    true,
          prezzoMese: true,
          prodotto:   { select: { prezzoMese: true } },
        },
      },
    },
    orderBy: { dataInizio: 'asc' },
  })

  // ── Unifico appuntamenti e fito in un'unica lista di "voci" ──────────────
  // Ogni voce ha la stessa forma: data, paziente, medico, prestazione, importo.
  // Così le aggregazioni e la tabella di dettaglio funzionano allo stesso modo.
  type Voce = {
    id:         string
    data:       Date
    paziente:   { id: string; nome: string; cognome: string | null }
    medico:     { id: string; nome: string; cognome: string | null }
    prestazione: string
    importo:    number
    stato:      string
    isFito:     boolean
  }

  const vociApp: Voce[] = appuntamenti.map(a => ({
    id:          a.id,
    data:        a.inizio,
    paziente:    a.paziente,
    medico:      a.medico,
    prestazione: a.tipoPrestazione,
    importo:     Number(a.prezzoApplicato),
    stato:       a.stato,
    isFito:      false,
  }))

  // Per ogni prescrizione fito calcolo l'importo totale: somma di
  // (prezzoMese override OPPURE prezzoMese catalogo) × durataM per ogni prodotto.
  const vociFito: Voce[] = prescrFito.map(p => {
    const importo = p.prodotti.reduce((s, pp) => {
      const prezzo = Number(pp.prezzoMese ?? pp.prodotto.prezzoMese)
      return s + prezzo * pp.durataM
    }, 0)
    return {
      id:          p.id,
      data:        p.dataInizio,
      paziente:    p.paziente,
      medico:      p.medico,
      prestazione: FITO_LABEL,
      importo,
      stato:       p.stato,
      isFito:      true,
    }
  })

  // Concateno e ordino per data
  const voci: Voce[] = [...vociApp, ...vociFito]
    .sort((a, b) => a.data.getTime() - b.data.getTime())

  // ── Aggregazioni (su tutte le voci, app+fito) ──────────────────────────
  const totale = voci.reduce((s, v) => s + v.importo, 0)

  // Raggruppa per paziente
  const perPaziente = new Map<string, { nome: string; importo: number; count: number }>()
  for (const v of voci) {
    const k = v.paziente.id
    const cur = perPaziente.get(k) ?? {
      nome: `${v.paziente.cognome ?? ''} ${v.paziente.nome}`.trim(),
      importo: 0,
      count: 0,
    }
    cur.importo += v.importo
    cur.count   += 1
    perPaziente.set(k, cur)
  }
  const listaPazienti = [...perPaziente.entries()]
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => b.importo - a.importo)

  // Raggruppa per prestazione (le fito appaiono come una singola voce "Fitoterapia")
  const perPrestazione = new Map<string, { importo: number; count: number }>()
  for (const v of voci) {
    const cur = perPrestazione.get(v.prestazione) ?? { importo: 0, count: 0 }
    cur.importo += v.importo
    cur.count   += 1
    perPrestazione.set(v.prestazione, cur)
  }
  const listaPrestazioni = [...perPrestazione.entries()]
    .map(([nome, val]) => ({ nome, ...val }))
    .sort((a, b) => b.importo - a.importo)

  // Raggruppa per operatore (medico)
  const perOperatore = new Map<string, { nome: string; importo: number; count: number }>()
  for (const v of voci) {
    const k = v.medico.id
    const cur = perOperatore.get(k) ?? {
      nome: `${v.medico.nome} ${v.medico.cognome ?? ''}`.trim(),
      importo: 0,
      count: 0,
    }
    cur.importo += v.importo
    cur.count   += 1
    perOperatore.set(k, cur)
  }
  const listaOperatori = [...perOperatore.entries()]
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => b.importo - a.importo)

  // ── Opzioni per i menu a tendina dei filtri ────────────────────────────
  // Faccio due query SENZA filtri attivi (appuntamenti + fito), così le
  // tendine mostrano sempre tutte le possibili scelte del periodo. Il filtro
  // per scope-team viene invece sempre applicato.
  const [tuttiAppBase, tuttiFitoBase] = await Promise.all([
    prisma.appuntamento.findMany({
      where: {
        ...ws,
        ...wsTeam,
        stato: { in: cfg.stati as never[] },
        inizio: { gte: inizio, lt: fine },
      },
      select: {
        tipoPrestazione: true,
        paziente: { select: { id: true, nome: true, cognome: true } },
        medico:   { select: { id: true, nome: true, cognome: true } },
      },
    }),
    prisma.prescrizioneFito.findMany({
      where: {
        ...ws,
        ...wsTeamFito,
        stato: { in: ['ATTIVA', 'CONCLUSA'] },
        dataInizio: { gte: inizio, lt: fine },
      },
      select: {
        paziente: { select: { id: true, nome: true, cognome: true } },
        medico:   { select: { id: true, nome: true, cognome: true } },
      },
    }),
  ])

  // Pazienti: unione delle due sorgenti
  const optPazienti = uniqBy(
    [
      ...tuttiAppBase.map(a => a.paziente),
      ...tuttiFitoBase.map(f => f.paziente),
    ].map(p => ({
      id: p.id,
      label: `${p.cognome ?? ''} ${p.nome}`.trim(),
    })),
    o => o.id,
  ).sort((a, b) => a.label.localeCompare(b.label))

  // Prestazioni: nomi distinti degli appuntamenti + "Fitoterapia" se ne esistono
  const optPrestazioni = [
    ...uniqBy(tuttiAppBase.map(a => a.tipoPrestazione), x => x),
    ...(tuttiFitoBase.length > 0 ? [FITO_LABEL] : []),
  ].sort((a, b) => a.localeCompare(b))

  // Operatori: unione medici delle due sorgenti
  const optOperatori = uniqBy(
    [
      ...tuttiAppBase.map(a => a.medico),
      ...tuttiFitoBase.map(f => f.medico),
    ].map(m => ({
      id: m.id,
      label: `${m.nome} ${m.cognome ?? ''}`.trim(),
    })),
    o => o.id,
  ).sort((a, b) => a.label.localeCompare(b.label))

  // Indicatore "ci sono filtri attivi"
  const filtriAttivi = Boolean(sp.pazienteId || sp.prestazione || sp.operatoreId)

  // ── Paginazione: leggo dalla query string e calcolo le slice ─────────────
  const pagDett = parsePage(sp.p)
  const pagPaz  = parsePage(sp.pp)
  const pagPre  = parsePage(sp.pr)
  const pagOp   = parsePage(sp.po)

  // Calcolo numero totale di pagine per ogni tabella (almeno 1)
  const totPagDett = Math.max(1, Math.ceil(voci.length / RIGHE_PER_PAGINA_DETT))
  const totPagPaz  = Math.max(1, Math.ceil(listaPazienti.length / RIGHE_PER_PAGINA_AGG))
  const totPagPre  = Math.max(1, Math.ceil(listaPrestazioni.length / RIGHE_PER_PAGINA_AGG))
  const totPagOp   = Math.max(1, Math.ceil(listaOperatori.length / RIGHE_PER_PAGINA_AGG))

  // Slice della pagina corrente per ciascuna tabella
  const sliceDett = voci.slice(
    (pagDett - 1) * RIGHE_PER_PAGINA_DETT,
    pagDett * RIGHE_PER_PAGINA_DETT,
  )
  const slicePaz = listaPazienti.slice(
    (pagPaz - 1) * RIGHE_PER_PAGINA_AGG,
    pagPaz * RIGHE_PER_PAGINA_AGG,
  )
  const slicePre = listaPrestazioni.slice(
    (pagPre - 1) * RIGHE_PER_PAGINA_AGG,
    pagPre * RIGHE_PER_PAGINA_AGG,
  )
  const sliceOp = listaOperatori.slice(
    (pagOp - 1) * RIGHE_PER_PAGINA_AGG,
    pagOp * RIGHE_PER_PAGINA_AGG,
  )

  // URL base della pagina (per i link di paginazione)
  const baseUrl = `/dashboard/economico/${tipo}`

  return (
    <div className="space-y-6">

      {/* ── Intestazione ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <a href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft size={16} />
          Dashboard
        </a>
        <h1 className="text-3xl font-semibold text-slate-600">{cfg.titolo}</h1>
      </div>

      <p className="text-sm text-slate-500">
        {cfg.descrizione}
        {' '}
        <span className="text-slate-400">
          (dal {inizio.toLocaleDateString('it-IT')} al {new Date(fine.getTime() - 1).toLocaleDateString('it-IT')})
        </span>
      </p>

      {/* Avviso scope ridotto: visibile solo al manager del team */}
      {limitatoAlTeam && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <ShieldCheck size={16} />
          Stai visualizzando i dati del tuo team
        </div>
      )}

      {/* ── KPI riepilogo ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Importo totale</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">{fmt(totale)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Voci (appuntamenti + fito)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">{voci.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pazienti distinti</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">{listaPazienti.length}</p>
        </div>
      </div>

      {/* ── Filtri ──────────────────────────────────────────────────────
          Il form fa una GET, quindi i valori finiscono nella query string
          (es: ?pazienteId=...&prestazione=...). Sull'arrivo la pagina si
          ricarica e filtra i dati. Niente JS lato client, tutto SSR.       */}
      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-slate-500">Paziente</label>
          <select
            name="pazienteId"
            defaultValue={sp.pazienteId ?? ''}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tutti</option>
            {optPazienti.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-slate-500">Prestazione</label>
          <select
            name="prestazione"
            defaultValue={sp.prestazione ?? ''}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tutte</option>
            {optPrestazioni.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-slate-500">Operatore</label>
          <select
            name="operatoreId"
            defaultValue={sp.operatoreId ?? ''}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tutti</option>
            {optOperatori.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Applica filtri
        </button>

        {filtriAttivi && (
          <a
            href={baseUrl}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Azzera
          </a>
        )}
      </form>

      {/* ── Tabelle aggregate (pazienti, prestazioni, operatori) ────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TabellaAggregata
          titolo="Pazienti"
          righe={slicePaz.map(p => ({
            chiave: p.id,
            etichetta: p.nome,
            count: p.count,
            importo: p.importo,
          }))}
          totaleRighe={listaPazienti.length}
          totaleImporto={totale}
          paginaCorrente={pagPaz}
          paginaTotale={totPagPaz}
          hrefPagina={(n) => buildUrl(baseUrl, sp, { pp: String(n) })}
        />
        <TabellaAggregata
          titolo="Prestazioni"
          righe={slicePre.map(p => ({
            chiave: p.nome,
            etichetta: p.nome,
            count: p.count,
            importo: p.importo,
          }))}
          totaleRighe={listaPrestazioni.length}
          totaleImporto={totale}
          paginaCorrente={pagPre}
          paginaTotale={totPagPre}
          hrefPagina={(n) => buildUrl(baseUrl, sp, { pr: String(n) })}
        />
        <TabellaAggregata
          titolo="Operatori"
          righe={sliceOp.map(o => ({
            chiave: o.id,
            etichetta: o.nome,
            count: o.count,
            importo: o.importo,
          }))}
          totaleRighe={listaOperatori.length}
          totaleImporto={totale}
          paginaCorrente={pagOp}
          paginaTotale={totPagOp}
          hrefPagina={(n) => buildUrl(baseUrl, sp, { po: String(n) })}
        />
      </div>

      {/* ── Lista dettaglio: appuntamenti + prescrizioni fito ─────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-6 py-4 text-lg font-semibold text-slate-800">
          Dettaglio
          <span className="ml-2 font-normal text-slate-400">({voci.length})</span>
        </h2>
        {voci.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nessun dato per il periodo/filtri selezionati.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Data</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Paziente</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Operatore</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Prestazione</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Stato</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sliceDett.map(v => (
                    <tr key={v.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {v.data.toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/pazienti/${v.paziente.id}`}
                          className="font-medium text-slate-800 hover:underline"
                        >
                          {`${v.paziente.cognome ?? ''} ${v.paziente.nome}`.trim()}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {`${v.medico.nome} ${v.medico.cognome ?? ''}`.trim()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {v.prestazione}
                        {v.isFito && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            fito
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{v.stato.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {fmt(v.importo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 font-semibold text-slate-700">
                      Totale ({voci.length} voci)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {fmt(totale)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Paginazione
              paginaCorrente={pagDett}
              paginaTotale={totPagDett}
              hrefPagina={(n) => buildUrl(baseUrl, sp, { p: String(n) })}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente tabella aggregata: riceve la slice della pagina corrente
// e mostra anche il footer di paginazione (se ci sono più pagine).
// ─────────────────────────────────────────────────────────────────────────────
function TabellaAggregata({
  titolo,
  righe,
  totaleRighe,
  totaleImporto,
  paginaCorrente,
  paginaTotale,
  hrefPagina,
}: {
  titolo: string
  righe: Array<{ chiave: string; etichetta: string; count: number; importo: number }>
  totaleRighe: number      // numero totale di voci (anche fuori pagina)
  totaleImporto: number    // totale generale per il calcolo delle percentuali
  paginaCorrente: number
  paginaTotale: number
  hrefPagina: (n: number) => string
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <h3 className="border-b border-slate-100 px-5 py-3 text-base font-semibold text-slate-800">
        {titolo} <span className="font-normal text-slate-400">({totaleRighe})</span>
      </h3>
      {totaleRighe === 0 ? (
        <p className="p-5 text-sm text-slate-400">Nessun dato.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">Nome</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">N°</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">Importo</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {righe.map(r => {
                  // Percentuale del totale (intera, arrotondata)
                  const perc = totaleImporto > 0 ? Math.round((r.importo / totaleImporto) * 100) : 0
                  return (
                    <tr key={r.chiave} className="transition hover:bg-slate-50">
                      <td className="max-w-[220px] truncate px-4 py-2 text-slate-700" title={r.etichetta}>
                        {r.etichetta}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">{r.count}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">
                        € {r.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">{perc}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Paginazione
            paginaCorrente={paginaCorrente}
            paginaTotale={paginaTotale}
            hrefPagina={hrefPagina}
          />
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente paginazione: mostra "← Precedente | Pagina N di M | Successiva →".
// Se c'è una sola pagina (o nessuna), non viene renderizzato nulla.
// ─────────────────────────────────────────────────────────────────────────────
function Paginazione({
  paginaCorrente,
  paginaTotale,
  hrefPagina,
}: {
  paginaCorrente: number
  paginaTotale: number
  hrefPagina: (n: number) => string
}) {
  if (paginaTotale <= 1) return null

  // Limito la pagina corrente al range valido (può capitare se l'utente
  // sposta a mano un valore di pagina nell'URL).
  const cur = Math.min(Math.max(paginaCorrente, 1), paginaTotale)
  const hasPrev = cur > 1
  const hasNext = cur < paginaTotale

  // Stili: link attivo vs disabilitato (grigio chiaro, niente click)
  const stileAttivo   = 'text-slate-600 hover:text-slate-900'
  const stileDisabil  = 'text-slate-300 pointer-events-none cursor-default'

  return (
    <nav className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-sm">
      <a
        href={hasPrev ? hrefPagina(cur - 1) : '#'}
        aria-disabled={!hasPrev}
        className={hasPrev ? stileAttivo : stileDisabil}
      >
        ← Precedente
      </a>
      <span className="text-slate-500">
        Pagina <span className="font-semibold text-slate-700">{cur}</span> di {paginaTotale}
      </span>
      <a
        href={hasNext ? hrefPagina(cur + 1) : '#'}
        aria-disabled={!hasNext}
        className={hasNext ? stileAttivo : stileDisabil}
      >
        Successiva →
      </a>
    </nav>
  )
}
