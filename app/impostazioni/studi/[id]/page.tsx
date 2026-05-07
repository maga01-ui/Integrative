// Dettaglio studio: sale, team con collaboratori
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'
import { formatTelefono } from '@/lib/telefono'
import BtnEliminaOperatore, { BtnDisattivaOperatore, BtnRiattivaOperatore } from './BtnEliminaOperatore'

// ── Server Action: sposta una sala su o giù scambiando il campo `ordine` ──
async function spostaSala(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const salaId   = formData.get('salaId')   as string
  const studioId = formData.get('studioId') as string
  const direzione = formData.get('direzione') as 'su' | 'giu'

  // Recupera la sala corrente
  const sala = await prisma.sala.findUnique({ where: { id: salaId }, select: { ordine: true } })
  if (!sala) return

  // Trova la sala adiacente nello stesso studio
  const adiacente = await prisma.sala.findFirst({
    where: {
      studioId,
      ordine: direzione === 'su' ? { lt: sala.ordine } : { gt: sala.ordine },
    },
    orderBy: { ordine: direzione === 'su' ? 'desc' : 'asc' },
    select: { id: true, ordine: true },
  })
  if (!adiacente) return // già in cima o in fondo

  // Scambia i valori di ordine tra le due sale
  await prisma.$transaction([
    prisma.sala.update({ where: { id: salaId },       data: { ordine: adiacente.ordine } }),
    prisma.sala.update({ where: { id: adiacente.id }, data: { ordine: sala.ordine } }),
  ])

  redirect(`/impostazioni/studi/${studioId}`)
}

// ── Server Action: DISATTIVA un operatore (soft delete) ─────────────────────
// Imposta dataFine sul record CollaboratoreTeam alla data corrente:
// l'operatore resta nel team ma viene mostrato come "Disattivato" e non
// compare più nei form (selezione canale paziente, ecc.). Tutti i salvataggi
// precedenti (appuntamenti, fatture…) restano coerenti.
async function disattivaCollaboratore(studioId: string, collaboratoreId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.collaboratoreTeam.update({
    where: { id: collaboratoreId },
    data:  { dataFine: new Date() },
  })

  revalidatePath(`/impostazioni/studi/${studioId}`)
}

// ── Server Action: RIATTIVA un operatore precedentemente disattivato ───────
// Azzera dataFine: l'operatore torna attivo e ricompare nei form.
async function riattivaCollaboratore(studioId: string, collaboratoreId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.collaboratoreTeam.update({
    where: { id: collaboratoreId },
    data:  { dataFine: null },
  })

  revalidatePath(`/impostazioni/studi/${studioId}`)
}

// ── Server Action: RIMUOVE un operatore (hard delete) ───────────────────────
// Cancella DEFINITIVAMENTE il record CollaboratoreTeam. Da usare solo se
// l'associazione è stata creata per errore — in tutti gli altri casi è
// preferibile usare "Disattiva" per conservare la storia del team.
async function eliminaCollaboratore(studioId: string, collaboratoreId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.collaboratoreTeam.delete({ where: { id: collaboratoreId } })

  // Forza il re-render della pagina dello studio così la riga sparisce subito.
  revalidatePath(`/impostazioni/studi/${studioId}`)
}

// ── Componente pulsante ▲ / ▼ ──
// È un mini-form: il submit chiama la server action spostaSala
function SpostaBtn({
  salaId, studioId, direzione, disabilitato,
}: {
  salaId: string; studioId: string; direzione: 'su' | 'giu'; disabilitato: boolean
}) {
  return (
    <form action={spostaSala}>
      <input type="hidden" name="salaId"    value={salaId} />
      <input type="hidden" name="studioId"  value={studioId} />
      <input type="hidden" name="direzione" value={direzione} />
      <button
        type="submit"
        disabled={disabilitato}
        className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
      >
        {direzione === 'su' ? '▲' : '▼'}
      </button>
    </form>
  )
}

