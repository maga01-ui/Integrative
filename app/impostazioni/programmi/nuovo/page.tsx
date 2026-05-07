// Form creazione nuovo programma di cura
// I programmi sono globali (condivisi tra tutti gli studi)

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import BackButton from '@/components/ui/BackButton'
import { prisma } from '@/lib/prisma'

// ── Server action: crea il programma ─────────────────────────────────────────
async function creaProgramma(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Calcola il prossimo valore ordine
  const ultimo = await prisma.programma.findFirst({
    orderBy: { ordine: 'desc' },
    select:  { ordine: true },
  })
  const prossimOrdine = (ultimo?.ordine ?? 0) + 1

  await prisma.programma.create({
    data: {
      nome:                   formData.get('nome') as string,
      descrizione:            (formData.get('descrizione') as string) || null,
      tipo:                   'TRATTAMENTI',  // non esposto in UI — default fisso
      defaultSessioni:        Number(formData.get('defaultSessioni') || 8),
      durataSessioneMinuti:   Number(formData.get('durataSessioneMinuti') || 60),
      prezzoSessione:         Number(formData.get('prezzoSessione') || 500),
      prezzoBioscanIniziale:  Number(formData.get('prezzoBioscanIniziale') ?? 0),
      prezzoBioscanControllo: Number(formData.get('prezzoBioscanControllo') || 0),
      attivo:                 true,
      ordine:                 prossimOrdine,
    },
  })

  redirect('/impostazioni/programmi')
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function NuovoProgrammaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo programma</h1>
      </div>

      <form action={creaProgramma} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome programma *</label>
          <input
            type="text"
            name="nome"
            required
            placeholder="es. Programma Base, Programma Mantenimento…"
            className={cls}
          />
        </div>

        {/* Descrizione */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Descrizione</label>
          <textarea
            name="descrizione"
            rows={2}
            placeholder="Descrizione opzionale del programma…"
            className={cls}
          />
        </div>

        {/* Sessioni + Durata */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Numero di sessioni predefinito *</label>
            <p className="mb-1.5 text-xs text-slate-400">Modificabile caso per caso al momento dell'assegnazione.</p>
            <input
              type="number"
              name="defaultSessioni"
              required
              min="1"
              max="50"
              defaultValue="8"
              className={cls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Durata sessione (minuti) *</label>
            <p className="mb-1.5 text-xs text-slate-400">Durata standard di ogni appuntamento del programma.</p>
            <input
              type="number"
              name="durataSessioneMinuti"
              required
              min="5"
              step="5"
              defaultValue="60"
              className={cls}
            />
          </div>
        </div>

        {/* ── Sezione prezzi ── */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Prezzi del programma</h3>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Bioscan iniziale */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Bioscan iniziale (€)</label>
              <p className="mb-1.5 text-xs text-slate-400">Prima del programma (0 = gratuito)</p>
              <input
                type="number"
                name="prezzoBioscanIniziale"
                min="0"
                step="10"
                defaultValue="0"
                className={cls}
              />
            </div>

            {/* Prezzo per sessione */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Prezzo per sessione (€)</label>
              <p className="mb-1.5 text-xs text-slate-400">Ogni trattamento del ciclo</p>
              <input
                type="number"
                name="prezzoSessione"
                min="0"
                step="10"
                defaultValue="500"
                className={cls}
              />
            </div>

            {/* Bioscan di controllo */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Bioscan di controllo (€)</label>
              <p className="mb-1.5 text-xs text-slate-400">Al termine del ciclo</p>
              <input
                type="number"
                name="prezzoBioscanControllo"
                min="0"
                step="10"
                defaultValue="0"
                className={cls}
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Il costo totale del programma (con {8} sessioni) sarà: Bioscan + (Sessioni × Prezzo/sessione) + Controllo
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
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
            Crea programma
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
