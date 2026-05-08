// Modifica appuntamento nel contesto della scheda paziente.
// Stessa logica di /calendario/[id]/page.tsx ma eredita il layout paziente (menu secondario).
// Le server action reindirizzano a /pazienti/[id]/agenda invece che al calendario.

import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseDataOraItalia } from '@/lib/datetime'
import { creaOaggiornaFatturaPerAppuntamento } from '@/lib/fatturazione'
import { sincronizzaSessioniCompletate } from '@/lib/sessioniCompletate'
import TipoAppuntamentoSelect from '@/app/calendario/nuovo/TipoAppuntamentoSelect'
import DatePickerCalendario from '@/app/calendario/nuovo/DatePickerCalendario'
import PazienteSearch from '@/components/ui/PazienteSearch'
import BackButton from '@/components/ui/BackButton'

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function fmtDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function badgeStato(stato: string): string {
  const map: Record<string, string> = {
    CONFERMATO: 'bg-green-100 text-green-700',
    COMPLETATO: 'bg-emerald-100 text-emerald-700',
    CANCELLATO: 'bg-red-100 text-red-600',
    NO_SHOW:    'bg-orange-100 text-orange-600',
  }
  return map[stato] ?? 'bg-slate-100 text-slate-600'
}

async function autoLinkLetturaReferto(appuntamentoId: string, pazienteId: string) {
  const giaCollegato = await prisma.bioscan.findFirst({ where: { letturaRefertoId: appuntamentoId } })
  if (giaCollegato) return
  const bioscan = await prisma.bioscan.findFirst({
    where:   { pazienteId, letturaRefertoId: null, effettuato: true },
    orderBy: { dataEsecuzione: 'desc' },
  })
  if (bioscan) {
    await prisma.bioscan.update({ where: { id: bioscan.id }, data: { letturaRefertoId: appuntamentoId } })
  }
}

