// Agenda appuntamenti del paziente.
// Mostra futuri, passati e annullati. Ogni riga ha modifica e cancella.
// Se l'appuntamento ha una ricevuta emessa, la cancellazione mostra un avviso.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPatientOrRedirect } from '../patientUtilsFinal'
import AzioniAppuntamento from './AzioniAppuntamento'

// ── Server action: cancella (soft) un appuntamento ────────────────────────────
async function cancellaAppuntamento(appId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const app = await prisma.appuntamento.findUnique({
    where:  { id: appId },
    select: { pazienteId: true },
  })
  if (!app) return

  await prisma.appuntamento.update({
    where: { id: appId },
    data:  { stato: 'CANCELLATO' },
  })

  revalidatePath(`/pazienti/${app.pazienteId}/agenda`)
}

// ── Etichette stato ───────────────────────────────────────────────────────────
const STATO_BADGE: Record<string, string> = {
  FISSATO:    'bg-blue-50 text-blue-700',
  CONFERMATO: 'bg-green-50 text-green-700',
  COMPLETATO: 'bg-emerald-50 text-emerald-700',
  CANCELLATO: 'bg-red-50 text-red-500',
  NO_SHOW:    'bg-amber-50 text-amber-600',
}
const STATO_LABEL: Record<string, string> = {
  FISSATO:    'Fissato',
  CONFERMATO: 'Confermato',
  COMPLETATO: 'Effettuato',
  CANCELLATO: 'Cancellato',
  NO_SHOW:    'No Show',
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function AgendaPage({ params }: { params: any }) {
  const { id } = await Promise.resolve(params) as { id: string }
  const paziente = await getPatientOrRedirect(id)

  const [appuntamenti, percorso] = await Promise.all([
    prisma.appuntamento.findMany({
      where:   { pazienteId: id },
      orderBy: { inizio: 'desc' },
      include: {
        medico:  { select: { nome: true, cognome: true } },
        sala:    { select: { nome: true } },
        fattura: { select: { id: true, stato: true } },
      },
    }),
    prisma.percorso.findFirst({
      where:   { pazienteId: id, attivo: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const ora = new Date()
  // Stati considerati "annullati" nella vista paziente:
  // - CANCELLATO: appuntamento cancellato
  // - NO_SHOW:   paziente non presentato
  // Vengono raggruppati insieme nella sezione "Appuntamenti annullati",
  // ma ogni riga conserva il proprio badge di stato per distinguerli.
  const STATI_ANNULLATI = ['CANCELLATO', 'NO_SHOW']
  const appFuturi    = appuntamenti.filter(a => !STATI_ANNULLATI.includes(a.stato) && new Date(a.inizio) > ora)
  const appPassati   = appuntamenti.filter(a => !STATI_ANNULLATI.includes(a.stato) && new Date(a.inizio) <= ora)
  const appAnnullati = appuntamenti.filter(a => STATI_ANNULLATI.includes(a.stato))

  // Server action con pazienteId già legato (per revalidatePath)
  const cancella = cancellaAppuntamento

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Agenda</p>
          <p className="text-sm text-slate-500">Calendario appuntamenti e stato del percorso.</p>
        </div>
        <a
          href={`/pazienti/${id}/agenda/nuovo`}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          + Nuovo appuntamento
        </a>
      </div>

      {/* ── Statistiche ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Appuntamenti futuri</p>
          <p className="mt-3 text-3xl font-semibold text-slate-600">{appFuturi.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Appuntamenti fatti</p>
          <p className="mt-3 text-3xl font-semibold text-slate-600">{appPassati.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Annullati</p>
          <p className="mt-3 text-3xl font-semibold text-slate-600">{appAnnullati.length}</p>
        </div>
      </div>

      {/* ── Appuntamenti futuri ── */}
      <TabellAppuntamenti
        titolo="Appuntamenti futuri"
        appuntamenti={appFuturi}
        pazienteId={id}
        cancella={cancella}
        mostraAzioni
      />

      {/* ── Appuntamenti passati ── */}
      <TabellAppuntamenti
        titolo="Appuntamenti passati"
        appuntamenti={appPassati}
        pazienteId={id}
        cancella={cancella}
        mostraAzioni
      />

      {/* ── Annullati (solo lettura) ── */}
      <TabellAppuntamenti
        titolo="Appuntamenti annullati"
        appuntamenti={appAnnullati}
        pazienteId={id}
        cancella={cancella}
        mostraAzioni={false}
      />
    </div>
  )
}

// ── Tabella riutilizzabile ────────────────────────────────────────────────────

type AppRow = {
  id:             string
  inizio:         Date
  tipoPrestazione:string
  stato:          string
  medico:         { nome: string; cognome: string } | null
  sala:           { nome: string } | null
  fattura:        { id: string; stato: string } | null
}

function TabellAppuntamenti({
  titolo, appuntamenti, pazienteId, cancella, mostraAzioni,
}: {
  titolo:        string
  appuntamenti:  AppRow[]
  pazienteId:    string
  cancella:      (appId: string) => Promise<void>
  mostraAzioni:  boolean
}) {
  const STATO_BADGE: Record<string, string> = {
    FISSATO:          'bg-blue-50 text-blue-700',
    CONFERMATO:       'bg-green-50 text-green-700',
    COMPLETATO:       'bg-emerald-50 text-emerald-700',
    CANCELLATO:       'bg-red-50 text-red-500',
    NO_SHOW:          'bg-amber-50 text-amber-600',
    DA_RIPROGRAMMARE: 'bg-purple-50 text-purple-700',
  }
  const STATO_LABEL: Record<string, string> = {
    FISSATO:          'Fissato',
    CONFERMATO:       'Confermato',
    COMPLETATO:       'Effettuato',
    CANCELLATO:       'Cancellato',
    NO_SHOW:          'No Show',
    DA_RIPROGRAMMARE: 'Da riprogrammare',
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-700">
        {titolo}
        <span className="ml-2 text-sm font-normal text-slate-400">({appuntamenti.length})</span>
      </h2>

      {appuntamenti.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nessun appuntamento.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500">Data</th>
                <th className="px-4 py-3 font-medium text-slate-500">Prestazione</th>
                <th className="px-4 py-3 font-medium text-slate-500">Operatore</th>
                <th className="px-4 py-3 font-medium text-slate-500">Sala</th>
                <th className="px-4 py-3 font-medium text-slate-500">Stato</th>
                {mostraAzioni && <th className="px-4 py-3 font-medium text-slate-500">Azioni</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {appuntamenti.map(app => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(app.inizio).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{app.tipoPrestazione}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {app.medico ? `${app.medico.cognome} ${app.medico.nome}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{app.sala?.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATO_BADGE[app.stato] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATO_LABEL[app.stato] ?? app.stato}
                    </span>
                  </td>
                  {mostraAzioni && (
                    <td className="px-4 py-3">
                      <AzioniAppuntamento
                        appId={app.id}
                        pazienteId={pazienteId}
                        haRicevuta={!!app.fattura}
                        onCancella={cancella}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
