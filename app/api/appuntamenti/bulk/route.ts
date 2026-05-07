// API per creare più appuntamenti in un colpo solo (prenotazione multipla per programma)
// POST /api/appuntamenti/bulk

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Struttura di ogni appuntamento nella richiesta ───────────────────────────
type AppuntamentoBulkInput = {
  studioId:           string
  pazienteId:         string
  medicoId:           string
  salaId:             string
  prestazioneId?:     string
  tipoPrestazione:    string
  inizio:             string   // ISO datetime string
  durataMinuti:       number
  prezzoBase:         number
  prezzoApplicato:    number
  percorsoId?:        string
  programmaPazienteId?: string
  note?:              string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  let body: { appuntamenti: AppuntamentoBulkInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Payload JSON non valido' }, { status: 400 })
  }

  const { appuntamenti } = body
  if (!Array.isArray(appuntamenti) || appuntamenti.length === 0) {
    return NextResponse.json({ error: 'Nessun appuntamento da creare' }, { status: 400 })
  }

  // Limita il numero massimo di appuntamenti per sicurezza
  if (appuntamenti.length > 50) {
    return NextResponse.json({ error: 'Troppi appuntamenti (massimo 50)' }, { status: 400 })
  }

  // Crea tutti gli appuntamenti in una singola transazione atomica
  const creati = await prisma.$transaction(
    appuntamenti.map(a => {
      const inizio = new Date(a.inizio)
      const fine   = new Date(inizio.getTime() + a.durataMinuti * 60 * 1000)
      return prisma.appuntamento.create({
        data: {
          studioId:            a.studioId,
          pazienteId:          a.pazienteId,
          medicoId:            a.medicoId,
          salaId:              a.salaId,
          prestazioneId:       a.prestazioneId ?? null,
          tipoPrestazione:     a.tipoPrestazione,
          inizio,
          fine,
          prezzoBase:          a.prezzoBase,
          prezzoApplicato:     a.prezzoApplicato,
          percorsoId:          a.percorsoId ?? null,
          programmaPazienteId: a.programmaPazienteId ?? null,
          note:                a.note ?? null,
          stato:               'FISSATO',
        },
      })
    })
  )

  return NextResponse.json({ creati: creati.length }, { status: 201 })
}
