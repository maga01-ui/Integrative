// Form creazione nuovo appuntamento
// Gestisce: selezione studio, auto-conversione lead → paziente, default BIOSCAN
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TipoAppuntamentoSelect from './TipoAppuntamentoSelect'
import FormStudioWrapper from './FormStudioWrapper'
import PazienteSearch from './PazienteSearch'
import BackButton from '@/components/ui/BackButton'

// ── Server Action ──────────────────────────────────────────────────────────────
async function creaAppuntamento(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const studioId         = formData.get('studioId') as string
  const prestazioneIdRaw = formData.get('prestazioneId') as string
  // Se bioscanId è presente, questo appuntamento è una lettura referto collegata a quel bioscan
  const bioscanId        = (formData.get('bioscanId') as string) || null
  const inizio           = new Date(formData.get('inizio') as string)

  // Riconosce se è una tipologia bioscan (ID prefissato "BIOSCAN:") o un programma
  const programmaPazienteId = (formData.get('programmaPazienteId') as string) || null
  const isBioscan           = prestazioneIdRaw.startsWith('BIOSCAN:')
  const bioscanTipId        = isBioscan ? prestazioneIdRaw.replace('BIOSCAN:', '') : null
  const prestazioneId       = isBioscan ? null : (programmaPazienteId ? null : prestazioneIdRaw)

  // Carica i dati della prestazione (o tipologia bioscan)
  let nomePrestazione = 'N/D'
  let durataMinuti    = 60
  let prezzoBase      = 0

  if (isBioscan && bioscanTipId) {
    const tip = await prisma.tipologiaBioscan.findUnique({
      where:  { id: bioscanTipId },
      select: { tipologia: true, prezzo: true, durataMinuti: true },
    })
    if (tip) {
      nomePrestazione = tip.tipologia
      durataMinuti    = tip.durataMinuti
      prezzoBase      = Number(tip.prezzo ?? 0)
    }
  } else if (programmaPazienteId) {
    const pp = await prisma.programmaPaziente.findUnique({
      where:   { id: programmaPazienteId },
      include: { programma: { select: { nome: true } } },
    })
    if (pp) {
      // Conta le sessioni completate per sapere qual è la prossima
      const sessCompletate = await prisma.appuntamento.count({
        where: { programmaPazienteId, stato: 'COMPLETATO' },
      })
      nomePrestazione = `${pp.programma.nome} — Sessione ${sessCompletate + 1}`
      durataMinuti    = 60
      prezzoBase      = 0
    }
  } else if (prestazioneId) {
    const prest = await prisma.prestazione.findUnique({
      where:  { id: prestazioneId },
      select: { nome: true, prezzoBase: true, durataMinuti: true },
    })
    if (prest) {
      nomePrestazione = prest.nome
      durataMinuti    = prest.durataMinuti
      prezzoBase      = Number(prest.prezzoBase)
    }
  }

  const fine            = new Date(inizio.getTime() + durataMinuti * 60 * 1000)
  const prezzoApplicato = Number(formData.get('prezzoApplicato') || prezzoBase)

  const leadId = formData.get('leadId') as string | null

  // pazienteId: arriva sempre compilato perché il lead viene convertito
  // nella pagina /leads/[id]/converti prima di arrivare qui
  let pazienteId = formData.get('pazienteId') as string

  const medicoId = formData.get('medicoId') as string
  const salaId   = formData.get('salaId')   as string

  // ── Validazione campi obbligatori (evita FK violation con stringa vuota) ──
  if (!pazienteId) throw new Error('Seleziona un paziente prima di salvare l\'appuntamento.')
  if (!medicoId)   throw new Error('Seleziona un operatore prima di salvare l\'appuntamento.')
  if (!salaId)     throw new Error('Seleziona una sala prima di salvare l\'appuntamento.')
  if (!studioId)   throw new Error('Studio non trovato. Ricarica la pagina e riprova.')

  // ── Crea l'appuntamento ────────────────────────────────────────────────────
  const appuntamento = await prisma.appuntamento.create({
    data: {
      studioId,
      pazienteId,
      medicoId,
      salaId,
      ...(prestazioneId       ? { prestazioneId }                         : {}),
      ...(programmaPazienteId ? { programmaPazienteId }                   : {}),
      tipoPrestazione: nomePrestazione,
      inizio,
      fine,
      prezzoBase,
      prezzoApplicato,
      notePrezzo: (formData.get('notePrezzo') as string) || null,
      note:       (formData.get('note') as string) || null,
      teamId:     (formData.get('teamId') as string) || null,
    },
    select: { id: true },
  })

  // ── Se è un bioscan: crea anche il record Bioscan collegato ───────────────
  // La lettura referto NON crea un nuovo bioscan — si collega solo a quello esistente
  if (isBioscan && bioscanTipId && !nomePrestazione.toLowerCase().includes('lettura')) {
    const tipoBioscan = nomePrestazione.toLowerCase().includes('controllo')
      ? 'CONTROLLO' : 'INIZIALE'
    await prisma.bioscan.create({
      data: {
        studioId,
        pazienteId,
        medicoId,
        dataEsecuzione:    inizio,
        tipo:              tipoBioscan as 'INIZIALE' | 'CONTROLLO',
        prezzo:            prezzoBase > 0 ? prezzoBase : undefined,
        refertoConsegnato: false,
        appuntamentoId:    appuntamento.id,
      },
    })
  }

  // ── Se è una lettura referto: collega al bioscan ──────────────────────────────
  // bioscanId presente = fissato via banner "Fissa lettura referto" → collega sempre
  // bioscanId assente  = creato manualmente → collega solo se il nome contiene 'lettura'
  if (bioscanId) {
    // Percorso diretto: bioscanId esplicito dall'URL (banner o link da paziente/bioscan)
    await prisma.bioscan.update({
      where: { id: bioscanId },
      data:  { letturaRefertoId: appuntamento.id },
    })
  } else if (nomePrestazione.toLowerCase().includes('lettura')) {
    // Percorso manuale: collega al bioscan effettuato più recente senza lettura fissata
    const bioscan = await prisma.bioscan.findFirst({
      where:   { pazienteId, letturaRefertoId: null, effettuato: true },
      orderBy: { dataEsecuzione: 'desc' },
    })
    if (bioscan) {
      await prisma.bioscan.update({
        where: { id: bioscan.id },
        data:  { letturaRefertoId: appuntamento.id },
      })
    }
  }

  // ── Se viene da un lead: aggiorna stato → CONVERTITO e collega il paziente ──
  if (leadId) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        stato:                'CONVERTITO' as never,
        convertitoPazienteId: pazienteId,
      },
    })
  }

  redirect('/calendario')
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function NuovoAppuntamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; studioId?: string; pazienteId?: string; bioscanId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where: { id: userId },
    select: { studioId: true, ruolo: true },
  })

  const { leadId, studioId: studioIdParam, pazienteId: pazienteIdParam, bioscanId } = await searchParams

  // ── Carica il lead se si arriva da uno ────────────────────────────────────
  const lead = leadId
    ? await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, nome: true, cognome: true, convertitoPazienteId: true, studioId: true, servizioInteresse: true },
      })
    : null

  // Se il lead non è ancora stato convertito in paziente, manda prima all'anagrafica.
  // In questo modo i dati obbligatori vengono sempre raccolti prima dell'appuntamento.
  if (lead && !lead.convertitoPazienteId) {
    redirect(`/leads/${lead.id}/converti?next=calendario`)
  }

  // ── Determina lo studio: URL param > studio del lead > studio dell'utente > primo studio (SUPERADMIN) ─
  const isSuperAdmin = utente?.ruolo === 'SUPERADMIN'
  let selectedStudioId = studioIdParam ?? lead?.studioId ?? utente?.studioId ?? null
  if (!selectedStudioId && isSuperAdmin) {
    // SUPERADMIN non ha studioId: usa il primo studio disponibile come default
    const primoStudio = await prisma.studio.findFirst({ where: { attivo: true }, select: { id: true }, orderBy: { nome: 'asc' } })
    selectedStudioId = primoStudio?.id ?? null
  }
  if (!selectedStudioId) redirect('/impostazioni/studio')

  // ── Studi per il selettore (tutti per ADMIN/SUPERADMIN, solo il proprio altrimenti) ──
  const mostraTuttiStudi = utente?.ruolo === 'SUPERADMIN' || utente?.ruolo === 'ADMIN'
  const studi = mostraTuttiStudi
    ? await prisma.studio.findMany({
        where:   { attivo: true },
        select:  { id: true, nome: true, citta: true },
        orderBy: { nome: 'asc' },
      })
    : await prisma.studio.findMany({
        where:  { id: selectedStudioId, attivo: true },
        select: { id: true, nome: true, citta: true },
      })

  // ── Carica dropdown filtrati per lo studio selezionato ────────────────────
  const [pazienti, medici, sale, team, prestazioni, tipologieBioscan] = await Promise.all([
    prisma.paziente.findMany({
      where:   { studioId: selectedStudioId, attivo: true },
      select:  { id: true, nome: true, cognome: true },
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
    }),
    prisma.utente.findMany({
      where: { studioId: selectedStudioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    prisma.sala.findMany({
      where:   { studioId: selectedStudioId, attiva: true },
      select:  { id: true, nome: true },
      orderBy: { ordine: 'asc' },
    }),
    prisma.team.findMany({
      where:   { studioId: selectedStudioId, attivo: true },
      select:  {
        id: true,
        nome: true,
        // Collaboratori attivi del team (per filtrare gli operatori)
        collaboratori: {
          where:  { dataFine: null },
          select: { utenteId: true },
        },
      },
      orderBy: { nome: 'asc' },
    }),
    // Prestazioni condivise tra tutti i centri — nessun filtro per studio
    prisma.prestazione.findMany({
      where:   { attiva: true },
      select:  { id: true, nome: true, prezzoBase: true, durataMinuti: true },
      orderBy: { ordine: 'asc' },
    }),
    // Tipologie bioscan (globali)
    prisma.tipologiaBioscan.findMany({
      where:   { attiva: true },
      select:  { id: true, tipologia: true, prezzo: true, durataMinuti: true },
      orderBy: { ordine: 'asc' },
    }),
  ])

  // Se il lead è già stato convertito in paziente, caricalo anche se non è nella lista dello studio
  const pazienteDelLead = lead?.convertitoPazienteId
    ? await prisma.paziente.findUnique({
        where:  { id: lead.convertitoPazienteId },
        select: { id: true, nome: true, cognome: true },
      })
    : null

  // Se arriva ?pazienteId=xxx (es. dopo conversione lead), assicura che il paziente
  // sia in lista anche se lo studio selezionato non coincide con quello del paziente
  const pazienteDaUrl = pazienteIdParam && !pazienti.some(p => p.id === pazienteIdParam)
    ? await prisma.paziente.findUnique({
        where:  { id: pazienteIdParam },
        select: { id: true, nome: true, cognome: true },
      })
    : null

  // Merge: porta in cima i pazienti "fuori lista" perché siano trovati dal defaultId
  const pazientiConLead = [
    ...(pazienteDelLead && !pazienti.some(p => p.id === pazienteDelLead.id) ? [pazienteDelLead] : []),
    ...(pazienteDaUrl ? [pazienteDaUrl] : []),
    ...pazienti,
  ]

  // Le tipologie bioscan hanno ID prefissato "BIOSCAN:" per distinguerle dalla Prestazione
  const prestazioniMerged = [
    ...tipologieBioscan.map(t => ({
      id:           `BIOSCAN:${t.id}`,
      nome:         t.tipologia.toLowerCase().includes('bioscan') ? t.tipologia : `Bioscan — ${t.tipologia}`,
      prezzoBase:   Number(t.prezzo ?? 0),
      durataMinuti: t.durataMinuti,
    })),
    ...prestazioni.map(p => ({
      id:           p.id,
      nome:         p.nome,
      prezzoBase:   Number(p.prezzoBase),
      durataMinuti: p.durataMinuti,
    })),
  ]

  // Trova la tipologia bioscan "Lettura Referto" (usata quando si arriva da un bioscan tramite URL)
  const tipologiaLettura = tipologieBioscan.find(
    t => t.tipologia.toLowerCase().includes('lettura')
  )

  // Default prestazioneId: lettura referto (BIOSCAN) se da bioscan, bioscan se il lead vuole bioscan, altrimenti vuoto
  const defaultPrestazioneId = bioscanId
    ? (tipologiaLettura ? `BIOSCAN:${tipologiaLettura.id}` : '')
    : lead?.servizioInteresse === 'BIOSCAN'
    ? (tipologieBioscan[0] ? `BIOSCAN:${tipologieBioscan[0].id}` : prestazioniMerged[0]?.id ?? '')
    : (lead ? prestazioniMerged[0]?.id ?? '' : '')

  // Il lead arriva qui solo se già convertito in paziente (altrimenti c'è il redirect sopra).
  // leadNomeLabel non serve più: il paziente viene sempre selezionato tramite PazienteSearch.

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton href="/calendario" />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo appuntamento</h1>
      </div>

      {sale.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Attenzione: nessuna sala configurata per questo studio.{' '}
          <a href="/impostazioni/sale/nuovo" className="font-semibold underline">Crea una sala</a> prima di procedere.
        </div>
      )}

      {prestazioni.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Attenzione: nessuna prestazione configurata per questo studio.{' '}
          <a href="/impostazioni/prestazioni/nuovo" className="font-semibold underline">Aggiungi una prestazione</a> prima di procedere.
        </div>
      )}

      <form action={creaAppuntamento} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {lead     && <input type="hidden" name="leadId"   value={lead.id} />}
        {bioscanId && <input type="hidden" name="bioscanId" value={bioscanId} />}

        {/* Banner informativo lettura referto */}
        {bioscanId && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            Stai fissando la <strong>lettura referto</strong> per questo bioscan.
            <span className="block mt-1 text-xs text-teal-600">La lettura è gratuita — nessuna ricevuta verrà emessa.</span>
          </div>
        )}

        {/* Banner informativo se arriva da un lead già convertito */}
        {lead && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Stai fissando un appuntamento per{' '}
            <strong>{lead.cognome} {lead.nome}</strong>.
          </div>
        )}

        {/* Paziente: ricerca tra i pazienti esistenti */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Paziente *</label>
          <PazienteSearch
            pazienti={pazientiConLead}
            defaultId={lead?.convertitoPazienteId ?? pazienteIdParam ?? ''}
          />
          {pazienti.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              <a href="/pazienti/nuovo" className="underline">Aggiungi un paziente</a> prima di procedere.
            </p>
          )}
        </div>

        {/* Tipo appuntamento: Bioscan | Programma | Prestazione */}
        <TipoAppuntamentoSelect
          tipologieBioscan={tipologieBioscan.map(t => ({
            id: t.id, tipologia: t.tipologia,
            prezzo: Number(t.prezzo ?? 0), durataMinuti: t.durataMinuti,
          }))}
          prestazioni={prestazioni.map(p => ({
            id: p.id, nome: p.nome,
            prezzoBase: Number(p.prezzoBase), durataMinuti: p.durataMinuti,
          }))}
          defaultPrestazioneId={defaultPrestazioneId}
          pazienteIdIniziale={lead?.convertitoPazienteId ?? pazienteIdParam ?? ''}
        />

        {/* Studio + Team + Data/ora + Operatore + Sala (wrapper gestisce cambio studio live) */}
        <FormStudioWrapper
          studi={studi}
          studioIdIniziale={selectedStudioId}
          mostraSelect={mostraTuttiStudi && studi.length > 1}
          team={team.map(t => ({ id: t.id, nome: t.nome, collaboratori: t.collaboratori }))}
          operatori={medici}
          sale={sale}
          pazienteIdIniziale={lead?.convertitoPazienteId ?? pazienteIdParam ?? ''}
        />

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="note" rows={2} className={inputCls} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/calendario" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva appuntamento
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls  = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
const selectCls = inputCls
