import { prisma } from './prisma'

export function canVedereCompensoOra(
  viewer: { ruolo: string; id: string; isManager: boolean },
  targetId: string
): boolean {
  if (viewer.ruolo === 'SUPERADMIN') return true
  if (viewer.isManager) return true
  return viewer.id === targetId
}

export function canVederePercentuale(
  viewer: { ruolo: string; id: string; isManager: boolean }
): boolean {
  if (viewer.ruolo === 'SUPERADMIN') return true
  if (viewer.isManager) return true
  return false
}

export async function calcolaCompensoPeriodo(
  utenteId: string,
  teamId: string,
  anno: number,
  mese: number
) {
  const inizioMese = new Date(anno, mese - 1, 1)
  const fineMese = new Date(anno, mese, 1)

  const appuntamenti = await prisma.appuntamento.findMany({
    where: {
      medicoId: utenteId,
      teamId,
      eseguita: true,
      dataEsecuzione: { gte: inizioMese, lt: fineMese }
    }
  })

  const oreLavorate = appuntamenti.reduce((acc: number, a: { inizio: Date; fine: Date }) => {
    const minuti = (a.fine.getTime() - a.inizio.getTime()) / 60000
    return acc + minuti / 60
  }, 0)

  const ct = await prisma.collaboratoreTeam.findFirst({
    where: { teamId, utenteId, dataFine: null }
  })
  if (!ct) throw new Error('Collaboratore non trovato nel team')

  const subtotaleOre = oreLavorate * Number(ct.compensoOra)

  let bonusTeam = 0
  let fattutatoTeam: number | null = null  // null se non è manager, altrimenti il totale fatturato del team

  if (ct.isManager && ct.percentualeTeam) {
    const fatture = await prisma.fattura.findMany({
      where: {
        appuntamento: { teamId },
        stato: { not: 'ANNULLATA' },
        dataEmissione: { gte: inizioMese, lt: fineMese }
      }
    })
    // Usiamo una const locale: TypeScript sa con certezza che è un number
    const totale = fatture.reduce((acc: number, f: { importo: unknown }) => acc + Number(f.importo), 0)
    fattutatoTeam = totale
    bonusTeam = totale * Number(ct.percentualeTeam) / 100
  }

  return {
    oreLavorate,
    compensoOraStorico: ct.compensoOra,
    subtotaleOre,
    fattutatoTeam,
    percentualeStorica: ct.percentualeTeam,
    bonusTeam,
    totale: subtotaleOre + bonusTeam
  }
}
