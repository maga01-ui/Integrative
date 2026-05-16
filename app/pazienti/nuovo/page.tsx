// Pagina creazione nuovo paziente — server component.
// La server action salva i dati; il form (client component) gestisce i required condizionali.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOriginiTutteAttive } from '@/lib/origini'
import NuovoPazienteForm from './NuovoPazienteForm'
import BackButton from '@/components/ui/BackButton'

// ── Helper: prima lettera maiuscola, resto minuscolo ──────────────────────────
function capitalizza(val: string | null | undefined): string | null {
  if (!val) return null
  return val.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Server action: salva il nuovo paziente nel DB ─────────────────────────────
async function creaPaziente(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })
  if (!utente) redirect('/login')

  // studioId: di norma viene dal profilo dell'utente loggato. Per i ruoli
  // cross-studio (SUPERADMIN, MARKETING) l'utente NON ha uno studioId,
  // quindi lo scegliamo dal form (campo "studioId" mostrato dinamicamente).
  const studioId = utente.studioId ?? ((formData.get('studioId') as string) || null)
  if (!studioId) throw new Error('Seleziona lo studio di riferimento.')

  const tipo = formData.get('tipo') as 'PRIVATO' | 'AZIENDA'

  // Operatore di riferimento e Team: obbligatori in creazione
  const operatoreId = (formData.get('operatoreId') as string) || null
  const teamId      = (formData.get('teamId') as string) || null
  if (!operatoreId) throw new Error('Seleziona un operatore di riferimento.')
  if (!teamId)      throw new Error('Seleziona un team di riferimento.')

  // Crea il paziente con i campi già noti al client Prisma
  // (stato e note sono campi nuovi — li aggiorniamo sotto con raw SQL)
  const paziente = await prisma.paziente.create({
    data: {
      studioId,
      tipo,
      nome:           capitalizza(formData.get('nome') as string) ?? '',
      cognome:        capitalizza(formData.get('cognome') as string),
      dataNascita:    (formData.get('dataNascita') as string)
                        ? new Date(formData.get('dataNascita') as string)
                        : null,
      codiceFiscale:  (formData.get('codiceFiscale') as string) || null,
      ragioneSociale: capitalizza(formData.get('ragioneSociale') as string),
      partitaIva:     (formData.get('partitaIva') as string) || null,
      pec:            (formData.get('pec') as string)?.trim().toLowerCase() || null,
      codiceSDI:      (formData.get('codiceSDI') as string) || null,
      referente:      capitalizza(formData.get('referente') as string),
      telefono:       (formData.get('telefono') as string) || null,
      email:          (formData.get('email') as string)?.trim().toLowerCase() || null,
      indirizzo:      capitalizza(formData.get('indirizzo') as string),
      cap:            (formData.get('cap') as string) || null,
      citta:          capitalizza(formData.get('citta') as string),
      provincia:      (formData.get('provincia') as string)?.toUpperCase() || null,
      canale:         (formData.get('origine') as string) || null,
      operatoreId,
      dataDiventaPaziente: new Date(),
    },
  })

  // Aggiorna i campi nuovi (stato, note, sesso, teamId) con raw SQL —
  // verranno gestiti normalmente dall'ORM dopo il prossimo riavvio del server
  const stato = capitalizza(formData.get('stato') as string) ?? 'Italia'
  const note  = (formData.get('note')  as string) || null
  const sesso = (formData.get('sesso') as string) || null  // M o F
  await prisma.$executeRaw`
    UPDATE "Paziente"
       SET stato = ${stato}, note = ${note}, sesso = ${sesso}, "teamId" = ${teamId}
     WHERE id = ${paziente.id}`

  // Dopo il salvataggio porta alla scheda del paziente appena creato
  redirect(`/pazienti/${paziente.id}`)
}

// ── Pagina ────────────────────────────────────────────────────────────────────
export default async function NuovoPazientePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utenteCorrente = await prisma.utente.findUnique({
    where: { id: userId },
    select: { studioId: true },
  })
  if (!utenteCorrente) redirect('/login')

  // L'utente loggato potrebbe NON avere uno studio fisso assegnato:
  // accade per i ruoli cross-studio (SUPERADMIN e MARKETING). In quel caso
  // dobbiamo farglielo scegliere dal form, e mostrare di conseguenza solo
  // gli operatori/team dello studio scelto.
  const senzaStudio = !utenteCorrente.studioId

  // Carica le origini attive (manuali + referral) tramite l'helper.
  // Sono GLOBALI: stessa lista per tutti gli utenti e per tutti gli studi.
  const origini = await getOriginiTutteAttive()

  // ── Studi disponibili (solo se l'utente è cross-studio) ──────────────────
  // Per chi ha uno studioId fisso non mostriamo nessuna lista studi: il form
  // userà direttamente lo studio dell'utente.
  const studi = senzaStudio
    ? await prisma.studio.findMany({
        where:   { attivo: true },
        select:  { id: true, nome: true },
        orderBy: { nome: 'asc' },
      })
    : []

  // ── Operatori e Team ─────────────────────────────────────────────────────
  // Se l'utente ha uno studio fisso → carichiamo SOLO operatori/team di
  // quello studio. Se è cross-studio → carichiamo TUTTO, taggando ognuno
  // con il proprio studioId: il form (lato client) li filtrerà in base allo
  // studio scelto nella tendina.
  const filtroOperatori = senzaStudio
    ? { attivo: true, ruolo: { not: 'SUPERADMIN' as const }, studioId: { not: null } }
    : { attivo: true, ruolo: { not: 'SUPERADMIN' as const }, studioId: utenteCorrente.studioId! }

  const filtroTeam = senzaStudio
    ? { attivo: true }
    : { attivo: true, studioId: utenteCorrente.studioId! }

  const [operatori, team] = await Promise.all([
    prisma.utente.findMany({
      where:   filtroOperatori,
      select:  { id: true, nome: true, cognome: true, studioId: true },
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
    }),
    prisma.team.findMany({
      where:   filtroTeam,
      select:  { id: true, nome: true, studioId: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const operatoriOpts = operatori.map(o => ({
    id: o.id,
    label: `${o.cognome ?? ''} ${o.nome}`.trim(),
    // Lo studioId serve al form per filtrare quando l'utente è cross-studio.
    // Per gli utenti normali è comunque sempre lo stesso valore.
    studioId: o.studioId!,
  }))
  const teamOpts = team.map(t => ({ id: t.id, label: t.nome, studioId: t.studioId }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo paziente</h1>
      </div>

      {/* Il form è un client component per gestire i required condizionali.
          Passiamo "studi" solo se l'utente è cross-studio: in quel caso il
          form mostrerà la tendina "Studio" e filtrerà operatori/team. */}
      <NuovoPazienteForm
        action={creaPaziente}
        origini={origini}
        operatori={operatoriOpts}
        team={teamOpts}
        studi={senzaStudio ? studi : undefined}
      />
    </div>
  )
}
