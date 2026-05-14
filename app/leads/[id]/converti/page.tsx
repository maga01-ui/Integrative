// Pagina conversione lead → paziente.
// Mostra il form anagrafica con i dati del lead precompilati.
// I campi obbligatori (data di nascita, codice fiscale, indirizzo…) devono
// essere compilati prima che il lead possa diventare paziente.
//
// Parametro URL opzionale: ?next=calendario
//   → dopo la conversione porta al form "Nuovo appuntamento" anziché alla scheda paziente.
//   Usato dal pulsante "Fissa appuntamento" nella pagina lead.
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOriginiTutteAttive } from '@/lib/origini'
import NuovoPazienteForm from '@/app/pazienti/nuovo/NuovoPazienteForm'
import BackButton from '@/components/ui/BackButton'

// ── Helper: prima lettera maiuscola ───────────────────────────────────────────
function capitalizza(val: string | null | undefined): string | null {
  if (!val) return null
  return val.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Server action: crea il paziente e chiude il lead come CONVERTITO ──────────
// leadId, next e studioIdFallback vengono passati tramite .bind dalla page.
// next = 'calendario' → porta al form appuntamento dopo la conversione
// next = null        → porta alla scheda paziente
// studioIdFallback   → studioId pre-risolto dalla pagina (lead → utente → primo studio disponibile)
async function convertiLead(leadId: string, next: string | null, studioIdFallback: string | null, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true },
  })

  // Ricarica il lead per avere studioId, canale e campagna originali
  const lead = await prisma.lead.findUnique({
    where:  { id: leadId },
    select: { studioId: true, canale: true, campagna: true, convertitoPazienteId: true },
  })
  if (!lead) redirect('/leads')

  // Se il lead è già stato convertito: vai direttamente alla destinazione corretta
  if (lead.convertitoPazienteId) {
    const sid = lead.studioId ?? utente?.studioId ?? studioIdFallback ?? ''
    if (next === 'calendario') {
      redirect(`/calendario/nuovo?pazienteId=${lead.convertitoPazienteId}&studioId=${sid}`)
    }
    redirect(`/pazienti/${lead.convertitoPazienteId}`)
  }

  // Risolvi studioId: prima dal lead, poi dall'utente, poi dal fallback pre-calcolato dalla pagina
  // Il fallback include già il primo studio disponibile nel sistema come ultima risorsa
  const studioId = lead.studioId ?? utente?.studioId ?? studioIdFallback
  if (!studioId) redirect('/impostazioni/studio')

  const tipo = formData.get('tipo') as 'PRIVATO' | 'AZIENDA'

  // Operatore e Team di riferimento: obbligatori in creazione
  const operatoreId = (formData.get('operatoreId') as string) || null
  const teamId      = (formData.get('teamId') as string) || null
  if (!operatoreId) throw new Error('Seleziona un operatore di riferimento.')
  if (!teamId)      throw new Error('Seleziona un team di riferimento.')

  // Crea il paziente con tutti i dati del form (anagrafica completa)
  const paziente = await prisma.paziente.create({
    data: {
      studioId,
      tipo,
      leadId,                                              // collega al lead originale
      operatoreId,                                         // operatore di riferimento
      nome:           capitalizza(formData.get('nome') as string) ?? '',
      cognome:        capitalizza(formData.get('cognome') as string),
      dataNascita:    formData.get('dataNascita')
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
      // Origine: usa quella del form se compilata, altrimenti quella del lead
      canale:         (formData.get('origine') as string) || lead.canale || null,
      campagna:       lead.campagna || null,
      dataDiventaPaziente: new Date(),
    },
  })

  // Salva i campi ancora gestiti con raw SQL (stato nazione, note, sesso, teamId)
  const stato = capitalizza(formData.get('stato') as string) ?? 'Italia'
  const note  = (formData.get('note') as string) || null
  const sesso = (formData.get('sesso') as string) || null
  await prisma.$executeRaw`
    UPDATE "Paziente"
    SET stato = ${stato}, note = ${note}, sesso = ${sesso}, "teamId" = ${teamId}
    WHERE id = ${paziente.id}`

  // Aggiorna il lead: stato → CONVERTITO, collega l'ID del nuovo paziente
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stato:                'CONVERTITO' as never,
      convertitoPazienteId: paziente.id,
    },
  })

  // Reindirizza in base alla destinazione richiesta
  if (next === 'calendario') {
    // Passa anche studioId così il calendario carica i pazienti dello studio giusto
    // e il paziente appena creato risulta già selezionato nel campo ricerca
    redirect(`/calendario/nuovo?pazienteId=${paziente.id}&studioId=${studioId}`)
  }

  redirect(`/pazienti/${paziente.id}`)
}

