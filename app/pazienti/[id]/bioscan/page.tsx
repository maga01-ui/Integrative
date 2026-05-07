// Elenco bioscan del paziente: tabella con data, tipologia, operatore e azioni

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPatientOrRedirect } from '../patientUtilsFinal'

// ── Server action: elimina un bioscan ─────────────────────────────────────────
async function eliminaBioscan(bioscanId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.bioscan.delete({ where: { id: bioscanId } })
  revalidatePath(`/pazienti/${pazienteId}/bioscan`)
}

// ── Server action: segna/desegna bioscan come effettuato ──────────────────────
async function toggleEffettuato(bioscanId: string, pazienteId: string, valore: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const bioscan = await prisma.bioscan.findUnique({
    where:  { id: bioscanId },
    select: {
      appuntamentoId: true,
      appuntamento:   { select: { stato: true } },
    },
  })

  if (valore) {
    // Quando si vuole segnare come effettuato, l'appuntamento deve essere già COMPLETATO
    if (bioscan?.appuntamentoId && bioscan.appuntamento?.stato !== 'COMPLETATO') {
      return
    }
  } else {
    // Quando si annulla l'effettuato, se l'appuntamento è COMPLETATO rimettilo
    // in DA_RIPROGRAMMARE per mantenere la coerenza tra bioscan e agenda
    if (bioscan?.appuntamentoId && bioscan.appuntamento?.stato === 'COMPLETATO') {
      await prisma.appuntamento.update({
        where: { id: bioscan.appuntamentoId },
        data:  { stato: 'DA_RIPROGRAMMARE' },
      })
    }
  }

  // Aggiorna il flag effettuato sul bioscan
  await prisma.bioscan.update({
    where: { id: bioscanId },
    data:  { effettuato: valore },
  })

  revalidatePath(`/pazienti/${pazienteId}/bioscan`)
  revalidatePath(`/pazienti/${pazienteId}/agenda`)
}

// ── Etichette tipo bioscan ────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  INIZIALE:  'Iniziale',
  CONTROLLO: 'Controllo',
}

// ── Icona PDF ─────────────────────────────────────────────────────────────────
function IconaPdf() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="h-4 w-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
      <line x1="9" y1="9" x2="11" y2="9" />
    </svg>
  )
}

// ── Icona matita (modifica) ───────────────────────────────────────────────────
function IconaMatita() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="h-4 w-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

// ── Icona cestino (elimina) ───────────────────────────────────────────────────
function IconaCestino() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className="h-4 w-4">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

