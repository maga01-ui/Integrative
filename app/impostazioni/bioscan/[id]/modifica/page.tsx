// Modifica tipologia Bioscan esistente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function aggiornaTipologia(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.tipologiaBioscan.update({
    where: { id },
    data: {
      tipologia:    formData.get('tipologia') as string,
      colore:       (formData.get('colore') as string) || '#6366f1',
      prezzo:       Number(formData.get('prezzo')),
      durataMinuti: Number(formData.get('durataMinuti')) || 60,
    },
  })

  redirect('/impostazioni/prestazioni')
}

export default async function ModificaTipologiaBioscanPage({ params }: { params: any }) {
  const { id } = await Promise.resolve(params) as { id: string }

  const tipologia = await prisma.tipologiaBioscan.findUnique({ where: { id } })
  if (!tipologia) notFound()

  const aggiorna = aggiornaTipologia.bind(null, id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Modifica Bioscan</h1>
      </div>

      <form action={aggiorna} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Tipologia *</label>
          <input name="tipologia" required defaultValue={tipologia.tipologia} className={cls} />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Prezzo (€) *</label>
            <input name="prezzo" type="number" step="0.01" min="0" required
              defaultValue={Number(tipologia.prezzo).toFixed(2)} className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Durata (minuti) *</label>
            <input name="durataMinuti" type="number" min="1" required
              defaultValue={tipologia.durataMinuti} className={cls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="color"
              name="colore"
              defaultValue={(tipologia as any).colore ?? '#6366f1'}
              className="h-10 w-14 cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-1"
            />
            <span className="text-xs text-slate-400">Colore usato nel calendario per questa tipologia</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <BackButton className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50" />
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
