// Creazione nuovo Bioscan per un paziente
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPatientOrRedirect } from '../../patientUtilsFinal'
import BackButton from '@/components/ui/BackButton'
import NuovoBioscanForm from './NuovoBioscanForm'

async function creaBioscan(pazienteId: string, studioId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const medicoId        = formData.get('medicoId') as string
  const salaId          = formData.get('salaId') as string
  const dataStr         = formData.get('inizio') as string   // viene dal DatePickerCalendario
  const raccomandazioni = (formData.get('raccomandazioni') as string) || null
  const prezzoStr       = formData.get('prezzo') as string | null
  const prezzo          = prezzoStr ? Number(prezzoStr) : null
  const tipologiaId     = (formData.get('tipologiaId') as string) || null

  if (!medicoId || !salaId || !dataStr) return

  // Ricava il tipo e durata dalla tipologia selezionata
  let tipo: 'INIZIALE' | 'CONTROLLO' = 'INIZIALE'
  let nomeTipologia = 'Bioscan'
  let durataMinuti  = 60
  if (tipologiaId) {
    const tipologia = await prisma.tipologiaBioscan.findUnique({
      where:  { id: tipologiaId },
      select: { tipologia: true, durataMinuti: true },
    })
    if (tipologia) {
      nomeTipologia = tipologia.tipologia
      durataMinuti  = tipologia.durataMinuti
      if (tipologia.tipologia.toLowerCase().includes('controllo')) tipo = 'CONTROLLO'
    }
  }

  const inizio = new Date(dataStr)
  const fine   = new Date(inizio.getTime() + durataMinuti * 60 * 1000)
  const prezzoDecimal = prezzo ?? 0

  // Transazione: se uno dei due fallisce, entrambi vengono annullati
  await prisma.$transaction(async (tx) => {
    const appuntamento = await tx.appuntamento.create({
      data: {
        studioId,
        pazienteId,
        medicoId,
        salaId,
        tipoPrestazione: nomeTipologia,
        inizio,
        fine,
        prezzoBase:      prezzoDecimal,
        prezzoApplicato: prezzoDecimal,
      },
      select: { id: true },
    })

    await tx.bioscan.create({
      data: {
        studioId,
        pazienteId,
        medicoId,
        dataEsecuzione:    inizio,
        tipo,
        raccomandazioni,
        prezzo:            prezzo !== null ? prezzo : undefined,
        refertoConsegnato: false,
        appuntamentoId:    appuntamento.id,
      },
    })
  })

  revalidatePath(`/pazienti/${pazienteId}/bioscan`)
  redirect(`/pazienti/${pazienteId}/bioscan`)
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default async function NuovoBioscanPage({ params }: { params: any }) {
  const { id } = await Promise.resolve(params) as { id: string }
  const paziente  = await getPatientOrRedirect(id)
  const studioId  = (paziente as any).studioId as string

  const [operatori, tipologie, bioscanEsistenti, sale, team] = await Promise.all([
    prisma.utente.findMany({
      where:   { studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    // Le tipologie bioscan sono condivise tra tutti gli studi
    prisma.tipologiaBioscan.findMany({
      where:   { attiva: true },
      orderBy: { ordine: 'asc' },
      select:  { id: true, tipologia: true, prezzo: true, durataMinuti: true },
    }),
    prisma.bioscan.count({ where: { pazienteId: id } }),
    prisma.sala.findMany({
      where:   { studioId, attiva: true },
      select:  { id: true, nome: true },
      orderBy: { ordine: 'asc' },
    }),
    // Team attivi dello studio (per filtrare gli operatori)
    prisma.team.findMany({
      where:   { studioId, attivo: true },
      select:  {
        id: true,
        nome: true,
        collaboratori: {
          where:  { dataFine: null },
          select: { utenteId: true },
        },
      },
      orderBy: { nome: 'asc' },
    }),
  ])

  // Prima tipologia se non ha mai fatto un bioscan, seconda se ne ha già uno
  const tipologiaDefault = bioscanEsistenti === 0
    ? tipologie[0]?.id ?? ''
    : tipologie[1]?.id ?? tipologie[0]?.id ?? ''

  const action = creaBioscan.bind(null, id, studioId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo Bioscan</h1>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <NuovoBioscanForm
          action={action}
          tipologie={tipologie.map(t => ({ ...t, prezzo: t.prezzo.toString() }))}
          operatori={operatori}
          tipologiaDefaultId={tipologiaDefault}
          sale={sale}
          studioId={studioId}
          team={team}
        />
      </div>
    </div>
  )
}
