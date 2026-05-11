// Pagina modifica appuntamento
// Carica i dati dell'appuntamento e permette di modificarli.
// Stessa struttura del form "nuovo appuntamento" ma con valori pre-compilati.

import { redirect, notFound } from 'next/navigation'
import TipoAppuntamentoSelect from '../nuovo/TipoAppuntamentoSelect'
import DatePickerCalendario from '../nuovo/DatePickerCalendario'
import PazienteSearch from '@/components/ui/PazienteSearch'
import BackButton from '@/components/ui/BackButton'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { creaOaggiornaFatturaPerAppuntamento } from '@/lib/fatturazione'
import { sincronizzaSessioniCompletate } from '@/lib/sessioniCompletate'
import { prisma } from '@/lib/prisma'
import { parseDataOraItalia } from '@/lib/datetime'

// ── Helper: collega letturaRefertoId al bioscan più recente non ancora collegato ──
// Chiamato ogni volta che una lettura referto diventa COMPLETATO, da qualsiasi percorso.
// Collega l'appuntamento lettura referto al bioscan più recente non ancora collegato.
// NON tocca refertoConsegnato — quello viene impostato solo da confermaEseguito (stato COMPLETATO).
async function autoLinkLetturaReferto(appuntamentoId: string, pazienteId: string) {
  const giaCollegato = await prisma.bioscan.findFirst({ where: { letturaRefertoId: appuntamentoId } })
  if (giaCollegato) return  // già collegato, niente da fare
  const bioscan = await prisma.bioscan.findFirst({
    where:   { pazienteId, letturaRefertoId: null, effettuato: true },
    orderBy: { dataEsecuzione: 'desc' },
  })
  if (bioscan) {
    await prisma.bioscan.update({
      where: { id: bioscan.id },
      data:  { letturaRefertoId: appuntamentoId },
    })
  }
}

