// Pagina fatture: sezione "da gestire" + lista con filtro per stato e mese
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { creaOaggiornaFatturaPerAppuntamento, creaOaggiornaFatturaPerBioscan } from '@/lib/fatturazione'
import Paginazione from '@/components/Paginazione'
import AzioniFatturaRow from './AzioniFatturaRow'

// ── Server action: emetti ricevuta per un appuntamento ─────────────────────────
async function emettiRicevuta(appId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const app = await prisma.appuntamento.findUnique({
    where:  { id: appId },
    select: { id: true, studioId: true, pazienteId: true, tipoPrestazione: true, prezzoApplicato: true },
  })
  if (!app) return

  await creaOaggiornaFatturaPerAppuntamento(
    { ...app, prezzoApplicato: Number(app.prezzoApplicato) },
    { pagato: false }
  )
  revalidatePath('/fatture')
}

// ── Server action: registra pagamento su fattura di appuntamento ───────────────
async function registraPagamento(appId: string, metodo: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const fattura = await prisma.fattura.findUnique({ where: { appuntamentoId: appId } })
  if (!fattura) return

  await prisma.fattura.update({
    where: { id: fattura.id },
    data: {
      stato:           'PAGATA',
      dataPagamento:   new Date(),
      metodoPagamento: metodo as any,
    },
  })
  revalidatePath('/fatture')
}

// ── Server action: emetti ricevuta per un bioscan ──────────────────────────────
async function emettiBioscanRicevuta(bioscanId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const b = await prisma.bioscan.findUnique({
    where:  { id: bioscanId },
    select: { id: true, studioId: true, pazienteId: true, prezzo: true },
  })
  if (!b || !b.prezzo) return

  await creaOaggiornaFatturaPerBioscan(
    { ...b, prezzo: Number(b.prezzo) },
    { pagato: false }
  )
  revalidatePath('/fatture')
}

// ── Server action: registra pagamento su fattura di bioscan ───────────────────
async function registraPagamentoBioscan(bioscanId: string, metodo: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const fattura = await prisma.fattura.findUnique({ where: { bioscanId } })
  if (!fattura) return

  await prisma.fattura.update({
    where: { id: fattura.id },
    data: {
      stato:           'PAGATA',
      dataPagamento:   new Date(),
      metodoPagamento: metodo as any,
    },
  })
  revalidatePath('/fatture')
}

const PER_PAGINA = 15

const BADGE: Record<string, string> = {
  EMESSA:    'bg-amber-100 text-amber-700',
  PAGATA:    'bg-green-100 text-green-700',
  ANNULLATA: 'bg-red-100 text-red-600',
}

