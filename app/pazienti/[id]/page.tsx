// Scheda paziente: riepilogo attività e agenda appuntamenti
import { redirect, notFound } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { PercorsoCard } from './PercorsoCard'

export default async function SchedaPazientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Verifica autenticazione
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { id } = await params

  // Carica il paziente (filtrato per studio per sicurezza)
  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}
  const paziente = await prisma.paziente.findFirst({
    where: { id, ...ws },
    include: {
      appuntamenti: {
        orderBy: { inizio: 'desc' },
        include: {
          medico: { select: { nome: true, cognome: true, ruolo: true } },
          sala: { select: { nome: true } },
        },
      },
      // Bioscan senza referto consegnato
      bioscan: {
        where: { refertoConsegnato: false },
        select: { id: true },
      },
      // Programmi attivi o sospesi
      assegnamenti: {
        where: { stato: { in: ['ATTIVO', 'SOSPESO'] } },
        select: { id: true },
      },
      // Prescrizioni fitoterapia attive
      prescrizioni: {
        where: { stato: 'ATTIVA' },
        select: { id: true },
      },
    },
  })
  if (!paziente) notFound()

  // Conta le prestazioni completate raggruppate per tipo
  const prestazioniCompletate = await prisma.appuntamento.groupBy({
    by: ['tipoPrestazione'],
    where: { pazienteId: id, stato: 'COMPLETATO' },
    _count: { _all: true },
    orderBy: { _count: { tipoPrestazione: 'desc' } },
  })

  const totaleDisdette = paziente.appuntamenti.filter(a => a.stato === 'CANCELLATO').length

  const percorso = await prisma.percorso.findFirst({
    where: { pazienteId: id, attivo: true },
    orderBy: { createdAt: 'desc' },
    include: {
      appuntamenti: { orderBy: { inizio: 'asc' } },
      bioscan: { orderBy: { dataEsecuzione: 'asc' } },
      prescrizioni: { orderBy: { dataInizio: 'asc' } },
    },
  })

  // Conta appuntamenti da riprogrammare
  const appuntamentiDaRiprogrammare = paziente.appuntamenti.filter(a => a.stato === 'DA_RIPROGRAMMARE')

  const appuntamentiFuturi = paziente.appuntamenti.filter(
    a => a.stato !== 'CANCELLATO' && new Date(a.inizio) > new Date()
  )

  // ── Calcola se il paziente è attivo ──────────────────────────────────────
  // Un paziente è attivo se ha ALMENO UNA di queste condizioni:
  // 1. Bioscan eseguito ma referto non ancora consegnato
  // 2. Appuntamenti futuri non cancellati
  // 3. Programma in stato ATTIVO o SOSPESO (non concluso)
  // 4. Fitoterapia con stato ATTIVA
  // 5. Appuntamenti da riprogrammare
  const isAttivo = 
    paziente.bioscan.length > 0 ||
    appuntamentiFuturi.length > 0 ||
    paziente.assegnamenti.length > 0 ||
    paziente.prescrizioni.length > 0 ||
    appuntamentiDaRiprogrammare.length > 0

  const appuntamentiPassati = paziente.appuntamenti.filter(
    a => a.stato !== 'CANCELLATO' && new Date(a.inizio) <= new Date()
  )

  return (
    <div className="space-y-6">

{/* ── Agenda appuntamenti ────────────────────────────────────────────── */}
      <section id="agenda" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Appuntamenti in corso</p>
            <p className="mt-3 text-3xl font-semibold text-slate-600">{appuntamentiFuturi.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Appuntamenti fatti</p>
            <p className="mt-3 text-3xl font-semibold text-slate-600">{appuntamentiPassati.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Appuntamenti annullati</p>
            <p className="mt-3 text-3xl font-semibold text-slate-600">{totaleDisdette}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold text-slate-600">Appuntamenti futuri</h3>
            {appuntamentiFuturi.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Nessun appuntamento futuro pianificato.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[34%]" />
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="border-b border-slate-100 bg-slate-100 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium text-slate-600">Data</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Prestazione</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Operatore</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Sala</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appuntamentiFuturi.map(app => (
                      <tr key={app.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-700">{new Date(app.inizio).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-5 py-3 text-slate-900">{app.tipoPrestazione}</td>
                        <td className="px-5 py-3 text-slate-700">{app.medico ? `Dr. ${app.medico.cognome} ${app.medico.nome}` : '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{app.sala?.nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-600">Appuntamenti passati</h3>
            {appuntamentiPassati.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Nessun appuntamento passato registrato.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[34%]" />
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="border-b border-slate-100 bg-slate-100 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium text-slate-600">Data</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Prestazione</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Operatore</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Sala</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appuntamentiPassati.map(app => (
                      <tr key={app.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-700">{new Date(app.inizio).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-5 py-3 text-slate-900">{app.tipoPrestazione}</td>
                        <td className="px-5 py-3 text-slate-700">{app.medico ? `Dr. ${app.medico.cognome} ${app.medico.nome}` : '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{app.sala?.nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-600">Appuntamenti annullati</h3>
            {totaleDisdette === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Nessun appuntamento annullato.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[34%]" />
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="border-b border-slate-100 bg-slate-100 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium text-slate-600">Data</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Prestazione</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Operatore</th>
                      <th className="px-5 py-3 font-medium text-slate-600">Sala</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paziente.appuntamenti
                      .filter(a => a.stato === 'CANCELLATO')
                      .map(app => (
                        <tr key={app.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 text-slate-700">{new Date(app.inizio).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-5 py-3 text-slate-900">{app.tipoPrestazione}</td>
                          <td className="px-5 py-3 text-slate-700">{app.medico ? `Dr. ${app.medico.cognome} ${app.medico.nome}` : '—'}</td>
                          <td className="px-5 py-3 text-slate-700">{app.sala?.nome ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {percorso ? (
          <div className="mt-6">
            <h3 className="text-base font-semibold text-slate-600">Stato del percorso</h3>
            <div className="mt-4">
              <PercorsoCard percorso={percorso} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
