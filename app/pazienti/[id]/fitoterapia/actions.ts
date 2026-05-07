// Server actions per la gestione delle prescrizioni fitoterapiche
'use server'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Elimina una prescrizione fitoterapica e tutti i suoi prodotti.
 * Le fatture collegate vengono scollegate (prescrizioneId → null) per non perdere lo storico fatturazione.
 */
export async function eliminaPrescrizioneFito(
  prescrizioneId: string,
  pazienteId: string
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.$transaction(async tx => {
    // 1. Scollega le fatture legate alla prescrizione (non le elimina)
    await tx.fattura.updateMany({
      where: { prescrizioneId },
      data:  { prescrizioneId: null },
    })

    // 2. Elimina i prodotti della prescrizione
    await tx.prescrizioneProdotto.deleteMany({
      where: { prescrizioneId },
    })

    // 3. Elimina la prescrizione stessa
    await tx.prescrizioneFito.delete({
      where: { id: prescrizioneId },
    })
  })

  redirect(`/pazienti/${pazienteId}/fitoterapia`)
}
