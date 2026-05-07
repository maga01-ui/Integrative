// Pagina compensi: compensi dei collaboratori per mese, centro e team selezionato
import { redirect } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { canVedereCompensoOra, canVederePercentuale } from '@/lib/profitti'

export default async function ProfittiPage({
  searchParams
}: {
  searchParams: Promise<{ mese?: string; centroId?: string; teamId?: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { mese, centroId, teamId } = await searchParams

  const isSuperAdmin = ctx.ruolo === 'SUPERADMIN'

  // Mese selezionato (default: mese corrente)
  const oggi = new Date()
  const [annoS, meseS] = mese
    ? mese.split('-').map(Number)
    : [oggi.getFullYear(), oggi.getMonth() + 1]

  const inizioMese = new Date(annoS, meseS - 1, 1)
  const fineMese   = new Date(annoS, meseS, 1)

  // Studio effettivo: SUPERADMIN può filtrare per centroId, altrimenti solo il proprio
  const studioIdEffettivo = isSuperAdmin
    ? (centroId || null)   // null = tutti i centri
    : ctx.studioId

  // Studi per il filtro (solo SUPERADMIN)
  const studi = isSuperAdmin
    ? await prisma.studio.findMany({
        where: { attivo: true },
        select: { id: true, nome: true, citta: true },
        orderBy: { nome: 'asc' },
      })
    : []

  // Team per il filtro — caricati solo se uno studio specifico è selezionato
  const teamList = studioIdEffettivo
    ? await prisma.team.findMany({
        where:   { studioId: studioIdEffettivo, attivo: true },
        select:  { id: true, nome: true },
        orderBy: { nome: 'asc' },
      })
    : []

  // teamId valido solo se lo studio è selezionato
  const teamIdEffettivo = studioIdEffettivo ? (teamId || null) : null

  // Filtro Prisma per lo studio
  const ws = studioIdEffettivo ? { studioId: studioIdEffettivo } : {}

  // Viewer per i controlli di visibilità
  const viewer = { ruolo: ctx.ruolo, id: ctx.utenteId, isManager: ctx.isManager }
  const puoVedereOra         = canVedereCompensoOra(viewer, ctx.utenteId)
  const puoVederePercentuale = canVederePercentuale(viewer)

  // Collaboratori attivi nei team dello studio (filtro team opzionale)
  const collaboratori = await prisma.collaboratoreTeam.findMany({
    where: {
      dataFine: null,
      team: {
        ...ws,
        attivo: true,
        ...(teamIdEffettivo ? { id: teamIdEffettivo } : {}),
      },
    },
    include: {
      utente: { select: { nome: true, cognome: true } },
      team:   { select: { id: true, nome: true } },
    },
    orderBy: [{ team: { nome: 'asc' } }, { utente: { cognome: 'asc' } }],
  })

  // Ore lavorate per medicoId nel mese — non filtra per team perché molti
  // appuntamenti possono avere teamId null; il filtro team serve solo a
  // selezionare quali collaboratori mostrare, non a limitare le ore contate
  const appuntamenti = await prisma.appuntamento.findMany({
    where: {
      ...ws,
      stato: 'COMPLETATO',
      inizio: { gte: inizioMese, lt: fineMese },
    },
    select: { medicoId: true, inizio: true, fine: true, teamId: true },
  })

  const orePerMedico: Record<string, number> = {}
  for (const a of appuntamenti) {
    const minuti = (a.fine.getTime() - a.inizio.getTime()) / 60000
    orePerMedico[a.medicoId] = (orePerMedico[a.medicoId] ?? 0) + minuti / 60
  }

  // Fatturato per medicoId nel mese — non dipende da teamId sull'appuntamento
  // (spesso non impostato); il bonus del manager viene calcolato sommando il
  // fatturato degli ALTRI collaboratori del suo stesso team
  const fatture = await prisma.fattura.findMany({
    where: {
      appuntamento: { ...ws },
      stato:         { not: 'ANNULLATA' },
      dataEmissione: { gte: inizioMese, lt: fineMese },
    },
    select: {
      importo:      true,
      appuntamento: { select: { medicoId: true } },
    },
  })

  const fatturatoPerMedico: Record<string, number> = {}
  for (const f of fatture) {
    const mid = f.appuntamento?.medicoId
    if (mid) fatturatoPerMedico[mid] = (fatturatoPerMedico[mid] ?? 0) + Number(f.importo)
  }

  // Calcola i dati per ogni riga
  type Riga = {
    id:           string
    utenteId:     string
    nome:         string
    team:         string
    ore:          number
    compensoOra:  number
    subtotale:    number
    percentuale:  number | null
    bonusEuro:    number | null
    isManager:    boolean
  }

  const righe: Riga[] = collaboratori.map(c => {
    const ore        = orePerMedico[c.utenteId] ?? 0
    const compensoOra = Number(c.compensoOra)
    const subtotale  = ore * compensoOra
    const perc = c.percentualeTeam ? Number(c.percentualeTeam) : null

    // Bonus: % sul fatturato totale del team (tutti i membri, manager incluso)
    let bonusEuro: number | null = null
    if (c.isManager && perc) {
      const fatturatoTeam = collaboratori
        .filter(altro => altro.team.id === c.team.id)
        .reduce((sum, altro) => sum + (fatturatoPerMedico[altro.utenteId] ?? 0), 0)
      bonusEuro = fatturatoTeam * perc / 100
    }

    return {
      id:          c.id,
      utenteId:    c.utenteId,
      nome:        `${c.utente.cognome} ${c.utente.nome}`,
      team:        c.team.nome,
      ore,
      compensoOra,
      subtotale,
      percentuale: perc,
      bonusEuro,
      isManager:   c.isManager,
    }
  })

  // Totali in fondo
  const totOre       = righe.reduce((s, r) => s + r.ore, 0)
  const totSubtotale = righe.reduce((s, r) => s + r.subtotale, 0)
  const totBonus     = righe.reduce((s, r) => s + (r.bonusEuro ?? 0), 0)
  const totGenerale  = totSubtotale + totBonus

  // Query string condivisa per i link al dettaglio collaboratore
  const meseStr = `${annoS}-${String(meseS).padStart(2, '0')}`
  const extraQs = [
    centroId ? `centroId=${centroId}` : '',
    teamIdEffettivo ? `teamId=${teamIdEffettivo}` : '',
  ].filter(Boolean).join('&')

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-600">Compensi</h1>

      {/* Filtri: mese + centro (SUPERADMIN) + team (se studio selezionato) */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          name="mese"
          type="month"
          defaultValue={meseStr}
          className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none"
        />

        {/* Filtro centro — solo SUPERADMIN */}
        {isSuperAdmin && studi.length > 0 && (
          <select
            name="centroId"
            defaultValue={centroId ?? ''}
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none"
          >
            <option value="">Tutti i centri</option>
            {studi.map(s => (
              <option key={s.id} value={s.id}>
                {s.nome}{s.citta ? ` — ${s.citta}` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Filtro team — visibile quando uno studio specifico è selezionato */}
        {studioIdEffettivo && teamList.length > 0 && (
          <select
            name="teamId"
            defaultValue={teamId ?? ''}
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none"
          >
            <option value="">Tutti i team</option>
            {teamList.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        )}

        <button
          type="submit"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          Aggiorna
        </button>
      </form>

      {/* Tabella collaboratori */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {righe.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            Nessun collaboratore nei team. Aggiungili dalla sezione Impostazioni.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">Collaboratore</th>
                <th className="px-5 py-3 font-medium text-slate-600">Team</th>
                <th className="px-5 py-3 font-medium text-slate-600">Ore lavorate</th>
                {/* €/ora: solo per chi ha visibilità */}
                {puoVedereOra && <th className="px-5 py-3 font-medium text-slate-600">€/ora</th>}
                {/* Compenso ore: sempre visibile */}
                <th className="px-5 py-3 font-medium text-slate-600">Compenso ore</th>
                {/* % team: solo per chi ha visibilità */}
                {puoVederePercentuale && <th className="px-5 py-3 font-medium text-slate-600">% team</th>}
                {/* Bonus €: sempre visibile */}
                <th className="px-5 py-3 font-medium text-slate-600">Bonus €</th>
                {/* Totale per operatore */}
                <th className="px-5 py-3 font-medium text-slate-600">Totale</th>
                <th className="px-5 py-3 font-medium text-slate-600">Ruolo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {righe.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    <a
                      href={`/profitti/${r.utenteId}?mese=${meseStr}${extraQs ? `&${extraQs}` : ''}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {r.nome}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{r.team}</td>
                  <td className="px-5 py-3 text-slate-700">{r.ore.toFixed(1)} h</td>
                  {puoVedereOra && (
                    <td className="px-5 py-3 text-slate-500 text-xs">€ {r.compensoOra.toFixed(2)}</td>
                  )}
                  {/* Compenso ore — sempre visibile */}
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    {puoVedereOra ? `€ ${r.subtotale.toFixed(2)}` : '—'}
                  </td>
                  {puoVederePercentuale && (
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {r.percentuale != null ? `${r.percentuale}%` : '—'}
                    </td>
                  )}
                  {/* Bonus € — sempre visibile */}
                  <td className="px-5 py-3 font-semibold text-emerald-700">
                    {puoVederePercentuale
                      ? (r.bonusEuro != null ? `€ ${r.bonusEuro.toFixed(2)}` : '—')
                      : '—'}
                  </td>
                  {/* Totale operatore = compenso ore + bonus */}
                  <td className="px-5 py-3 font-bold text-slate-900 bg-slate-50">
                    {puoVedereOra
                      ? `€ ${(r.subtotale + (r.bonusEuro ?? 0)).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {r.isManager
                      ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Manager</span>
                      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Membro</span>}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Riga totali */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-5 py-3 text-slate-700" colSpan={2}>Totale</td>
                <td className="px-5 py-3 text-slate-800">{totOre.toFixed(1)} h</td>
                {puoVedereOra && <td className="px-5 py-3" />}
                {/* Totale compenso ore */}
                <td className="px-5 py-3 font-bold text-slate-900">
                  {puoVedereOra ? `€ ${totSubtotale.toFixed(2)}` : '—'}
                </td>
                {puoVederePercentuale && <td className="px-5 py-3" />}
                {/* Totale bonus € */}
                <td className="px-5 py-3 font-bold text-emerald-700">
                  {puoVederePercentuale
                    ? (totBonus > 0 ? `€ ${totBonus.toFixed(2)}` : '—')
                    : '—'}
                </td>
                {/* Totale generale per colonna */}
                <td className="px-5 py-3 font-bold text-slate-900 bg-slate-100">
                  {puoVedereOra ? `€ ${totGenerale.toFixed(2)}` : '—'}
                </td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
