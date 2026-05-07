'use server'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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