export default async function StudioDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params

  const studio = await prisma.studio.findUnique({
    where: { id },
    include: {
      // Sale dello studio
      sale: { orderBy: { ordine: 'asc' } },
      // Team con i collaboratori (inclusi i dati dell'utente).
      // NB: includiamo anche i collaboratori disattivati (dataFine != null) —
      // li mostriamo in fondo alla lista, in grigio, con badge "Disattivato"
      // e con il pulsante "Riattiva" al posto di "Disattiva".
      team: {
        where: { attivo: true },
        orderBy: { ordine: 'asc' },
        include: {
          collaboratori: {
            // Ordine: prima gli attivi (dataFine NULL), poi i disattivati per
            // data discendente (i più recenti per primi tra i disabilitati).
            orderBy: [
              { dataFine: { sort: 'asc', nulls: 'first' } },
              { dataInizio: 'desc' },
            ],
            include: {
              utente: { select: { id: true, nome: true, cognome: true, email: true } }
            }
          }
        }
      }
    }
  })

  if (!studio) notFound()

  // Carichiamo il flag isReferral per tutti i collaboratori dei team dello studio
  // tramite raw SQL (campo nuovo: il client Prisma generato potrebbe non averlo
  // ancora finché non viene rigenerato). Il risultato è una mappa
  // collaboratoreId → isReferral, usata per mostrare il badge nelle righe.
  // NB: includiamo anche i disattivati così il badge "Referral" appare
  // ancora nella loro riga (anche se il referral non è più operativo).
  const referralRows = await prisma.$queryRaw<{ id: string; isReferral: boolean }[]>`
    SELECT ct.id, ct."isReferral"
      FROM "CollaboratoreTeam" ct
      JOIN "Team" t ON t.id = ct."teamId"
     WHERE t."studioId" = ${id}`
  const referralMap = new Map(referralRows.map(r => [r.id, r.isReferral]))

  return (
    <div className="space-y-8">

      {/* Header studio */}
      <div className="flex items-start justify-between">
        <div>
          <BackButton />
          <h1 className="mt-1 text-3xl font-semibold text-slate-600">{studio.nome}</h1>
          {studio.citta && <p className="mt-1 text-slate-500">{studio.indirizzo && `${studio.indirizzo}, `}{studio.citta}</p>}
        </div>
        <a href={`/impostazioni/studi/${id}/modifica`}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Modifica
        </a>
      </div>

      {/* Info studio */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
        {[
          { l: 'Email',       v: studio.email },
          { l: 'Telefono',    v: formatTelefono(studio.telefono) },
          { l: 'Partita IVA', v: studio.partitaIva },
          { l: 'Provincia',   v: studio.provincia },
        ].map(({ l, v }) => v ? (
          <div key={l}>
            <span className="text-slate-500">{l}: </span>
            <span className="font-medium text-slate-800">{v}</span>
          </div>
        ) : null)}
      </div>

      {/* ── SALE ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Sale visita</h2>
          <a href={`/impostazioni/studi/${id}/sale/nuovo`}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            + Nuova sala
          </a>
        </div>

        {studio.sale.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nessuna sala. <a href={`/impostazioni/studi/${id}/sale/nuovo`} className="underline">Aggiungi la prima sala</a>.
          </p>
        ) : (
          <ul className="space-y-2">
            {studio.sale.map((s, idx) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                {/* Pulsanti ordine ▲ ▼ */}
                <div className="flex flex-col gap-0.5">
                  <SpostaBtn salaId={s.id} studioId={id} direzione="su"  disabilitato={idx === 0} />
                  <SpostaBtn salaId={s.id} studioId={id} direzione="giu" disabilitato={idx === studio.sale.length - 1} />
                </div>

                {/* Pallino colore */}
                <span className="h-4 w-4 shrink-0 rounded-full border border-slate-200"
                  style={{ background: s.colore }} />

                <span className="flex-1 font-medium text-slate-900">{s.nome}</span>

                {!s.attiva && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Disattiva</span>
                )}

                {/* Link modifica */}
                <a href={`/impostazioni/studi/${id}/sale/${s.id}/modifica`}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                  Modifica
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── TEAM / OPERATORI ── */}
      {/* Con 1 solo team mostra gli operatori direttamente (senza header team).
          Con più team mostra la vista raggruppata per team. */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {studio.team.length <= 1 ? 'Operatori' : 'Team'}
          </h2>
          <div className="flex gap-2">
            {/* Pulsante aggiungi operatore: se team unico link diretto, altrimenti non mostrato qui */}
            {studio.team.length === 1 && (
              <a href={`/impostazioni/studi/${id}/team/${studio.team[0].id}/collaboratori/nuovo`}
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
                + Aggiungi operatore
              </a>
            )}
            <a href={`/impostazioni/studi/${id}/team/nuovo`}
              className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              {studio.team.length <= 1 ? '+ Nuovo team' : '+ Nuovo team'}
            </a>
          </div>
        </div>

        {studio.team.length === 0 ? (
          /* Nessun team: invita a creare il primo */
          <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nessun operatore. <a href={`/impostazioni/studi/${id}/team/nuovo`} className="underline">Crea il primo team</a> per aggiungere operatori.
          </div>

        ) : studio.team.length === 1 ? (
          /* Un solo team: mostra operatori piatti, senza header del team */
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* Pulsante rinomina team */}
            <div className="mb-4 flex justify-end">
              <a
                href={`/impostazioni/studi/${id}/team/${studio.team[0].id}/modifica`}
                className="text-xs text-slate-400 hover:text-slate-700 underline"
              >
                Rinomina team
              </a>
            </div>
            {studio.team[0].collaboratori.length === 0 ? (
              <p className="text-sm text-slate-400">Nessun operatore. Usa il pulsante in alto per aggiungerne uno.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left">
                  <tr>
                    <th className="pb-2 font-medium text-slate-600">Operatore</th>
                    <th className="pb-2 font-medium text-slate-600">Ruolo</th>
                    <th className="pb-2 font-medium text-slate-600">€/ora</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {studio.team[0].collaboratori.map((c) => {
                    // Lega studioId e collaboratoreId alle server action
                    const disattiva  = disattivaCollaboratore.bind(null, id, c.id)
                    const riattiva   = riattivaCollaboratore.bind(null, id, c.id)
                    const elimina    = eliminaCollaboratore.bind(null, id, c.id)
                    const isReferral = referralMap.get(c.id) ?? false
                    // Un collaboratore con dataFine valorizzata è "disattivato":
                    // resta in elenco ma in grigio, non è disattivabile di nuovo
                    // e i form/selezioni non lo mostrano più.
                    const disattivato = c.dataFine !== null
                    const nomeCompleto = `${c.utente.nome} ${c.utente.cognome}`
                    return (
                      <tr key={c.id} className={disattivato ? 'opacity-50' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium text-slate-900">{c.utente.nome} {c.utente.cognome}</div>
                          <div className="text-xs text-slate-400">{c.utente.email}</div>
                        </td>
                        <td className="py-2.5 pr-4">
                          {disattivato ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Disattivato</span>
                          ) : (
                            <>
                              {c.isManager
                                ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Manager</span>
                                : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Membro</span>}
                              {c.isPrimario && (
                                <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">Primario</span>
                              )}
                              {isReferral && (
                                <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Referral</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-700">€ {Number(c.compensoOra).toFixed(2)}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Le azioni di modifica sono utili solo sui collaboratori attivi.
                                Sui disattivati mostriamo solo Riattiva + Rimuovi. */}
                            {!disattivato && (
                              <>
                                <a
                                  href={`/impostazioni/studi/${id}/team/${studio.team[0].id}/collaboratori/${c.id}/modifica`}
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                >
                                  Ruolo
                                </a>
                                <a
                                  href={`/impostazioni/utenti/${c.utente.id}/modifica`}
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                >
                                  Utente
                                </a>
                                <BtnDisattivaOperatore action={disattiva} nome={nomeCompleto} />
                              </>
                            )}
                            {disattivato && (
                              <BtnRiattivaOperatore action={riattiva} />
                            )}
                            <BtnEliminaOperatore action={elimina} nome={nomeCompleto} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        ) : (
          /* Più team: vista raggruppata con nome team */
          <div className="space-y-4">
            {studio.team.map((team) => (
              <div key={team.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-900">{team.nome}</h3>
                    {/* Modifica nome team */}
                    <a
                      href={`/impostazioni/studi/${id}/team/${team.id}/modifica`}
                      className="text-xs text-slate-400 hover:text-slate-700 underline"
                    >
                      Rinomina
                    </a>
                  </div>
                  <a href={`/impostazioni/studi/${id}/team/${team.id}/collaboratori/nuovo`}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
                    + Aggiungi operatore
                  </a>
                </div>
                {team.collaboratori.length === 0 ? (
                  <p className="text-sm text-slate-400">Nessun operatore nel team.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-left">
                      <tr>
                        <th className="pb-2 font-medium text-slate-600">Operatore</th>
                        <th className="pb-2 font-medium text-slate-600">Ruolo team</th>
                        <th className="pb-2 font-medium text-slate-600">€/ora</th>
                        <th className="pb-2 font-medium text-slate-600">% team</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {team.collaboratori.map((c) => {
                        const disattiva  = disattivaCollaboratore.bind(null, id, c.id)
                        const riattiva   = riattivaCollaboratore.bind(null, id, c.id)
                        const elimina    = eliminaCollaboratore.bind(null, id, c.id)
                        const isReferral = referralMap.get(c.id) ?? false
                        const disattivato = c.dataFine !== null
                        const nomeCompleto = `${c.utente.nome} ${c.utente.cognome}`
                        return (
                          <tr key={c.id} className={disattivato ? 'opacity-50' : 'hover:bg-slate-50'}>
                            <td className="py-2.5 pr-4">
                              <div className="font-medium text-slate-900">{c.utente.nome} {c.utente.cognome}</div>
                              <div className="text-xs text-slate-400">{c.utente.email}</div>
                            </td>
                            <td className="py-2.5 pr-4">
                              {disattivato ? (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Disattivato</span>
                              ) : (
                                <>
                                  {c.isManager
                                    ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Manager</span>
                                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Membro</span>}
                                  {c.isPrimario && (
                                    <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">Primario</span>
                                  )}
                                  {isReferral && (
                                    <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Referral</span>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-slate-700">€ {Number(c.compensoOra).toFixed(2)}</td>
                            <td className="py-2.5 pr-4 text-slate-600">
                              {c.percentualeTeam ? `${c.percentualeTeam}%` : '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!disattivato && (
                                  <>
                                    <a
                                      href={`/impostazioni/studi/${id}/team/${team.id}/collaboratori/${c.id}/modifica`}
                                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                    >
                                      Ruolo
                                    </a>
                                    <a
                                      href={`/impostazioni/utenti/${c.utente.id}/modifica`}
                                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                    >
                                      Utente
                                    </a>
                                    <BtnDisattivaOperatore action={disattiva} nome={nomeCompleto} />
                                  </>
                                )}
                                {disattivato && (
                                  <BtnRiattivaOperatore action={riattiva} />
                                )}
                                <BtnEliminaOperatore action={elimina} nome={nomeCompleto} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
