// Form aggiunta operatore a un team (con compenso/ora e ruolo)
// Un operatore può appartenere a team di studi diversi — multi-studio
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function aggiungiCollaboratore(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const teamId   = formData.get('teamId') as string
  const studioId = formData.get('studioId') as string
  const utenteId = formData.get('utenteId') as string

  // Creiamo il collaboratore con tutti i flag, incluso isReferral.
  // NOTA: usiamo $executeRaw per isReferral perché il client Prisma generato
  // potrebbe non avere ancora la nuova colonna finché non viene rigenerato.
  const id = crypto.randomUUID()
  const compensoOra    = Number(formData.get('compensoOra'))
  const percentualeRaw = formData.get('percentualeTeam')
  const percentualeTeam = percentualeRaw ? Number(percentualeRaw) : null
  const isManager  = formData.get('isManager')  === 'on'
  const isPrimario = formData.get('isPrimario') === 'on'
  const isReferral = formData.get('isReferral') === 'on'

  await prisma.$executeRaw`
    INSERT INTO "CollaboratoreTeam"
      (id, "teamId", "utenteId", "isManager", "isReferral",
       "compensoOra", "percentualeTeam", "isPrimario", "dataInizio")
    VALUES
      (${id}, ${teamId}, ${utenteId}, ${isManager}, ${isReferral},
       ${compensoOra}, ${percentualeTeam}, ${isPrimario}, CURRENT_TIMESTAMP)`

  redirect(`/impostazioni/studi/${studioId}`)
}

export default async function NuovoCollaboratorePage({
  params
}: {
  params: Promise<{ id: string; teamId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: studioId, teamId } = await params

  const [studio, team] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nome: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { nome: true, collaboratori: { select: { utenteId: true } } } })
  ])
  if (!studio || !team) notFound()

  // ID degli utenti già nel team (per escluderli dal dropdown)
  const giaNelTeam = new Set(team.collaboratori.map(c => c.utenteId))

  // Tutti gli utenti attivi del sistema (multi-studio: non filtriamo per studioId)
  const utenti = await prisma.utente.findMany({
    where: { attivo: true },
    select: { id: true, nome: true, cognome: true, email: true, studioId: true },
    orderBy: [{ cognome: 'asc' }, { nome: 'asc' }]
  })

  // Separa utenti già nel team da quelli disponibili
  const disponibili = utenti.filter(u => !giaNelTeam.has(u.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <a href="/impostazioni" className="text-slate-400 hover:text-slate-700">Impostazioni</a>
        <span className="text-slate-300">/</span>
        <a href={`/impostazioni/studi/${studioId}`} className="text-slate-500 hover:text-slate-900">{studio.nome}</a>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">{team.nome}</span>
      </div>

      <h1 className="text-3xl font-semibold text-slate-600">Aggiungi operatore</h1>
      <p className="text-sm text-slate-500">
        Puoi aggiungere operatori di qualsiasi studio — la stessa persona può far parte di più team.
      </p>

      <form action={aggiungiCollaboratore} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="studioId" value={studioId} />

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Operatore *</label>
            {/* Bottone per creare un nuovo utente/operatore se non è ancora presente nel sistema */}
            <a
              href="/impostazioni/utenti/nuovo"
              className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-brand-hover"
            >
              + Crea nuovo operatore
            </a>
          </div>
          <select name="utenteId" required className={cls}>
            <option value="">Seleziona operatore…</option>
            {disponibili.map(u => (
              <option key={u.id} value={u.id}>
                {u.cognome} {u.nome} — {u.email}
                {u.studioId !== studioId ? ' (altro studio)' : ''}
              </option>
            ))}
          </select>
          {disponibili.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">Tutti gli utenti sono già nel team.</p>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Compenso orario (€) *</label>
            <input type="number" name="compensoOra" step="0.50" min="0" required
              placeholder="es. 35.00" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">% fatturato team</label>
            <input type="number" name="percentualeTeam" step="0.5" min="0" max="100"
              placeholder="Solo per manager (es. 5)" className={cls} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isManager" className="rounded" />
            È manager del team (vede i compensi del team e percepisce la % sul fatturato)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isPrimario" defaultChecked className="rounded" />
            Questo è il team primario dell&apos;operatore
          </label>
          {/* Se spuntato, il nome dell'operatore appare automaticamente nelle
              Origini di acquisizione dello studio: è utile quando l'operatore
              porta nuovi pazienti come "referral". */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isReferral" className="rounded" />
            È un referral (il suo nome compare nelle Origini di acquisizione dello studio)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href={`/impostazioni/studi/${studioId}`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Aggiungi al team
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
