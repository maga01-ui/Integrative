// Pagina pazienti: vista avanzata con filtri, statistiche e percorsi in evidenza
import { redirect } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import Paginazione from '@/components/Paginazione'
import { formatTelefono } from '@/lib/telefono'
import BottoneConverti from './BottoneConverti'

const PER_PAGINA = 15

// Converte un numero di telefono in formato wa.me (solo cifre, con prefisso 39 se mancante)
function waNumero(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('39') && digits.length >= 11) return digits
  if (digits.startsWith('0039')) return digits.slice(2)
  return `39${digits}`
}

// ─── Tipi per il componente avanzamento ───────────────────────────────────────
type PercorsoMin = {
  fase: string
  tipoCura: string | null
  sessioniTotali: number
  _count: { prescrizioni: number; appuntamenti: number }
}

// ─── Barra di avanzamento del percorso ────────────────────────────────────────
function AvanzamentoBar({ percorso }: { percorso: PercorsoMin | null }) {
  if (!percorso) return <span className="text-xs text-slate-300">—</span>

  // Percorso concluso: barra verde piena
  if (percorso.fase === 'CONCLUSO') {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-green-100">
          <div className="h-full w-full rounded-full bg-green-500" />
        </div>
        <span className="text-xs font-medium text-green-600">Completata</span>
      </div>
    )
  }

  // Ciclo trattamenti (con o senza fitoterapia)
  if (percorso.tipoCura === 'TRATTAMENTI' || percorso.tipoCura === 'ENTRAMBI') {
    const tot  = percorso.sessioniTotali
    const comp = percorso._count.appuntamenti   // conteggio reale da DB
    const pct  = tot > 0 ? Math.round((comp / tot) * 100) : 0
    // Colore diverso se combinato con fitoterapia
    const colore = percorso.tipoCura === 'ENTRAMBI' ? 'bg-amber-500' : 'bg-indigo-500'
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${colore}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-slate-600">{comp}/{tot}</span>
      </div>
    )
  }

  // Solo fitoterapia: mostra mesi completati su 3 (corso tipico)
  if (percorso.tipoCura === 'FITOTERAPIA') {
    const mesi = percorso._count.prescrizioni
    const pct  = Math.min(Math.round((mesi / 3) * 100), 100)
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-slate-600">{mesi}/3 mesi</span>
      </div>
    )
  }

  // Fase iniziale (bioscan / lettura referto): testo descrittivo
  const FASE_LABEL: Record<string, string> = {
    BIOSCAN_INIZIALE: 'Attesa bioscan',
    LETTURA_REFERTO:  'Attesa referto',
    IN_CURA:          'In cura',
    MANTENIMENTO:     'Mantenimento',
  }
  return <span className="text-xs text-slate-400">{FASE_LABEL[percorso.fase] ?? '—'}</span>
}

// ─── Card statistica cliccabile ───────────────────────────────────────────────
function StatCard({ label, valore, href, attivo = false, schema }: {
  label:   string
  valore:  number
  href?:   string
  attivo?: boolean
  schema:  'slate' | 'green' | 'gray' | 'red' | 'amber' | 'violet' | 'orange' | 'indigo'
}) {
  const colori: Record<string, { bg: string; border: string; num: string; lbl: string; ring: string }> = {
    slate:  { bg: 'bg-slate-50',   border: 'border-slate-200',  num: 'text-slate-800',  lbl: 'text-slate-500',  ring: 'ring-slate-300'  },
    green:  { bg: 'bg-green-50',   border: 'border-green-200',  num: 'text-green-700',  lbl: 'text-green-600',  ring: 'ring-green-400'  },
    gray:   { bg: 'bg-slate-100',  border: 'border-slate-200',  num: 'text-slate-600',  lbl: 'text-slate-500',  ring: 'ring-slate-300'  },
    red:    { bg: 'bg-red-50',     border: 'border-red-200',    num: 'text-red-700',    lbl: 'text-red-500',    ring: 'ring-red-400'    },
    amber:  { bg: 'bg-amber-50',   border: 'border-amber-200',  num: 'text-amber-700',  lbl: 'text-amber-600',  ring: 'ring-amber-400'  },
    violet: { bg: 'bg-violet-50',  border: 'border-violet-200', num: 'text-violet-700', lbl: 'text-violet-600', ring: 'ring-violet-400' },
    orange: { bg: 'bg-orange-50',  border: 'border-orange-200', num: 'text-orange-700', lbl: 'text-orange-600', ring: 'ring-orange-400' },
    indigo: { bg: 'bg-indigo-50',  border: 'border-indigo-200', num: 'text-indigo-700', lbl: 'text-indigo-600', ring: 'ring-indigo-400' },
  }
  const c = colori[schema]
  const base = `rounded-2xl border px-4 py-3 shadow-sm transition-all ${c.bg} ${c.border}`
  const activeCls = attivo ? `ring-2 ${c.ring} shadow-md` : 'hover:shadow-md hover:scale-[1.02]'
  const inner = (
    <>
      <p className={`text-xs font-medium ${c.lbl}`}>{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${c.num}`}>{valore}</p>
    </>
  )
  if (href) return <a href={href} className={`block ${base} ${activeCls}`}>{inner}</a>
  return <div className={base}>{inner}</div>
}

// ─── Badge tipo paziente ──────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: string }) {
  const s = tipo === 'AZIENDA'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s}`}>
      {tipo}
    </span>
  )
}

