// API route: aggiorna un singolo appuntamento (usata dal drag & drop del calendario)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { sincronizzaSessioniCompletate } from '@/lib/sessioniCompletate'

// Collega l'appuntamento lettura referto al bioscan più recente non ancora collegato.
// Prima cerca bioscan già segnati come effettuati; se non ne trova, usa qualsiasi bioscan
// senza lettura referto (es. se il bioscan è stato creato ma l'appuntamento non è stato
// marcato COMPLETATO prima della lettura referto).
async function autoLinkLetturaReferto(appuntamentoId: string, pazienteId: string) {
  const giaCollegato = await prisma.bioscan.findFirst({ where: { letturaRefertoId: appuntamentoId } })
  if (giaCollegato) return  // già collegato, niente da fare

  // Caso normale: bioscan già segnato come effettuato
  let bioscan = await prisma.bioscan.findFirst({
    where:   { pazienteId, letturaRefertoId: null, effettuato: true },
    orderBy: { dataEsecuzione: 'desc' },
  })

  // Fallback: bioscan non ancora segnato come effettuato (es. utente usa toggle nella pagina bioscan)
  if (!bioscan) {
    bioscan = await prisma.bioscan.findFirst({
      where:   { pazienteId, letturaRefertoId: null },
      orderBy: { dataEsecuzione: 'desc' },
    })
  }

  if (bioscan) {
    await prisma.bioscan.update({
      where: { id: bioscan.id },
      // Imposta anche effettuato: true — completare la lettura implica che il bioscan è stato fatto
      data:  { letturaRefertoId: appuntamentoId, effettuato: true },
    })
  }
}

// PATCH /api/appuntamenti/[id]
// Body JSON: { inizio: string (ISO) }  oppure  { stato: string }
// - inizio: ricalcola l'ora di fine dalla durata della prestazione e salva
// - stato:  aggiorna solo lo stato dell'appuntamento (es. FISSATO → CONFERMATO → COMPLETATO)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body   = await req.json()

  // ── Cambio stato ──────────────────────────────────────────────────────────
  if (body.stato) {
    const STATI_VALIDI = ['FISSATO', 'CONFERMATO', 'COMPLETATO', 'CANCELLATO', 'NO_SHOW', 'DA_RIPROGRAMMARE']
    if (!STATI_VALIDI.includes(body.stato))
      return NextResponse.json({ error: 'Stato non valido' }, { status: 400 })

    const app = await prisma.appuntamento.update({
      where:  { id },
      data:   { stato: body.stato },
      select: { programmaPazienteId: true, pazienteId: true, tipoPrestazione: true },
    })
    if (body.stato === 'COMPLETATO') {
      // Bioscan: segnalo come effettuato
      await prisma.bioscan.updateMany({
        where: { appuntamentoId: id },
        data:  { effettuato: true },
      })
      // Lettura referto: collega al bioscan e segna refertoConsegnato
      if (app.tipoPrestazione.toLowerCase().includes('lettura')) {
        await autoLinkLetturaReferto(id, app.pazienteId)
        await prisma.bioscan.updateMany({
          where: { letturaRefertoId: id },
          data:  { refertoConsegnato: true },
        })
        // Invalida la cache della pagina programma così il paziente vede "Consegnato il" aggiornato
        revalidatePath(`/pazienti/${app.pazienteId}/programma`)
      }
    }
    // Aggiorna il contatore sessioni completate sul programma e sul percorso
    await sincronizzaSessioniCompletate(app.programmaPazienteId)
    return NextResponse.json({ ok: true, stato: body.stato })
  }

  // ── Cambio data/ora e/o operatore/sala ────────────────────────────────────
  const updateData: Record<string, unknown> = {}

  if (body.inizio !== undefined) {
    const inizio = new Date(body.inizio)
    if (isNaN(inizio.getTime()))
      return NextResponse.json({ error: 'Data non valida' }, { status: 400 })

    const app = await prisma.appuntamento.findUnique({
      where:  { id },
      select: { prestazioneId: true },
    })
    if (!app) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })

    const prestazione = app.prestazioneId
      ? await prisma.prestazione.findUnique({
          where:  { id: app.prestazioneId },
          select: { durataMinuti: true },
        })
      : null

    const durataMinuti = prestazione?.durataMinuti ?? 60
    updateData.inizio  = inizio
    updateData.fine    = new Date(inizio.getTime() + durataMinuti * 60 * 1000)
  }

  if (body.medicoId) updateData.medicoId = body.medicoId
  if (body.salaId)   updateData.salaId   = body.salaId

  if (Object.keys(updateData).length === 0)
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })

  const aggiornato = await prisma.appuntamento.update({
    where: { id },
    data:  updateData,
  })

  // Sincronizza data e operatore del bioscan con i valori aggiornati dell'appuntamento.
  const bioscanSync: Record<string, unknown> = {}
  if (body.inizio !== undefined)  bioscanSync.dataEsecuzione = updateData.inizio
  if (body.medicoId !== undefined) bioscanSync.medicoId       = body.medicoId
  if (Object.keys(bioscanSync).length > 0) {
    await prisma.bioscan.updateMany({ where: { appuntamentoId: id }, data: bioscanSync })
  }

  return NextResponse.json({ ok: true, inizio: aggiornato.inizio, fine: aggiornato.fine })
}

// ── DELETE /api/appuntamenti/[id] ─────────────────────────────────────────────
// Segna l'appuntamento come CANCELLATO (soft delete — non cancella dal DB).
// Chiamato dal popup del calendario quando si clicca sull'icona cestino.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.appuntamento.update({
    where: { id },
    data:  { stato: 'CANCELLATO' },
  })

  return NextResponse.json({ ok: true })
}
