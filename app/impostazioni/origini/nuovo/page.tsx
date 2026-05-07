// Impostazioni › Origini › Nuova origine acquisizione
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import BackButton from '@/components/ui/BackButton'

// ── Server action ─────────────────────────────────────────────────────────────
async function creaOrigine(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true, ruolo: true },
  })

  const nome = (formData.get('nome') as string).trim()
  const studioIdForm = formData.get('studioId') as string | null

  // Valore speciale del select: crea l'origine per tutti gli studi attivi.
  // Lo riconosciamo da SOTTO con la stringa "__TUTTI__" inviata dal form.
  const perTuttiGliStudi = studioIdForm === '__TUTTI__'

  // Lista degli studi su cui inserire l'origine.
  // - Se il form chiede "tutti gli studi" → tutti gli studi attivi
  // - Altrimenti se l'utente ha uno studioId proprio → solo quello
  // - Altrimenti (SUPERADMIN che ha scelto uno studio specifico) → quello scelto
  let studioIds: string[] = []
  if (perTuttiGliStudi) {
    const tutti = await prisma.studio.findMany({
      where:   { attivo: true },
      select:  { id: true },
      orderBy: { nome: 'asc' },
    })
    studioIds = tutti.map(s => s.id)
  } else if (utente?.studioId) {
    studioIds = [utente.studioId]
  } else if (studioIdForm) {
    studioIds = [studioIdForm]
  } else {
    // Fallback: primo studio attivo (non dovrebbe mai accadere con il form corretto)
    const primo = await prisma.studio.findFirst({
      where:   { attivo: true },
      select:  { id: true },
      orderBy: { nome: 'asc' },
    })
    if (primo) studioIds = [primo.id]
  }

  if (studioIds.length === 0) redirect('/impostazioni')

  // Inserisce un record per ogni studio scelto. L'ordine è calcolato per studio
  // perché gli ordini sono indipendenti per ciascuno (vedi schema.prisma).
  for (const sid of studioIds) {
    const [ultima] = await prisma.$queryRaw<{ ordine: number }[]>`
      SELECT ordine FROM "OrigineAcquisizione"
      WHERE "studioId" = ${sid}
      ORDER BY ordine DESC LIMIT 1`
    const nuovoOrdine = (ultima?.ordine ?? -1) + 1
    const id = crypto.randomUUID()

    await prisma.$executeRaw`
      INSERT INTO "OrigineAcquisizione" (id, "studioId", nome, ordine, attivo)
      VALUES (${id}, ${sid}, ${nome}, ${nuovoOrdine}, true)`
  }

  // Invalida la cache della pagina elenco prima del redirect, così la nuova
  // origine appare subito invece di mostrare dati cachati.
  revalidatePath('/impostazioni/origini')
  redirect('/impostazioni/origini')
}

// ── Pagina ────────────────────────────────────────────────────────────────────
export default async function NuovaOriginePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true, ruolo: true },
  })

  // Se l'utente è SUPERADMIN (senza studioId proprio) carichiamo la lista degli
  // studi così può scegliere a quale assegnare la nuova origine.
  const studi = !utente?.studioId
    ? await prisma.studio.findMany({
        where:   { attivo: true },
        select:  { id: true, nome: true },
        orderBy: { nome: 'asc' },
      })
    : []

  const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuova origine</h1>
      </div>

      <form action={creaOrigine} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Selettore studio: visibile solo per SUPERADMIN, che non ha uno studioId proprio.
            La voce "Per tutti gli studi" è sempre presente e preselezionata: crea l'origine
            su ogni studio attivo (la server action gestisce il valore speciale "__TUTTI__"). */}
        {studi.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Studio *</label>
            <select name="studioId" required className={cls} defaultValue="__TUTTI__">
              <option value="__TUTTI__">Per tutti gli studi</option>
              {studi.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Nome *</label>
          <input
            type="text" name="nome" required
            placeholder="Es. Referral medico, Social…"
            className={cls}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/impostazioni/origini"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Crea origine
          </button>
        </div>
      </form>
    </div>
  )
}
