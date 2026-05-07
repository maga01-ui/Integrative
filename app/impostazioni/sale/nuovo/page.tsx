// Form creazione nuova sala (necessaria per gli appuntamenti)
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function creaSala(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })
  if (!utente?.studioId) redirect('/impostazioni/studio')

  await prisma.sala.create({
    data: {
      studioId: utente.studioId,
      nome:     formData.get('nome') as string,
      colore:   (formData.get('colore') as string) || '#78DCBE',
    }
  })
  redirect('/impostazioni')
}

export default async function NuovaSalaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuova sala</h1>
      </div>

      <form action={creaSala} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome sala *</label>
          <input type="text" name="nome" required placeholder="es. Sala 1"
            className={cls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input type="color" name="colore" defaultValue="#78DCBE"
              className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300" />
            <span className="text-xs text-slate-400">Colore usato nel calendario</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/impostazioni" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Crea sala
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
