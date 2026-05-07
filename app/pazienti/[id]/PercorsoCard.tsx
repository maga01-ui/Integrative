// Visualizza il percorso completo del paziente: timeline delle prestazioni,
// barra di avanzamento, stato della fase e totali costi.
// Questo componente è puramente di visualizzazione (server component).

import type { Prisma } from '@prisma/client'

// ─── Tipo Prisma con tutte le relazioni incluse ───────────────────────────────
type PercorsoCompleto = Prisma.PercorsoGetPayload<{
  include: {
    appuntamenti: true
    bioscan: true
    prescrizioni: true
  }
}>

// ─── Una singola riga nella tabella del percorso ─────────────────────────────
type VocePercorso = {
  chiave: string
  numero?: number
  nome: string
  descrizione: string
  data: Date | null
  prezzo: number           // prezzo effettivamente pagato (o previsto)
  prezzoOriginale: number  // prezzo di listino (barrato se scontato)
  eseguita: boolean
  programmata: boolean     // ha un appuntamento/data fissata
}

// ─── Calcola la lista ordinata di voci dal percorso ──────────────────────────
function calcolaVoci(p: PercorsoCompleto): VocePercorso[] {
  const voci: VocePercorso[] = []

  // 1. Bioscan iniziale — sempre presente come primo step
  const bioscanI = p.bioscan.find(b => b.tipo === 'INIZIALE')
  voci.push({
    chiave: 'bioscan_iniziale',
    nome: 'Bioscan iniziale',
    descrizione: 'Biorisonanza completa',
    data: bioscanI?.dataEsecuzione ?? null,
    prezzo: 300,
    prezzoOriginale: 300,
    eseguita: !!bioscanI,
    programmata: !!bioscanI,
  })

  // 2. Lettura referto bioscan — consulto per spiegare i risultati
  const letturaApp = p.appuntamenti
    .filter(a => a.tipoPrestazione === 'LETTURA_REFERTO')
    .sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime())[0]
  voci.push({
    chiave: 'lettura_referto',
    nome: 'Lettura referto',
    descrizione: 'Consulto bioscan',
    data: letturaApp ? new Date(letturaApp.inizio) : null,
    prezzo: letturaApp ? Number(letturaApp.prezzoApplicato) : 0,
    prezzoOriginale: letturaApp ? Number(letturaApp.prezzoBase) : 0,
    eseguita: letturaApp?.eseguita ?? false,
    programmata: !!letturaApp,
  })

  // 3. Ciclo trattamenti (se il tipo di cura lo include)
  if (p.tipoCura === 'TRATTAMENTI' || p.tipoCura === 'ENTRAMBI') {
    // Prendo tutti gli appuntamenti di tipo TRATTAMENTO ordinati per data
    const trattamenti = p.appuntamenti
      .filter(a => a.tipoPrestazione === 'TRATTAMENTO')
      .sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime())

    // Mostro una riga per ogni sessione pianificata (es. 6 di default)
    const totSessioni = p.sessioniTotali
    for (let i = 0; i < totSessioni; i++) {
      const t = trattamenti[i]
      voci.push({
        chiave: `trattamento_${i + 1}`,
        numero: i + 1,
        nome: `Trattamento ${i + 1}`,
        descrizione: t ? 'Sessione ciclo' : 'Da programmare',
        data: t ? new Date(t.inizio) : null,
        prezzo: t ? Number(t.prezzoApplicato) : 500,
        prezzoOriginale: t ? Number(t.prezzoBase) : 500,
        eseguita: t?.eseguita ?? false,
        programmata: !!t,
      })
    }

    // 4. Bioscan di controllo — gratuito, eseguito al termine del ciclo di trattamenti
    const bioscanC = p.bioscan.find(b => b.tipo === 'CONTROLLO')
    voci.push({
      chiave: 'bioscan_controllo',
      nome: 'Bioscan di controllo',
      descrizione: bioscanC ? 'Eseguito dopo il ciclo' : 'Incluso nel programma',
      data: bioscanC ? new Date(bioscanC.dataEsecuzione) : null,
      prezzo: 0,            // gratuito — incluso nel programma
      prezzoOriginale: 300, // valore di listino barrato
      eseguita: !!bioscanC,
      programmata: !!bioscanC,
    })
  }

  // 5. Cura fitoterapica (se il tipo di cura lo include)
  if (p.tipoCura === 'FITOTERAPIA' || p.tipoCura === 'ENTRAMBI') {
    if (p.prescrizioni.length === 0) {
      // Nessuna prescrizione ancora: mostra un segnaposto
      voci.push({
        chiave: 'fito_placeholder',
        nome: 'Cura fitoterapica',
        descrizione: 'Da programmare',
        data: null,
        prezzo: 150,
        prezzoOriginale: 150,
        eseguita: false,
        programmata: false,
      })
    } else {
      // Una riga per ogni prescrizione (mese di cura)
      p.prescrizioni
        .sort((a, b) => new Date(a.dataInizio).getTime() - new Date(b.dataInizio).getTime())
        .forEach((pr, idx) => {
          const desc = pr.stato === 'CONCLUSA' ? 'Completata'
            : pr.stato === 'SOSPESA' ? 'Sospesa'
            : 'In corso'
          voci.push({
            chiave: `fito_${idx + 1}`,
            numero: idx + 1,
            nome: `Fitoterapia mese ${idx + 1}`,
            descrizione: desc,
            data: new Date(pr.dataInizio),
            prezzo: 150,
            prezzoOriginale: 150,
            eseguita: pr.stato === 'CONCLUSA',
            programmata: true,
          })
        })
    }
  }

  // 6. Sessioni di mantenimento (dopo la fine della cura)
  const mantenimento = p.appuntamenti
    .filter(a => a.tipoPrestazione === 'MANTENIMENTO')
    .sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime())
  mantenimento.forEach((m, idx) => {
    voci.push({
      chiave: `mantenimento_${idx + 1}`,
      numero: idx + 1,
      nome: `Mantenimento ${idx + 1}`,
      descrizione: 'Sessione mantenimento',
      data: new Date(m.inizio),
      prezzo: Number(m.prezzoApplicato),
      prezzoOriginale: Number(m.prezzoBase),
      eseguita: m.eseguita,
      programmata: true,
    })
  })

  return voci
}