export default async function FatturePage({
  searchParams
}: {
  searchParams: Promise<{
    stato?: string; mese?: string; page?: string; paziente?: string; studio?: string; pageDE?: string
    studioDE?: string; pazienteDE?: string; dataDE?: string
  }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { stato, mese, page: pageParam, paziente, studio,
          pageDE: pageDEParam, studioDE, pazienteDE, dataDE } = await searchParams
  const pagina   = Math.max(1, Number(pageParam)   || 1)
  const paginaDE = Math.max(1, Number(pageDEParam) || 1)
  const skip     = (pagina   - 1) * PER_PAGINA
  const skipDE   = (paginaDE - 1) * PER_PAGINA
  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}

  // Studi disponibili per il filtro (solo SUPERADMIN/ADMIN vedono tutti)
  const isSuperAdmin = ctx.ruolo === 'SUPERADMIN' || ctx.ruolo === 'ADMIN'
  const studi = isSuperAdmin
    ? await prisma.studio.findMany({ where: { attivo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } })
    : []

  // Filtro per mese (formato YYYY-MM)
  let rangeDate = {}
  if (mese) {
    const [anno, m] = mese.split('-').map(Number)
    rangeDate = {
      dataEmissione: {
        gte: new Date(anno, m - 1, 1),
        lt:  new Date(anno, m, 1)
      }
    }
  }

  const whereF = {
    ...ws,
    ...(studio   ? { studioId: studio } : {}),
    ...(stato    ? { stato: stato as never } : {}),
    ...(paziente ? {
      paziente: {
        OR: [
          { cognome: { contains: paziente, mode: 'insensitive' as const } },
          { nome:    { contains: paziente, mode: 'insensitive' as const } },
        ]
      }
    } : {}),
    ...rangeDate,
  }

  // Filtri comuni per la sezione "da gestire"
  const filtriDG = {
    ...ws,
    stato: 'COMPLETATO',
    prezzoApplicato: { gt: 0 },
    ...(studioDE  ? { studioId: studioDE } : {}),
    ...(pazienteDE ? {
      paziente: {
        OR: [
          { cognome: { contains: pazienteDE, mode: 'insensitive' } },
          { nome:    { contains: pazienteDE, mode: 'insensitive' } },
        ]
      }
    } : {}),
    ...(dataDE ? {
      inizio: {
        gte: new Date(dataDE),
        lt:  new Date(new Date(dataDE).getTime() + 86400000),
      }
    } : {}),
  }
  // bioscan: { is: null } esclude gli appuntamenti bioscan, già gestiti nella sezione bioscanDaEmettere
  const whereDE = { ...filtriDG, fattura: { is: null },                         bioscan: { is: null } }
  const whereEN = { ...filtriDG, fattura: { is: { stato: 'EMESSA' as const } }, bioscan: { is: null } }

  // Filtri comuni per bioscan (solo studioId e paziente, non prezzoApplicato/stato)
  const filtriBioscanDG = {
    ...ws,
    prezzo: { gt: 0 },
    ...(studioDE  ? { studioId: studioDE } : {}),
    ...(pazienteDE ? {
      paziente: {
        OR: [
          { cognome: { contains: pazienteDE, mode: 'insensitive' as const } },
          { nome:    { contains: pazienteDE, mode: 'insensitive' as const } },
        ]
      }
    } : {}),
  }
  const whereBDE = { ...filtriBioscanDG, fattura: { is: null } }
  const whereBEN = { ...filtriBioscanDG, fattura: { is: { stato: 'EMESSA' as const } } }

  // Carica tutti e 4 gli insiemi senza paginazione, poi li combina e pagina insieme
  const [appsDE, appsEN, biosDE, biosEN] = await Promise.all([
    prisma.appuntamento.findMany({
      where:   whereDE,
      include: { paziente: { select: { id: true, nome: true, cognome: true } }, studio: { select: { nome: true } } },
      orderBy: { inizio: 'asc' },
    }),
    prisma.appuntamento.findMany({
      where:   whereEN,
      include: { paziente: { select: { id: true, nome: true, cognome: true } }, studio: { select: { nome: true } } },
      orderBy: { inizio: 'asc' },
    }),
    prisma.bioscan.findMany({
      where:   whereBDE,
      include: { paziente: { select: { id: true, nome: true, cognome: true } }, studio: { select: { nome: true } } },
      orderBy: { dataEsecuzione: 'asc' },
    }),
    prisma.bioscan.findMany({
      where:   whereBEN,
      include: { paziente: { select: { id: true, nome: true, cognome: true } }, studio: { select: { nome: true } } },
      orderBy: { dataEsecuzione: 'asc' },
    }),
  ])

  // Tipo unione per gli elementi della sezione "Da gestire"
  type ItemDaGestire =
    | { tipo: 'da_emettere';         data: Date; app:     typeof appsDE[0] }
    | { tipo: 'emessa_non_pagata';   data: Date; app:     typeof appsEN[0] }
    | { tipo: 'bioscan_da_emettere'; data: Date; bioscan: typeof biosDE[0] }
    | { tipo: 'bioscan_emessa';      data: Date; bioscan: typeof biosEN[0] }

  // Combina e ordina tutti gli elementi per data crescente
  const tuttiDaGestire: ItemDaGestire[] = [
    ...appsDE.map(app    => ({ tipo: 'da_emettere'         as const, data: app.inizio,           app })),
    ...appsEN.map(app    => ({ tipo: 'emessa_non_pagata'   as const, data: app.inizio,           app })),
    ...biosDE.map(bioscan => ({ tipo: 'bioscan_da_emettere' as const, data: bioscan.dataEsecuzione, bioscan })),
    ...biosEN.map(bioscan => ({ tipo: 'bioscan_emessa'      as const, data: bioscan.dataEsecuzione, bioscan })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime())

  const totaleDaGestire  = tuttiDaGestire.length
  const daGestirePaginati = tuttiDaGestire.slice(skipDE, skipDE + PER_PAGINA)

  const [fatture, totaleFatture] = await Promise.all([
    prisma.fattura.findMany({
      where: whereF,
      include: {
        paziente: { select: { id: true, nome: true, cognome: true, ragioneSociale: true, tipo: true } },
        studio:   { select: { nome: true } }
      },
      orderBy: [{ anno: 'desc' }, { numero: 'desc' }],
      skip,
      take: PER_PAGINA,
    }),
    prisma.fattura.count({ where: whereF }),
  ])

  // Totale importo filtrato
  const totale = fatture.reduce((acc, f) => acc + Number(f.importo), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-600">Fatture</h1>
        <a href="/fatture/nuovo" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
          + Nuova fattura
        </a>
        <span className="text-sm font-medium text-slate-600">
          Totale: <strong>€ {totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
        </span>
      </div>

      {/* ── Da gestire: da emettere + emesse non pagate ─────────────────────── */}
      {totaleDaGestire > 0 && (
        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-orange-800">
              Da gestire ({totaleDaGestire})
            </h2>
            <form method="GET" className="flex flex-wrap gap-2">
              {stato     && <input type="hidden" name="stato"  value={stato} />}
              {mese      && <input type="hidden" name="mese"   value={mese} />}
              {pageParam && <input type="hidden" name="page"   value={pageParam} />}

              {isSuperAdmin && studi.length > 1 && (
                <select name="studioDE" defaultValue={studioDE ?? ''}
                  className="rounded-xl border border-orange-300 bg-white px-3 py-1.5 text-xs outline-none">
                  <option value="">Tutti gli studi</option>
                  {studi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              )}
              <input name="pazienteDE" type="text" defaultValue={pazienteDE ?? ''}
                placeholder="Paziente…"
                className="rounded-xl border border-orange-300 bg-white px-3 py-1.5 text-xs outline-none w-36" />
              <input name="dataDE" type="date" defaultValue={dataDE ?? ''}
                className="rounded-xl border border-orange-300 bg-white px-3 py-1.5 text-xs outline-none" />
              <button type="submit"
                className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                Filtra
              </button>
              {(studioDE || pazienteDE || dataDE) && (
                <a href="/fatture" className="rounded-full border border-orange-300 px-3 py-1.5 text-xs text-orange-700 hover:bg-orange-100">
                  Reset
                </a>
              )}
            </form>
          </div>
          <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-orange-100 bg-orange-50/60 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-orange-700">Data</th>
                  <th className="px-4 py-2.5 font-medium text-orange-700">Paziente</th>
                  <th className="px-4 py-2.5 font-medium text-orange-700">Studio</th>
                  <th className="px-4 py-2.5 font-medium text-orange-700">Prestazione</th>
                  <th className="px-4 py-2.5 font-medium text-orange-700">Importo</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {/* Lista combinata e paginata di tutti gli elementi da gestire */}
                {daGestirePaginati.map(item => {
                  if (item.tipo === 'da_emettere' || item.tipo === 'emessa_non_pagata') {
                    const app = item.app
                    return (
                      <tr key={app.id}>
                        <td className="px-4 py-2.5 text-slate-600">{app.inizio.toLocaleDateString('it-IT')}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          <a href={`/pazienti/${app.paziente.id}`} className="text-indigo-600 hover:underline">
                            {app.paziente.cognome} {app.paziente.nome}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{app.studio?.nome ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600">{app.tipoPrestazione}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          € {Number(app.prezzoApplicato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5">
                          <AzioniFatturaRow
                            itemId={app.id}
                            statoIniziale={item.tipo === 'da_emettere' ? 'da_emettere' : 'emessa'}
                            onEmettiRicevuta={emettiRicevuta}
                            onRegistraPagamento={registraPagamento}
                          />
                        </td>
                      </tr>
                    )
                  } else {
                    const b = item.bioscan
                    return (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5 text-slate-600">{b.dataEsecuzione.toLocaleDateString('it-IT')}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          <a href={`/pazienti/${b.paziente.id}`} className="text-indigo-600 hover:underline">
                            {b.paziente.cognome} {b.paziente.nome}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{b.studio?.nome ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600">Bioscan</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          € {Number(b.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5">
                          <AzioniFatturaRow
                            itemId={b.id}
                            statoIniziale={item.tipo === 'bioscan_da_emettere' ? 'da_emettere' : 'emessa'}
                            onEmettiRicevuta={emettiBioscanRicevuta}
                            onRegistraPagamento={registraPagamentoBioscan}
                          />
                        </td>
                      </tr>
                    )
                  }
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Paginazione
              paginaCorrente={paginaDE}
              totale={totaleDaGestire}
              perPagina={PER_PAGINA}
              baseUrl="/fatture"
              queryParams={{ stato, mese, page: pageParam, studioDE, pazienteDE, dataDE }}
              pageParam="pageDE"
            />
          </div>
        </div>
      )}

      {/* Filtri */}
      <form method="GET" className="flex flex-wrap gap-3">
        {isSuperAdmin && studi.length > 1 && (
          <select name="studio" defaultValue={studio ?? ''}
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none">
            <option value="">Tutti gli studi</option>
            {studi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
        <input
          name="paziente"
          type="text"
          defaultValue={paziente ?? ''}
          placeholder="Nome paziente…"
          className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none"
        />
        <select
          name="stato"
          defaultValue={stato ?? ''}
          className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none"
        >
          <option value="">Tutti gli stati</option>
          <option value="EMESSA">Emessa</option>
          <option value="PAGATA">Pagata</option>
          <option value="ANNULLATA">Annullata</option>
        </select>
        <input
          name="mese"
          type="month"
          defaultValue={mese}
          className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none"
        />
        <button type="submit" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
          Filtra
        </button>
        {(stato || mese || paziente || studio) && (
          <a href="/fatture" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Reset
          </a>
        )}
      </form>

      {/* Tabella */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {fatture.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Nessuna fattura trovata.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-5 py-3 font-medium text-slate-600">N°</th>
                <th className="px-5 py-3 font-medium text-slate-600">Paziente</th>
                <th className="px-5 py-3 font-medium text-slate-600">Studio</th>
                <th className="px-5 py-3 font-medium text-slate-600">Importo</th>
                <th className="px-5 py-3 font-medium text-slate-600">Stato</th>
                <th className="hidden px-5 py-3 font-medium text-slate-600 md:table-cell">Tipo</th>
                <th className="hidden px-5 py-3 font-medium text-slate-600 md:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fatture.map((f) => {
                const nomePaziente = f.paziente.tipo === 'AZIENDA'
                  ? (f.paziente.ragioneSociale ?? '—')
                  : `${f.paziente.cognome ?? ''} ${f.paziente.nome}`.trim()
                return (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono">
                      <a href={`/fatture/${f.id}`} className="font-semibold text-indigo-600 hover:underline">
                        {f.anno}/{String(f.numero).padStart(4, '0')}
                      </a>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <a href={`/pazienti/${f.paziente.id}`} className="text-indigo-600 hover:underline">
                        {nomePaziente}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{f.studio?.nome ?? '—'}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      € {Number(f.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[f.stato]}`}>
                        {f.stato}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 md:table-cell">{f.tipo}</td>
                    <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                      {f.dataEmissione.toLocaleDateString('it-IT')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Paginazione
        paginaCorrente={pagina}
        totale={totaleFatture}
        perPagina={PER_PAGINA}
        baseUrl="/fatture"
        queryParams={{ stato, mese, paziente, studio }}
      />
    </div>
  )
}
