// API route: restituisce gli operatori (medici) attivi di uno studio
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const studioId = req.nextUrl.searchParams.get('studioId')
  if (!studioId) return NextResponse.json([], { status: 200 })

  const operatori = await prisma.utente.findMany({
    where: { studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
    select:  { id: true, nome: true, cognome: true },
    orderBy: { cognome: 'asc' },
  })

  return NextResponse.json(operatori)
}
