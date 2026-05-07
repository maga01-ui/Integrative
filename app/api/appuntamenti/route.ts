// API route: restituisce gli appuntamenti in un range di date (usata dal calendario custom)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const start      = searchParams.get('start')
  const end        = searchParams.get('end')
  const studioId   = searchParams.get('studioId') // filtro opzionale per studio
  const daGestire    = searchParams.get('daGestire')    === 'true'
  const daConfermare = searchParams.get('daConfermare') === 'true'

  // Calcola il range "oggi + prossimo giorno lavorativo" per "da confermare"
  function rangeConfermare() {
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
    const dow  = oggi.getDay() // 0=dom,1=lun,...,5=ven,6=sab
    // Quanti giorni aggiungere per arrivare al prossimo giorno lavorativo dopo oggi
    const salto = dow === 5 ? 3 : dow === 6 ? 2 : 1
    const prossimoLav = new Date(oggi)
    prossimoLav.setDate(prossimoLav.getDate() + salto)
    const fine = new Date(prossimoLav)
    fine.setDate(fine.getDate() + 1)
    return { gte: oggi, lt: fine }
  }

  // Modalità "da gestire": appuntamenti passati ancora aperti (FISSATO o CONFERMATO)
  // Modalità "da confermare": appuntamenti di oggi e prossimo giorno lavorativo ancora FISSATO
  const where = daGestire
    ? {
        ...(studioId ? { studioId } : {}),
        inizio: { lt: new Date() },
        stato:  { in: ['FISSATO', 'CONFERMATO'] as never[] },
      }
    : daConfermare
    ? {
        ...(studioId ? { studioId } : {}),
        inizio: rangeConfermare(),
        stato:  'FISSATO' as never,
      }
    : {
        ...(start && end ? { inizio: { gte: new Date(start), lt: new Date(end) } } : {}),
        ...(studioId     ? { studioId }                                            : {}),
      }

  const appuntamenti = await prisma.appuntamento.findMany({
    where,
    include: {
      paziente:    { select: { nome: true, cognome: true } },
      medico:      { select: { nome: true, cognome: true } },
      sala:        { select: { nome: true, colore: true } },
      prestazione: { select: { colore: true } },
      // Controlla se il bioscan ha già la lettura referto fissata
      bioscan: { select: { letturaRefertoId: true } },
      // Se l'appuntamento È una lettura referto, recupera il tipo del bioscan collegato
      bioscanLetturaReferto: { select: { tipo: true } },
    },
    orderBy: { inizio: 'asc' },
    take: 500,
  })

  // Colori di fallback per appuntamenti precedenti alla migrazione Prestazione
  const coloriDefault: Record<string, string> = {
    BIOSCAN:         '#6366f1',
    TRATTAMENTO:     '#0ea5e9',
    FITOTERAPIA:     '#10b981',
    MANTENIMENTO:    '#f59e0b',
    LETTURA_REFERTO: '#8b5cf6',
  }

  const eventi = appuntamenti.map((a) => {
    // Formato nome paziente: "Cognome Nome" completo
    const paziente = `${a.paziente.cognome ?? ''} ${a.paziente.nome ?? ''}`.trim()

    // Formato nome medico: "Nome Cognome" per esteso
    const medico     = `${a.medico.nome} ${a.medico.cognome}`.trim()

    return {
      id:         a.id,
      pazienteId: a.pazienteId,   // ID del paziente — serve al popup per aprire la cartella clinica
      paziente,
      tipo:       a.tipoPrestazione,
      start:      a.inizio.toISOString(),
      end:        a.fine.toISOString(),
      color:      a.prestazione?.colore ?? coloriDefault[a.tipoPrestazione] ?? '#64748b',
      salaId:      a.salaId,
      medicoId:    a.medicoId,
      sala:        a.sala.nome,
      salaColore:  a.sala.colore,
      medico,
      stato:      a.stato,
      // true se è un appuntamento bioscan COMPLETATO senza lettura referto ancora fissata
      bioscanSenzaLettura: !!a.bioscan && a.stato === 'COMPLETATO' && !a.bioscan.letturaRefertoId,
      // true se questo appuntamento è la lettura referto di un bioscan di CONTROLLO
      bioscanControllo: !!a.bioscanLetturaReferto && a.bioscanLetturaReferto.tipo === 'CONTROLLO',
    }
  })

  return NextResponse.json(eventi)
}
