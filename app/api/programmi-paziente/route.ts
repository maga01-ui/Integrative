// API: programmi attivi di un paziente, con conteggio sessioni già programmate
// Usata dal form "nuovo/modifica appuntamento" per il box Programmi
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json([], { status: 401 })

  const pazienteId = req.nextUrl.searchParams.get('pazienteId')
  if (!pazienteId) return NextResponse.json([])

  const programmi = await prisma.programmaPaziente.findMany({
    where:   { pazienteId, stato: { in: ['ATTIVO', 'IN_CORSO'] as never[] } },
    include: {
      programma: { select: { nome: true, tipo: true } },
      appuntamenti: {
        where:  { stato: 'COMPLETATO' },
        select: { id: true },
      },
    },
    orderBy: { dataInizio: 'desc' },
  })

  const risultati = programmi.map(pp => ({
    id:                   pp.id,
    nome:                 pp.programma.nome,
    tipo:                 pp.programma.tipo,
    sessioniTotali:       pp.sessioniTotali,
    sessioniCompletate:   pp.appuntamenti.length,
    sessioniProgrammate:  0, // calcolato sotto
  }))

  // Conta le sessioni già programmate (FISSATO o CONFERMATO) per ciascun programma
  for (const r of risultati) {
    r.sessioniProgrammate = await prisma.appuntamento.count({
      where: {
        programmaPazienteId: r.id,
        stato: { in: ['FISSATO', 'CONFERMATO'] as never[] },
      },
    })
  }

  return NextResponse.json(risultati)
}