// ── Server Action: salva le modifiche ─────────────────────────────────────────
async function modificaAppuntamento(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const prestazioneIdRaw    = formData.get('prestazioneId') as string
  const programmaPazienteId = (formData.get('programmaPazienteId') as string) || null
  const isBioscan           = prestazioneIdRaw.startsWith('BIOSCAN:')
  const bioscanTipId        = isBioscan ? prestazioneIdRaw.replace('BIOSCAN:', '') : null
  const prestazioneId       = isBioscan ? null : (programmaPazienteId ? null : (prestazioneIdRaw || null))
  // Interpretiamo SEMPRE come ora italiana: vedi lib/datetime.ts.
  const inizio           = parseDataOraItalia(formData.get('inizio') as string)

  // Carica i dati della prestazione (o tipologia bioscan) e l'appuntamento corrente
  const [prestazioneDB, bioscanTipDB, appCorrente] = await Promise.all([
    prestazioneId
      ? prisma.prestazione.findUnique({
          where:  { id: prestazioneId },
          select: { nome: true, prezzoBase: true, durataMinuti: true },
        })
      : null,
    bioscanTipId
      ? prisma.tipologiaBioscan.findUnique({
          where:  { id: bioscanTipId },
          select: { tipologia: true, prezzo: true, durataMinuti: true },
        })
      : null,
    prisma.appuntamento.findUnique({
      where:  { id },
      select: { inizio: true, fine: true, tipoPrestazione: true, prezzoBase: true, pazienteId: true, programmaPazienteId: true },
    }),
  ])

  // Nome, durata e prezzo: dalla prestazione/bioscan scelta, altrimenti dall'appuntamento esistente
  const durataMinutiEsistente = appCorrente
    ? Math.round((appCorrente.fine.getTime() - appCorrente.inizio.getTime()) / 60000)
    : 60
  const nomePrestazione = bioscanTipDB?.tipologia ?? prestazioneDB?.nome ?? appCorrente?.tipoPrestazione ?? 'N/D'
  const durataMinuti    = bioscanTipDB?.durataMinuti ?? prestazioneDB?.durataMinuti ?? durataMinutiEsistente
  const fine            = new Date(inizio.getTime() + durataMinuti * 60 * 1000)
  const prezzoBase      = bioscanTipDB ? Number(bioscanTipDB.prezzo ?? 0)
                        : prestazioneDB ? Number(prestazioneDB.prezzoBase)
                        : Number(appCorrente?.prezzoBase ?? 0)
  const prezzoApplicato = Number(formData.get('prezzoApplicato') || prezzoBase)
  const tipoPrestazione = nomePrestazione

  // Converte stringhe vuote in undefined (Prisma non aggiorna il campo): evita FK violation
  // se il medico/sala corrente è stato disattivato e il select non aveva opzioni valide.
  const salaIdNew   = (formData.get('salaId')   as string) || undefined
  const medicoIdNew = (formData.get('medicoId') as string) || undefined
  const pazIdNew    = (formData.get('pazienteId') as string) || undefined

  // Se l'appuntamento era DA_RIPROGRAMMARE e la data è cambiata, torna a FISSATO
  // automaticamente: l'utente ha riprogrammato l'appuntamento senza cambiare il select.
  const statoFormulario = formData.get('stato') as string
  const dataModificata = appCorrente && inizio.getTime() !== appCorrente.inizio.getTime()
  const statoFinale = (statoFormulario === 'DA_RIPROGRAMMARE' && dataModificata)
    ? 'FISSATO'
    : statoFormulario

  await prisma.appuntamento.update({
    where: { id },
    data: {
      pazienteId:      pazIdNew,
      medicoId:        medicoIdNew,
      salaId:          salaIdNew,
      prestazioneId,
      ...(programmaPazienteId ? { programmaPazienteId } : {}),
      tipoPrestazione,
      inizio,
      fine,
      prezzoBase,
      prezzoApplicato,
      notePrezzo: (formData.get('notePrezzo') as string) || null,
      note:       (formData.get('note') as string) || null,
      teamId:     (formData.get('teamId') as string) || null,
      stato:      statoFinale as never,
    },
  })

  // Sincronizza data e operatore del bioscan con i valori dell'appuntamento.
  // Il bioscan ha campi propri (dataEsecuzione, medicoId) che devono restare allineati.
  await prisma.bioscan.updateMany({
    where: { appuntamentoId: id },
    data: {
      dataEsecuzione: inizio,
      ...(medicoIdNew ? { medicoId: medicoIdNew } : {}),
    },
  })

  if (statoFinale === 'COMPLETATO') {
    // Bioscan: segnalo come effettuato
    await prisma.bioscan.updateMany({
      where: { appuntamentoId: id },
      data:  { effettuato: true },
    })
    // Lettura referto: auto-collega al bioscan più recente non collegato
    if (tipoPrestazione.toLowerCase().includes('lettura') && appCorrente?.pazienteId) {
      await autoLinkLetturaReferto(id, appCorrente.pazienteId)
    }
  }

  // Aggiorna il contatore sessioni completate (nel caso lo stato sia cambiato)
  await sincronizzaSessioniCompletate(appCorrente?.programmaPazienteId)

  // Se era una sessione di un programma, torna alla pagina programma del paziente
  if (appCorrente?.programmaPazienteId && appCorrente.pazienteId) {
    redirect(`/pazienti/${appCorrente.pazienteId}/programma`)
  }
  redirect('/calendario')
}

// ── Server Action: cancella l'appuntamento ─────────────────────────────────────
async function cancellaAppuntamento(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.appuntamento.update({
    where: { id },
    data:  { stato: 'CANCELLATO' },
  })

  redirect('/calendario')
}

// ── Server Action: conferma appuntamento eseguito e crea ricevuta/fattura ───
async function confermaEseguito(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const id = formData.get('id') as string
  const pagato = formData.get('pagato') === 'si'
  const metodoPagamento = formData.get('metodoPagamento') as string | null

  const app = await prisma.appuntamento.findUnique({ where: { id } })
  if (!app) notFound()

  const isLetturaReferto = app.tipoPrestazione.toLowerCase().includes('lettura')

  await prisma.appuntamento.update({
    where: { id },
    data: {
      stato:          'COMPLETATO',
      eseguita:       true,
      dataEsecuzione: new Date(),
      eseguitaDa:     (session.user as { id: string }).id,
    },
  })

  // Se è un bioscan: segnalo come effettuato
  await prisma.bioscan.updateMany({
    where: { appuntamentoId: id },
    data:  { effettuato: true },
  })

  // Se è una lettura referto: collega al bioscan e segna refertoConsegnato
  if (isLetturaReferto) {
    await autoLinkLetturaReferto(id, app.pazienteId)
    // Segna refertoConsegnato solo ora che l'appuntamento è COMPLETATO
    await prisma.bioscan.updateMany({
      where: { letturaRefertoId: id },
      data:  { refertoConsegnato: true },
    })
  }

  // La lettura referto è gratuita: nessuna fattura da emettere
  if (!isLetturaReferto) {
    await creaOaggiornaFatturaPerAppuntamento({
      ...app,
      prezzoApplicato: Number(app.prezzoApplicato),
    }, {
      pagato,
      metodoPagamento: pagato && metodoPagamento ? metodoPagamento as any : undefined,
      dataPagamento: pagato ? new Date() : undefined,
    })
  }

  await sincronizzaSessioniCompletate(app.programmaPazienteId)
  redirect(`/calendario/${id}`)
}


