// Calendario: server component — carica i dati della sidebar e passa al componente client
// force-dynamic: disabilita la router cache di Next.js → la pagina rimonta sempre dopo navigazione back
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import CalendarioClient from './CalendarioClient'

export default async function CalendarioPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true, ruolo: true },
  })

  const studioId          = utente?.studioId
  const isSuperAdmin      = utente?.ruolo === 'SUPERADMIN'
  const isMarketing       = utente?.ruolo === 'MARKETING'
  const puoVedereTutti    = isSuperAdmin || isMarketing
  const ws                = studioId ? { studioId } : {}

  // SUPERADMIN e MARKETING possono usare il calendario anche senza studio assegnato.
  // Gli altri ruoli vengono rimandati a impostazioni per farsi assegnare uno studio.
  if (!studioId && !puoVedereTutti) redirect('/impostazioni?avviso=studio_mancante')

  // Studi per il selettore: SUPERADMIN e MARKETING vedono tutti gli studi
  const studi = puoVedereTutti
    ? await prisma.studio.findMany({ where: { attivo: true }, select: { id: true, nome: true, citta: true }, orderBy: { nome: 'asc' } })
    // Sappiamo che studioId esiste qui perché il redirect a inizio funzione
    // ne intercetta l'assenza per i ruoli che non sono SUPERADMIN/MARKETING.
    : await prisma.studio.findMany({ where: { id: studioId!, attivo: true }, select: { id: true, nome: true, citta: true } })

  // studioIdEffettivo: per SUPERADMIN senza studio proprio, usa il primo studio disponibile
  const studioIdEffettivo = studioId ?? studi[0]?.id ?? ''
  const wsEff = studioIdEffettivo ? { studioId: studioIdEffettivo } : {}

  const [saleDb, operatori, prestazioni, tipologieBioscanDB, daProgrammare] = await Promise.all([
    // Tutte le sale dello studio (sia attive sia "eliminate"/disattivate):
    // includiamo anche le disattivate perché vanno mostrate in calendario
    // per le date in cui erano ancora attive. Il client filtra in base
    // alla settimana/giorno visualizzato.
    prisma.sala.findMany({
      where:   { ...wsEff },
      select:  {
        id: true, nome: true, colore: true,
        attiva: true, dataAttivazione: true, dataDisattivazione: true,
      },
      orderBy: { ordine: 'asc' },
    }),
    // Operatori attivi dello studio (escluso SUPERADMIN — non è operativo)
    prisma.utente.findMany({
      where: { studioId: studioIdEffettivo, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    // Prestazioni dalla tabella Prestazione (Fitoterapia, Lettura referto, ecc.)
    prisma.prestazione.findMany({
      where:   { attiva: true },
      select:  { id: true, nome: true, colore: true },
      orderBy: { ordine: 'asc' },
    }),
    // Tipologie Bioscan — mostrate singolarmente nel calendario (Bioscan, Standard, Mantenimento…)
    prisma.tipologiaBioscan.findMany({
      where:   { attiva: true },
      select:  { id: true, tipologia: true },
      orderBy: { ordine: 'asc' },
    }),
    // Leads in attesa di programmazione
    prisma.lead.count({
      where: { ...wsEff, stato: { in: ['FISSATO', 'IN_ATTESA_CENTRO'] as never[] }, convertitoPazienteId: null },
    }),
  ])

  // Mappa le tipologie bioscan nel formato atteso dal componente
  const tipologieBioscan = tipologieBioscanDB.map(t => ({ id: t.id, nome: t.tipologia }))

  // Serializza le date come ISO string per passarle al client component
  // (Next.js richiede props serializzabili — Date non sopravvive al confine).
  const sale = saleDb.map(s => ({
    id:                 s.id,
    nome:               s.nome,
    colore:             s.colore,
    attiva:             s.attiva,
    dataAttivazione:    s.dataAttivazione.toISOString(),
    dataDisattivazione: s.dataDisattivazione ? s.dataDisattivazione.toISOString() : null,
  }))

  return (
    <CalendarioClient
      sale={sale}
      operatori={operatori}
      prestazioni={prestazioni}
      tipologieBioscan={tipologieBioscan}
      studi={studi}
      studioId={studioIdEffettivo}
      daProgrammare={daProgrammare}
    />
  )
}
