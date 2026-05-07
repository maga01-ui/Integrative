// Form creazione nuovo studio
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SelectProvincia from '@/components/ui/SelectProvincia'
import BackButton from '@/components/ui/BackButton'
import TelefonoInput from '@/components/ui/TelefonoInput'

async function creaStudio(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const studio = await prisma.studio.create({
    data: {
      nome:       formData.get('nome') as string,
      indirizzo:  (formData.get('indirizzo') as string) || null,
      citta:      (formData.get('citta') as string) || null,
      provincia:  (formData.get('provincia') as string) || null,
      partitaIva: (formData.get('partitaIva') as string) || null,
      telefono:   (formData.get('telefono') as string) || null,
      email:      (formData.get('email') as string) || null,
    }
  })

  // Crea le prestazioni di default per il nuovo studio
  await prisma.prestazione.createMany({
    data: [
      { studioId: studio.id, nome: 'BIOSCAN',         colore: '#6366f1', prezzoBase: 300, durataMinuti: 60, ordine: 1 },
      { studioId: studio.id, nome: 'LETTURA_REFERTO', colore: '#8b5cf6', prezzoBase: 0,   durataMinuti: 30, ordine: 2 },
      { studioId: studio.id, nome: 'TRATTAMENTO',     colore: '#0ea5e9', prezzoBase: 500, durataMinuti: 60, ordine: 3 },
      { studioId: studio.id, nome: 'FITOTERAPIA',     colore: '#10b981', prezzoBase: 150, durataMinuti: 30, ordine: 4 },
      { studioId: studio.id, nome: 'MANTENIMENTO',    colore: '#f59e0b', prezzoBase: 500, durataMinuti: 60, ordine: 5 },
    ],
  })

  // Se l'utente non ha ancora uno studio principale, lo assegniamo
  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })
  if (!utente?.studioId) {
    await prisma.utente.update({ where: { id: userId }, data: { studioId: studio.id } })
  }

  redirect(`/impostazioni/studi/${studio.id}`)
}

export default async function NuovoStudioPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo studio</h1>
      </div>

      <form action={creaStudio} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Campo label="Nome studio *" name="nome" required />

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Email" name="email" type="email" />
          <TelefonoInput label="Telefono" name="telefono" />
        </div>

        <Campo label="Indirizzo" name="indirizzo" />

        <div className="grid gap-5 md:grid-cols-3">
          <Campo label="Città" name="citta" />
          <SelectProvincia />
          <Campo label="Partita IVA" name="partitaIva" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/impostazioni" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Crea studio
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function Campo({ label, name, type = 'text', required = false, placeholder = '', maxLength }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; maxLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} placeholder={placeholder}
        maxLength={maxLength} className={cls} />
    </div>
  )
}
