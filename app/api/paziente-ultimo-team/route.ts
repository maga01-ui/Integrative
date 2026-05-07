// API: restituisce l'ultimo team usato per un paziente
// GET /api/paziente-ultimo-team?pazienteId=xxx
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const pazienteId = req.nextUrl.searchParams.get('pazienteId')
  if (!pazienteId) return NextResponse.json({ teamId: null })

  // Cerca l'appuntamento più recente non cancellato che ha un team assegnato
  const app = await prisma.appuntamento.findFirst({
    where:   { pazienteId, teamId: { not: null }, stato: { not: 'CANCELLATO' } },
    orderBy: { inizio: 'desc' },
    select:  { teamId: true },
  })

  return NextResponse.json({ teamId: app?.teamId ?? null })
}