// ─── Badge colorati per ogni fase del percorso ───────────────────────────────
const FASE_BADGE: Record<string, { label: string; cls: string }> = {
  BIOSCAN_INIZIALE: { label: 'Attesa bioscan',  cls: 'bg-slate-100 text-slate-600'    },
  LETTURA_REFERTO:  { label: 'Attesa referto',  cls: 'bg-violet-100 text-violet-700'  },
  IN_CURA:          { label: 'In cura',          cls: 'bg-blue-100 text-blue-700'      },
  MANTENIMENTO:     { label: 'Mantenimento',     cls: 'bg-amber-100 text-amber-700'    },
  CONCLUSO:         { label: 'Concluso',          cls: 'bg-green-100 text-green-700'   },
}

// ─── Formatta una data in italiano (es. "10 gen 2025") ───────────────────────
function fmtData(d: Date) {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(d)
}

// ─── Componente principale ────────────────────────────────────────────────────
export function PercorsoCard({ percorso }: { percorso: PercorsoCompleto }) {
  const voci = calcolaVoci(percorso)
  const fase = FASE_BADGE[percorso.fase] ?? FASE_BADGE.BIOSCAN_INIZIALE

  // Calcola avanzamento del ciclo trattamenti
  const haTrattamenti = percorso.tipoCura === 'TRATTAMENTI' || percorso.tipoCura === 'ENTRAMBI'
  const sessCompletate = percorso.sessioniCompletate
  const sessTotali = percorso.sessioniTotali
  const progresso = haTrattamenti && sessTotali > 0
    ? Math.round((sessCompletate / sessTotali) * 100)
    : 0

  // Calcola totale già speso e totale previsto
  const totaleSpeso    = voci.filter(v => v.eseguita).reduce((s, v) => s + v.prezzo, 0)
  const totalePrevisto = voci.reduce((s, v) => s + v.prezzoOriginale, 0)

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* ── Header con fase e barra avanzamento ── */}
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Percorso e prestazioni
          </h2>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${fase.cls}`}>
            {fase.label}
          </span>
        </div>

        {/* Barra di avanzamento (solo se ci sono trattamenti nel percorso) */}
        {haTrattamenti && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-600">Avanzamento ciclo trattamenti</span>
              <span className="text-sm font-semibold text-slate-900">
                {sessCompletate}/{sessTotali} sessioni
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Tabella delle voci ── */}
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100">
          <tr>
            <th className="px-6 py-3 text-left font-medium text-slate-500">Prestazione</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Data</th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">Prezzo</th>
            <th className="px-4 py-3 text-center font-medium text-slate-500">Eseguita</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {voci.map((v) => (
            <tr
              key={v.chiave}
              className={!v.programmata ? 'opacity-50' : ''}
            >
              {/* Nome con icona stato */}
              <td className="px-6 py-3">
                <div className="flex items-center gap-2.5">
                  {v.eseguita ? (
                    // Cerchio verde con spunta se eseguita
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">
                      ✓
                    </span>
                  ) : v.numero != null ? (
                    // Numero grigio se non ancora eseguita
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                      {v.numero}
                    </span>
                  ) : (
                    // Punto neutro per le voci senza numero (bioscan, referto)
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-300 text-xs">
                      ·
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-slate-900">{v.nome}</p>
                    <p className="text-xs text-slate-400">{v.descrizione}</p>
                  </div>
                </div>
              </td>

              {/* Data dell'appuntamento */}
              <td className="px-4 py-3 text-slate-600">
                {v.data ? fmtData(v.data) : <span className="text-slate-300">—</span>}
              </td>

              {/* Prezzo (barrato se scontato) */}
              <td className="px-4 py-3 text-right">
                {v.prezzo !== v.prezzoOriginale && (
                  <span className="mr-1.5 text-xs text-slate-400 line-through">
                    €{v.prezzoOriginale}
                  </span>
                )}
                <span className={v.prezzo === 0 ? 'text-slate-400' : 'font-medium text-slate-900'}>
                  €{v.prezzo}
                </span>
              </td>

              {/* Badge stato */}
              <td className="px-4 py-3 text-center">
                {v.eseguita ? (
                  <span className="inline-block rounded-full bg-green-50 px-3 py-0.5 text-xs font-semibold text-green-700">
                    Fatto
                  </span>
                ) : v.programmata ? (
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-500">
                    mod.
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">
                    Da fare
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Footer con totali ── */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Totale percorso</span>
          <span className="text-sm">
            <span className="font-semibold text-slate-900">
              € {totaleSpeso.toLocaleString('it-IT')}
            </span>
            <span className="text-slate-400">
              {' '}/ € {totalePrevisto.toLocaleString('it-IT')} previsti
            </span>
          </span>
        </div>
      </div>

    </section>
  )
}
