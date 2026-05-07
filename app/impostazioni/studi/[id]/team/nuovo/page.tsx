// Form creazione nuovo team nello studio
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function creaTeam(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const studioId = formData.get('studioId') as string
  await prisma.team.create({
    data: {
      studioId,
      nome: formData.get('nome') as string,
    }
  })
  redirect(`/impostazioni/studi/${studioId}`)
}

export default async function NuovoTeamPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params
  const studio = await prisma.studio.findUnique({ where: { id }, select: { nome: true } })
  if (!studio) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo team</h1>
      </div>

      <form action={creaTeam} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <input type="hidden" name="studioId" value={id} />

        <div>
          <label className="block text-sm font-medium text-slate-700">Nome team *</label>
          <input type="text" name="nome" required placeholder="es. Team Alfa"
            className={cls} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href={`/impostazioni/studi/${id}`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Crea team
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
