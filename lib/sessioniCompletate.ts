// Helper: ricalcola e aggiorna sessioniCompletate su ProgrammaPaziente e Percorso.
// Va chiamato ogni volta che uno stato appuntamento cambia (COMPLETATO o da COMPLETATO).

import { prisma } from './prisma'

export async function sincronizzaSessioniCompletate(programmaPazienteId: string | null | undefined) {
  if (!programmaPazienteId) return

  // Conta appuntamenti COMPLETATO per questo programma
  const countProg = await prisma.appuntamento.count({
    where: { programmaPazienteId, stato: 'COMPLETATO' },
  })

  // Aggiorna ProgrammaPaziente e recupera il percorsoId
  const prog = await prisma.programmaPaziente.update({
    where:  { id: programmaPazienteId },
    data:   { sessioniCompletate: countProg },
    select: { percorsoId: true },
  })

  // Aggiorna anche Percorso (usato nella lista pazienti)
  if (prog.percorsoId) {
    const countPerc = await prisma.appuntamento.count({
      where: { percorsoId: prog.percorsoId, stato: 'COMPLETATO' },
    })
    await prisma.percorso.update({
      where: { id: prog.percorsoId },
      data:  { sessioniCompletate: countPerc },
    })
  }
}
