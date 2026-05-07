// Impostazioni: lista di tutti gli studi + sezione utenti
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BtnElimina from '@/app/impostazioni/origini/BtnElimina'
import FiltroUtenti from './FiltroUtenti'

// ── Server action: disattiva operatore (soft delete) ─────────────────────────
// Non elimina fisicamente per preservare storico appuntamenti/bioscan/prescrizioni
async function eliminaOperatore(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.utente.update({ where: { id }, data: { attivo: false } })
  redirect('/impostazioni#utenti')
}

export default async function ImpostazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ centroId?: string; avviso?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where: { id: userId },
    select: { studioId: true, ruolo: true }
  })

  const { centroId, avviso } = await searchParams

  // SUPERADMIN e MARKETING vedono tutti gli studi; gli altri solo il proprio
  const puoVedereTuttiStudi = utente?.ruolo === 'SUPERADMIN' || utente?.ruolo === 'MARKETING'
  const studi = await prisma.studio.findMany({
    where: puoVedereTuttiStudi ? {} : { id: utente?.studioId ?? '__nessuno__' },
    include: {
      _count: { select: { sale: true, team: true, utenti: true } }
    },
    orderBy: { nome: 'asc' }
  })

  // Lista utenti: SUPERADMIN/MARKETING possono filtrare per centro, altrimenti solo il proprio studio
  const filtroStudio = puoVedereTuttiStudi
    ? (centroId ? { studioId: centroId } : {})
    : { studioId: utente?.studioId ?? undefined }

  const utenti = await prisma.utente.findMany({
    where: { attivo: true, ...filtroStudio },
    orderBy: [{ cognome: 'asc' }, { nome: 'asc' }]
  })

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold text-slate-600">Impostazioni</h1>

      {/* Avviso: studio non assegnato all'utente (es. redirect dal calendario) */}
      {avviso === 'studio_mancante' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Studio non assegnato.</strong> Il tuo account non è collegato a nessuno studio.
          Chiedi a un amministratore di assegnarti uno studio dalla sezione{' '}
          <a href="#utenti" className="underline font-medium">Utenti</a> qui sotto.
        </div>
      )}

      {/* ── STUDI ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Studi</h2>
          <a href="/impostazioni/studi/nuovo"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            + Nuovo studio
          </a>
        </div>

        {studi.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-slate-500">Nessuno studio configurato.</p>
            <a href="/impostazioni/studi/nuovo"
              className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
              Crea il primo studio →
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {studi.map((s) => (
              <a key={s.id} href={`/impostazioni/studi/${s.id}`}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400 hover:shadow-md">
                <h3 className="text-lg font-semibold text-slate-600 group-hover:underline">
                  {s.nome}
                </h3>
                {(s.citta || s.indirizzo) && (
                  <p className="mt-1 text-sm text-slate-500">{s.citta ?? s.indirizzo}</p>
                )}
                {/* Statistiche dello studio */}
                <div className="mt-4 flex gap-4 text-sm text-slate-600">
                  <span><strong>{s._count.sale}</strong> sale</span>
                  <span><strong>{s._count.team}</strong> team</span>
                  <span><strong>{s._count.utenti}</strong> operatori</span>
                </div>
                <span className="mt-4 inline-block text-xs font-medium text-slate-400 group-hover:text-slate-700">
                  Gestisci →
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ── UTENTI ── */}
      <section id="utenti" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Utenti</h2>
          <a href="/impostazioni/utenti/nuovo"
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            + Nuovo utente
          </a>
        </div>

        {/* Filtro per centro — visibile a SUPERADMIN e MARKETING quando ci sono più studi */}
        {puoVedereTuttiStudi && studi.length > 1 && (
          <div className="mb-4">
            <FiltroUtenti
              studi={studi.map(s => ({ id: s.id, nome: s.nome }))}
              centroIdAttivo={centroId}
            />
          </div>
        )}
        {utenti.length === 0 ? (
          <p className="text-sm text-slate-400">Nessun utente trovato.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left">
              <tr>
                <th className="pb-3 font-medium text-slate-600">Nome</th>
                <th className="pb-3 font-medium text-slate-600">Email</th>
                <th className="pb-3 font-medium text-slate-600">Ruolo</th>
                <th className="hidden pb-3 font-medium text-slate-600 md:table-cell">Studio principale</th>
                <th className="hidden pb-3 font-medium text-slate-600 lg:table-cell">Ultimo accesso</th>
                <th className="pb-3 font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {utenti.map((u) => {
                // Un utente è considerato "online" se ha effettuato accesso negli ultimi 5 minuti
                const online = u.ultimoAccesso
                  ? (Date.now() - new Date(u.ultimoAccesso).getTime()) < 5 * 60 * 1000
                  : false

                // Formatta la data dell'ultimo accesso in italiano
                const ultimoAccesso = u.ultimoAccesso
                  ? new Intl.DateTimeFormat('it-IT', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    }).format(new Date(u.ultimoAccesso))
                  : 'Mai'

                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    {/* Nome con i due pallini: online/offline + colore utente */}
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      <span className="flex items-center gap-2">
                        {/* Pallino stato: verde = online, grigio = offline */}
                        <span
                          title={online ? 'Online' : 'Offline'}
                          className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${online ? 'bg-green-500' : 'bg-slate-300'}`}
                        />
                        {/* Pallino colore utente nel calendario */}
                        <span
                          title={(u as unknown as { colore?: string }).colore ?? '#6366f1'}
                          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ background: (u as unknown as { colore?: string }).colore ?? '#6366f1' }}
                        />
                        {u.cognome} {u.nome}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {u.ruolo}
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-4 text-slate-500 md:table-cell text-xs">
                      {u.studioId
                        ? studi.find(s => s.id === u.studioId)?.nome ?? u.studioId.slice(0, 8) + '…'
                        : '— nessuno —'}
                    </td>
                    {/* Ultimo accesso */}
                    <td className="hidden py-2.5 pr-4 text-xs text-slate-500 lg:table-cell">
                      {ultimoAccesso}
                    </td>
                    {/* Azioni: modifica + elimina */}
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/impostazioni/utenti/${u.id}/modifica`}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                        >
                          Modifica
                        </a>
                        <BtnElimina
                          action={eliminaOperatore.bind(null, u.id)}
                          nome={`${u.nome} ${u.cognome}`}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── PRESTAZIONI ── */}
      <section id="prestazioni" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Prestazioni</h2>
            <p className="mt-0.5 text-sm text-slate-500">Tipi di servizi: bioscan, trattamento, visita…</p>
          </div>
          <a
            href="/impostazioni/prestazioni"
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Gestisci →
          </a>
        </div>
      </section>

      {/* ── ORIGINI ACQUISIZIONE ── */}
      <section id="origini" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Origini acquisizione</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Da dove arrivano i pazienti: Diretto, Marketing, Passaparola…
            </p>
          </div>
          <a
            href="/impostazioni/origini"
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Gestisci →
          </a>
        </div>
      </section>

    </div>
  )
}
