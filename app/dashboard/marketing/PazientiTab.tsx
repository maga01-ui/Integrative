// Sezione "Pazienti" della Dashboard Mktg.
//
// Mostra 4 box (cliccabili dove ha senso):
//   - Nuovi pazienti del mese (creati nel mese corrente)
//   - Da riprogrammare        (almeno un appuntamento DA_RIPROGRAMMARE)
//   - Senza appuntamento fissato (paziente "attivo" ma senza prossimo app.)
//   - Da richiamare           (statoCura = DA_RICHIAMARE, dopo lettura referto)
//
// La logica dei tre box "alert" replica quella usata in /pazienti per
// coerenza tra le due viste.

import { prisma } from '@/lib/prisma'
import { KpiBox } from './Components'

export default async function PazientiTab({ studioId }: { studioId: string | null }) {
  // Filtro per studio
  const ws  = studioId ? { studioId } : {}
  const now = new Date()

  // Inizio/fine del mese corrente — usato per "nuovi pazienti del mese"
  const inizioMese = new Date(now.getFullYear(), now.getMonth(), 1)
  const fineMese   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // ── Query in parallelo per tutti i contatori ────────────────────────────
  const [nNuoviMese, nDaRiprogrammare, nSenzaApp, nDaRichiamare] = await Promise.all([

    // Pazienti nuovi del mese: usa dataDiventaPaziente (impostata sia su
    // creazione manuale che su conversione lead). Esclude i pazienti "persi".
    prisma.paziente.count({
      where: {
        ...ws,
        perso: false,
        dataDiventaPaziente: { gte: inizioMese, lt: fineMese },
      },
    }),

    // Pazienti con almeno un appuntamento DA_RIPROGRAMMARE
    prisma.paziente.count({
      where: {
        ...ws,
        perso: false,
        appuntamenti: { some: { stato: 'DA_RIPROGRAMMARE' } },
      },
    }),

    // Pazienti "attivi" senza appuntamento futuro fissato.
    // - Almeno una di queste condizioni di "attività":
    //     * programma ATTIVO o SOSPESO
    //     * fitoterapia attiva
    //     * bioscan con referto non ancora consegnato
    // - Nessun appuntamento futuro non cancellato
    // - Esclusi quelli già contati nella categoria DA_RIPROGRAMMARE
    //   per evitare doppi conteggi
    prisma.paziente.count({
      where: {
        ...ws,
        perso: false,
        appuntamenti: { none: { stato: 'DA_RIPROGRAMMARE' } },
        OR: [
          { assegnamenti: { some: { stato: { in: ['ATTIVO', 'SOSPESO'] } } } },
          { prescrizioni: { some: { stato: 'ATTIVA' } } },
          { bioscan:      { some: { refertoConsegnato: false } } },
        ],
        AND: [
          {
            appuntamenti: {
              none: {
                stato:  { notIn: ['CANCELLATO'] },
                inizio: { gte: now },
              },
            },
          },
        ],
      },
    }),

    // Pazienti segnati come "da richiamare" dopo la lettura del referto
    prisma.paziente.count({
      where: {
        ...ws,
        perso: false,
        statoCura: 'DA_RICHIAMARE',
      },
    }),

  ])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="space-y-4">

      <h2 className="text-xl font-semibold text-slate-700">Pazienti</h2>

      {/* Quattro box affiancati su schermi medi/grandi, due per riga su mobile */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <KpiBox
          label="Nuovi pazienti del mese"
          value={nNuoviMese}
          subtitle="Creati o convertiti questo mese"
          colore="green"
        />

        <KpiBox
          label="Da riprogrammare"
          value={nDaRiprogrammare}
          subtitle="Appuntamenti saltati o spostati"
          colore="red"
          href="/pazienti?alert=daRiprogrammare"
        />

        <KpiBox
          label="Senza appuntamento fissato"
          value={nSenzaApp}
          subtitle="Pazienti attivi senza prossimo app."
          colore="amber"
          href="/pazienti?alert=senzaApp"
        />

        <KpiBox
          label="Da richiamare"
          value={nDaRichiamare}
          subtitle="Dopo la lettura del referto"
          colore="violet"
          href="/pazienti?alert=daRichiamare"
        />

      </div>
    </section>
  )
}
