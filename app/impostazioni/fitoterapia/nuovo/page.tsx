// Form creazione nuovo prodotto fitoterapico
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function creaFito(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })
  let studioId = utente?.studioId
  if (!studioId) {
    const primo = await prisma.studio.findFirst({ where: { attivo: true }, select: { id: true }, orderBy: { nome: 'asc' } })
    studioId = primo?.id ?? null
  }
  if (!studioId) redirect('/impostazioni/studio')

  const ultimo = await prisma.prodottoFito.findFirst({
    where: { studioId }, orderBy: { ordine: 'desc' }, select: { ordine: true },
  })

  await prisma.prodottoFito.create({
    data: {
      studioId,
      nome:              formData.get('nome') as string,
      prezzoMese:        Number(formData.get('prezzoMese') || 0),
      durataDefaultMesi: Number(formData.get('durataDefaultMesi') || 1),
      note:              (formData.get('note') as string) || null,
      attivo:            true,
      ordine:            (ultimo?.ordine ?? 0) + 1,
    },
  })

  redirect('/impostazioni/prestazioni')
}

export default async function NuovoFitoPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo prodotto fitoterapico</h1>
      </div>

      <form action={creaFito} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <div>
          <label className="block text-sm font-medium text-slate-700">Nome *</label>
          <input type="text" name="nome" required placeholder="es. Omega 3, Vitamina D…" className={cls} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Durata (mesi)</label>
            <input type="number" name="durataDefaultMesi" min="1" defaultValue="1" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Prezzo/mese (€)</label>
            <input type="number" name="prezzoMese" min="0" step="0.01" defaultValue="0" className={cls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <input type="text" name="note" placeholder="Indicazioni, dosaggio, avvertenze…" className={cls} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/impostazioni/prestazioni"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
