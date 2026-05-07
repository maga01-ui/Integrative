// Form creazione nuova prestazione
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function creaPrestazione(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true, ruolo: true } })

  // SUPERADMIN non ha studioId: usa lo studioId dal form, oppure il primo studio disponibile
  let studioId = utente?.studioId
  if (!studioId) {
    const studioIdForm = formData.get('studioId') as string | null
    if (studioIdForm) {
      studioId = studioIdForm
    } else {
      const primo = await prisma.studio.findFirst({ where: { attivo: true }, select: { id: true }, orderBy: { nome: 'asc' } })
      studioId = primo?.id ?? null
    }
  }
  if (!studioId) redirect('/impostazioni/studio')

  // Calcola il prossimo valore di ordine (in fondo alla lista)
  const ultimo = await prisma.prestazione.findFirst({
    where:   { studioId },
    orderBy: { ordine: 'desc' },
    select:  { ordine: true },
  })
  const prossimOrdine = (ultimo?.ordine ?? 0) + 1

  await prisma.prestazione.create({
    data: {
      studioId,
      nome:         formData.get('nome') as string,
      colore:       (formData.get('colore') as string) || '#64748b',
      prezzoBase:   Number(formData.get('prezzoBase') || 0),
      durataMinuti: Number(formData.get('durataMinuti') || 60),
      ordine:       prossimOrdine,
      attiva:       true,
    },
  })

  redirect('/impostazioni/prestazioni')
}

export default async function NuovaPrestazioneaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuova prestazione</h1>
      </div>

      <form action={creaPrestazione} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome *</label>
          <input
            type="text"
            name="nome"
            required
            placeholder="es. BIOSCAN, TRATTAMENTO, VISITA…"
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
              defaultValue="0"
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
              defaultValue="60"
              className={cls}
            />
          </div>
        </div>

        {/* Colore per il calendario */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="color"
              name="colore"
              defaultValue="#6366f1"
              className="h-10 w-14 cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-1"
            />
            <span className="text-xs text-slate-400">
              Usato per distinguere la prestazione nel calendario
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
            Salva prestazione
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
