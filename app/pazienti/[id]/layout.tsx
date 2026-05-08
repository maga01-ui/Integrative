import type { ReactNode } from 'react'
import { getPatientOrRedirect, formatPatientName, createPhoneUrl, createWhatsAppUrl } from './patientUtilsFinal'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'
import PazienteNav from './PazienteNav'
import PersoButton from './PersoButton'

export default async function PazienteLayout({
  children,
  params,
}: {
  children: ReactNode
  params: any
}) {
  // In Next.js 15 params è una Promise — await Promise.resolve funziona sia con oggetto che con Promise
  const { id } = await Promise.resolve(params) as { id: string }

  const paziente = await getPatientOrRedirect(id)
  const nomePaziente = formatPatientName(paziente)

  // Carica il nome dell'operatore assegnato (se presente)
  const operatore = (paziente as any).operatoreId
    ? await prisma.utente.findUnique({
        where: { id: (paziente as any).operatoreId },
        select: { nome: true, cognome: true },
      })
    : null
  const telefonoUrl = createPhoneUrl(paziente.telefono)
  const whatsappUrl = createWhatsAppUrl(paziente.telefonoWa ?? paziente.telefono)
  const emailUrl = paziente.email ? `mailto:${paziente.email}` : null

  // Calcola età in anni dalla data di nascita
  const eta = paziente.dataNascita
    ? Math.floor((Date.now() - new Date(paziente.dataNascita).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  // Determina se il paziente è attivo — almeno una delle 4 condizioni:
  // 1. Bioscan eseguito ma referto non ancora consegnato (visita da fissare)
  // 2. Appuntamenti futuri non cancellati
  // 3. Programma di trattamento non concluso (ATTIVO o SOSPESO)
  // 4. Fitoterapia in corso
  const ora = new Date()
  const [bioscanSenzaReferto, appFuturi, appDaRiprogrammare, programmiAttivi, fitoAttive] = await Promise.all([
    prisma.bioscan.count({
      where: { pazienteId: id, refertoConsegnato: false },
    }),
    prisma.appuntamento.count({
      where: { pazienteId: id, stato: { notIn: ['CANCELLATO', 'COMPLETATO'] }, inizio: { gt: ora } },
    }),
    // Appuntamenti con stato DA_RIPROGRAMMARE (passati o futuri)
    prisma.appuntamento.count({
      where: { pazienteId: id, stato: 'DA_RIPROGRAMMARE' },
    }),
    prisma.programmaPaziente.count({
      where: { pazienteId: id, stato: { in: ['ATTIVO', 'SOSPESO'] } },
    }),
    prisma.prescrizioneFito.count({
      where: { pazienteId: id, stato: 'ATTIVA' },
    }),
  ])
  const isAttivo = bioscanSenzaReferto > 0 || appFuturi > 0 || appDaRiprogrammare > 0 || programmiAttivi > 0 || fitoAttive > 0

  // Conta elementi senza ricevuta → badge arancione su "Ricevute"
  const [appDaEmettere, bioscanDaEmettere] = await Promise.all([
    prisma.appuntamento.count({
      where: {
        pazienteId:      id,
        stato:           'COMPLETATO',
        prezzoApplicato: { gt: 0 },
        fattura:         { is: null },
        bioscan:         { is: null },  // gli appuntamenti bioscan sono contati sotto, separatamente
      },
    }),
    prisma.bioscan.count({
      where: {
        pazienteId: id,
        effettuato: true,          // solo bioscan già eseguiti
        prezzo:     { gt: 0 },
        fattura:    { is: null },
      },
    }),
  ])
  const ricevuteDaEmettere = appDaEmettere + bioscanDaEmettere

  // Conta i record presenti per ogni sezione, per colorare i bottoni del menu
  const [conteggi, conteggioPrestazioniReali, conteggioPrescrizionI] = await Promise.all([
    prisma.paziente.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            appuntamenti: true,
            bioscan:      true,
            prescrizioni: true,  // PrescrizioneFito
            fatture:      true,
            assegnamenti: true,  // ProgrammaPaziente
          },
        },
      },
    }),
    // Conta solo gli appuntamenti che compaiono nella pagina Prestazioni:
    // senza programma, senza bioscan principale e senza lettura referto
    prisma.appuntamento.count({
      where: {
        pazienteId:            id,
        programmaPazienteId:   null,
        bioscan:               { is: null },
        bioscanLetturaReferto: { is: null },
      },
    }),
    // Conta le prescrizioni mediche generiche
    prisma.prescrizione.count({ where: { pazienteId: id } }),
  ])
  // Default tipato così TypeScript sa quali campi esistono anche in fallback.
  const c = conteggi?._count ?? { appuntamenti: 0, bioscan: 0, prescrizioni: 0, fatture: 0, assegnamenti: 0 }

  // true = la sezione ha almeno un contenuto → bottone colorato
  const haContenuto: Record<string, boolean> = {
    anagrafica:   true,
    agenda:       (c.appuntamenti ?? 0) > 0,
    anamnesi:     false,
    bioscan:      (c.bioscan ?? 0) > 0,
    programma:    (c.assegnamenti ?? 0) > 0,
    prestazioni:  conteggioPrestazioniReali > 0,
    fitoterapia:  (c.prescrizioni ?? 0) > 0,
    prescrizioni: conteggioPrescrizionI > 0,
    ricevute:     (c.fatture ?? 0) > 0,
    privacy:      false,
  }

  const sezioni = [
    { id: 'anagrafica',   label: 'Anagrafica' },
    { id: 'agenda',       label: 'Agenda' },
    { id: 'anamnesi',     label: 'Anamnesi' },
    { id: 'bioscan',      label: 'Bioscan' },
    { id: 'programma',    label: 'Programma' },
    { id: 'prestazioni',  label: 'Prestazioni' },
    { id: 'fitoterapia',  label: 'Fitoterapia' },
    { id: 'prescrizioni', label: 'Prescrizioni' },
    { id: 'ricevute',     label: paziente.tipo === 'AZIENDA' ? 'Fatture' : 'Ricevute' },
    { id: 'privacy',      label: 'Privacy' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton />
        <span className="text-slate-300">/</span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-600">{nomePaziente}</h1>
          {!paziente.attivo && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              Inattivo
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        {/* Box dettagli paziente con pulsanti contatto integrati */}
        <div className={`rounded-3xl border p-5 shadow-sm ${(paziente as any).perso ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs uppercase tracking-wide text-slate-400">Dettagli paziente</p>

          {/* Banner "Perso" con motivazione, visibile solo quando il paziente è segnato come perso */}
          {(paziente as any).perso && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-red-100 px-4 py-3">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-700">Paziente perso</p>
                {(paziente as any).persoNota && (
                  <p className="mt-0.5 text-sm text-red-600">{(paziente as any).persoNota}</p>
                )}
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Studio</p>
              <p className="mt-0.5 font-semibold text-slate-900">{(paziente as any).studio?.nome ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Operatore</p>
              <p className="mt-0.5 text-slate-900">
                {operatore ? `${operatore.cognome} ${operatore.nome}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Età</p>
              <p className="mt-0.5 text-slate-900">{eta !== null ? `${eta} anni` : '—'}</p>
            </div>
          </div>
          {/* Pulsanti contatto */}
          <div className="mt-4 flex flex-wrap gap-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                WhatsApp
              </a>
            )}
            {telefonoUrl && (
              <a
                href={telefonoUrl}
                className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-brand-hover"
              >
                Chiama
              </a>
            )}
            {emailUrl && (
              <a
                href={emailUrl}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
              >
                Email
              </a>
            )}
            {/* Badge stato attività cliente */}
            {isAttivo ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Attivo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Non attivo
              </span>
            )}

            {/* Badge / toggle "Perso" */}
            <PersoButton
              pazienteId={id}
              perso={!!(paziente as any).perso}
              persoNota={(paziente as any).persoNota ?? null}
              appuntamentiFuturi={appFuturi}
            />
          </div>
        </div>

        {/* Box indirizzo */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Data in cui il contatto è diventato paziente */}
          {paziente.dataDiventaPaziente && (
            <p className="mb-3 text-sm text-slate-500">
              Paziente dal{' '}
              {new Date(paziente.dataDiventaPaziente).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          <p className="text-xs uppercase tracking-wide text-slate-400">Indirizzo</p>
          <div className="mt-2 space-y-0.5 text-sm text-slate-700">
            {paziente.indirizzo && <p>{paziente.indirizzo}</p>}
            <p>
              {paziente.cap ? `${paziente.cap} ` : ''}
              {paziente.citta ?? ''}
              {paziente.provincia ? ` (${paziente.provincia})` : ''}
            </p>
            {paziente.stato && <p>{paziente.stato}</p>}
          </div>
        </div>
      </div>

      {/* Menu secondario con evidenziazione sezione attiva */}
      <PazienteNav
        pazienteId={id}
        sezioni={sezioni}
        haContenuto={haContenuto}
        sezioniAlert={ricevuteDaEmettere > 0 ? ['ricevute'] : []}
      />

      {children}
    </div>
  )
}
