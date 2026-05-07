// Form modifica studio esistente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SelectProvincia from '@/components/ui/SelectProvincia'
import BackButton from '@/components/ui/BackButton'
import TelefonoInput from '@/components/ui/TelefonoInput'

async function aggiornaStudio(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const id = formData.get('studioId') as string
  await prisma.studio.update({
    where: { id },
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
  redirect(`/impostazioni/studi/${id}`)
}

export default async function ModificaStudioPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params
  const studio = await prisma.studio.findUnique({ where: { id } })
  if (!studio) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Modifica studio</h1>
      </div>

      <form action={aggiornaStudio} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Campo nascosto con l'ID dello studio */}
        <input type="hidden" name="studioId" value={id} />

        <Campo label="Nome studio *" name="nome" required defaultValue={studio.nome} />

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Email" name="email" type="email" defaultValue={studio.email ?? ''} />
          <TelefonoInput label="Telefono" name="telefono" defaultValue={studio.telefono ?? ''} />
        </div>

        <Campo label="Indirizzo" name="indirizzo" defaultValue={studio.indirizzo ?? ''} />

        <div className="grid gap-5 md:grid-cols-3">
          <Campo label="Città" name="citta" defaultValue={studio.citta ?? ''} />
          <SelectProvincia defaultValue={studio.provincia ?? ''} />
          <Campo label="Partita IVA" name="partitaIva" defaultValue={studio.partitaIva ?? ''} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href={`/impostazioni/studi/${id}`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function Campo({ label, name, type = 'text', required = false, defaultValue = '', maxLength }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; maxLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} defaultValue={defaultValue}
        maxLength={maxLength} className={cls} />
    </div>
  )
}