export default async function PazienteModificaAppuntamento({
  params,
}: {
  params: Promise<{ id: string; appId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: pazienteId, appId } = await params
  const backUrl = `/pazienti/${pazienteId}/agenda`

  // ── Server Action: salva modifiche ─────────────────────────────────────────
  async function salvaModifiche(formData: FormData) {
    'use server'
    const session2 = await getServerSession(authOptions)
    if (!session2?.user) redirect('/login')

    const prestazioneIdRaw    = formData.get('prestazioneId') as string
    const programmaPazienteId = (formData.get('programmaPazienteId') as string) || null
    const isBioscan           = prestazioneIdRaw.startsWith('BIOSCAN:')
    const bioscanTipId        = isBioscan ? prestazioneIdRaw.replace('BIOSCAN:', '') : null
    const prestazioneId       = isBioscan ? null : (programmaPazienteId ? null : (prestazioneIdRaw || null))
    // Interpretiamo SEMPRE come ora italiana: vedi lib/datetime.ts.
    const inizio              = parseDataOraItalia(formData.get('inizio') as string)

    const [prestazioneDB, bioscanTipDB, appCorrente] = await Promise.all([
      prestazioneId
        ? prisma.prestazione.findUnique({ where: { id: prestazioneId }, select: { nome: true, prezzoBase: true, durataMinuti: true } })
        : null,
      bioscanTipId
        ? prisma.tipologiaBioscan.findUnique({ where: { id: bioscanTipId }, select: { tipologia: true, prezzo: true, durataMinuti: true } })
        : null,
      prisma.appuntamento.findUnique({
        where:  { id: appId },
        select: { inizio: true, fine: true, tipoPrestazione: true, prezzoBase: true, pazienteId: true, programmaPazienteId: true },
      }),
    ])

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

    const salaIdNew2   = (formData.get('salaId')    as string) || undefined
    const medicoIdNew2 = (formData.get('medicoId')  as string) || undefined
    const pazIdNew2    = (formData.get('pazienteId') as string) || undefined

    // Se l'appuntamento era DA_RIPROGRAMMARE e la data è cambiata, torna a FISSATO
    // automaticamente: l'utente ha riprogrammato l'appuntamento senza cambiare il select.
    const statoFormulario = formData.get('stato') as string
    const dataModificata = appCorrente && inizio.getTime() !== appCorrente.inizio.getTime()
    const statoFinale = (statoFormulario === 'DA_RIPROGRAMMARE' && dataModificata)
      ? 'FISSATO'
      : statoFormulario

    await prisma.appuntamento.update({
      where: { id: appId },
      data: {
        pazienteId:      pazIdNew2,
        medicoId:        medicoIdNew2,
        salaId:          salaIdNew2,
        prestazioneId,
        ...(programmaPazienteId ? { programmaPazienteId } : {}),
        tipoPrestazione: nomePrestazione,
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
      where: { appuntamentoId: appId },
      data: {
        dataEsecuzione: inizio,
        ...(medicoIdNew2 ? { medicoId: medicoIdNew2 } : {}),
      },
    })

    if (statoFinale === 'COMPLETATO') {
      await prisma.bioscan.updateMany({ where: { appuntamentoId: appId }, data: { effettuato: true } })
      if (nomePrestazione.toLowerCase().includes('lettura') && appCorrente?.pazienteId) {
        await autoLinkLetturaReferto(appId, appCorrente.pazienteId)
      }
    }
    await sincronizzaSessioniCompletate(appCorrente?.programmaPazienteId)

    if (appCorrente?.programmaPazienteId && appCorrente.pazienteId) {
      redirect(`/pazienti/${appCorrente.pazienteId}/programma`)
    }
    redirect(backUrl)
  }

  // ── Server Action: cancella ─────────────────────────────────────────────────
  async function cancellaAppuntamento() {
    'use server'
    const session2 = await getServerSession(authOptions)
    if (!session2?.user) redirect('/login')
    await prisma.appuntamento.update({ where: { id: appId }, data: { stato: 'CANCELLATO' } })
    redirect(backUrl)
  }

  // ── Server Action: conferma eseguito ────────────────────────────────────────
  async function confermaEseguito(formData: FormData) {
    'use server'
    const session2 = await getServerSession(authOptions)
    if (!session2?.user) redirect('/login')

    const pagato           = formData.get('pagato') === 'si'
    const metodoPagamento  = formData.get('metodoPagamento') as string | null
    const app2             = await prisma.appuntamento.findUnique({ where: { id: appId } })
    if (!app2) notFound()

    const isLetturaReferto = app2.tipoPrestazione.toLowerCase().includes('lettura')

    await prisma.appuntamento.update({
      where: { id: appId },
      data: {
        stato:          'COMPLETATO',
        eseguita:       true,
        dataEsecuzione: new Date(),
        eseguitaDa:     (session2.user as { id: string }).id,
      },
    })
    await prisma.bioscan.updateMany({ where: { appuntamentoId: appId }, data: { effettuato: true } })

    if (isLetturaReferto) {
      await autoLinkLetturaReferto(appId, app2.pazienteId)
      await prisma.bioscan.updateMany({ where: { letturaRefertoId: appId }, data: { refertoConsegnato: true } })
    }

    if (!isLetturaReferto) {
      await creaOaggiornaFatturaPerAppuntamento(
        { ...app2, prezzoApplicato: Number(app2.prezzoApplicato) },
        {
          pagato,
          metodoPagamento: pagato && metodoPagamento ? metodoPagamento as any : undefined,
          dataPagamento:   pagato ? new Date() : undefined,
        }
      )
    }

    await sincronizzaSessioniCompletate(app2.programmaPazienteId)
    redirect(backUrl)
  }

  // ── Carica dati ─────────────────────────────────────────────────────────────
  const app = await prisma.appuntamento.findUnique({
    where:   { id: appId },
    include: {
      paziente:    { select: { id: true, nome: true, cognome: true, tipo: true, statoCura: true } },
      medico:      { select: { id: true, nome: true, cognome: true } },
      sala:        { select: { id: true, nome: true } },
      prestazione: { select: { id: true, nome: true } },
      team:        { select: { id: true, nome: true } },
      bioscan: {
        select: {
          id: true,
          letturaRefertoId: true,
          letturaReferto: { select: { stato: true } },
        },
      },
      bioscanLetturaReferto: { select: { id: true } },
    },
  })
  if (!app) notFound()

  const [pazientiStudio, pazienteApp, medici, medicoApp, sale, salaApp, team, prestazioni, fattura, tipologieBioscan] = await Promise.all([
    prisma.paziente.findMany({
      where:   { studioId: app.studioId },
      select:  { id: true, nome: true, cognome: true },
      orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
    }),
    prisma.paziente.findUnique({ where: { id: app.pazienteId }, select: { id: true, nome: true, cognome: true } }),
    prisma.utente.findMany({
      where:   { studioId: app.studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
      select:  { id: true, nome: true, cognome: true },
      orderBy: { cognome: 'asc' },
    }),
    prisma.utente.findUnique({ where: { id: app.medicoId }, select: { id: true, nome: true, cognome: true } }),
    prisma.sala.findMany({ where: { studioId: app.studioId, attiva: true }, select: { id: true, nome: true }, orderBy: { ordine: 'asc' } }),
    prisma.sala.findUnique({ where: { id: app.salaId }, select: { id: true, nome: true } }),
    prisma.team.findMany({ where: { studioId: app.studioId, attivo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.prestazione.findMany({ where: { attiva: true }, select: { id: true, nome: true, prezzoBase: true, durataMinuti: true }, orderBy: { ordine: 'asc' } }),
    prisma.fattura.findFirst({ where: { appuntamentoId: appId }, orderBy: { createdAt: 'asc' }, select: { id: true, numero: true, anno: true, stato: true, metodoPagamento: true } }),
    prisma.tipologiaBioscan.findMany({ where: { attiva: true }, select: { id: true, tipologia: true, prezzo: true, durataMinuti: true }, orderBy: { ordine: 'asc' } }),
  ])

  const normalizza = (p: { id: string; nome: string; cognome: string | null }): { id: string; nome: string; cognome: string } =>
    ({ id: p.id, nome: p.nome, cognome: p.cognome ?? '' })

  const pazientiBase = pazienteApp && !pazientiStudio.some(p => p.id === pazienteApp.id)
    ? [pazienteApp, ...pazientiStudio]
    : pazientiStudio
  const pazienti = pazientiBase.map(normalizza)

  const mediciList = medicoApp && !medici.some(m => m.id === medicoApp.id)
    ? [medicoApp, ...medici]
    : medici
  const saleList = salaApp && !sale.some(s => s.id === salaApp.id)
    ? [salaApp, ...sale]
    : sale

  const prestazioniMerged = [
    ...tipologieBioscan.map(t => ({
      id: `BIOSCAN:${t.id}`,
      nome: t.tipologia.toLowerCase().includes('bioscan') ? t.tipologia : `Bioscan — ${t.tipologia}`,
      prezzoBase: Number(t.prezzo ?? 0), durataMinuti: t.durataMinuti,
    })),
    ...prestazioni.map(p => ({ id: p.id, nome: p.nome, prezzoBase: Number(p.prezzoBase), durataMinuti: p.durataMinuti })),
  ]

  const bioscanDefault = tipologieBioscan.find(t => t.tipologia.toLowerCase() === app.tipoPrestazione.toLowerCase())
  const defaultPrestazioneId = bioscanDefault ? `BIOSCAN:${bioscanDefault.id}` : (app.prestazioneId ?? '')

  const isLetturaReferto = app.tipoPrestazione.toLowerCase().includes('lettura')
  const isBioscanApp     = !!app.bioscan

  const letturaRefertoFallback = (isBioscanApp && !app.bioscan?.letturaRefertoId)
    ? await prisma.appuntamento.findFirst({
        where: { pazienteId: app.pazienteId, tipoPrestazione: { contains: 'lettura', mode: 'insensitive' }, stato: { notIn: ['CANCELLATO'] } },
        select: { id: true },
      })
    : null

  const bioscanHaLetturaReferto = isBioscanApp && !!app.bioscan?.letturaRefertoId && app.bioscan?.letturaReferto?.stato === 'COMPLETATO'
  const mostraFissaLettura = isBioscanApp && app.stato === 'COMPLETATO' && !app.bioscan?.letturaRefertoId && !letturaRefertoFallback

  const STATI = [
    { v: 'FISSATO',          l: 'Fissato' },
    { v: 'CONFERMATO',       l: 'Confermato' },
    { v: 'COMPLETATO',       l: 'Effettuato' },
    { v: 'CANCELLATO',       l: 'Cancellato' },
    { v: 'NO_SHOW',          l: 'No Show' },
    { v: 'DA_RIPROGRAMMARE', l: 'Da riprogrammare' },
  ]

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Modifica appuntamento</h1>
      </div>

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

      <form action={salvaModifiche} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <PazienteSearch pazienti={pazienti} defaultId={app.pazienteId} required />

        <TipoAppuntamentoSelect
          tipologieBioscan={tipologieBioscan.map(t => ({ id: t.id, tipologia: t.tipologia, prezzo: Number(t.prezzo ?? 0), durataMinuti: t.durataMinuti }))}
          prestazioni={prestazioni.map(p => ({ id: p.id, nome: p.nome, prezzoBase: Number(p.prezzoBase), durataMinuti: p.durataMinuti }))}
          defaultPrestazioneId={defaultPrestazioneId}
          defaultProgrammaId={app.programmaPazienteId ?? ''}
          defaultPrezzo={Number(app.prezzoApplicato)}
          pazienteIdIniziale={app.pazienteId}
        />

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

        <div>
          <label className="block text-sm font-medium text-slate-700">Stato</label>
          <select name="stato" defaultValue={app.stato} className={cls}>
            {STATI.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Note prezzo</label>
          <input type="text" name="notePrezzo" defaultValue={app.notePrezzo ?? ''} placeholder="Es. sconto famiglia, convenzione…" className={cls} />
        </div>

        {team.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Team (opzionale)</label>
            <select name="teamId" defaultValue={app.teamId ?? ''} className={cls}>
              <option value="">— Nessun team —</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="note" rows={2} defaultValue={app.note ?? ''} className={cls} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href={backUrl} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>

      {isLetturaReferto ? (
        <section className="rounded-3xl border border-teal-200 bg-teal-50 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-teal-900">Lettura referto</h2>
          <p className="text-sm text-teal-700">La lettura referto è gratuita — nessun documento fiscale da emettere.</p>
          {app.stato !== 'COMPLETATO' && (
            <form action={confermaEseguito}>
              <input type="hidden" name="pagato" value="no" />
              <button type="submit" className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                Conferma lettura referto eseguita
              </button>
            </form>
          )}
          {app.stato === 'COMPLETATO' && (
            <p className="text-xs text-teal-600">Lettura completata.</p>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Conferma esecuzione e documento fiscale</h2>
              <p className="text-sm text-slate-500">
                Genera una {app.paziente.tipo === 'AZIENDA' ? 'fattura' : 'ricevuta'} per questo appuntamento.
              </p>
            </div>
            {fattura ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Documento: {fattura.anno}/{String(fattura.numero).padStart(4, '0')} · {fattura.stato}
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Nessun documento ancora emesso.</div>
            )}
          </div>
          <form action={confermaEseguito} className="space-y-5">
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
                  <option value="TOKEN">Token</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                {fattura ? 'Aggiorna documento' : 'Conferma eseguito'}
              </button>
            </div>
          </form>
        </section>
      )}

      {mostraFissaLettura && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">Lettura referto da fissare</p>
              <p className="text-xs text-amber-700 mt-0.5">Il bioscan è stato eseguito — fissa ora l'appuntamento per la lettura del referto.</p>
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

      <form action={cancellaAppuntamento}>
        <button type="submit" className="rounded-full border border-red-200 px-5 py-2.5 text-sm text-red-600 hover:bg-red-50">
          Cancella appuntamento
        </button>
      </form>

      <p className="text-xs text-slate-400">
        Creato il {app.createdAt.toLocaleString('it-IT')} · ID: {app.id}
      </p>
    </div>
  )
}
