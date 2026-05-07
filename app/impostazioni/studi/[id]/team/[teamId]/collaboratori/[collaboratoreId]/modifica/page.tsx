// Modifica ruolo e compenso di un collaboratore nel team
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function salvaCollaboratore(
  studioId: string,
  collaboratoreId: string,
  formData: FormData,
) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const compensoOra    = Number(formData.get('compensoOra'))
  const percentualeRaw = formData.get('percentualeTeam')
  const percentualeTeam = percentualeRaw ? Number(percentualeRaw) : null
  const isManager  = formData.get('isManager')  === 'on'
  const isPrimario = formData.get('isPrimario') === 'on'
  const isReferral = formData.get('isReferral') === 'on'

  // Aggiorniamo via raw SQL perché isReferral è una colonna nuova e il client
  // Prisma generato potrebbe non averla ancora finché non viene rigenerato.
  await prisma.$executeRaw`
    UPDATE "CollaboratoreTeam"
       SET "compensoOra"     = ${compensoOra},
           "percentualeTeam" = ${percentualeTeam},
           "isManager"       = ${isManager},
           "isPrimario"      = ${isPrimario},
           "isReferral"      = ${isReferral}
     WHERE id = ${collaboratoreId}`

  redirect(`/impostazioni/studi/${studioId}`)
}

export default async function ModificaCollaboratorePage({
  params,
}: {
  params: Promise<{ id: string; teamId: string; collaboratoreId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: studioId, teamId, collaboratoreId } = await params

  const [studio, team, collaboratore] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nome: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { nome: true } }),
    prisma.collaboratoreTeam.findUnique({
      where: { id: collaboratoreId },
      include: { utente: { select: { nome: true, cognome: true, email: true } } },
    }),
  ])
  if (!studio || !team || !collaboratore) notFound()

  // Leggiamo isReferral con raw SQL (campo nuovo non ancora nel client Prisma generato).
  const [refRow] = await prisma.$queryRaw<{ isReferral: boolean }[]>`
    SELECT "isReferral" FROM "CollaboratoreTeam" WHERE id = ${collaboratoreId}`
  const isReferralAttuale = refRow?.isReferral ?? false

  const salva = salvaCollaboratore.bind(null, studioId, collaboratoreId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <a href="/impostazioni" className="text-slate-400 hover:text-slate-700">Impostazioni</a>
        <span className="text-slate-300">/</span>
        <a href={`/impostazioni/studi/${studioId}`} className="text-slate-500 hover:text-slate-900">{studio.nome}</a>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">{team.nome}</span>
      </div>

      <div>
        <h1 className="text-3xl font-semibold text-slate-600">
          {collaboratore.utente.nome} {collaboratore.utente.cognome}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{collaboratore.utente.email}</p>
      </div>

      <form action={salva} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ruolo nel team — {team.nome}
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Compenso orario (€) *</label>
            <input
              type="number"
              name="compensoOra"
              step="0.50"
              min="0"
              required
              defaultValue={Number(collaboratore.compensoOra)}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">% fatturato team</label>
            <input
              type="number"
              name="percentualeTeam"
              step="0.5"
              min="0"
              max="100"
              placeholder="Solo per manager (es. 5)"
              defaultValue={collaboratore.percentualeTeam ? Number(collaboratore.percentualeTeam) : ''}
              className={cls}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isManager"
              defaultChecked={collaboratore.isManager}
              className="rounded"
            />
            È manager del team (vede i compensi e percepisce la % sul fatturato)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isPrimario"
              defaultChecked={collaboratore.isPrimario}
              className="rounded"
            />
            Questo è il team primario dell&apos;operatore
          </label>
          {/* Se spuntato, il nome dell'operatore appare automaticamente nelle
              Origini di acquisizione dello studio. */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isReferral"
              defaultChecked={isReferralAttuale}
              className="rounded"
            />
            È un referral (il suo nome compare nelle Origini di acquisizione dello studio)
          </label>
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