// ─── Colori avatar (deterministici sul primo carattere dell'id) ───────────────
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
]

// ─── Pagina principale ────────────────────────────────────────────────────────
export default async function PazientiPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    stato?: string
    studioId?: string
    medicoId?: string
    fase?: string
    page?: string
    persi?: string
    alert?: string
  }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { q, stato = 'attivi', studioId: filtroStudio, medicoId: filtroMedico, fase: filtroFase, page: pageParam, alert, persi } =
    await searchParams
  const mostraPersi = persi === '1'
  const pagina = Math.max(1, Number(pageParam) || 1)
  const skip   = (pagina - 1) * PER_PAGINA

  // Filtro base per lo studio (SUPERADMIN vede tutto)
  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}
  const now = new Date()
  const inizioOggi = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // mezzanotte locale

  // ── Costruisce il filtro WHERE per i pazienti ─────────────────────────────
  // NOTA: il filtro attivo/non attivo viene applicato DOPO il caricamento
  // usando la logica calcolata, non il campo database attivo
  const whereBase: Record<string, unknown> = {
    ...ws,
    // Escludi sempre i pazienti persi, a meno che non sia richiesta la vista persi
    perso: mostraPersi ? true : false,
    // Filtro centro
    ...(filtroStudio ? { studioId: filtroStudio } : {}),
    // Ricerca testuale su nome, cognome, email, telefono
    ...(q ? {
      OR: [
        { nome:           { contains: q, mode: 'insensitive' as const } },
        { cognome:        { contains: q, mode: 'insensitive' as const } },
        { ragioneSociale: { contains: q, mode: 'insensitive' as const } },
        { email:          { contains: q, mode: 'insensitive' as const } },
        { telefono:       { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}),
    // Filtro per fase del percorso attivo
    ...(filtroFase ? { percorsi: { some: { attivo: true, fase: filtroFase } } } : {}),
    // Filtro per operatore: pazienti con almeno un appuntamento con quel medico
    ...(filtroMedico ? { appuntamenti: { some: { medicoId: filtroMedico } } } : {}),
  }

  // ── Carica dati in parallelo ──────────────────────────────────────────────
  const [studi, medici, contatoreAssoluto, tuttiPazienti] = await Promise.all([

    // Studi per il dropdown "centro"
    prisma.studio.findMany({
      where: ws.studioId ? { id: ws.studioId } : { attivo: true },
      select: { id: true, nome: true, citta: true },
      orderBy: { nome: 'asc' },
    }),

    // Medici/admin per il dropdown "operatore"
    prisma.utente.findMany({
      where: { ...ws, ruolo: { in: ['MEDICO', 'ADMIN', 'SUPERADMIN'] }, attivo: true },
      select: { id: true, nome: true, cognome: true, ruolo: true },
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
    }),

    // Contatore totale (indipendente dai filtri) per la stat "Pazienti totali"
    prisma.paziente.count({ where: ws }),

    // Carica TUTTI i pazienti (senza paginazione nel DB)
    // La paginazione verrà applicata DOPO il filtro attivo calcolato lato JavaScript
    prisma.paziente.findMany({
      where: whereBase,
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
      include: {
        // Studio per la colonna "Centro"
        studio: { select: { nome: true, citta: true } },

        // Percorso attivo con bioscan e conteggio prescrizioni fitoterapiche
        percorsi: {
          where: { attivo: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            bioscan: { select: { id: true, tipo: true } },
            _count: {
              select: {
                prescrizioni: true,
                // Conta appuntamenti COMPLETATO per la barra avanzamento
                appuntamenti: { where: { stato: 'COMPLETATO' } },
              },
            },
          },
        },

        // Ultimi 10 appuntamenti non cancellati (per trovare operatore e prossimo app.)
        appuntamenti: {
          where: { stato: { notIn: ['CANCELLATO'] } },
          orderBy: { inizio: 'desc' },
          take: 10,
          include: {
            medico:                { select: { id: true, nome: true, cognome: true, ruolo: true } },
            bioscan:               { select: { id: true } },  // per escludere appuntamenti bioscan da "Prestazioni"
            bioscanLetturaReferto: { select: { id: true } },  // per escludere lettura referto da "Prestazioni"
          },
        },

        // Tutti i bioscan del paziente
        bioscan: {
          select: { id: true, tipo: true, refertoConsegnato: true, effettuato: true, letturaRefertoId: true },
        },

        // Programmi: include sessioniTotali/Completate per rilevare programmi finiti anche se non chiusi
        assegnamenti: {
          where:  { stato: { in: ['ATTIVO', 'SOSPESO', 'COMPLETATO'] } },
          select: { id: true, stato: true, sessioniTotali: true, sessioniCompletate: true },
        },

        // Prescrizioni fitoterapia attive
        prescrizioni: {
          where:  { stato: 'ATTIVA' },
          select: { id: true },
          take:   1,
        },
      },
    }),
  ])

  // ── Funzione helper: calcola se un paziente è attivo ──────────────────────
  // Un paziente è attivo se ha ALMENO UNA di queste condizioni:
  // 1. Bioscan eseguito ma referto non ancora consegnato
  // 2. Appuntamenti futuri non cancellati
  // 3. Programma in stato ATTIVO o SOSPESO (non concluso)
  // 4. Fitoterapia con stato ATTIVA
  // 5. Appuntamenti da riprogrammare
  const pazienteIsAttivo = (p: any): boolean => {
    // 1. Bioscan senza referto consegnato
    if (p.bioscan.some((b: any) => !b.refertoConsegnato)) return true

    // 2. Appuntamenti futuri (non cancellati, inizio > now)
    if (p.appuntamenti.some((a: any) => new Date(a.inizio) > now && a.stato !== 'CANCELLATO')) return true

    // 3. Programma non concluso: ATTIVO con sessioni ancora da fare, oppure SOSPESO.
    // Un programma ATTIVO con sessioniCompletate >= sessioniTotali è "di fatto concluso":
    // non lo contiamo come attivo così il paziente può apparire in "attesa di conversione".
    if (p.assegnamenti.some((a: any) => {
      if (a.stato === 'SOSPESO') return true
      if (a.stato !== 'ATTIVO') return false
      const sessioniFinite = a.sessioniTotali > 0 && a.sessioniCompletate >= a.sessioniTotali
      return !sessioniFinite
    })) return true

    // 4. Fitoterapia attiva
    if (p.prescrizioni.length > 0) return true

    // 5. Appuntamenti da riprogrammare
    if (p.appuntamenti.some((a: any) => a.stato === 'DA_RIPROGRAMMARE')) return true

    // 6. Appuntamento in attesa (FISSATO/CONFERMATO anche nel passato — non ancora completato)
    //    Copre il caso del paziente appena convertito da lead con appuntamento odierno
    if (p.appuntamenti.some((a: any) => a.stato === 'FISSATO' || a.stato === 'CONFERMATO')) return true

    // 7. Programma concluso (stato COMPLETATO oppure tutte le sessioni finite) senza bioscan di controllo
    const haProgrammaConcluso = p.assegnamenti.some((a: any) =>
      a.stato === 'COMPLETATO' ||
      (a.sessioniCompletate > 0 && a.sessioniCompletate >= a.sessioniTotali)
    )
    const haBioscanControllo  = p.bioscan.some((b: any) => b.tipo === 'CONTROLLO')
    if (haProgrammaConcluso && !haBioscanControllo) return true

    return false
  }

  // ── Applica il filtro attivo/non attivo lato JavaScript ───────────────────
  // Filtra i pazienti in base al criterio selezionato (attivi/non attivi/tutti)
  const pazientiFiltratiPerAttivo = tuttiPazienti.filter(p => {
    if (stato === 'attivi') return pazienteIsAttivo(p)
    if (stato === 'nonAttivi') return !pazienteIsAttivo(p)
    return true  // 'tutti'
  })

  // ── Calcola statistiche ───────────────────────────────────────────────────
  const patientiAttivi    = tuttiPazienti.filter(pazienteIsAttivo)
  const totaleAttivi      = patientiAttivi.length
  const totaleNonAttivi   = tuttiPazienti.length - totaleAttivi

  // Alert 1: pazienti con appuntamenti da riprogrammare
  const alertAppDaRiprogrammare = tuttiPazienti.filter(p =>
    p.appuntamenti.some(a => a.stato === 'DA_RIPROGRAMMARE')
  )

  // Alert 2: pazienti attivi senza appuntamento futuro
  // (hanno una condizione attiva ma nessuno app. futuro fissato)
  const alertPazienti = patientiAttivi.filter(p => {
    const haAppFuturo = p.appuntamenti.some(
      a => new Date(a.inizio) > now && a.stato !== 'CANCELLATO'
    )
    return !haAppFuturo
  })

  // Alert 3: pazienti che hanno completato un programma ma non hanno ancora
  // un bioscan di controllo eseguito o prenotato
  // Alert 4: pazienti marcati come "da richiamare" dopo la lettura referto
  const alertDaRichiamare = tuttiPazienti.filter(p => (p as any).statoCura === 'DA_RICHIAMARE')

  const alertBioscanSenzaControllo = tuttiPazienti.filter(p => {
    const haProgrammaConcluso = p.assegnamenti.some((a: any) =>
      a.stato === 'COMPLETATO' ||
      (a.sessioniCompletate > 0 && a.sessioniCompletate >= a.sessioniTotali)
    )
    const haBioscanControllo = p.bioscan.some((b: any) => b.tipo === 'CONTROLLO')
    return haProgrammaConcluso && !haBioscanControllo
  })
  // Set di ID per lookup O(1) nelle righe della tabella
  const idsBioscanSenzaControllo = new Set(alertBioscanSenzaControllo.map(p => p.id))

  // Alert: pazienti che hanno ricevuto entrambi i referti (bioscan iniziale + controllo)
  // ma non hanno ancora preso nessuna decisione clinica (nessun programma, nessuna fito,
  // non segnati come "da richiamare" o "perso") → pronti per la conversione
  const alertAttesaConversione = tuttiPazienti.filter(p => {
    const haRefertoIniziale  = p.bioscan.some((b: any) => b.tipo === 'INIZIALE'  && b.refertoConsegnato)
    const haRefertoControllo = p.bioscan.some((b: any) => b.tipo === 'CONTROLLO' && b.refertoConsegnato)
    if (!haRefertoIniziale || !haRefertoControllo) return false
    // Ha ancora sessioni di programma da fare? (stesso criterio di pazienteIsAttivo)
    const haSessioniAttive = p.assegnamenti.some((a: any) => {
      if (a.stato === 'SOSPESO') return true
      if (a.stato !== 'ATTIVO') return false
      const sessioniFinite = a.sessioniTotali > 0 && a.sessioniCompletate >= a.sessioniTotali
      return !sessioniFinite
    })
    if (haSessioniAttive) return false
    // Ha già una fitoterapia attiva?
    if (p.prescrizioni.length > 0) return false
    // È segnato come "da richiamare" (vuole pensarci) o è perso?
    if ((p as any).statoCura === 'DA_RICHIAMARE') return false
    if (p.perso) return false
    return true
  })
  const idsAttesaConversione = new Set(alertAttesaConversione.map(p => p.id))

  // Alert 4: pazienti con bioscan eseguito (referto non ancora consegnato)
  // ma senza un appuntamento per la lettura del referto già fissato
  const alertSenzaLetturaReferto = tuttiPazienti.filter(p => {
    // Ha almeno un bioscan già ESEGUITO con referto non ancora consegnato
    // (effettuato: true garantisce che il bioscan sia stato fatto, non solo prenotato)
    const haBioscanNonRefertato = p.bioscan.some((b: any) => b.effettuato && !b.refertoConsegnato)
    if (!haBioscanNonRefertato) return false
    // Ha già un appuntamento futuro per la lettura referto?
    const haLetturaFissata = p.appuntamenti.some(
      (a: any) => new Date(a.inizio) > now
        && a.stato !== 'CANCELLATO'
        && (a.tipoPrestazione ?? '').toLowerCase().includes('lettura')
    )
    return !haLetturaFissata
  })
  const idsSenzaLetturaReferto = new Set(alertSenzaLetturaReferto.map(p => p.id))

  // ── Applica il filtro alert se presente ──────────────────────────────────
  // Se alert=senzaApp, filtra mostrando solo i pazienti senza appuntamento futuro
  // Se alert=daRiprogrammare, filtra mostrando solo i pazienti con app. da riprogrammare
  let pazientiFiltrati = pazientiFiltratiPerAttivo
  if (alert === 'senzaApp') {
    pazientiFiltrati = alertPazienti
  } else if (alert === 'daRiprogrammare') {
    pazientiFiltrati = alertAppDaRiprogrammare
  } else if (alert === 'bioscanSenzaControllo') {
    pazientiFiltrati = alertBioscanSenzaControllo
  } else if (alert === 'senzaLetturaReferto') {
    pazientiFiltrati = alertSenzaLetturaReferto
  } else if (alert === 'daRichiamare') {
    pazientiFiltrati = alertDaRichiamare
  } else if (alert === 'attesaConversione') {
    pazientiFiltrati = alertAttesaConversione
  }
  
  const totaleFiltrati = pazientiFiltrati.length
  const pazientiPerTabella = pazientiFiltrati.slice(skip, skip + PER_PAGINA)

  // qp preserva la ricerca per nome quando si cambia stato/alert tramite StatCard
  const qp = q ? `&q=${encodeURIComponent(q)}` : ''

  return (
    <div className="space-y-5">

      {/* ── Barra superiore: ricerca, filtri, toggle, pulsante nuovo ── */}
      <form method="GET">
        {/* Campi nascosti: preservano stato/alert attivi quando si ricerca */}
        {alert ? (
          <input type="hidden" name="alert" value={alert} />
        ) : (
          <input type="hidden" name="stato" value={stato} />
        )}
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">

            {/* Campo di ricerca */}
            <input
              name="q"
              defaultValue={q}
              placeholder="Cerca paziente..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />

            {/* Dropdown filtri */}
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                name="studioId"
                defaultValue={filtroStudio ?? ''}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
              >
                <option value="">Tutti i centri</option>
                {studi.map(s => (
                  <option key={s.id} value={s.id}>{s.citta ?? s.nome}</option>
                ))}
              </select>

              <select
                name="medicoId"
                defaultValue={filtroMedico ?? ''}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
              >
                <option value="">Tutti gli operatori</option>
                {medici.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.ruolo === 'MEDICO' ? 'Dr. ' : ''}{m.cognome} {m.nome}
                  </option>
                ))}
              </select>

              <select
                name="fase"
                defaultValue={filtroFase ?? ''}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
              >
                <option value="">Tutti gli stati cura</option>
                <option value="BIOSCAN_INIZIALE">Attesa bioscan</option>
                <option value="LETTURA_REFERTO">Attesa referto</option>
                <option value="IN_CURA">In cura</option>
                <option value="MANTENIMENTO">Mantenimento</option>
                <option value="CONCLUSO">Concluso</option>
              </select>
            </div>

          </div>

          {/* Pulsante pazienti persi */}
          <a
            href={mostraPersi ? '/pazienti' : '/pazienti?persi=1'}
            className={`flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              mostraPersi
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:text-red-600'
            }`}
          >
            {mostraPersi ? '← Torna ai pazienti' : 'Persi'}
          </a>

          {/* Pulsante nuovo paziente */}
          {!mostraPersi && (
            <a
              href="/pazienti/nuovo"
              className="flex-shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
            >
              + Nuovo paziente
            </a>
          )}
        </div>
      </form>

      {/* ── Box statistiche — i tre base bianchi, gli alert colorati ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pazienti totali"           valore={contatoreAssoluto}                 schema="slate"  href={`/pazienti?stato=tutti${qp}`}                  attivo={!alert && stato === 'tutti'} />
        <StatCard label="Attivi"                    valore={totaleAttivi}                      schema="slate"  href={`/pazienti?stato=attivi${qp}`}                 attivo={!alert && stato === 'attivi'} />
        <StatCard label="Non attivi"                valore={totaleNonAttivi}                   schema="slate"  href={`/pazienti?stato=nonAttivi${qp}`}              attivo={!alert && stato === 'nonAttivi'} />
        <StatCard label="In attesa di conversione"  valore={alertAttesaConversione.length}     schema="green"  href={`/pazienti?alert=attesaConversione${qp}`}      attivo={alert === 'attesaConversione'} />
        <StatCard label="Da riprogrammare"          valore={alertAppDaRiprogrammare.length}    schema="red"    href={`/pazienti?alert=daRiprogrammare${qp}`}        attivo={alert === 'daRiprogrammare'} />
        <StatCard label="Senza app. fissato"        valore={alertPazienti.length}              schema="amber"  href={`/pazienti?alert=senzaApp${qp}`}               attivo={alert === 'senzaApp'} />
        <StatCard label="Da richiamare"             valore={alertDaRichiamare.length}          schema="violet" href={`/pazienti?alert=daRichiamare${qp}`}           attivo={alert === 'daRichiamare'} />
        <StatCard label="Senza lettura referto"     valore={alertSenzaLetturaReferto.length}   schema="orange" href={`/pazienti?alert=senzaLetturaReferto${qp}`}    attivo={alert === 'senzaLetturaReferto'} />
        <StatCard label="No Bioscan di controllo"   valore={alertBioscanSenzaControllo.length} schema="indigo" href={`/pazienti?alert=bioscanSenzaControllo${qp}`}  attivo={alert === 'bioscanSenzaControllo'} />
      </div>

      {/* ── Tabella pazienti ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {pazientiPerTabella.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            {q ? `Nessun paziente trovato per "${q}"` : 'Nessun paziente trovato.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Paziente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Centro</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Operatore</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Trattamenti attivi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Avanzamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Prossimo App.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pazientiPerTabella.map((p) => {
                  const percorso    = p.percorsi[0] ?? null
                  const appAll      = p.appuntamenti

                  // Prossimo appuntamento: da oggi incluso (non da ora), così un appuntamento
                  // di stamattina ancora FISSATO appare fino a quando non viene completato
                  const prossimoApp = appAll
                    .filter(a => new Date(a.inizio) >= inizioOggi)
                    .sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime())[0]

                  // Operatore: prendo dal prossimo app, altrimenti dall'ultimo passato
                  const operatore = prossimoApp?.medico ?? appAll[0]?.medico ?? null

                  // Nome visualizzato
                  const nome = p.tipo === 'AZIENDA'
                    ? (p.ragioneSociale ?? p.nome)
                    : `${p.cognome ?? ''} ${p.nome}`.trim()

                  // Iniziali per l'avatar
                  const cognome0 = (p.tipo === 'AZIENDA' ? p.ragioneSociale : p.cognome) ?? p.nome
                  const iniziali = `${cognome0[0] ?? ''}${p.nome[0] ?? ''}`.toUpperCase()

                  // Colore avatar deterministico (basato sul primo byte dell'id)
                  const avatarColor = AVATAR_COLORS[p.id.charCodeAt(0) % AVATAR_COLORS.length]

                  // Badge: cosa sta facendo il paziente (bioscan, prestazioni singole, programma, fito)
                  // haBioscan: ha almeno un bioscan collegato al percorso attivo, oppure uno non ancora refertato
                  const haBioscan = (percorso?.bioscan.length ?? 0) > 0 || p.bioscan.length > 0
                  // haPrestazioni: appuntamenti singoli non in programma, escludendo bioscan e lettura referto
                  const haPrestazioni = p.appuntamenti.some(
                    a => !a.programmaPazienteId &&
                         a.stato !== 'COMPLETATO' &&
                         a.stato !== 'NO_SHOW' &&
                         !(a as any).bioscan &&
                         !(a as any).bioscanLetturaReferto
                  )
                  // haBioscanAttivo: solo bioscan INIZIALE — referto non consegnato o appuntamento futuro iniziale
                  // (escludiamo il tipo CONTROLLO, che ha il suo badge dedicato)
                  const haBioscanAttivo =
                    p.bioscan.some((b: any) => b.tipo !== 'CONTROLLO' && !b.refertoConsegnato) ||
                    p.appuntamenti.some((a: any) =>
                      new Date(a.inizio) >= now &&
                      a.stato !== 'CANCELLATO' &&
                      (a.tipoPrestazione ?? '').toLowerCase().includes('bioscan') &&
                      !(a.tipoPrestazione ?? '').toLowerCase().includes('controllo')
                    )
                  // hasBioscanControlloAttivo: bioscan di CONTROLLO già prenotato/eseguito ma referto non ancora consegnato
                  const hasBioscanControlloAttivo = p.bioscan.some((b: any) => b.tipo === 'CONTROLLO' && !b.refertoConsegnato)

                  // haProgramma: ATTIVO con sessioni ancora da fare, o SOSPESO — stessa logica di pazienteIsAttivo
                  // Un ATTIVO con sessioniCompletate >= sessioniTotali è "di fatto concluso": niente badge
                  const haProgramma = p.assegnamenti.some((a: any) => {
                    if (a.stato === 'SOSPESO') return true
                    if (a.stato !== 'ATTIVO') return false
                    return !(a.sessioniTotali > 0 && a.sessioniCompletate >= a.sessioniTotali)
                  })
                  // haFito: solo prescrizioni attive, non il tipo del percorso (che non cambia al completamento)
                  const haFito = p.prescrizioni.length > 0
                  const haMantenimento = percorso?.fase === 'MANTENIMENTO'

                  // Formatta la data del prossimo appuntamento
                  const dataApp = prossimoApp
                    ? new Intl.DateTimeFormat('it-IT', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      }).format(new Date(prossimoApp.inizio))
                    : null

                  // È un paziente in alert (ha almeno un appuntamento da riprogrammare)?
                  const appDaRiprogrammare = p.appuntamenti.find(a => a.stato === 'DA_RIPROGRAMMARE')
                  const isAlert = !!appDaRiprogrammare

                  // Da richiamare dopo lettura referto?
                  const isDaRichiamare       = (p as any).statoCura === 'DA_RICHIAMARE'
                  // Ha completato un programma ma non ha ancora il bioscan di controllo?
                  const isSenzaControllo     = idsBioscanSenzaControllo.has(p.id)
                  // Ha un bioscan non refertato senza lettura referto fissata?
                  const isSenzaLetturaReferto = idsSenzaLetturaReferto.has(p.id)
                  // Ha ricevuto entrambi i referti ma non ha ancora preso una decisione?
                  const isAttesaConversione  = idsAttesaConversione.has(p.id)
                  // Variante del bottone Converti: controllo se ha il bioscan di CONTROLLO con referto
                  const isConvertiControllo  = isAttesaConversione &&
                    p.bioscan.some((b: any) => b.tipo === 'CONTROLLO' && b.refertoConsegnato)

                  // Colore sfondo riga: verde per attesa conversione, viola per da richiamare, amber per lettura referto, indigo per controllo
                  const rowBg = isAttesaConversione ? 'bg-green-50/40' : isDaRichiamare ? 'bg-violet-50/40' : isSenzaLetturaReferto ? 'bg-amber-50/40' : isSenzaControllo ? 'bg-indigo-50/40' : ''

                  return (
                    <tr
                      key={p.id}
                      className={`transition hover:bg-slate-50 ${!p.attivo ? 'opacity-50' : ''} ${rowBg}`}
                    >
                      {/* ── Paziente: avatar + nome + telefono ── */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <a href={`/pazienti/${p.id}`} className="flex-shrink-0">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}>
                              {iniziali}
                            </span>
                          </a>
                          <div>
                            <a href={`/pazienti/${p.id}`} className="font-semibold text-slate-900 hover:underline">{nome}</a>
                            {p.telefono && (
                              <a
                                href={`https://wa.me/${waNumero(p.telefono)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="block whitespace-nowrap text-xs font-medium text-green-700 hover:underline"
                              >
                                {formatTelefono(p.telefono)}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ── Centro (città dello studio) ── */}
                      <td className="px-4 py-3.5 text-slate-700">
                        {p.studio?.citta ?? p.studio?.nome ?? '—'}
                      </td>

                      {/* ── Operatore (medico del prossimo o ultimo appuntamento) ── */}
                      <td className="px-4 py-3.5 text-slate-700">
                        {operatore ? (
                          <span>
                            {operatore.ruolo === 'MEDICO' ? 'Dr. ' : ''}
                            {operatore.cognome} {operatore.nome}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* ── Badge trattamenti attivi ── */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {/* Mostra "Bioscan" solo se NON è già in attesa di bioscan controllo
                              (in quel caso compare solo il badge "Bioscan controllo" più specifico) */}
                          {haBioscanAttivo && !isSenzaControllo && !hasBioscanControlloAttivo && (
                            <a
                              href={`/pazienti/${p.id}/bioscan`}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
                              title="Vai ai bioscan"
                            >
                              Bioscan
                            </a>
                          )}
                          {isSenzaLetturaReferto && (() => {
                            const bioscanDaLeggere = p.bioscan.find(
                              (b: any) => b.effettuato && !b.letturaRefertoId
                            ) ?? p.bioscan.find((b: any) => b.effettuato)
                            const url = bioscanDaLeggere
                              ? `/calendario/nuovo?pazienteId=${p.id}&bioscanId=${bioscanDaLeggere.id}&studioId=${(p as any).studioId}`
                              : `/calendario/nuovo?pazienteId=${p.id}&studioId=${(p as any).studioId}`
                            return (
                              <a key="lettura" href={url}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 transition"
                                title="Fissa lettura referto"
                              >
                                ⚠ Lettura referto
                              </a>
                            )
                          })()}
                          {haPrestazioni && (
                            <a
                              href={`/pazienti/${p.id}/prestazioni`}
                              className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 hover:bg-violet-100 transition"
                              title="Vai alle prestazioni"
                            >
                              Prestazioni
                            </a>
                          )}
                          {/* Nascondi "Programma" se il paziente è in fase di bioscan controllo (da prenotare o già prenotato) */}
                          {haProgramma && !isSenzaControllo && !hasBioscanControlloAttivo && (
                            <a
                              href={`/pazienti/${p.id}/programma`}
                              className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition"
                              title="Vai al programma di trattamento"
                            >
                              Programma
                            </a>
                          )}
                          {haFito && (
                            <a
                              href={`/pazienti/${p.id}/fitoterapia`}
                              className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 transition"
                              title="Vai alla fitoterapia"
                            >
                              Fito
                            </a>
                          )}
                          {haMantenimento && (
                            <a
                              href={`/pazienti/${p.id}/programma`}
                              className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-100 transition"
                              title="Vai al programma di mantenimento"
                            >
                              Mantenimento
                            </a>
                          )}
                          {isAlert && appDaRiprogrammare && (
                            <a
                              href={haProgramma
                                ? `/pazienti/${p.id}/programma`
                                : `/pazienti/${p.id}/agenda/${appDaRiprogrammare.id}`}
                              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100 transition"
                              title={haProgramma ? 'Vai al programma di trattamento' : "Vai all'appuntamento da riprogrammare"}
                            >
                              ↻ Da riprogrammare
                            </a>
                          )}
                          {/* Badge bioscan di controllo:
                              - isSenzaControllo: programma completato, controllo non ancora prenotato → link a /nuovo
                              - hasBioscanControlloAttivo: controllo già prenotato/eseguito, referto non ancora consegnato → link alla lista bioscan */}
                          {isSenzaControllo && (
                            <a
                              href={`/pazienti/${p.id}/bioscan/nuovo`}
                              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition"
                              title="Prenota bioscan di controllo"
                            >
                              ⚠ Bioscan controllo
                            </a>
                          )}
                          {hasBioscanControlloAttivo && (
                            <a
                              href={`/pazienti/${p.id}/bioscan`}
                              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition"
                              title="Bioscan di controllo in corso"
                            >
                              Bioscan controllo
                            </a>
                          )}
                          {/* Bottone Converti — visibile solo nel filtro "In attesa di conversione" */}
                          {isAttesaConversione && (
                            <BottoneConverti
                              pazienteId={p.id}
                              isControllo={isConvertiControllo}
                            />
                          )}
                          {!haBioscanAttivo && !hasBioscanControlloAttivo && !isSenzaLetturaReferto && !isAlert && !isSenzaControllo && !haPrestazioni && !haProgramma && !haFito && !haMantenimento && !isAttesaConversione && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* ── Barra di avanzamento del percorso ── */}
                      <td className="px-4 py-3.5">
                        {/* Mostra avanzamento solo se c'è un programma o fito attiva */}
                        <AvanzamentoBar percorso={(haProgramma || haFito) ? percorso : null} />
                      </td>

                      {/* ── Prossimo appuntamento (rosso se in alert) ── */}
                      <td className="px-4 py-3.5">
                        {dataApp ? (
                          <span className="capitalize text-slate-700">{dataApp}</span>
                        ) : (
                          <span className={isAlert ? 'font-semibold text-red-500' : 'text-slate-300'}>
                            Nessuno
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Paginazione
        paginaCorrente={pagina}
        totale={totaleFiltrati}
        perPagina={PER_PAGINA}
        baseUrl="/pazienti"
        queryParams={{ q, stato, studioId: filtroStudio, medicoId: filtroMedico, fase: filtroFase }}
      />
    </div>
  )
}
