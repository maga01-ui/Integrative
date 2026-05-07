// Tab "Leads" della Dashboard Mktg.
//
// Mostra (per il mese corrente):
//   - Grafico mensile dei nuovi leads (ultimi 12 mesi)
//   - Ripartizione leads per origine (canale)
//   - Box KPI con il funnel di conversione:
//       Lead → Appuntamento preso → Appuntamento effettuato → Bioscan → Programma → Prestazione

import { prisma } from '@/lib/prisma'
import { KpiBox, BarChart, OriginiList } from './Components'

const STATI_FISSATI       = ['FISSATO', 'APPUNTAMENTO', 'CONVERTITO']
const STATI_GIA_GESTITI   = [...STATI_FISSATI, 'NON_INTERESSATO']
const MESE_LABELS_BREVI   = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

export default async function LeadsTab({ studioId }: { studioId: string | null }) {
  // Filtro per studio (vuoto se SUPERADMIN/MARKETING senza studio)
  const ws = studioId ? { studioId } : {}

  // ── Date di riferimento ──────────────────────────────────────────────────
  const oggi        = new Date()
  const inizioOggi  = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate())
  const fineOggi    = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1)
  const inizioMese  = new Date(oggi.getFullYear(), oggi.getMonth(), 1)
  const fineMese    = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 1)

  // ── Costruisce gli ultimi 12 mesi (incluso il mese corrente) ─────────────
  // Esempio: se oggi è maggio 2026, parte da giugno 2025.
  const mesi: { label: string; inizio: Date; fine: Date }[] = []
  for (let i = 11; i >= 0; i--) {
    const d    = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    mesi.push({
      label:  MESE_LABELS_BREVI[d.getMonth()],
      inizio: d,
      fine:   next,
    })
  }
  const inizioPeriodo = mesi[0].inizio  // primo dei 12 mesi (per filtri "ultimi 12 mesi")

  // ── Query principali in parallelo ────────────────────────────────────────
  const [
    leadDaGestire,        // n. leads ancora da gestire (qualsiasi data)
    leadOggi,             // n. nuovi lead arrivati oggi
    leadMese,             // n. lead del mese corrente
    appPresiMese,         // appuntamenti creati nel mese per pazienti convertiti da lead
    appEffettuatiMese,    // appuntamenti completati nel mese per pazienti convertiti da lead
    bioscanLeadsMese,     // bioscan INIZIALE eseguiti nel mese su pazienti convertiti da lead
    leadiMensili,         // count di lead per mese (per il grafico)
    perOrigine,           // count di lead per canale (ultimi 12 mesi)
  ] = await Promise.all([
    // Lead da gestire — stessa logica del bucket "Da gestire" in /leads
    prisma.lead.count({
      where: {
        ...ws,
        nascosto: false,
        stato: { notIn: STATI_GIA_GESTITI as never[] },
      },
    }),

    // Lead nuovi oggi (creati oggi, non nascosti)
    prisma.lead.count({
      where: {
        ...ws,
        nascosto: false,
        dataLead: { gte: inizioOggi, lt: fineOggi },
      },
    }),

    // Lead del mese corrente (creati nel mese)
    prisma.lead.count({
      where: {
        ...ws,
        nascosto: false,
        dataLead: { gte: inizioMese, lt: fineMese },
      },
    }),

    // Appuntamenti "presi" nel mese: appuntamenti creati nel mese il cui paziente
    // è stato convertito da un lead (quindi marketing-relevant).
    prisma.appuntamento.count({
      where: {
        ...ws,
        createdAt: { gte: inizioMese, lt: fineMese },
        paziente: { leadId: { not: null } },
      },
    }),

    // Appuntamenti "effettuati" nel mese: completati nel mese su pazienti da lead.
    prisma.appuntamento.count({
      where: {
        ...ws,
        stato: 'COMPLETATO',
        inizio: { gte: inizioMese, lt: fineMese },
        paziente: { leadId: { not: null } },
      },
    }),

    // Bioscan iniziali effettuati nel mese su pazienti da lead.
    // Solo INIZIALE (no controlli o successivi).
    prisma.bioscan.count({
      where: {
        ...ws,
        tipo:           'INIZIALE',
        effettuato:     true,
        dataEsecuzione: { gte: inizioMese, lt: fineMese },
        paziente:       { leadId: { not: null } },
      },
    }),

    // Conteggio lead per ciascuno dei 12 mesi (per il grafico).
    Promise.all(
      mesi.map(m =>
        prisma.lead.count({
          where: {
            ...ws,
            nascosto: false,
            dataLead: { gte: m.inizio, lt: m.fine },
          },
        }),
      ),
    ),

    // Ripartizione leads per canale (ultimi 12 mesi).
    prisma.lead.groupBy({
      by: ['canale'],
      where: {
        ...ws,
        nascosto: false,
        dataLead: { gte: inizioPeriodo, lt: fineMese },
      },
      _count: true,
    }),
  ])

  // ── "Primo programma" per ciascun paziente da lead ──────────────────────
  // Strategia: scarico TUTTI i programmi dei pazienti da lead ordinati per data
  // di inizio crescente; per ogni paziente prendo il primo (= più vecchio) e
  // controllo se cade nel mese corrente.
  // In questo modo escludiamo automaticamente programmi successivi e mantenimento.
  const tuttiProgrammi = await prisma.programmaPaziente.findMany({
    where: {
      paziente: { ...ws, leadId: { not: null } },
    },
    orderBy: { dataInizio: 'asc' },
    select: { pazienteId: true, dataInizio: true },
  })

  const vistiProg = new Set<string>()
  let primiProgrammiMese = 0
  for (const p of tuttiProgrammi) {
    if (vistiProg.has(p.pazienteId)) continue   // ho già il primo per questo paziente
    vistiProg.add(p.pazienteId)
    if (p.dataInizio >= inizioMese && p.dataInizio < fineMese) primiProgrammiMese++
  }

  // ── "Prima prestazione singola" per ciascun paziente da lead ────────────
  // Per "prestazione" intendiamo un appuntamento singolo (non in un programma)
  // che NON sia un bioscan e NON una lettura referto. Conta solo COMPLETATI.
  const tuttePrestazioni = await prisma.appuntamento.findMany({
    where: {
      ...ws,
      stato: 'COMPLETATO',
      programmaPazienteId:   null,
      bioscan:               { is: null },   // non collegato a un bioscan
      bioscanLetturaReferto: { is: null },   // non è una lettura referto
      paziente:              { leadId: { not: null } },
    },
    orderBy: { inizio: 'asc' },
    select: { pazienteId: true, inizio: true },
  })

  const vistiPrest = new Set<string>()
  let primePrestazioniMese = 0
  for (const a of tuttePrestazioni) {
    if (vistiPrest.has(a.pazienteId)) continue
    vistiPrest.add(a.pazienteId)
    if (a.inizio >= inizioMese && a.inizio < fineMese) primePrestazioniMese++
  }

  // ── Helper: percentuale di conversione formattata ───────────────────────
  // Restituisce "X%" oppure "—" se il denominatore è 0.
  const pct = (n: number, d: number): string => {
    if (d <= 0) return '—'
    return `${Math.round((n / d) * 100)}%`
  }

  // ── Dati per i componenti grafico ───────────────────────────────────────
  const itemsGrafico = mesi.map((m, i) => ({
    label: m.label,
    value: leadiMensili[i],
  }))

  const itemsOrigine = perOrigine.map(o => ({
    canale: o.canale,
    count:  o._count,
  }))

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="space-y-4">

      <h2 className="text-xl font-semibold text-slate-700">Leads</h2>

      {/* ── Box KPI principali ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

        {/* Riga 1: counter rapidi (cliccabili → /leads) */}
        <KpiBox
          label="Lead da gestire"
          value={leadDaGestire}
          colore="amber"
          href="/leads?filtro=da_gestire"
        />
        <KpiBox
          label="Nuovi lead oggi"
          value={leadOggi}
          colore="blue"
          href="/leads"
        />
        <KpiBox
          label="Lead del mese"
          value={leadMese}
          colore="slate"
        />

        {/* Riga 2: funnel di conversione del mese */}
        <KpiBox
          label="Appuntamenti presi"
          value={appPresiMese}
          subtitle={`${pct(appPresiMese, leadMese)} sui lead del mese`}
          colore="indigo"
        />
        <KpiBox
          label="Appuntamenti effettuati"
          value={appEffettuatiMese}
          subtitle={`${pct(appEffettuatiMese, appPresiMese)} sugli appuntamenti presi`}
          colore="violet"
        />
        <KpiBox
          label="Bioscan da lead"
          value={bioscanLeadsMese}
          subtitle={`${pct(bioscanLeadsMese, appEffettuatiMese)} sugli appuntamenti effettuati`}
          colore="purple"
        />
        <KpiBox
          label="Primi programmi"
          value={primiProgrammiMese}
          subtitle={`${pct(primiProgrammiMese, bioscanLeadsMese)} sui bioscan`}
          colore="green"
        />
        <KpiBox
          label="Prime prestazioni"
          value={primePrestazioniMese}
          subtitle={`${pct(primePrestazioniMese, bioscanLeadsMese)} sui bioscan`}
          colore="teal"
        />
      </div>

      {/* ── Grafico nuovi lead per mese ─────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Nuovi lead per mese (ultimi 12 mesi)
        </h3>
        <BarChart items={itemsGrafico} color="indigo" />
      </div>

      {/* ── Ripartizione per origine ─────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Lead per origine (ultimi 12 mesi)
        </h3>
        <OriginiList items={itemsOrigine} />
      </div>

    </section>
  )
}
