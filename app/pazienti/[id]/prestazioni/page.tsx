// Prestazioni del paziente: lista prestazioni singole (senza programma) con possibilità di aggiungere e modificare

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseDataOraItalia } from '@/lib/datetime'
import { getTenantContext } from '@/lib/tenant'
import { getPatientOrRedirect } from '../patientUtilsFinal'
import AggiuntaPrestazioneToggle from './AggiuntaPrestazioneToggle'

// ── Server action: aggiunge una cura singola (Appuntamento senza programma) ───
async function aggiungiCura(pazienteId: string, studioId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const prestazioneId = formData.get('prestazioneId') as string
  const medicoId      = formData.get('medicoId') as string
  const salaId        = formData.get('salaId') as string
  // "inizio" è il campo hidden combinato scritto da DatePickerCalendario ("YYYY-MM-DDTHH:mm")
  const inizioStr     = formData.get('inizio') as string
  const prezzoStr     = formData.get('prezzo') as string
  const durataStr     = formData.get('durata') as string
  const note          = (formData.get('note') as string) || null

  if (!prestazioneId || !medicoId || !salaId || !inizioStr) return

  // Carica la prestazione per ricavare nome e prezzo base
  const prestazione = await prisma.prestazione.findUnique({
    where: { id: prestazioneId },
    select: { nome: true, prezzoBase: true, durataMinuti: true },
  })
  if (!prestazione) return

  // Calcola orario inizio e fine.
  // Interpretiamo SEMPRE come ora italiana: vedi lib/datetime.ts.
  const inizio = parseDataOraItalia(inizioStr)
  const durata = Number(durataStr) || prestazione.durataMinuti
  const fine   = new Date(inizio.getTime() + durata * 60 * 1000)

  const prezzo = Number(prezzoStr) || Number(prestazione.prezzoBase)

  await prisma.appuntamento.create({
    data: {
      studioId,
      pazienteId,
      medicoId,
      salaId,
      prestazioneId,
      tipoPrestazione: prestazione.nome,
      inizio,
      fine,
      stato:           'FISSATO',
      prezzoBase:      Number(prestazione.prezzoBase),
      prezzoApplicato: prezzo,
      note,
    },
  })

  revalidatePath(`/pazienti/${pazienteId}/prestazioni`)
}

// ── Server action: elimina una cura singola ───────────────────────────────────
async function eliminaCura(appId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Elimina solo se non ha un programma associato (sicurezza)
  await prisma.appuntamento.deleteMany({
    where: { id: appId, programmaPazienteId: null },
  })

  revalidatePath(`/pazienti/${pazienteId}/prestazioni`)
}

// ── Etichette stato ───────────────────────────────────────────────────────────
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

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function CurePage({ params }: { params: any }) {
  const { id: pazienteId } = await Promise.resolve(params) as { id: string }
  const paziente  = await getPatientOrRedirect(pazienteId)
  const studioId  = (paziente as any).studioId as string | null

  // Usa lo stesso filtro della pagina impostazioni: nessun filtro per SUPERADMIN
  let ctx: Awaited<ReturnType<typeof getTenantContext>> | null = null
  try { ctx = await getTenantContext() } catch { redirect('/login') }
  const isSuperAdmin    = ctx!.ruolo === 'SUPERADMIN'
  const studioFilter    = isSuperAdmin ? {} : { studioId: studioId ?? ctx!.studioId ?? '' }

  // Carica cure singole: esclude appuntamenti di programma, bioscan principale e lettura referto
  const cureSingole = await prisma.appuntamento.findMany({
    where:   {
      pazienteId,
      programmaPazienteId:  null,
      bioscan:              { is: null },  // non è un appuntamento bioscan
      bioscanLetturaReferto: { is: null }, // non è un appuntamento di lettura referto
    },
    orderBy: { inizio: 'desc' },
    include: {
      prestazione: { select: { nome: true } },
      medico:      { select: { nome: true, cognome: true } },
      sala:        { select: { nome: true } },
    },
  })

  // Carica prestazioni dello studio per il form (stessa logica di impostazioni)
  const prestazioni = await prisma.prestazione.findMany({
    where:   { ...studioFilter, attiva: true },
    orderBy: { ordine: 'asc' },
    select:  { id: true, nome: true, prezzoBase: true, durataMinuti: true },
  })

  // Operatori e sale: sempre filtrati per lo studio del paziente (non il filtro globale)
  const studioIdPaziente = studioId ?? ''
  const [operatori, sale] = await Promise.all([
    prisma.utente.findMany({
      where:   { studioId: studioIdPaziente, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    prisma.sala.findMany({
      where:   { studioId: studioIdPaziente, attiva: true },
      select:  { id: true, nome: true },
      orderBy: { ordine: 'asc' },
    }),
  ])

  // Server actions con parametri pre-legati. Usiamo studioIdPaziente (string,
  // mai null) perché aggiungiCura si aspetta string.
  const aggiungi = aggiungiCura.bind(null, pazienteId, studioIdPaziente)

  return (
    <div className="space-y-6">
      {/* Titolo sezione */}
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-400">Prestazioni</p>
        <p className="text-sm text-slate-500">
          Sessioni singole non collegate ad un programma
        </p>
      </div>

      {/* ── Bottone + form aggiungi prestazione (sotto il titolo) ── */}
      {prestazioni.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nessuna prestazione configurata.{' '}
          <a href="/impostazioni/prestazioni" className="underline">Configurale nelle impostazioni</a>.
        </p>
      ) : (
        <AggiuntaPrestazioneToggle
          action={aggiungi}
          prestazioni={prestazioni.map(p => ({ ...p, prezzoBase: Number(p.prezzoBase) }))}
          operatori={operatori}
          sale={sale}
          studioId={studioIdPaziente}
        />
      )}

      {/* ── Lista prestazioni ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-700">
            Prestazioni
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({cureSingole.length})
            </span>
          </h2>
        </div>

        {cureSingole.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-400">
            Nessuna prestazione registrata.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">Data</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Ora</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Prestazione</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Operatore</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Sala</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Stato</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">€</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cureSingole.map(cura => {
                  const elimina = eliminaCura.bind(null, cura.id, pazienteId)
                  return (
                    <tr key={cura.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(cura.inizio).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(cura.inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {cura.tipoPrestazione}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {cura.medico ? `${cura.medico.cognome} ${cura.medico.nome}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{cura.sala?.nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATO_BADGE[cura.stato] ?? ''}`}>
                          {STATO_LABEL[cura.stato] ?? cura.stato}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        € {Number(cura.prezzoApplicato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Modifica → apre il dettaglio appuntamento nel calendario */}
                          <a
                            href={`/calendario/${cura.id}`}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                          >
                            Modifica
                          </a>
                          {/* Elimina (solo se senza fattura collegata) */}
                          <form action={elimina}>
                            <button
                              type="submit"
                              className="rounded-full border border-red-100 px-3 py-1 text-xs font-medium text-red-400 hover:border-red-300 hover:text-red-600"
                            >
                              Elimina
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
