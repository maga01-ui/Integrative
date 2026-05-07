// API route: restituisce le sale di uno studio.
//
// Comportamento:
//   - senza parametri di data → solo sale attualmente attive
//   - con `from` e `to` (ISO date) → tutte le sale (attive o disattivate)
//     il cui periodo di attività si sovrappone all'intervallo richiesto.
//     Una sala è "attiva nel periodo [from, to]" se:
//        dataAttivazione    <= to
//      AND (dataDisattivazione IS NULL OR dataDisattivazione >= from)
//
// La modalità con date è usata dal calendario per mostrare ciascuna sala
// solo nei giorni in cui era effettivamente attiva.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const studioId = req.nextUrl.searchParams.get('studioId')
  const fromRaw  = req.nextUrl.searchParams.get('from')
  const toRaw    = req.nextUrl.searchParams.get('to')
  const tutte    = req.nextUrl.searchParams.get('tutte') === 'true'

  if (!studioId) return NextResponse.json([], { status: 200 })

  // Filtro: tre modalità
  //   tutte=true              → tutte le sale (attive + disattivate), per il calendario
  //   from + to               → sale con periodo di attività che interseca il range
  //   nessun parametro extra  → solo sale attualmente attive (default)
  let where: Prisma.SalaWhereInput
  if (tutte) {
    where = { studioId }
  } else if (fromRaw && toRaw) {
    const from = new Date(fromRaw)
    const to   = new Date(toRaw)
    where = {
      studioId,
      dataAttivazione: { lte: to },
      OR: [
        { dataDisattivazione: null },
        { dataDisattivazione: { gte: from } },
      ],
    }
  } else {
    where = { studioId, attiva: true }
  }

  const sale = await prisma.sala.findMany({
    where,
    select: {
      id: true,
      nome: true,
      colore: true,
      attiva: true,
      dataAttivazione: true,
      dataDisattivazione: true,
    },
    orderBy: { ordine: 'asc' },
  })

  return NextResponse.json(sale)
}
