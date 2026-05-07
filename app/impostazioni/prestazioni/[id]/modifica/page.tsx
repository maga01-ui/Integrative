// Form modifica prestazione esistente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function modificaPrestazione(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.prestazione.update({
    where: { id },
    data: {
      nome:         formData.get('nome') as string,
      colore:       formData.get('colore') as string,
      prezzoBase:   Number(formData.get('prezzoBase') || 0),
      durataMinuti: Number(formData.get('durataMinuti') || 60),
    },
  })

  redirect('/impostazioni/prestazioni')
}

export default async function ModificaPrestazionePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params

  const prestazione = await prisma.prestazione.findUnique({ where: { id } })
  if (!prestazione) notFound()

  const salva = modificaPrestazione.bind(null, id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Modifica prestazione</h1>
      </div>

      <form action={salva} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome *</label>
          <input
            type="text"
            name="nome"
            required
            defaultValue={prestazione.nome}
            className={cls}
          />
        </div>

        {/* Prezzo e durata */}
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Prezzo base (€) *</label>
            <input
              type="number"
              name="prezzoBase"
              required
              min="0"
              step="0.01"
              defaultValue={Number(prestazione.prezzoBase).toFixed(2)}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Durata (minuti) *</label>
            <input
              type="number"
              name="durataMinuti"
              required
              min="5"
              step="5"
              defaultValue={prestazione.durataMinuti}
              className={cls}
            />
          </div>
        </div>

        {/* Colore */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="color"
              name="colore"
              defaultValue={prestazione.colore}
              className="h-10 w-14 cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-1"
            />
            <span className="text-xs text-slate-400">
              Colore usato nel calendario per distinguere questa prestazione
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href="/impostazioni/prestazioni"
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
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
