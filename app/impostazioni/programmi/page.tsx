// Lista di tutti i programmi di cura — globali, condivisi tra tutti gli studi
// Un programma definisce: numero sessioni, prezzi, tipo di cura

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import BackButton from '@/components/ui/BackButton'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import BtnElimina from '@/app/impostazioni/origini/BtnElimina'

// ── Sposta un programma su o giù scambiando i valori ordine ──────────────────
async function spostaOrdine(id: string, direzione: 'su' | 'giu') {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const corrente = await prisma.programma.findUnique({ where: { id } })
  if (!corrente) return

  const adiacente = await prisma.programma.findFirst({
    where: {
      ordine: direzione === 'su'
        ? { lt: corrente.ordine }
        : { gt: corrente.ordine },
    },
    orderBy: { ordine: direzione === 'su' ? 'desc' : 'asc' },
  })

  if (!adiacente) return

  await prisma.$transaction([
    prisma.programma.update({ where: { id: corrente.id  }, data: { ordine: adiacente.ordine } }),
    prisma.programma.update({ where: { id: adiacente.id }, data: { ordine: corrente.ordine  } }),
  ])

  revalidatePath('/impostazioni/programmi')
}

// ── Attiva o disattiva un programma ──────────────────────────────────────────
async function toggleAttivo(id: string, attivo: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.programma.update({ where: { id }, data: { attivo: !attivo } })
  revalidatePath('/impostazioni/programmi')
}

// ── Elimina un programma (solo se non ha alcuna assegnazione a pazienti) ──────
// ATTENZIONE: la relazione ProgrammaPaziente → Programma ha onDelete: Cascade,
// quindi eliminare un Programma cancellerebbe la storia di cura di tutti i pazienti
// che lo hanno usato. Blocchiamo la cancellazione se esistono assegnazioni.
async function eliminaProgramma(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Conta le assegnazioni: se esistono, blocca l'eliminazione
  const assegnazioni = await prisma.programmaPaziente.count({ where: { programmaId: id } })
  if (assegnazioni > 0) return  // non elimina — ci sono pazienti che usano questo programma

  await prisma.programma.delete({ where: { id } })
  revalidatePath('/impostazioni/programmi')
}

// ── Etichette leggibili per il tipo di cura ───────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  TRATTAMENTI: 'Trattamenti',
  FITOTERAPIA: 'Fitoterapia',
  ENTRAMBI:    'Trattamenti + Fitoterapia',
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function ProgrammiPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Carica tutti i programmi con il conteggio degli step e delle assegnazioni
  const programmi = await prisma.programma.findMany({
    orderBy: { ordine: 'asc' },
    include: {
      _count: { select: { cure: true, assegnamenti: true } },
    },
  })

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Programmi di cura</h1>
      </div>

      <p className="text-sm text-slate-500">
        I programmi definiscono il percorso standard di un paziente: numero di sessioni,
        prezzi e tipo di cura. Sono condivisi tra tutti gli studi.
      </p>

      <div className="flex justify-end">
        <a
          href="/impostazioni/programmi/nuovo"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          + Nuovo programma
        </a>
      </div>

      {/* ── Lista programmi ── */}
      {programmi.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-slate-500">Nessun programma configurato.</p>
          <a
            href="/impostazioni/programmi/nuovo"
            className="mt-3 inline-block text-sm font-medium text-slate-900 underline"
          >
            Crea il primo programma →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {programmi.map((prog, idx) => {
            const spSu    = spostaOrdine.bind(null, prog.id, 'su')
            const spGiu   = spostaOrdine.bind(null, prog.id, 'giu')
            const toggle  = toggleAttivo.bind(null, prog.id, prog.attivo)
            const elimina = eliminaProgramma.bind(null, prog.id)

            // Calcola il costo totale del programma (bioscan + sessioni + controllo)
            const costoTotale =
              Number(prog.prezzoBioscanIniziale) +
              (prog.defaultSessioni * Number(prog.prezzoSessione)) +
              Number(prog.prezzoBioscanControllo)

            return (
              <div
                key={prog.id}
                className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
                  prog.attivo ? 'border-slate-200' : 'border-slate-100 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-start gap-4">

                  {/* Nome + tipo badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{prog.nome}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {TIPO_LABEL[prog.tipo] ?? prog.tipo}
                      </span>
                      {!prog.attivo && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          Disattivo
                        </span>
                      )}
                    </div>
                    {prog.descrizione && (
                      <p className="mt-1 text-sm text-slate-500">{prog.descrizione}</p>
                    )}

                    {/* Riepilogo prezzi */}
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>
                        <span className="font-medium text-slate-800">{prog.defaultSessioni}</span> sessioni
                      </span>
                      <span>
                        Bioscan: <span className="font-medium text-slate-800">€ {Number(prog.prezzoBioscanIniziale).toFixed(0)}</span>
                      </span>
                      <span>
                        Sessione: <span className="font-medium text-slate-800">€ {Number(prog.prezzoSessione).toFixed(0)}</span>
                      </span>
                      <span>
                        Controllo: <span className="font-medium text-slate-800">
                          {Number(prog.prezzoBioscanControllo) === 0 ? 'Gratuito' : `€ ${Number(prog.prezzoBioscanControllo).toFixed(0)}`}
                        </span>
                      </span>
                      <span className="text-slate-400">|</span>
                      <span>
                        Totale programma: <span className="font-semibold text-indigo-700">€ {costoTotale.toLocaleString('it-IT')}</span>
                      </span>
                    </div>

                    {/* Contatori */}
                    <div className="mt-2 flex gap-4 text-xs text-slate-400">
                      <span>{prog._count.cure} step configurati</span>
                      <span>{prog._count.assegnamenti} assegnazioni pazienti</span>
                    </div>
                  </div>

                  {/* Azioni */}
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    {/* Toggle attivo */}
                    <form action={toggle}>
                      <button
                        type="submit"
                        title={prog.attivo ? 'Disattiva' : 'Attiva'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          prog.attivo ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          prog.attivo ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </form>

                    {/* Modifica + Elimina */}
                    <div className="flex items-center gap-2">
                      <a
                        href={`/impostazioni/programmi/${prog.id}/modifica`}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                      >
                        Modifica
                      </a>
                      {/* Elimina solo se nessun paziente ha mai usato questo programma */}
                      {prog._count.assegnamenti === 0 ? (
                        <BtnElimina action={elimina} nome={prog.nome} />
                      ) : (
                        <span
                          title={`Impossibile eliminare: ${prog._count.assegnamenti} pazienti hanno usato questo programma. Usa il toggle per disattivarlo.`}
                          className="cursor-not-allowed rounded-full border border-slate-100 px-3 py-1 text-xs font-medium text-slate-300"
                        >
                          Elimina
                        </span>
                      )}
                    </div>

                    {/* Frecce ordine */}
                    <div className="flex gap-1">
                      <form action={spSu}>
                        <button
                          type="submit"
                          disabled={idx === 0}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          title="Sposta su"
                        >▲</button>
                      </form>
                      <form action={spGiu}>
                        <button
                          type="submit"
                          disabled={idx === programmi.length - 1}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          title="Sposta giù"
                        >▼</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
