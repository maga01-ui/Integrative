// ─────────────────────────────────────────────────────────────────────────────
// Helper per calcolare il valore economico delle prescrizioni fitoterapia.
//
// Una PrescrizioneFito contiene più PrescrizioneProdotto. Il valore di ogni
// riga = (prezzoMese override OPPURE prodotto.prezzoMese) × durataM (mesi).
// Il totale della prescrizione è la somma di queste righe.
//
// Queste funzioni sono usate per includere la fitoterapia nei KPI economici
// (atteso/fatto) della dashboard, della pagina economico e della BI.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from './prisma'

// Calcola la somma del valore delle prescrizioni fitoterapia che soddisfano
// il where passato. Restituisce un numero (totale in euro).
//
// Note:
//  - Per ogni PrescrizioneProdotto, se prezzoMese (override) è valorizzato
//    lo usiamo, altrimenti fall-back sul prezzoMese del prodotto catalogo.
//  - Escludiamo le prescrizioni con stato SOSPESA: non producono incasso.
export async function valoreFitoterapia(
  where: Record<string, unknown> = {},
): Promise<number> {
  const prescrizioni = await prisma.prescrizioneFito.findMany({
    where: {
      // Le prescrizioni sospese non generano incasso effettivo.
      stato: { in: ['ATTIVA', 'CONCLUSA'] },
      ...where,
    },
    select: {
      prodotti: {
        select: {
          durataM:    true,
          prezzoMese: true,
          prodotto:   { select: { prezzoMese: true } },
        },
      },
    },
  })

  let totale = 0
  for (const p of prescrizioni) {
    for (const pp of p.prodotti) {
      // Override prezzo se presente, altrimenti prezzo catalogo
      const prezzo = Number(pp.prezzoMese ?? pp.prodotto.prezzoMese)
      totale += prezzo * pp.durataM
    }
  }
  return totale
}
