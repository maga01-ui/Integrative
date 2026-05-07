// Nuovo appuntamento — aperto dall'interno della scheda paziente.
// Rimane nel layout paziente (menu laterale visibile).
// Il paziente è già noto dall'URL e non è modificabile.
// Dopo il salvataggio reindirizza all'agenda del paziente.

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPatientOrRedirect } from '../../patientUtilsFinal'
import TipoAppuntamentoSelect from '@/app/calendario/nuovo/TipoAppuntamentoSelect'
import FormStudioWrapper from '@/app/calendario/nuovo/FormStudioWrapper'
import BackButton from '@/components/ui/BackButton'

// ── Server Action ──────────────────────────────────────────────────────────────
async function creaAppuntamentoPaziente(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const studioId         = formData.get('studioId') as string
  const prestazioneIdRaw = formData.get('prestazioneId') as string
  const bioscanId        = (formData.get('bioscanId') as string) || null
  const inizio           = new Date(formData.get('inizio') as string)

  const programmaPazienteId = (formData.get('programmaPazienteId') as string) || null
  const isBioscan           = prestazioneIdRaw.startsWith('BIOSCAN:')
  const bioscanTipId        = isBioscan ? prestazioneIdRaw.replace('BIOSCAN:', '') : null
  const prestazioneId       = isBioscan ? null : (programmaPazienteId ? null : prestazioneIdRaw)

  // Carica durata e prezzo in base al tipo selezionato
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
      const sessCompletate = await prisma.appuntamento.count({
        where: { programmaPazienteId, stato: 'COMPLETATO' },
      })
      nomePrestazione = `${pp.programma.nome} — Sessione ${sessCompletate + 1}`
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
  const pazienteId      = formData.get('pazienteId') as string
  const medicoId        = formData.get('medicoId') as string
  const salaId          = formData.get('salaId')   as string

  // Crea l'appuntamento
  const appuntamento = await prisma.appuntamento.create({
    data: {
      studioId,
      pazienteId,
      medicoId,
      salaId,
      ...(prestazioneId       ? { prestazioneId }       : {}),
      ...(programmaPazienteId ? { programmaPazienteId } : {}),
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

  // Se bioscan: crea il record Bioscan collegato (solo se non è lettura referto)
  if (isBioscan && bioscanTipId && !nomePrestazione.toLowerCase().includes('lettura')) {
    const tipoBioscan = nomePrestazione.toLowerCase().includes('controllo') ? 'CONTROLLO' : 'INIZIALE'
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

  // Se è lettura referto: collega al bioscan esistente
  if (bioscanId) {
    await prisma.bioscan.update({
      where: { id: bioscanId },
      data:  { letturaRefertoId: appuntamento.id },
    })
  } else if (nomePrestazione.toLowerCase().includes('lettura')) {
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

  // Torna all'agenda del paziente (non al calendario globale)
  redirect(`/pazienti/${pazienteId}/agenda`)
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function NuovoAppuntamentoPazientePage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ bioscanId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id }      = await params
  const { bioscanId } = await searchParams

  // Carica i dati del paziente (reindirizza se non trovato)
  const paziente = await getPatientOrRedirect(id)

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where: { id: userId },
    select: { studioId: true, ruolo: true },
  })

  // Determina lo studio: quello del paziente è la scelta naturale
  const isSuperAdmin      = utente?.ruolo === 'SUPERADMIN'
  const mostraTuttiStudi  = utente?.ruolo === 'SUPERADMIN' || utente?.ruolo === 'ADMIN'
  const selectedStudioId  = (paziente as any).studioId ?? utente?.studioId ?? null
  if (!selectedStudioId) redirect('/impostazioni/studio')

  // Carica studi disponibili per il selettore
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

  // Carica dropdown per lo studio del paziente
  const [medici, sale, team, prestazioni, tipologieBioscan] = await Promise.all([
    prisma.utente.findMany({
      where:   { studioId: selectedStudioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
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
        collaboratori: {
          where:  { dataFine: null },
          select: { utenteId: true },
        },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.prestazione.findMany({
      where:   { attiva: true },
      select:  { id: true, nome: true, prezzoBase: true, durataMinuti: true },
      orderBy: { ordine: 'asc' },
    }),
    prisma.tipologiaBioscan.findMany({
      where:   { attiva: true },
      select:  { id: true, tipologia: true, prezzo: true, durataMinuti: true },
      orderBy: { ordine: 'asc' },
    }),
  ])

  // Trova la tipologia "Lettura Referto" (quando si arriva da un bioscan)
  const tipologiaLettura = tipologieBioscan.find(
    t => t.tipologia.toLowerCase().includes('lettura')
  )

  const defaultPrestazioneId = bioscanId
    ? (tipologiaLettura ? `BIOSCAN:${tipologiaLettura.id}` : '')
    : ''

  const nomePaziente = `${(paziente as any).cognome ?? ''} ${(paziente as any).nome ?? ''}`.trim()

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        <BackButton href={`/pazienti/${id}/agenda`} />
        <h2 className="text-xl font-semibold text-slate-600">Nuovo appuntamento</h2>
      </div>

      {sale.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Attenzione: nessuna sala configurata per questo studio.{' '}
          <a href="/impostazioni/sale/nuovo" className="font-semibold underline">Crea una sala</a> prima di procedere.
        </div>
      )}

      {bioscanId && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          Stai fissando la <strong>lettura referto</strong> per questo bioscan.
          <span className="block mt-1 text-xs text-teal-600">La lettura è gratuita — nessuna ricevuta verrà emessa.</span>
        </div>
      )}

      <form action={creaAppuntamentoPaziente} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Paziente fisso — non modificabile da qui */}
        <input type="hidden" name="pazienteId" value={id} />
        {bioscanId && <input type="hidden" name="bioscanId" value={bioscanId} />}

        <div>
          <p className="text-sm font-medium text-slate-700">Paziente</p>
          <p className="mt-1.5 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
            {nomePaziente}
          </p>
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
          pazienteIdIniziale={id}
        />

        {/* Studio + Team + Data/ora + Operatore + Sala */}
        <FormStudioWrapper
          studi={studi}
          studioIdIniziale={selectedStudioId}
          mostraSelect={mostraTuttiStudi && studi.length > 1}
          team={team.map(t => ({ id: t.id, nome: t.nome, collaboratori: t.collaboratori }))}
          operatori={medici}
          sale={sale}
          pazienteIdIniziale={id}
        />

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="note" rows={2} className={inputCls} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href={`/pazienti/${id}/agenda`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Salva appuntamento
          </button>
        </div>

      </form>
    </div>
  )
}

const inputCls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
