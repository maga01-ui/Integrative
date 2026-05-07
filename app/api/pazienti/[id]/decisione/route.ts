// API: registra la decisione del paziente dopo la lettura referto
// POST /api/pazienti/[id]/decisione
// Body: { decisione, dataRichiamo?, motivazione? }
// Restituisce { ok, redirect? } — il client naviga all'URL restituito se presente

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: pazienteId } = await params
  // motivazione = note per DA_RICHIAMARE, motivazione per NON_INTERESSATO
  const { decisione, dataRichiamo, motivazione } = await req.json()

  if (decisione === 'DA_RICHIAMARE') {
    await prisma.paziente.update({
      where: { id: pazienteId },
      data:  {
        statoCura:    'DA_RICHIAMARE',
        dataRichiamo: dataRichiamo ? new Date(dataRichiamo) : null,
        note:         motivazione ?? null,
      },
    })
    return NextResponse.json({ ok: true, redirect: '/pazienti' })
  }

  if (decisione === 'NON_INTERESSATO') {
    await prisma.paziente.update({
      where: { id: pazienteId },
      data:  { attivo: false, statoCura: 'NON_INTERESSATO', note: motivazione ?? null },
    })
    return NextResponse.json({ ok: true, redirect: '/pazienti' })
  }

  // Tutte le altre decisioni: azzera lo stato cura e reindirizza alla pagina opportuna
  await prisma.paziente.update({
    where: { id: pazienteId },
    data:  { statoCura: null, dataRichiamo: null },
  })

  const redirectMap: Record<string, string> = {
    // Flusso bioscan iniziale
    PROGRAMMA:   `/pazienti/${pazienteId}/programma`,
    PRESTAZIONE: `/pazienti/${pazienteId}/prestazioni`,
    FITOTERAPIA: `/pazienti/${pazienteId}/fitoterapia/nuovo`,
    // Flusso bioscan di controllo
    AGGIUNGI_SESSIONE:  `/pazienti/${pazienteId}/programma`,
    MANTENIMENTO:       `/pazienti/${pazienteId}/programma`,
    PROGRAMMA_TERMINATO: `/pazienti/${pazienteId}/programma`,
  }

  return NextResponse.json({ ok: true, redirect: redirectMap[decisione] ?? '/calendario' })
}