// ── Badge stato appuntamento lettura referto ──────────────────────────────────
// Mostra il colore e l'etichetta in base allo stato corrente dell'appuntamento
function StatoBadgeLetturaReferto({ stato }: { stato: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    FISSATO:          { label: 'Fissata',           cls: 'bg-amber-100 text-amber-700' },
    CONFERMATO:       { label: 'Confermata',         cls: 'bg-sky-100 text-sky-700' },
    COMPLETATO:       { label: 'Effettuata',         cls: 'bg-emerald-100 text-emerald-700' },
    CANCELLATO:       { label: 'Annullata',          cls: 'bg-red-100 text-red-600' },
    NO_SHOW:          { label: 'No show',            cls: 'bg-slate-100 text-slate-500' },
    DA_RIPROGRAMMARE: { label: 'Da riprogrammare',   cls: 'bg-orange-100 text-orange-700' },
  }
  const { label, cls } = cfg[stato] ?? { label: stato, cls: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function BioscanPage({ params }: { params: any }) {
  const { id } = await Promise.resolve(params) as { id: string }

  // Carica paziente, bioscan e appuntamenti lettura referto in parallelo
  const [paziente, bioscanList, letturaRefertoApps] = await Promise.all([
    getPatientOrRedirect(id),
    prisma.bioscan.findMany({
      where:   { pazienteId: id },
      orderBy: { dataEsecuzione: 'desc' },
      include: {
        medico:         { select: { nome: true, cognome: true } },
        // Appuntamento di esecuzione bioscan: serve per verificare se è COMPLETATO
        appuntamento:   { select: { stato: true } },
        // Appuntamento lettura referto collegato: data e stato corrente
        letturaReferto: { select: { inizio: true, stato: true } },
      },
    }),
    // Fallback: appuntamenti lettura referto non cancellati per questo paziente
    // usati quando letturaRefertoId non è impostato sul bioscan
    prisma.appuntamento.findMany({
      where: {
        pazienteId: id,
        tipoPrestazione: { contains: 'lettura', mode: 'insensitive' },
        stato: { notIn: ['CANCELLATO'] },
      },
      select: { id: true },
    }),
  ])

  // Un bioscan "senza lettura" = effettuato + no letturaRefertoId + nessun appuntamento lettura fallback
  // (il fallback serve per dati precedenti dove il link non era ancora impostato)
  const haLetturaFallback = letturaRefertoApps.length > 0
  const bioscanSenzaLettura = bioscanList.filter(
    b => b.effettuato && !b.letturaRefertoId && !haLetturaFallback
  )

  return (
    <div className="space-y-6">

      {/* ── Intestazione sezione ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Bioscan</p>
          <p className="text-sm text-slate-500">Elenco dei bioscan eseguiti per questo paziente.</p>
        </div>
        <a
          href={`/pazienti/${id}/bioscan/nuovo`}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          + Nuovo Bioscan
        </a>
      </div>

      {/* ── Banner: bioscan senza lettura referto ── */}
      {bioscanSenzaLettura.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Attenzione:</strong> uno o più bioscan non hanno ancora un appuntamento per la lettura del referto.
          Usa il pulsante <strong>Fissa lettura</strong> sulla riga corrispondente.
        </div>
      )}

      {/* ── Tabella bioscan ── */}
      {bioscanList.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Nessun bioscan registrato.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <table className="w-full text-sm">

            {/* Intestazione colonne */}
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500">Data</th>
                <th className="px-4 py-3 font-medium text-slate-500">Tipologia</th>
                <th className="px-4 py-3 font-medium text-slate-500">Operatore</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Effettuato</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Lettura referto</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Consegnato</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Report</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Modifica</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Elimina</th>
              </tr>
            </thead>

            {/* Righe bioscan */}
            <tbody className="divide-y divide-slate-50">
              {bioscanList.map(b => {
                // Pre-lega le actions con l'id del bioscan
                const elimina           = eliminaBioscan.bind(null, b.id, id)
                const segnaEffettuato   = toggleEffettuato.bind(null, b.id, id, true)
                const annullaEffettuato = toggleEffettuato.bind(null, b.id, id, false)

                return (
                  <tr key={b.id} className="hover:bg-slate-50">

                    {/* Data */}
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(b.dataEsecuzione).toLocaleDateString('it-IT')}
                    </td>

                    {/* Tipologia (enum TipoBioscan) */}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {TIPO_LABEL[b.tipo] ?? b.tipo}
                    </td>

                    {/* Operatore */}
                    <td className="px-4 py-3 text-slate-600">
                      {b.medico
                        ? `Dr. ${b.medico.cognome} ${b.medico.nome}`
                        : '—'}
                    </td>

                    {/* Effettuato: toggle cliccabile solo se l'appuntamento è COMPLETATO */}
                    <td className="px-4 py-3 text-center">
                      {b.effettuato ? (
                        // Già effettuato: permetti sempre di annullare
                        <form action={annullaEffettuato}>
                          <button
                            type="submit"
                            title="Segna come non effettuato"
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-80 bg-emerald-100 text-emerald-700"
                          >
                            Sì
                          </button>
                        </form>
                      ) : (!b.appuntamento || b.appuntamento.stato === 'COMPLETATO') ? (
                        // Appuntamento completato (o assente per dati storici): permetti di segnare
                        <form action={segnaEffettuato}>
                          <button
                            type="submit"
                            title="Segna come effettuato"
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold transition bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            No
                          </button>
                        </form>
                      ) : (
                        // Appuntamento non ancora completato: bottone disabilitato con spiegazione
                        <span
                          title="Completa prima l'appuntamento per segnare il bioscan come effettuato"
                          className="cursor-not-allowed rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-300 select-none"
                        >
                          No
                        </span>
                      )}
                    </td>

                    {/* Lettura referto: data + stato corrente se collegata, altrimenti link per fissarla */}
                    <td className="px-4 py-3 text-center">
                      {b.effettuato ? (
                        b.letturaReferto ? (
                          // Link diretto: mostra solo lo stato corrente (la data è nella colonna "Consegnato")
                          <StatoBadgeLetturaReferto stato={b.letturaReferto.stato} />
                        ) : haLetturaFallback ? (
                          // Dati vecchi senza link diretto: mostra solo "Fissata"
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Fissata
                          </span>
                        ) : (
                          <a
                            href={`/calendario/nuovo?pazienteId=${id}&bioscanId=${b.id}&studioId=${paziente.studioId}`}
                            className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 transition"
                          >
                            Fissa lettura
                          </a>
                        )
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Consegnato: data di consegna se disponibile, "No" altrimenti */}
                    <td className="px-4 py-3 text-center">
                      {b.refertoConsegnato && b.letturaReferto ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {new Date(b.letturaReferto.inizio).toLocaleDateString('it-IT')}
                        </span>
                      ) : b.refertoConsegnato ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Sì
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                          No
                        </span>
                      )}
                    </td>

                    {/* Bottone report PDF */}
                    <td className="px-4 py-3 text-center">
                      <a
                        href={`/pazienti/${id}/bioscan/${b.id}/report`}
                        title="Scarica report PDF"
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:border-red-300 hover:text-red-500"
                      >
                        <IconaPdf />
                      </a>
                    </td>

                    {/* Bottone modifica */}
                    <td className="px-4 py-3 text-center">
                      <a
                        href={`/pazienti/${id}/bioscan/${b.id}/modifica`}
                        title="Modifica bioscan"
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                      >
                        <IconaMatita />
                      </a>
                    </td>

                    {/* Bottone elimina */}
                    <td className="px-4 py-3 text-center">
                      <form action={elimina}>
                        <button
                          type="submit"
                          title="Elimina bioscan"
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:border-red-300 hover:text-red-500"
                        >
                          <IconaCestino />
                        </button>
                      </form>
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
