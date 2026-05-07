import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getOriginiPerStudio, getOriginiTutteAttive } from '@/lib/origini'
import NuovoPazienteForm from '../../nuovo/NuovoPazienteForm'

function capitalizza(val: string | null | undefined): string | null {
  if (!val) return null
  return val.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

async function updatePaziente(formData: FormData) {
  'use server'
  // L'id è passato come campo nascosto nel form (evita problemi con bind + server actions)
  const id = formData.get('_pazienteId') as string
  if (!id) redirect('/pazienti')

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const tipo = (formData.get('tipo') as string) as 'PRIVATO' | 'AZIENDA'
  await prisma.paziente.update({
    where: { id },
    data: {
      tipo,
      nome: capitalizza(formData.get('nome') as string) ?? '',
      cognome: capitalizza(formData.get('cognome') as string),
      dataNascita: (formData.get('dataNascita') as string) ? new Date(formData.get('dataNascita') as string) : null,
      codiceFiscale: (formData.get('codiceFiscale') as string) || null,
      ragioneSociale: capitalizza(formData.get('ragioneSociale') as string),
      partitaIva: (formData.get('partitaIva') as string) || null,
      pec: (formData.get('pec') as string)?.trim().toLowerCase() || null,
      codiceSDI: (formData.get('codiceSDI') as string) || null,
      referente: capitalizza(formData.get('referente') as string),
      telefono: (formData.get('telefono') as string) || null,
      telefonoWa: (formData.get('telefonoWa') as string) || null,
      email: (formData.get('email') as string)?.trim().toLowerCase() || null,
      indirizzo: capitalizza(formData.get('indirizzo') as string),
      cap: (formData.get('cap') as string) || null,
      citta: capitalizza(formData.get('citta') as string),
      provincia: (formData.get('provincia') as string)?.toUpperCase() || null,
      stato: capitalizza(formData.get('stato') as string) || 'Italia',
      note: (formData.get('note') as string) || null,
      canale: (formData.get('origine') as string) || null,
    },
  })

  // Salva sesso con raw SQL (campo nuovo, non ancora nel client Prisma generato)
  const sesso = (formData.get('sesso') as string) || null
  await prisma.$executeRaw`UPDATE "Paziente" SET sesso = ${sesso} WHERE id = ${id}`

  redirect(`/pazienti/${id}`)
}

export default async function AnagraficaPage({ params }: { params: any }) {
  // In Next.js 15 params è una Promise — await Promise.resolve funziona sia con Promise che con oggetto
  const { id: pazienteId } = await Promise.resolve(params) as { id: string }

  // Verifica autenticazione e carica paziente tramite la stessa utility del layout
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  // Cerca il paziente per id
  const paziente = await prisma.paziente.findUnique({ where: { id: pazienteId } })
  if (!paziente) redirect('/pazienti')
  // Sicurezza: l'utente può modificare solo pazienti del proprio studio
  if (ctx.studioId && paziente.studioId !== ctx.studioId) redirect('/pazienti')

  // Carica le origini attive (manuali + referral) tramite l'helper.
  // Filtra per studio del paziente: in modifica anagrafica vediamo solo le
  // origini coerenti con lo studio in cui il paziente è registrato.
  const origini = paziente.studioId
    ? await getOriginiPerStudio(paziente.studioId)
    : await getOriginiTutteAttive()

  // Legge sesso con raw SQL (campo nuovo non ancora nel client Prisma generato)
  const [sessoRow] = await prisma.$queryRaw<{ sesso: string | null }[]>`
    SELECT sesso FROM "Paziente" WHERE id = ${pazienteId} LIMIT 1`

  const defaultValues = {
    tipo: paziente.tipo,
    nome: paziente.nome ?? '',
    cognome: paziente.cognome ?? '',
    dataNascita: paziente.dataNascita ? paziente.dataNascita.toISOString().slice(0, 10) : '',
    codiceFiscale: paziente.codiceFiscale ?? '',
    ragioneSociale: paziente.ragioneSociale ?? '',
    partitaIva: paziente.partitaIva ?? '',
    codiceSDI: paziente.codiceSDI ?? '',
    pec: paziente.pec ?? '',
    referente: paziente.referente ?? '',
    telefono: paziente.telefono ?? '',
    telefonoWa: paziente.telefonoWa ?? '',
    email: paziente.email ?? '',
    indirizzo: paziente.indirizzo ?? '',
    cap: paziente.cap ?? '',
    citta: paziente.citta ?? '',
    provincia: paziente.provincia ?? '',
    stato: paziente.stato ?? 'Italia',
    origine: paziente.canale ?? '',
    note: paziente.note ?? '',
    sesso: sessoRow?.sesso ?? '',   // M o F
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">Anagrafica paziente</p>
        <p className="text-sm text-slate-500">Aggiorna i dati anagrafici, i contatti e l'origine del paziente.</p>
      </div>

      <NuovoPazienteForm
        action={updatePaziente}
        origini={origini}
        defaultValues={defaultValues}
        submitLabel="Aggiorna paziente"
        pazienteId={pazienteId}
      />
    </div>
  )
}
