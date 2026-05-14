// API: restituisce il team di riferimento di un paziente.
// GET /api/paziente-ultimo-team?pazienteId=xxx
//
// Strategia:
//   1. Se il paziente ha Paziente.teamId valorizzato (campo nuovo,
//      impostato in fase di creazione), restituisce quello.
//   2. Fallback per i pazienti vecchi (senza teamId): restituisce
//      il teamId dell'appuntamento più recente non cancellato.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const pazienteId = req.nextUrl.searchParams.get('pazienteId')
  if (!pazienteId) return NextResponse.json({ teamId: null })

  // 1. Prova a leggere Paziente.teamId tramite raw SQL (il campo può non
  // essere ancora nel client Prisma se non è stato rigenerato dopo la
  // migrazione)
  const [pazRow] = await prisma.$queryRaw<{ teamId: string | null }[]>`
    SELECT "teamId" FROM "Paziente" WHERE id = ${pazienteId} LIMIT 1`
  if (pazRow?.teamId) {
    return NextResponse.json({ teamId: pazRow.teamId })
  }

  // 2. Fallback: cerca nell'ultimo appuntamento attivo
  const app = await prisma.appuntamento.findFirst({
    where:   { pazienteId, teamId: { not: null }, stato: { not: 'CANCELLATO' } },
    orderBy: { inizio: 'desc' },
    select:  { teamId: true },
  })

  return NextResponse.json({ teamId: app?.teamId ?? null })
}
