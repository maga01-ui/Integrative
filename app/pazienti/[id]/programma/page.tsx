// Pagina programma del paziente
// Mostra: bioscan iniziale, programma attivo con progresso, possibilità di assegnare un programma
// e prenotare più sessioni in una volta.

import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getPatientOrRedirect } from '../patientUtilsFinal'
import PrenotazioniMultiple from './PrenotazioniMultiple'
import TabellaAppuntamenti from './TabellaAppuntamenti'
import CancellaButton from './CancellaButton'
import ProgrammaSelect from './ProgrammaSelect'
import DecisionePostReferto from './DecisionePostReferto'
import FormConScroll from './FormConScroll'
import ProgrammaCollassabile from './ProgrammaCollassabile'

// ── Server action: assegna un programma al paziente ──────────────────────────
// Crea (se necessario) un Percorso attivo, poi crea il ProgrammaPaziente
async function assegnaProgramma(pazienteId: string, studioId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const programmaId     = formData.get('programmaId') as string
  const sessioniTotali  = Number(formData.get('sessioniTotali') || 8)
  const note            = (formData.get('note') as string) || null

  if (!programmaId) return

  // Cerca il programma per ricavare il tipo
  const programma = await prisma.programma.findUnique({
    where: { id: programmaId },
    select: { tipo: true, defaultSessioni: true },
  })
  if (!programma) return

  // Cerca un percorso attivo del paziente; se non c'è, ne crea uno nuovo
  let percorso = await prisma.percorso.findFirst({
    where: { pazienteId, attivo: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!percorso) {
    percorso = await prisma.percorso.create({
      data: {
        studioId,
        pazienteId,
        tipoCura:       programma.tipo,
        sessioniTotali: sessioniTotali,
        fase:           'IN_CURA',
        attivo:         true,
      },
    })
  }

  // Crea il nuovo ProgrammaPaziente
  await prisma.programmaPaziente.create({
    data: {
      programmaId,
      pazienteId,
      percorsoId:          percorso.id,
      sessioniTotali,
      sessioniCompletate:  0,
      stato:               'ATTIVO',
      note,
    },
  })

  revalidatePath(`/pazienti/${pazienteId}/programma`)
}

// ── Server action: sospende il programma e annulla gli appuntamenti futuri ───
async function cancellaProgramma(programmaPazienteId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Blocca se esistono appuntamenti già completati (non si può cancellare la storia)
  const completati = await prisma.appuntamento.count({
    where: { programmaPazienteId, stato: 'COMPLETATO' },
  })
  if (completati > 0) return

  // Cancella tutti gli appuntamenti futuri (non ancora eseguiti) del programma
  await prisma.appuntamento.updateMany({
    where: {
      programmaPazienteId,
      stato: { in: ['FISSATO', 'CONFERMATO', 'DA_RIPROGRAMMARE'] },
    },
    data: { stato: 'CANCELLATO' },
  })

  // Sospende il programma (CANCELLATO non esiste nell'enum StatoProgramma)
  await prisma.programmaPaziente.update({
    where: { id: programmaPazienteId },
    data:  { stato: 'SOSPESO', dataFine: new Date() },
  })

  revalidatePath(`/pazienti/${pazienteId}/programma`)
}

// ── Server action: elimina definitivamente un programma già sospeso ───────────
// Usata quando il programma è già SOSPESO e non ha sessioni completate.
async function eliminaProgramma(programmaPazienteId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Sicurezza: blocca l'eliminazione se ci sono sessioni completate
  const completati = await prisma.appuntamento.count({
    where: { programmaPazienteId, stato: 'COMPLETATO' },
  })
  if (completati > 0) return

  // Elimina prima tutti gli appuntamenti collegati (anche quelli già cancellati)
  await prisma.appuntamento.deleteMany({ where: { programmaPazienteId } })

  // Poi elimina il record del programma paziente
  await prisma.programmaPaziente.delete({ where: { id: programmaPazienteId } })

  revalidatePath(`/pazienti/${pazienteId}/programma`)
}

// ── Server action: chiude definitivamente il programma ───────────────────────
async function chiudiProgramma(programmaPazienteId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.programmaPaziente.update({
    where: { id: programmaPazienteId },
    data:  { stato: 'COMPLETATO', dataFine: new Date() },
  })

  revalidatePath(`/pazienti/${pazienteId}/programma`)
}

// ── Server action: aggiunge sessioni extra al programma dopo il referto ───────
async function aggiungiSessioni(programmaPazienteId: string, pazienteId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const da = Number(formData.get('sessioniDaAggiungere') || 0)
  if (da <= 0 || da > 50) return

  // Aumenta il totale sessioni pianificate e rimette il programma in stato ATTIVO
  const pp = await prisma.programmaPaziente.findUnique({
    where:  { id: programmaPazienteId },
    select: { sessioniTotali: true },
  })
  if (!pp) return

  await prisma.programmaPaziente.update({
    where: { id: programmaPazienteId },
    data: {
      sessioniTotali: pp.sessioniTotali + da,
      stato:          'ATTIVO',
    },
  })

  revalidatePath(`/pazienti/${pazienteId}/programma`)
}

// ── Etichette tipo cura ───────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  TRATTAMENTI: 'Trattamenti',
  FITOTERAPIA: 'Fitoterapia',
  ENTRAMBI:    'Trattamenti + Fitoterapia',
}

// ── Etichette stato programma ─────────────────────────────────────────────────
const STATO_BADGE: Record<string, string> = {
  ATTIVO:     'bg-blue-100 text-blue-700',
  SOSPESO:    'bg-amber-100 text-amber-700',
  COMPLETATO: 'bg-green-100 text-green-700',
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function ProgrammaPazientePage({ params }: { params: any }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: pazienteId } = await Promise.resolve(params) as { id: string }
  const paziente = await getPatientOrRedirect(pazienteId)

  // Carica tutti i programmi non cancellati del paziente con gli appuntamenti collegati
  const programmiPaziente = await prisma.programmaPaziente.findMany({
    where:   { pazienteId },
    orderBy: { createdAt: 'desc' },
    include: {
      programma: true,
      appuntamenti: {
        orderBy: { inizio: 'asc' },
        include: {
          medico: { select: { nome: true, cognome: true } },
          sala:   { select: { nome: true } },
        },
      },
    },
  })

  // Carica il bioscan iniziale del paziente (se eseguito), incluso l'appuntamento lettura referto
  const bioscanIniziale = await prisma.bioscan.findFirst({
    where:   { pazienteId, tipo: 'INIZIALE' },
    orderBy: { dataEsecuzione: 'desc' },
    include: { letturaReferto: { select: { inizio: true } } },
  })

  // Carica il bioscan di controllo (se presente), incluso lo stato dell'appuntamento e lettura referto
  const bioscanControllo = await prisma.bioscan.findFirst({
    where:   { pazienteId, tipo: 'CONTROLLO' },
    orderBy: { dataEsecuzione: 'desc' },
    include: {
      letturaReferto: { select: { inizio: true } },
      // Stato dell'appuntamento di esecuzione: serve per mostrare se è da riprogrammare
      appuntamento:   { select: { stato: true, inizio: true } },
    },
  })

  // Carica tutti i programmi disponibili per la selezione
  const programmiDisponibili = await prisma.programma.findMany({
    where:   { attivo: true },
    orderBy: { ordine: 'asc' },
  })

  // Carica operatori e sale dello studio per la prenotazione multipla
  const [operatori, sale] = await Promise.all([
    prisma.utente.findMany({
      where:   { studioId: (paziente as any).studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    prisma.sala.findMany({
      where:   { studioId: (paziente as any).studioId, attiva: true },
      select:  { id: true, nome: true },
      orderBy: { ordine: 'asc' },
    }),
  ])

  // Server action assegna con parametri pre-legati
  const assegna = assegnaProgramma.bind(null, pazienteId, (paziente as any).studioId)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-400">Programma</p>
        <p className="text-sm text-slate-500">
          Percorso di cura del paziente, sessioni programmate e avanzamento.
        </p>
      </div>

      {/* ── Lista programmi ── */}
      {programmiPaziente.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-slate-500 font-medium">Nessun programma</p>
          <p className="mt-1 text-sm text-slate-400">Assegna il primo programma al paziente qui sotto.</p>
        </div>
      )}

      {programmiPaziente.map(pp => {
        const appts               = pp.appuntamenti
        const sessComplReali      = appts.filter(a => a.stato === 'COMPLETATO').length
        const sessGiaProgrammate  = appts.length
        const sessRimanenti       = Math.max(0, pp.sessioniTotali - sessGiaProgrammate)
        const haCompletati        = sessComplReali > 0
        const cancellaAction      = cancellaProgramma.bind(null, pp.id, pazienteId)
        const eliminaAction       = eliminaProgramma.bind(null, pp.id, pazienteId)
        const chiudiAction        = chiudiProgramma.bind(null, pp.id, pazienteId)
        const aggiungiAction      = aggiungiSessioni.bind(null, pp.id, pazienteId)

        return (
          <div key={pp.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">

            {/* Header programma */}
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{pp.programma.nome}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATO_BADGE[pp.stato] ?? 'bg-slate-100 text-slate-500'}`}>
                      {pp.stato}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {TIPO_LABEL[pp.programma.tipo]}
                    </span>
                  </div>
                  {pp.programma.descrizione && (
                    <p className="mt-0.5 text-sm text-slate-500">{pp.programma.descrizione}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Iniziato il {new Date(pp.dataInizio).toLocaleDateString('it-IT')}
                  </p>
                </div>

                {haCompletati ? (
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700">
                    Non cancellabile — ci sono sessioni già effettuate
                  </div>
                ) : pp.stato === 'SOSPESO' ? (
                  /* Programma già sospeso: offre l'eliminazione definitiva */
                  <CancellaButton
                    action={eliminaAction}
                    label="Elimina definitivamente"
                    confirmMessage="Il programma verrà eliminato definitivamente. Continuare?"
                  />
                ) : (
                  <CancellaButton action={cancellaAction} />
                )}
              </div>

              {/* Barra avanzamento */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-sm text-slate-600">Sessioni completate</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {sessComplReali} / {pp.sessioniTotali}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${pp.sessioniTotali > 0 ? Math.round((sessComplReali / pp.sessioniTotali) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sezione dettagli: collassata automaticamente per i programmi non attivi */}
            <ProgrammaCollassabile defaultCollapsed={pp.stato !== 'ATTIVO'}>

            {/* Tabella appuntamenti con modifica inline */}
            {appts.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400">Nessuna sessione ancora prenotata — usa il form in basso.</p>
            ) : (
              <TabellaAppuntamenti
                appuntamenti={appts.map((a, idx) => ({
                  id:              a.id,
                  inizio:          a.inizio.toISOString(),
                  dataFormattata:  a.inizio.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
                  oraFormattata:   a.inizio.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                  stato:           a.stato,
                  prezzoApplicato: Number(a.prezzoApplicato),
                  medicoId:        (a as any).medicoId ?? '',
                  salaId:          (a as any).salaId   ?? '',
                  medicoNome:      a.medico ? `${a.medico.cognome} ${a.medico.nome}` : '',
                  salaNome:        a.sala?.nome ?? '',
                }))}
                operatori={operatori}
                sale={sale}
                studioId={(paziente as any).studioId}
              />
            )}

            {/* Bioscan di controllo — visibile solo quando il programma è completato */}
            {(() => {
              const programmaTerminato = sessComplReali > 0 && sessComplReali >= pp.sessioniTotali

              // "effettuato" solo se il flag effettuato è true (l'appuntamento era COMPLETATO)
              const controlloEffettuato  = programmaTerminato && bioscanControllo?.effettuato ? bioscanControllo : null
              // Bioscan prenotato ma appuntamento non ancora completato
              const controlloPrenotato   = programmaTerminato && bioscanControllo && !bioscanControllo.effettuato ? bioscanControllo : null
              // Nessun bioscan ancora creato: va prenotato
              const daPrenotare          = programmaTerminato && !bioscanControllo

              // Stato dell'appuntamento del bioscan di controllo
              const statoApp = controlloPrenotato?.appuntamento?.stato

              // Bioscan effettuato ma senza appuntamento lettura referto
              const refertoMancante = !!controlloEffettuato && !controlloEffettuato.letturaRefertoId
              const dataConsegna    = controlloEffettuato?.letturaReferto?.inizio

              // Calcola colori, icona e testo in base allo stato reale
              let cardBorder:  string
              let icona:       string
              let iconaClasse: string
              let statoTesto:  string

              if (controlloEffettuato) {
                cardBorder  = 'border-green-200 bg-green-50'
                icona       = '✓'
                iconaClasse = 'text-green-600'
                statoTesto  = `Eseguito il ${new Date(controlloEffettuato.dataEsecuzione).toLocaleDateString('it-IT')}`
              } else if (controlloPrenotato) {
                if (statoApp === 'DA_RIPROGRAMMARE') {
                  cardBorder  = 'border-amber-200 bg-amber-50'
                  icona       = '!'
                  iconaClasse = 'text-amber-600'
                  statoTesto  = 'Da riprogrammare — appuntamento non ancora effettuato'
                } else if (statoApp === 'CANCELLATO' || statoApp === 'NO_SHOW') {
                  cardBorder  = 'border-red-200 bg-red-50'
                  icona       = '!'
                  iconaClasse = 'text-red-500'
                  statoTesto  = 'Appuntamento cancellato — da riprogrammare'
                } else {
                  cardBorder  = 'border-sky-200 bg-sky-50'
                  icona       = '◷'
                  iconaClasse = 'text-sky-500'
                  statoTesto  = "Prenotato — in attesa del completamento dell'appuntamento"
                }
              } else if (daPrenotare) {
                cardBorder  = 'border-amber-200 bg-amber-50'
                icona       = '!'
                iconaClasse = 'text-amber-600'
                statoTesto  = 'Programma completato — prenota il bioscan di controllo'
              } else {
                cardBorder  = 'border-slate-100 bg-slate-50'
                icona       = '○'
                iconaClasse = 'text-slate-400'
                statoTesto  = 'Al termine del ciclo'
              }

              return (
                <>
                  <div className={`mx-6 mt-2 rounded-2xl border px-4 py-3 ${cardBorder} ${refertoMancante ? 'mb-2' : 'mb-4'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${iconaClasse}`}>{icona}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Bioscan di controllo</p>
                          <p className="text-xs text-slate-400">{statoTesto}</p>
                          {/* Riga consegna referto (compare solo quando il referto è stato consegnato) */}
                          {dataConsegna && (
                            <p className="mt-0.5 text-xs text-green-600 font-medium">
                              Referto consegnato il {new Date(dataConsegna).toLocaleDateString('it-IT')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm text-slate-500">
                          {Number(pp.programma.prezzoBioscanControllo) === 0
                            ? <span className="font-medium text-green-600">Gratuito</span>
                            : `€ ${Number(pp.programma.prezzoBioscanControllo).toFixed(0)}`}
                        </span>
                        {daPrenotare && (
                          <a
                            href={`/pazienti/${pazienteId}/bioscan/nuovo`}
                            className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition"
                          >
                            Prenota bioscan di controllo →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alert: bioscan effettuato ma nessun appuntamento di lettura referto */}
                  {refertoMancante && (
                    <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                      <span className="mt-0.5 text-amber-500 text-sm">⚠</span>
                      <p className="text-xs text-amber-700">
                        Il bioscan di controllo è stato eseguito ma non risulta ancora un appuntamento per la{' '}
                        <strong>lettura del referto</strong>. Ricordati di programmarlo.
                      </p>
                    </div>
                  )}

                  {/* Pannello di decisione: mostrato dopo la consegna del referto se il programma non è già chiuso */}
                  {dataConsegna && pp.stato !== 'COMPLETATO' && (
                    <DecisionePostReferto
                      chiudiAction={chiudiAction}
                      aggiungiAction={aggiungiAction}
                    />
                  )}
                </>
              )
            })()}

            {/* Riepilogo costi */}
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Totale programma</span>
                <span className="font-semibold text-slate-900">
                  € {(
                    Number(pp.programma.prezzoBioscanIniziale) +
                    (pp.sessioniTotali * Number(pp.programma.prezzoSessione)) +
                    Number(pp.programma.prezzoBioscanControllo)
                  ).toLocaleString('it-IT')}
                </span>
              </div>
            </div>

            {/* Form prenotazione sessioni */}
            {operatori.length > 0 && sale.length > 0 && (
              <div className="border-t border-indigo-100 bg-indigo-50 px-6 py-5">
                <h3 className="mb-3 text-sm font-semibold text-indigo-800">
                  {sessRimanenti > 0 ? `Prenota le prossime sessioni (${sessRimanenti} da programmare)` : 'Aggiungi una sessione extra'}
                </h3>
                <PrenotazioniMultiple
                  key={sessGiaProgrammate}
                  pazienteId={pazienteId}
                  studioId={(paziente as any).studioId}
                  programmaPazienteId={pp.id}
                  percorsoId={pp.percorsoId}
                  sessioni={Math.max(1, sessRimanenti)}
                  primoProgressivo={sessGiaProgrammate + 1}
                  tipoPrestazione={pp.programma.tipo === 'FITOTERAPIA' ? 'FITOTERAPIA' : 'TRATTAMENTO'}
                  prezzoBase={Number(pp.programma.prezzoSessione)}
                  operatori={operatori}
                  sale={sale}
                />
              </div>
            )}

            </ProgrammaCollassabile>
          </div>
        )
      })}

      {/* ── Assegna / Cambia programma ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Aggiungi programma</h2>

        {programmiDisponibili.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nessun programma disponibile. Configura i programmi nelle{' '}
            <a href="/impostazioni/programmi" className="underline">impostazioni</a>.
          </p>
        ) : (
          <FormConScroll action={assegna} className="space-y-5">

            {/* Selezione programma — gestita dal Client Component */}
            <ProgrammaSelect
              programmi={programmiDisponibili.map(p => ({
                id:                     p.id,
                nome:                   p.nome,
                descrizione:            p.descrizione,
                tipo:                   p.tipo,
                defaultSessioni:        p.defaultSessioni,
                prezzoSessione:         Number(p.prezzoSessione),
                prezzoBioscanIniziale:   Number(p.prezzoBioscanIniziale),
                prezzoBioscanControllo:  Number(p.prezzoBioscanControllo),
              }))}
            />

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Note (opzionale)</label>
              <textarea
                name="note"
                rows={2}
                placeholder="Note specifiche per questo paziente…"
                className="mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
              >
                Aggiungi programma
              </button>
            </div>
          </FormConScroll>
        )}
      </div>

    </div>
  )
}
