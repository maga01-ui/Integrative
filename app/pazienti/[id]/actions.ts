'use server'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Aggiorna operatore di riferimento e team del paziente.
// Questi sono gli unici due campi modificabili dal box in alto della scheda
// paziente: vengono impostati alla creazione e poi restano stabili nel tempo.
export async function aggiornaOperatoreTeam(
  pazienteId: string,
  operatoreId: string,
  teamId: string,
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  if (!pazienteId)  throw new Error('Paziente mancante.')
  if (!operatoreId) throw new Error('Seleziona un operatore di riferimento.')
  if (!teamId)      throw new Error('Seleziona un team di riferimento.')

  // Aggiorna operatoreId tramite ORM e teamId con raw SQL (campo nuovo,
  // potrebbe non essere ancora nel client Prisma rigenerato).
  await prisma.paziente.update({
    where: { id: pazienteId },
    data:  { operatoreId },
  })
  await prisma.$executeRaw`
    UPDATE "Paziente" SET "teamId" = ${teamId} WHERE id = ${pazienteId}`

  revalidatePath(`/pazienti/${pazienteId}`, 'layout')
}

export async function togglePerso(pazienteId: string, attuale: boolean, nota?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  if (!attuale) {
    // Diventa "perso" → cancella appuntamenti futuri attivi
    await prisma.appuntamento.updateMany({
      where: {
        pazienteId,
        stato: { in: ['FISSATO', 'CONFERMATO', 'DA_RIPROGRAMMARE'] },
        inizio: { gt: new Date() },
      },
      data: { stato: 'CANCELLATO' },
    })
  }

  await prisma.paziente.update({
    where: { id: pazienteId },
    data:  {
      perso:     !attuale,
      // Salva la nota solo quando si segna come perso; quando si rimuove lo stato la cancella
      persoNota: !attuale ? (nota ?? null) : null,
    },
  })

  revalidatePath(`/pazienti/${pazienteId}`, 'layout')
}
