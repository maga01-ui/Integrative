// Form creazione/modifica studio e associazione all'utente corrente
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SelectProvincia from '@/components/ui/SelectProvincia'
import BackButton from '@/components/ui/BackButton'
import TelefonoInput from '@/components/ui/TelefonoInput'

async function salvaStudio(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })

  const data = {
    nome:       formData.get('nome') as string,
    indirizzo:  (formData.get('indirizzo') as string) || null,
    citta:      (formData.get('citta') as string) || null,
    provincia:  (formData.get('provincia') as string) || null,
    partitaIva: (formData.get('partitaIva') as string) || null,
    telefono:   (formData.get('telefono') as string) || null,
    email:      (formData.get('email') as string) || null,
  }

  let studioId = utente?.studioId

  if (studioId) {
    // Aggiorna studio esistente
    await prisma.studio.update({ where: { id: studioId }, data })
  } else {
    // Crea nuovo studio e associa l'utente
    const studio = await prisma.studio.create({ data })
    studioId = studio.id
    await prisma.utente.update({ where: { id: userId }, data: { studioId } })
  }

  redirect('/impostazioni')
}

export default async function StudioPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })

  // Carica studio esistente (se presente)
  const studio = utente?.studioId
    ? await prisma.studio.findUnique({ where: { id: utente.studioId } })
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">
          {studio ? 'Modifica studio' : 'Crea studio'}
        </h1>
      </div>

      <form action={salvaStudio} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <Campo label="Nome studio *" name="nome" required defaultValue={studio?.nome} />

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Email" name="email" type="email" defaultValue={studio?.email ?? ''} />
          <TelefonoInput label="Telefono" name="telefono" defaultValue={studio?.telefono ?? ''} />
        </div>

        <Campo label="Indirizzo" name="indirizzo" defaultValue={studio?.indirizzo ?? ''} />

        <div className="grid gap-5 md:grid-cols-3">
          <Campo label="Città" name="citta" defaultValue={studio?.citta ?? ''} />
          <SelectProvincia defaultValue={studio?.provincia ?? ''} />
          <Campo label="Partita IVA" name="partitaIva" defaultValue={studio?.partitaIva ?? ''} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/impostazioni" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            {studio ? 'Aggiorna' : 'Crea studio'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function Campo({ label, name, type = 'text', required = false, defaultValue = '', maxLength, placeholder }: {
  label: string; name: string; type?: string; required?: boolean
  defaultValue?: string; maxLength?: number; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} defaultValue={defaultValue}
        maxLength={maxLength} placeholder={placeholder} className={inputCls} />
    </div>
  )
}