// ── Pagina ────────────────────────────────────────────────────────────────────
export default async function ConvertiLeadPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id }   = await params
  const { next } = await searchParams

  // Carica il lead con i dati da precompilare nel form
  // studioId incluso per evitare una query separata più avanti
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      cognome: true,
      telefono: true,
      email: true,
      citta: true,
      provincia: true,
      canale: true,
      studioId: true,
      convertitoPazienteId: true,
    },
  })

  if (!lead) notFound()

  // Carica l'utente PRIMA di qualsiasi redirect condizionale:
  // serve lo studioId in tutti i percorsi (già convertito o no)
  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true, ruolo: true },
  })

  // Risolvi lo studioId: lead → utente → primo studio disponibile nel sistema
  // Questa cascata garantisce che utenti SUPERADMIN (senza studioId proprio)
  // o lead creati senza studio assegnato possano comunque procedere
  let studioId = lead.studioId ?? utente?.studioId ?? null
  if (!studioId) {
    const primoStudio = await prisma.studio.findFirst({ select: { id: true } })
    studioId = primoStudio?.id ?? null
  }

  // Se già convertito, vai alla destinazione giusta senza mostrare il form
  if (lead.convertitoPazienteId) {
    if (next === 'calendario') {
      redirect(`/calendario/nuovo?pazienteId=${lead.convertitoPazienteId}&studioId=${studioId ?? ''}`)
    }
    redirect(`/pazienti/${lead.convertitoPazienteId}`)
  }

  // Carica le origini (manuali + referral) per il select nel form.
  // Sono GLOBALI: stessa lista per tutti gli utenti e per tutti gli studi.
  const origini = await getOriginiTutteAttive()

  // Carica operatori e team dello studio per i campi obbligatori del form
  const [operatori, team] = studioId
    ? await Promise.all([
        prisma.utente.findMany({
          where:   { studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
          select:  { id: true, nome: true, cognome: true },
          orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
        }),
        prisma.team.findMany({
          where:   { studioId, attivo: true },
          select:  { id: true, nome: true },
          orderBy: { nome: 'asc' },
        }),
      ])
    : [[], []]
  const operatoriOpts = (operatori as { id: string; nome: string; cognome: string }[])
    .map(o => ({ id: o.id, label: `${o.cognome} ${o.nome}`.trim() }))
  const teamOpts = (team as { id: string; nome: string }[])
    .map(t => ({ id: t.id, label: t.nome }))

  // Lega leadId, next e studioId alla server action tramite .bind
  // studioId viene passato come fallback pre-calcolato (sicuro: risolto lato server)
  const azione = convertiLead.bind(null, lead.id, next ?? null, studioId)

  // Titolo e sottotitolo cambiano in base al percorso
  const titolo   = next === 'calendario' ? 'Anagrafica paziente' : 'Converti in paziente'
  const sottotit = next === 'calendario'
    ? 'Compila i dati richiesti, poi potrai fissare l\'appuntamento.'
    : 'Compila i dati obbligatori per completare la conversione del lead.'
  const btnLabel = next === 'calendario' ? 'Salva e vai al calendario' : 'Converti in paziente'

  return (
    <div className="space-y-6">

      {/* Intestazione */}
      <div className="flex items-center gap-4">
        <BackButton href={`/leads/${lead.id}`} />
        <div>
          <h1 className="text-3xl font-semibold text-slate-600">{titolo}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lead: <strong>{lead.cognome} {lead.nome}</strong>
          </p>
        </div>
      </div>

      {/* Avviso contestuale */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {sottotit} I campi contrassegnati con <strong>*</strong> sono obbligatori.
      </div>

      {/* Form anagrafica — dati lead precompilati, campi obbligatori attivi */}
      <NuovoPazienteForm
        action={azione}
        origini={origini}
        operatori={operatoriOpts}
        team={teamOpts}
        defaultValues={{
          nome:      lead.nome      ?? '',
          cognome:   lead.cognome   ?? '',
          telefono:  lead.telefono  ?? '',
          email:     lead.email     ?? '',
          citta:     lead.citta     ?? '',
          provincia: lead.provincia ?? '',
          origine:   lead.canale    ?? '',
        }}
        submitLabel={btnLabel}
        cancelHref={`/leads/${lead.id}`}
      />

    </div>
  )
}
