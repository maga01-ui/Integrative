// Modifica programma + gestione degli step (ProgrammaCura) inclusi nel programma

import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'
import { revalidatePath } from 'next/cache'
import BtnElimina from '@/app/impostazioni/origini/BtnElimina'

// ── Aggiorna i dati del programma ─────────────────────────────────────────────
async function aggiornaProgramma(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.programma.update({
    where: { id },
    data: {
      nome:                   formData.get('nome') as string,
      descrizione:            (formData.get('descrizione') as string) || null,
      defaultSessioni:        Number(formData.get('defaultSessioni') || 8),
      durataSessioneMinuti:   Number(formData.get('durataSessioneMinuti') || 60),
      prezzoSessione:         Number(formData.get('prezzoSessione') || 500),
      prezzoBioscanIniziale:  Number(formData.get('prezzoBioscanIniziale') ?? 0),
      prezzoBioscanControllo: Number(formData.get('prezzoBioscanControllo') || 0),
    },
  })

  revalidatePath(`/impostazioni/programmi/${id}/modifica`)
  redirect('/impostazioni/programmi')
}

// ── Aggiunge uno step (ProgrammaCura) al programma ───────────────────────────
async function aggiungiCura(programmaId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Calcola il prossimo ordine tra le cure del programma
  const ultimo = await prisma.programmaCura.findFirst({
    where:   { programmaId },
    orderBy: { ordine: 'desc' },
    select:  { ordine: true },
  })

  await prisma.programmaCura.create({
    data: {
      programmaId,
      nome:            formData.get('nome') as string,
      tipoPrestazione: formData.get('tipoPrestazione') as 'BIOSCAN' | 'LETTURA_REFERTO' | 'TRATTAMENTO' | 'FITOTERAPIA' | 'MANTENIMENTO',
      prezzo:          Number(formData.get('prezzo') || 0),
      durataMinuti:    Number(formData.get('durataMinuti') || 60),
      ordine:          (ultimo?.ordine ?? 0) + 1,
    },
  })

  revalidatePath(`/impostazioni/programmi/${programmaId}/modifica`)
}

// ── Elimina uno step dal programma ───────────────────────────────────────────
async function eliminaCura(curaId: string, programmaId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.programmaCura.delete({ where: { id: curaId } })
  revalidatePath(`/impostazioni/programmi/${programmaId}/modifica`)
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function ModificaProgrammaPage({ params }: { params: any }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await Promise.resolve(params) as { id: string }

  const programma = await prisma.programma.findUnique({
    where: { id },
    include: {
      cure: { orderBy: { ordine: 'asc' } },
    },
  })

  if (!programma) notFound()

  // Server actions con il programmaId pre-legato
  const salva      = aggiornaProgramma.bind(null, id)
  const aggiungi   = aggiungiCura.bind(null, id)

  // Calcola il costo totale con i valori attuali del programma
  const costoTotale =
    Number(programma.prezzoBioscanIniziale) +
    (programma.defaultSessioni * Number(programma.prezzoSessione)) +
    Number(programma.prezzoBioscanControllo)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Modifica programma</h1>
      </div>

      {/* ── Form dati principali ── */}
      <form action={salva} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700">Dati del programma</h2>

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome programma *</label>
          <input type="text" name="nome" required defaultValue={programma.nome} className={cls} />
        </div>

        {/* Descrizione */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Descrizione</label>
          <textarea name="descrizione" rows={2} defaultValue={programma.descrizione ?? ''} className={cls} />
        </div>

        {/* Sessioni + Durata */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Numero sessioni predefinito *</label>
            <input
              type="number"
              name="defaultSessioni"
              required
              min="1"
              max="50"
              defaultValue={programma.defaultSessioni}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Durata sessione (minuti) *</label>
            <input
              type="number"
              name="durataSessioneMinuti"
              required
              min="5"
              step="5"
              defaultValue={(programma as any).durataSessioneMinuti ?? 60}
              className={cls}
            />
          </div>
        </div>

        {/* Prezzi */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Prezzi</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Bioscan iniziale (€)</label>
              <input
                type="number"
                name="prezzoBioscanIniziale"
                min="0"
                step="10"
                defaultValue={Number(programma.prezzoBioscanIniziale)}
                className={cls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Prezzo sessione (€)</label>
              <input
                type="number"
                name="prezzoSessione"
                min="0"
                step="10"
                defaultValue={Number(programma.prezzoSessione)}
                className={cls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Bioscan controllo (€)</label>
              <input
                type="number"
                name="prezzoBioscanControllo"
                min="0"
                step="10"
                defaultValue={Number(programma.prezzoBioscanControllo)}
                className={cls}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Totale attuale: <strong>€ {costoTotale.toLocaleString('it-IT')}</strong>
            {' '}(bioscan + {programma.defaultSessioni} sessioni + controllo)
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <a
            href="/impostazioni/programmi"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Salva modifiche
          </button>
        </div>
      </form>

      {/* ── Sezione step/cure del programma ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-700">Step personalizzati del programma</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Opzionale: aggiungi trattamenti specifici da usare come guida clinica durante il programma.
            Se non configurati, il medico sceglie la prestazione al momento della prenotazione.
          </p>
        </div>

        {/* Lista step esistenti */}
        {programma.cure.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 text-center">
            Nessuno step configurato — il programma usa solo i parametri generali.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-slate-500">Nome</th>
                  <th className="px-4 py-2.5 font-medium text-slate-500">Tipo</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-500">Prezzo</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-500">Durata</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {programma.cure.map(cura => {
                  const elim = eliminaCura.bind(null, cura.id, id)
                  return (
                    <tr key={cura.id}>
                      <td className="px-4 py-2.5 text-slate-900">{cura.nome}</td>
                      <td className="px-4 py-2.5 text-slate-500">{cura.tipoPrestazione}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">€ {Number(cura.prezzo).toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{cura.durataMinuti} min</td>
                      <td className="px-4 py-2.5 text-right">
                        <BtnElimina action={elim} nome={cura.nome} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Form aggiunta nuovo step */}
        <form action={aggiungi} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-600">Aggiungi step</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
              <input
                type="text"
                name="nome"
                required
                placeholder="es. Trattamento bioenergetico"
                className={clsSmall}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
              <select name="tipoPrestazione" required className={clsSmall}>
                <option value="TRATTAMENTO">Trattamento</option>
                <option value="BIOSCAN">Bioscan</option>
                <option value="LETTURA_REFERTO">Lettura referto</option>
                <option value="FITOTERAPIA">Fitoterapia</option>
                <option value="MANTENIMENTO">Mantenimento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prezzo (€)</label>
              <input type="number" name="prezzo" min="0" step="10" defaultValue="500" className={clsSmall} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Durata (minuti)</label>
              <input type="number" name="durataMinuti" min="5" step="5" defaultValue="60" className={clsSmall} />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              + Aggiungi step
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const cls      = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
const clsSmall = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900'