// ── Formatta data per input datetime-local (YYYY-MM-DDTHH:mm) ─────────────────
function fmtDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function ModificaAppuntamentoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params

  // Carica l'appuntamento con tutte le relazioni necessarie
  const app = await prisma.appuntamento.findUnique({
    where:   { id },
    include: {
      paziente:    { select: { id: true, nome: true, cognome: true, tipo: true, statoCura: true } },
      medico:      { select: { id: true, nome: true, cognome: true } },
      sala:        { select: { id: true, nome: true } },
      prestazione: { select: { id: true, nome: true } },
      team:        { select: { id: true, nome: true } },
      // Bioscan collegato a questo appuntamento (per sapere se già ha lettura referto e se completata)
      bioscan: {
        select: {
          id: true,
          letturaRefertoId: true,
          letturaReferto: { select: { stato: true } },
        },
      },
      // Se questo appuntamento è una lettura referto, trova il bioscan collegato
      bioscanLetturaReferto: { select: { id: true } },
    },
  })
  if (!app) notFound()

  // Carica i dropdown per lo studio dell'appuntamento
  const [pazientiStudio, pazienteApp, medici, medicoApp, sale, salaApp, team, prestazioni, fattura, tipologieBioscan] = await Promise.all([
    prisma.paziente.findMany({
      where:   { studioId: app.studioId },
      select:  { id: true, nome: true, cognome: true },
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
    }),
    // Carica sempre il paziente dell'appuntamento (potrebbe avere studioId diverso)
    prisma.paziente.findUnique({
      where:  { id: app.pazienteId },
      select: { id: true, nome: true, cognome: true },
    }),
    prisma.utente.findMany({
      where: { studioId: app.studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    // Carica sempre il medico dell'appuntamento (potrebbe essere disattivato)
    prisma.utente.findUnique({
      where:  { id: app.medicoId },
      select: { id: true, nome: true, cognome: true },
    }),
    prisma.sala.findMany({
      where:   { studioId: app.studioId, attiva: true },
      select:  { id: true, nome: true },
      orderBy: { ordine: 'asc' },
    }),
    // Carica sempre la sala dell'appuntamento (potrebbe essere disattivata)
    prisma.sala.findUnique({
      where:  { id: app.salaId },
      select: { id: true, nome: true },
    }),
    prisma.team.findMany({
      where:   { studioId: app.studioId, attivo: true },
      select:  { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    // Prestazioni condivise tra tutti i centri
    prisma.prestazione.findMany({
      where:   { attiva: true },
      select:  { id: true, nome: true, prezzoBase: true, durataMinuti: true },
      orderBy: { ordine: 'asc' },
    }),
    prisma.fattura.findFirst({
      where:   { appuntamentoId: id },
      orderBy: { createdAt: 'asc' },
      select:  { id: true, numero: true, anno: true, stato: true, metodoPagamento: true },
    }),
    // Tipologie bioscan (globali) — necessarie per il select
    prisma.tipologiaBioscan.findMany({
      where:   { attiva: true },
      select:  { id: true, tipologia: true, prezzo: true, durataMinuti: true },
      orderBy: { ordine: 'asc' },
    }),
  ])

  // Assicura che paziente/medico/sala dell'appuntamento siano sempre presenti nelle liste
  const pazienti = pazienteApp && !pazientiStudio.some(p => p.id === pazienteApp.id)
    ? [pazienteApp, ...pazientiStudio]
    : pazientiStudio
  const mediciList = medicoApp && !medici.some(m => m.id === medicoApp.id)
    ? [medicoApp, ...medici]
    : medici
  const saleList = salaApp && !sale.some(s => s.id === salaApp.id)
    ? [salaApp, ...sale]
    : sale

  // Merge tipologie bioscan (prefisso "BIOSCAN:") + prestazioni — stesso pattern della pagina "nuovo"
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

  // Per bioscan: trova il default cercando la tipologiaBioscan il cui nome combacia con tipoPrestazione
  const bioscanDefault = tipologieBioscan.find(
    t => t.tipologia.toLowerCase() === app.tipoPrestazione.toLowerCase()
  )
  const defaultPrestazioneId = bioscanDefault
    ? `BIOSCAN:${bioscanDefault.id}`
    : (app.prestazioneId ?? '')

  const salva    = modificaAppuntamento.bind(null, id)
  const cancella = cancellaAppuntamento.bind(null, id)

  // Determina il tipo di appuntamento per mostrare le sezioni giuste
  const isLetturaReferto = app.tipoPrestazione.toLowerCase().includes('lettura')
  const isBioscanApp     = !!app.bioscan   // questo appuntamento è un bioscan

  // Fallback: se letturaRefertoId non è impostato (es. dati precedenti o link mancato),
  // cerca comunque un appuntamento lettura referto non cancellato per questo paziente
  const letturaRefertoFallback = (isBioscanApp && !app.bioscan?.letturaRefertoId)
    ? await prisma.appuntamento.findFirst({
        where: {
          pazienteId: app.pazienteId,
          tipoPrestazione: { contains: 'lettura', mode: 'insensitive' },
          stato: { notIn: ['CANCELLATO'] },
        },
        select: { id: true },
      })
    : null

  // Il bioscan ha già una lettura referto fissata E completata?
  const letturaRefertoStato = app.bioscan?.letturaReferto?.stato
  const bioscanHaLetturaReferto = isBioscanApp && (
    !!app.bioscan?.letturaRefertoId &&
    letturaRefertoStato === 'COMPLETATO'
  )
  // Dopo completamento bioscan: mostra il pulsante "Fissa lettura referto"
  // Nascosto se la lettura referto è già fissata (per letturaRefertoId o per ricerca fallback)
  const mostraFissaLettura = isBioscanApp
    && app.stato === 'COMPLETATO'
    && !app.bioscan?.letturaRefertoId
    && !letturaRefertoFallback

  const STATI: { v: string; l: string }[] = [
    { v: 'FISSATO',          l: 'Fissato' },
    { v: 'CONFERMATO',       l: 'Confermato' },
    { v: 'COMPLETATO',       l: 'Effettuato' },
    { v: 'CANCELLATO',       l: 'Cancellato' },
    { v: 'NO_SHOW',          l: 'No Show' },
    { v: 'DA_RIPROGRAMMARE', l: 'Da riprogrammare' },
  ]

  return (
    <div className="space-y-6">

      {/* Intestazione */}
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Modifica appuntamento</h1>
      </div>

      {/* Badge stato corrente */}
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeStato(app.stato)}`}>
          {app.stato}
        </span>
        <span className="text-sm text-slate-500">
          {app.inizio.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' '}·{' '}
          {fmtDatetimeLocal(app.inizio).slice(11, 16)} – {fmtDatetimeLocal(app.fine).slice(11, 16)}
        </span>
      </div>

      <form action={salva} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Paziente */}
        <PazienteSearch
          pazienti={pazienti}
          defaultId={app.pazienteId}
          required
        />

        {/* Tipo prestazione + prezzo applicato.
            Le sessioni del programma non hanno una prestazioneId: mostra solo il prezzo. */}
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
          defaultProgrammaId={app.programmaPazienteId ?? ''}
          defaultPrezzo={Number(app.prezzoApplicato)}
          pazienteIdIniziale={app.pazienteId}
        />

        {/* Data e ora con griglia disponibilità */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Data e ora inizio *</label>
          <DatePickerCalendario
            sale={saleList}
            operatori={mediciList}
            studioId={app.studioId}
            defaultData={fmtDatetimeLocal(app.inizio).slice(0, 10)}
            defaultOra={fmtDatetimeLocal(app.inizio).slice(11, 16)}
            defaultSalaId={app.salaId}
            defaultSalaNome={app.sala?.nome ?? ''}
            defaultMedicoId={app.medicoId}
            defaultMedicoNome={app.medico ? `${app.medico.cognome} ${app.medico.nome}` : ''}
          />
        </div>

        {/* Stato */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Stato</label>
          <select name="stato" defaultValue={app.stato} className={cls}>
            {STATI.map(s => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </select>
        </div>


        {/* Note prezzo */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Note prezzo</label>
          <input
            type="text"
            name="notePrezzo"
            defaultValue={app.notePrezzo ?? ''}
            placeholder="Es. sconto famiglia, convenzione…"
            className={cls}
          />
        </div>

        {/* Team (opzionale) */}
        {team.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Team (opzionale)</label>
            <select name="teamId" defaultValue={app.teamId ?? ''} className={cls}>
              <option value="">— Nessun team —</option>
              {team.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="note" rows={2} defaultValue={app.note ?? ''} className={cls} />
        </div>

        {/* Azioni salva / annulla */}
        <div className="flex justify-end gap-3 pt-2">
          <a href="/calendario"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>

      {/* ── Sezione lettura referto: semplice conferma, nessun documento ── */}
      {isLetturaReferto ? (
        <section className="rounded-3xl border border-teal-200 bg-teal-50 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-teal-900">Lettura referto</h2>
          <p className="text-sm text-teal-700">
            La lettura referto è gratuita — nessun documento fiscale da emettere.
          </p>

          {/* Conferma eseguito */}
          {app.stato !== 'COMPLETATO' && (
            <form action={confermaEseguito}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="pagato" value="no" />
              <button type="submit" className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                Conferma lettura referto eseguita
              </button>
            </form>
          )}

          {/* Le opzioni dopo la lettura referto (Programma/Prestazione/Fitoterapia/ecc.)
              sono ora nel popup del calendario — bottone "Converti" */}
          {app.stato === 'COMPLETATO' && (
            <p className="text-xs text-teal-600">
              Lettura completata. Per registrare la decisione del paziente, usa il bottone <strong>Converti</strong> nel popup del calendario.
            </p>
          )}
        </section>
      ) : (
        /* ── Sezione standard: documento fiscale ── */
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Conferma esecuzione e documento fiscale
              </h2>
              <p className="text-sm text-slate-500">
                Genera una {app.paziente.tipo === 'AZIENDA' ? 'fattura' : 'ricevuta'} per questo appuntamento.
              </p>
            </div>
            {fattura ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Documento: {fattura.anno}/{String(fattura.numero).padStart(4, '0')} · {fattura.stato}
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Nessun documento ancora emesso.
              </div>
            )}
          </div>

          <form action={confermaEseguito} className="space-y-5">
            <input type="hidden" name="id" value={id} />

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Incassato?</label>
                <select name="pagato" defaultValue={fattura?.stato === 'PAGATA' ? 'si' : 'no'} className={cls}>
                  <option value="si">Sì, incassato</option>
                  <option value="no">No, da pagare</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Metodo pagamento</label>
                <select name="metodoPagamento" defaultValue={fattura?.metodoPagamento ?? 'CASH'} className={cls}>
                  <option value="CASH">Cash</option>
                  <option value="BONIFICO">Bonifico</option>
                  <option value="CARTA">Carta</option>
                  <option value="OMAGGIO">Omaggio</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                {fattura ? 'Aggiorna documento' : 'Conferma eseguito'}
              </button>
              <span className="text-sm text-slate-500">
                {fattura
                  ? 'Aggiorna stato pagamento del documento esistente.'
                  : 'Seleziona "No" se il documento deve essere emesso ma non ancora pagato.'}
              </span>
            </div>
          </form>
        </section>
      )}

      {/* ── Pulsante "Fissa lettura referto" — appare dopo che il bioscan è completato ── */}
      {mostraFissaLettura && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">Lettura referto da fissare</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Il bioscan è stato eseguito — fissa ora l'appuntamento per la lettura del referto.
              </p>
            </div>
            <a
              href={`/calendario/nuovo?pazienteId=${app.pazienteId}&bioscanId=${app.bioscan?.id}&studioId=${app.studioId}`}
              className="flex-shrink-0 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition"
            >
              Fissa lettura referto
            </a>
          </div>
        </section>
      )}

      {/* Form cancellazione — separato per evitare annidamento di form (HTML invalido) */}
      <form action={cancella}>
        <button
          type="submit"
          className="rounded-full border border-red-200 px-5 py-2.5 text-sm text-red-600 hover:bg-red-50"
        >
          Cancella appuntamento
        </button>
      </form>

      {/* Metadati */}
      <p className="text-xs text-slate-400">
        Creato il {app.createdAt.toLocaleString('it-IT')} · ID: {app.id}
      </p>
    </div>
  )
}

// Colore badge per stato appuntamento
function badgeStato(stato: string): string {
  const map: Record<string, string> = {
    CONFERMATO:  'bg-green-100 text-green-700',
    COMPLETATO:  'bg-emerald-100 text-emerald-700',
    CANCELLATO:  'bg-red-100 text-red-600',
    NO_SHOW:     'bg-orange-100 text-orange-600',
  }
  return map[stato] ?? 'bg-slate-100 text-slate-600'
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
