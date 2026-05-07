import { prisma } from './prisma'

export async function checkConflitti(
  studioId: string,
  medicoId: string,
  salaId: string | null,
  inizio: Date,
  fine: Date,
  escludiId?: string
) {
  // Esclude appuntamenti cancellati e da riprogrammare: non occupano più la risorsa
  const baseWhere = {
    studioId,
    stato: { notIn: ['CANCELLATO', 'DA_RIPROGRAMMARE'] as never[] },
    inizio: { lt: fine },
    fine: { gt: inizio },
    ...(escludiId ? { id: { not: escludiId } } : {})
  }

  const [conflittoMedico, conflittoSala] = await Promise.all([
    prisma.appuntamento.findFirst({ where: { ...baseWhere, medicoId } }),
    salaId
      ? prisma.appuntamento.findFirst({ where: { ...baseWhere, salaId } })
      : null
  ])

  return {
    medicoLibero: !conflittoMedico,
    salaLibera: !conflittoSala,
    conflitti: [conflittoMedico && 'MEDICO', conflittoSala && 'SALA'].filter(
      Boolean
    )
  }
}

export async function primaLiberaSala(
  studioId: string,
  inizio: Date,
  fine: Date
): Promise<string | null> {
  const sale = await prisma.sala.findMany({
    where: { studioId, attiva: true },
    orderBy: { ordine: 'asc' }
  })

  for (const sala of sale) {
    const occupata = await prisma.appuntamento.findFirst({
      where: {
        studioId,
        salaId: sala.id,
        // Esclude cancellati e da riprogrammare: non occupano più la risorsa
        stato: { notIn: ['CANCELLATO', 'DA_RIPROGRAMMARE'] },
        inizio: { lt: fine },
        fine: { gt: inizio }
      }
    })
    if (!occupata) return sala.id
  }

  return null
}
