import { prisma } from './prisma'

export async function generaFattureFitoterapia() {
  const oggi = new Date()
  const mese = oggi.getMonth() + 1
  const anno = oggi.getFullYear()

  const prescrizioni = await prisma.prescrizioneFito.findMany({
    where: { stato: 'ATTIVA' }
  })

  for (const p of prescrizioni) {
    const esistente = await prisma.fattura.findFirst({
      where: {
        prescrizioneId: p.id,
        anno,
        dataEmissione: {
          gte: new Date(anno, mese - 1, 1),
          lt: new Date(anno, mese, 1)
        }
      }
    })
    if (esistente) continue

    await prisma.$transaction(async (tx) => {
      const ultima = await tx.fattura.findFirst({
        where:   { studioId: p.studioId, anno },
        orderBy: { numero: 'desc' },
        select:  { numero: true },
      })

      await tx.fattura.create({
        data: {
          studioId:      p.studioId,
          pazienteId:    p.pazienteId,
          prescrizioneId: p.id,
          tipo:          'FITOTERAPIA',
          numero:        (ultima?.numero ?? 0) + 1,
          anno,
          importo:       150,
          stato:         'EMESSA',
          dataScadenza:  new Date(anno, mese, 15),
        },
      })
    })
  }
}

function mapTipoFattura(tipoPrestazione: string) {
  const valore = tipoPrestazione?.toUpperCase() ?? ''
  if (valore.includes('BIOSCAN')) return 'BIOSCAN'
  if (valore.includes('FITOTERAPIA') || valore.includes('FITO')) return 'FITOTERAPIA'
  if (valore.includes('MANTENIMENTO')) return 'MANTENIMENTO'
  return 'TRATTAMENTO'
}

// Crea o aggiorna la fattura/ricevuta per un bioscan
export async function creaOaggiornaFatturaPerBioscan(bioscan: {
  id: string
  studioId: string
  pazienteId: string
  prezzo: number
}, options: {
  pagato: boolean
  metodoPagamento?: 'CASH' | 'BONIFICO' | 'CARTA' | 'TOKEN'
  dataPagamento?: Date
}) {
  const importo = bioscan.prezzo
  const stato = options.pagato ? 'PAGATA' : 'EMESSA'
  const dataPagamento = options.pagato ? options.dataPagamento ?? new Date() : null
  const metodoPagamento = options.pagato ? options.metodoPagamento ?? null : null
  const dataEmissione = new Date()
  const anno = dataEmissione.getFullYear()

  const esistente = await prisma.fattura.findUnique({ where: { bioscanId: bioscan.id } })

  if (esistente) {
    return prisma.fattura.update({
      where: { id: esistente.id },
      data: { stato, importo, dataPagamento, metodoPagamento },
    })
  }

  return prisma.$transaction(async (tx) => {
    const ultima = await tx.fattura.findFirst({
      where:   { studioId: bioscan.studioId, anno },
      orderBy: { numero: 'desc' },
      select:  { numero: true },
    })

    return tx.fattura.create({
      data: {
        studioId:   bioscan.studioId,
        pazienteId: bioscan.pazienteId,
        bioscanId:  bioscan.id,
        tipo:       'BIOSCAN',
        numero:     (ultima?.numero ?? 0) + 1,
        anno,
        importo,
        stato,
        dataEmissione,
        dataPagamento,
        metodoPagamento,
      },
    })
  })
}

export async function creaOaggiornaFatturaPerAppuntamento(appuntamento: {
  id: string
  studioId: string
  pazienteId: string
  percorsoId?: string | null
  tipoPrestazione: string
  prezzoApplicato: number | string
}, options: {
  pagato: boolean
  metodoPagamento?: 'CASH' | 'BONIFICO' | 'CARTA' | 'TOKEN'
  dataPagamento?: Date
}) {
  const importo = Number(appuntamento.prezzoApplicato ?? 0)
  const stato = options.pagato ? 'PAGATA' : 'EMESSA'
  const dataPagamento = options.pagato ? options.dataPagamento ?? new Date() : null
  const metodoPagamento = options.pagato ? options.metodoPagamento ?? null : null
  const tipo = mapTipoFattura(appuntamento.tipoPrestazione)
  const dataEmissione = new Date()
  const anno = dataEmissione.getFullYear()

  // Cerca TUTTE le fatture per questo appuntamento (findMany è più sicuro di findUnique
  // su campi nullable, e permette di rilevare ed eliminare eventuali duplicati)
  const esistenti = await prisma.fattura.findMany({
    where: { appuntamentoId: appuntamento.id },
    orderBy: { createdAt: 'asc' },
  })

  if (esistenti.length > 0) {
    // Mantieni solo la prima, cancella eventuali duplicati
    if (esistenti.length > 1) {
      const idsDuplicati = esistenti.slice(1).map(f => f.id)
      await prisma.fattura.deleteMany({ where: { id: { in: idsDuplicati } } })
    }
    // Aggiorna la fattura principale
    return prisma.fattura.update({
      where: { id: esistenti[0].id },
      data: {
        stato,
        importo,
        tipo,
        percorsoId: appuntamento.percorsoId ?? undefined,
        dataPagamento,
        metodoPagamento,
      },
    })
  }

  // Nessuna fattura esistente: crea in transazione per evitare race condition
  // sul numero progressivo per studio
  return prisma.$transaction(async (tx) => {
    // Doppio controllo all'interno della transazione
    const giaEsiste = await tx.fattura.findFirst({
      where: { appuntamentoId: appuntamento.id },
    })
    if (giaEsiste) {
      return tx.fattura.update({
        where: { id: giaEsiste.id },
        data: { stato, importo, tipo, dataPagamento, metodoPagamento },
      })
    }

    const ultima = await tx.fattura.findFirst({
      where:   { studioId: appuntamento.studioId, anno },
      orderBy: { numero: 'desc' },
      select:  { numero: true },
    })

    return tx.fattura.create({
      data: {
        studioId:       appuntamento.studioId,
        pazienteId:     appuntamento.pazienteId,
        percorsoId:     appuntamento.percorsoId ?? undefined,
        appuntamentoId: appuntamento.id,
        tipo,
        numero:         (ultima?.numero ?? 0) + 1,
        anno,
        importo,
        stato,
        dataEmissione,
        dataPagamento,
        metodoPagamento,
      },
    })
  })
}
