// GET /api/team?studioId=X
// Restituisce team, operatori e sale attivi per uno studio.
// Usata da TeamOperatoriSection per ricaricare i dati quando si cambia studio.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const studioId = req.nextUrl.searchParams.get('studioId')
  if (!studioId) return NextResponse.json({ error: 'studioId mancante' }, { status: 400 })

  const [team, operatori, sale] = await Promise.all([
    prisma.team.findMany({
      where:   { studioId, attivo: true },
      select:  {
        id:   true,
        nome: true,
        collaboratori: {
          where:  { dataFine: null },
          select: { utenteId: true },
        },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.utente.findMany({
      where:   { studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    prisma.sala.findMany({
      where:   { studioId, attiva: true },
      select:  { id: true, nome: true },
      orderBy: { ordine: 'asc' },
    }),
  ])

  return NextResponse.json({ team, operatori, sale })
}
