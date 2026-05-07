// Modifica nome del team
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function salvaTeam(studioId: string, teamId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.team.update({
    where: { id: teamId },
    data:  { nome: (formData.get('nome') as string).trim() },
  })
  redirect(`/impostazioni/studi/${studioId}`)
}

export default async function ModificaTeamPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: studioId, teamId } = await params

  const [studio, team] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nome: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { nome: true } }),
  ])
  if (!studio || !team) notFound()

  const salva = salvaTeam.bind(null, studioId, teamId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <a href="/impostazioni" className="text-slate-400 hover:text-slate-700">Impostazioni</a>
        <span className="text-slate-300">/</span>
        <a href={`/impostazioni/studi/${studioId}`} className="text-slate-500 hover:text-slate-900">{studio.nome}</a>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">Modifica team</span>
      </div>

      <h1 className="text-3xl font-semibold text-slate-600">Modifica team</h1>

      <form action={salva} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome team *</label>
          <input
            type="text"
            name="nome"
            required
            defaultValue={team.nome}
            className={cls}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href={`/impostazioni/studi/${studioId}`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Salva
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
