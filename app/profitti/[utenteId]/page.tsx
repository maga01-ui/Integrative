// Dettaglio interventi di un collaboratore nel mese selezionato
import { redirect, notFound } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'
import Paginazione from '@/components/Paginazione'

const PER_PAGINA = 15

export default async function ProfittiDettaglioPage({
  params,
  searchParams,
}: {
  params:       Promise<{ utenteId: string }>
  searchParams: Promise<{ mese?: string; centroId?: string; teamId?: string; page?: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { utenteId }                              = await params
  const { mese, centroId, teamId, page: pageParam } = await searchParams

  const pagina = Math.max(1, Number(pageParam) || 1)
  const skip   = (pagina - 1) * PER_PAGINA

  // Mese selezionato (default: mese corrente)
  const oggi = new Date()
  const [annoS, meseS] = mese
    ? mese.split('-').map(Number)
    : [oggi.getFullYear(), oggi.getMonth() + 1]

  const inizioMese = new Date(annoS, meseS - 1, 1)
  const fineMese   = new Date(annoS, meseS, 1)

  // Dati del collaboratore
  const utente = await prisma.utente.findUnique({
    where:  { id: utenteId },
    select: { nome: true, cognome: true },
  })
  if (!utente) notFound()

  // Filtro studio
  const isSuperAdmin = ctx.ruolo === 'SUPERADMIN'
  const studioIdEffettivo = isSuperAdmin ? (centroId || null) : ctx.studioId
  const ws = studioIdEffettivo ? { studioId: studioIdEffettivo } : {}

  // Tutti i record CollaboratoreTeam attivi del collaboratore (può essere in più team)
  const collRecords = await prisma.collaboratoreTeam.findMany({
    where:   { utenteId, dataFine: null, team: { ...ws, attivo: true } },
    select:  {
      compensoOra:    true,
      percentualeTeam: true,
      isManager:      true,
      team:           { select: { id: true, nome: true } },
    },
  })

  // Compenso orario: prende il primo record (di solito un solo team)
  const compensoOra = Number(collRecords[0]?.compensoOra ?? 0)

  // Appuntamenti completati dal collaboratore nel mese.
  // `as const` necessario per far inferire il literal type StatoAppuntamento.
  const whereApp = {
    ...ws,
    medicoId: utenteId,
    stato:    'COMPLETATO' as const,
    inizio:   { gte: inizioMese, lt: fineMese },
  }

  const [appuntamenti, totaleApp] = await Promise.all([
    prisma.appuntamento.findMany({
      where:   whereApp,
      select:  {
        id:              true,
        inizio:          true,
        fine:            true,
        tipoPrestazione: true,
        paziente:        { select: { id: true, nome: true, cognome: true } },
        studio:          { select: { nome: true } },
      },
      orderBy: { inizio: 'asc' },
      skip,
      take:    PER_PAGINA,
    }),
    prisma.appuntamento.count({ where: whereApp }),
  ])

  // Totale ore (su tutti gli appuntamenti del mese, non solo la pagina corrente)
  const tuttiApp = await prisma.appuntamento.findMany({
    where:  whereApp,
    select: { inizio: true, fine: true },
  })
  const totOre      = tuttiApp.reduce((s, a) => s + (a.fine.getTime() - a.inizio.getTime()) / 3600000, 0)
  const totCompensoOre = totOre * compensoOra

  // ── Calcolo bonus per ogni team in cui il collaboratore è manager ─────────────
  // Per ogni team: somma il fatturato di TUTTI i collaboratori del team (manager incluso)
  // e applica la percentuale

  // 1. Raccogli tutti i collaboratori di ogni team in cui questo utente è manager
  const teamManagerIds = collRecords
    .filter(r => r.isManager && r.percentualeTeam)
    .map(r => r.team.id)

  type BonusTeam = {
    teamNome:       string
    fatturatoTeam:  number
    percentuale:    number
    bonusEuro:      number
  }
  const bonusTeam: BonusTeam[] = []

  for (const cr of collRecords) {
    if (!cr.isManager || !cr.percentualeTeam) continue
    const perc = Number(cr.percentualeTeam)

    // Collaboratori attivi del team
    const membriTeam = await prisma.collaboratoreTeam.findMany({
      where:  { team: { id: cr.team.id }, dataFine: null },
      select: { utenteId: true },
    })
    const utenteIds = membriTeam.map(m => m.utenteId)

    // Fatturato generato da tutti i membri del team nel mese
    const fattureTeam = await prisma.fattura.findMany({
      where: {
        appuntamento: { ...ws, medicoId: { in: utenteIds } },
        stato:         { not: 'ANNULLATA' },
        dataEmissione: { gte: inizioMese, lt: fineMese },
      },
      select: { importo: true },
    })
    const fatturatoTeam = fattureTeam.reduce((s, f) => s + Number(f.importo), 0)
    const bonusEuro     = fatturatoTeam * perc / 100

    bonusTeam.push({
      teamNome:      cr.team.nome,
      fatturatoTeam,
      percentuale:   perc,
      bonusEuro,
    })
  }

  const totBonus    = bonusTeam.reduce((s, b) => s + b.bonusEuro, 0)
  const totGenerale = totCompensoOre + totBonus

  const meseFmt = `${annoS}-${String(meseS).padStart(2, '0')}`
  const extraQs = [centroId ? `centroId=${centroId}` : '', teamId ? `teamId=${teamId}` : ''].filter(Boolean).join('&')
  const backUrl = `/profitti?mese=${meseFmt}${extraQs ? `&${extraQs}` : ''}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">
          {utente.cognome} {utente.nome}
        </h1>
        <span className="text-sm text-slate-400">
          {new Date(annoS, meseS - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Card riepilogo */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
          <p className="text-xs uppercase tracking-wide text-indigo-600">Interventi nel mese</p>
          <p className="mt-2 text-3xl font-semibold text-indigo-900">{totaleApp}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ore totali</p>
          <p className="mt-2 text-3xl font-semibold text-slate-800">{totOre.toFixed(1)} h</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-xs uppercase tracking-wide text-emerald-600">Compenso ore</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-900">
            € {totCompensoOre.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5">
          <p className="text-xs uppercase tracking-wide text-violet-600">Totale mese</p>
          <p className="mt-2 text-3xl font-semibold text-violet-900">
            € {totGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Tabella bonus team (solo se è manager in almeno un team) */}
      {bonusTeam.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="font-semibold text-slate-700">Bonus team</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">Team</th>
                <th className="px-5 py-3 font-medium text-slate-600">Fatturato team</th>
                <th className="px-5 py-3 font-medium text-slate-600">% spettante</th>
                <th className="px-5 py-3 font-medium text-slate-600">Bonus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bonusTeam.map(b => (
                <tr key={b.teamNome} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{b.teamNome}</td>
                  <td className="px-5 py-3 text-slate-700">
                    € {b.fatturatoTeam.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{b.percentuale}%</td>
                  <td className="px-5 py-3 font-semibold text-emerald-700">
                    € {b.bonusEuro.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-5 py-3 font-semibold text-slate-700" colSpan={3}>Totale bonus</td>
                <td className="px-5 py-3 font-bold text-emerald-700">
                  € {totBonus.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Riepilogo finale */}
          <div className="border-t-2 border-slate-200 bg-slate-100 px-5 py-4 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Totale complessivo (ore + bonus)</span>
            <span className="text-xl font-bold text-slate-900">
              € {totGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Tabella interventi */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {appuntamenti.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            Nessun intervento eseguito in questo mese.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">Data</th>
                <th className="px-5 py-3 font-medium text-slate-600">Paziente</th>
                <th className="px-5 py-3 font-medium text-slate-600">Prestazione</th>
                <th className="px-5 py-3 font-medium text-slate-600">Durata</th>
                <th className="px-5 py-3 font-medium text-slate-600">Compenso</th>
                {isSuperAdmin && <th className="px-5 py-3 font-medium text-slate-600">Studio</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appuntamenti.map(a => {
                const durata = (a.fine.getTime() - a.inizio.getTime()) / 60000
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">
                      {a.inizio.toLocaleDateString('it-IT')}
                      <span className="ml-1 text-slate-400 text-xs">
                        {a.inizio.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <a href={`/pazienti/${a.paziente.id}`} className="text-indigo-600 hover:underline">
                        {a.paziente.cognome} {a.paziente.nome}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{a.tipoPrestazione}</td>
                    <td className="px-5 py-3 text-slate-600">{Math.round(durata)} min</td>
                    <td className="px-5 py-3 font-semibold text-emerald-700">
                      € {(durata / 60 * compensoOra).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3 text-slate-500">{a.studio?.nome ?? '—'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Paginazione
        paginaCorrente={pagina}
        totale={totaleApp}
        perPagina={PER_PAGINA}
        baseUrl={`/profitti/${utenteId}`}
        queryParams={{ mese: meseFmt, centroId, teamId }}
      />
    </div>
  )
}
