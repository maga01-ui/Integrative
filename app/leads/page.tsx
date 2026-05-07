// Pagina leads — 4 bucket: Da gestire | Fissati | Follow-up | Nascosti
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import Paginazione from '@/components/Paginazione'
import { Clock, Pencil, EyeOff, RotateCcw } from 'lucide-react'
import { formatTelefono } from '@/lib/telefono'

const PER_PAGINA = 15

// ── Server Actions ──────────────────────────────────────────────────────────

async function nascondiLead(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.lead.update({
    where: { id: formData.get('leadId') as string },
    data: { nascosto: true },
  })
  redirect('/leads')
}

async function ripristina(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.lead.update({
    where: { id: formData.get('leadId') as string },
    data: { nascosto: false },
  })
  redirect('/leads?filtro=nascosti')
}

async function fissaAppuntamento(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.lead.update({
    where: { id: formData.get('leadId') as string },
    data: { stato: 'FISSATO' },
  })
  redirect('/leads')
}

async function salvaNota(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const nota = (formData.get('nota') as string) || null
  await prisma.lead.update({
    where: { id: formData.get('leadId') as string },
    data: { noteOperatore: nota },
  })
  redirect('/leads')
}

// ── Costanti visualizzazione ─────────────────────────────────────────────────

const BADGE: Record<string, string> = {
  NUOVO:            'bg-sky-100 text-sky-700',
  DA_RICHIAMARE:    'bg-orange-100 text-orange-700',
  FOLLOW_UP:        'bg-orange-100 text-orange-700',
  FISSATO:          'bg-blue-100 text-blue-700',
  IN_ATTESA_CENTRO: 'bg-purple-100 text-purple-700',
  APPUNTAMENTO:     'bg-green-100 text-green-700',
  CONVERTITO:       'bg-emerald-100 text-emerald-700',
  NON_INTERESSATO:  'bg-slate-100 text-slate-500',
}

const LABEL: Record<string, string> = {
  NUOVO:            'Nuovo',
  DA_RICHIAMARE:    'Follow-up',
  FOLLOW_UP:        'Follow-up',
  FISSATO:          'Fissato',
  IN_ATTESA_CENTRO: 'In attesa centro',
  APPUNTAMENTO:     'Appuntamento',
  CONVERTITO:       'Convertito',
  NON_INTERESSATO:  'Non interessato',
}

// Stati che appartengono al bucket "Fissati"
const STATI_FISSATI   = ['FISSATO', 'APPUNTAMENTO', 'CONVERTITO']
// Stati che appartengono al bucket "Follow-up" (NUOVO escluso: ha il suo bucket)
const STATI_FOLLOW_UP = ['FOLLOW_UP', 'DA_RICHIAMARE', 'IN_ATTESA_CENTRO']

// ── Pagina ──────────────────────────────────────────────────────────────────

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string; centroId?: string; page?: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { filtro = 'da_gestire', q, centroId, page: pageParam } = await searchParams
  const pagina = Math.max(1, Number(pageParam) || 1)
  const skip   = (pagina - 1) * PER_PAGINA

  // Solo SUPERADMIN vede tutti i lead quando nessun centro è selezionato.
  // STAFF, MEDICO e MARKETING vedono solo quelli del loro studio.
  const isAmministratore = ctx.ruolo === 'SUPERADMIN'
  const wsStudio = (!isAmministratore && ctx.studioId) ? { studioId: ctx.studioId } : {}

  // Se è selezionato un centro specifico, filtra per quello (sovrascrive wsStudio)
  const filtroCentro = centroId ? { studioId: centroId } : {}

  // Stati da escludere dal bucket "Da gestire" (hanno già il loro bucket)
  const STATI_GIA_GESTITI = [...STATI_FISSATI, 'NON_INTERESSATO']

  // WHERE clause basato sul bucket selezionato
  const bucketWhere = (() => {
    if (filtro === 'fissati')      return { nascosto: false, stato: { in: STATI_FISSATI     as never[] } }
    if (filtro === 'follow_up')    return { nascosto: false, stato: { in: STATI_FOLLOW_UP   as never[] } }
    if (filtro === 'nascosti')     return { nascosto: true }
    if (filtro === 'da_assegnare') return { nascosto: false, studioId: null }
    // da_gestire: non-nascosti che non sono ancora fissati/convertiti/non interessati
    return { nascosto: false, stato: { notIn: STATI_GIA_GESTITI as never[] } }
  })()

  const searchWhere = q ? {
    OR: [
      { nome:     { contains: q, mode: 'insensitive' as const } },
      { cognome:  { contains: q, mode: 'insensitive' as const } },
      { telefono: { contains: q, mode: 'insensitive' as const } },
    ],
  } : {}

  const where = { ...wsStudio, ...filtroCentro, ...bucketWhere, ...searchWhere }

  // Query in parallelo
  const [leads, totaleLeads, contatoriRaw, centri] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ urgente: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: PER_PAGINA,
      include: { studio: { select: { nome: true } } },
    }),
    prisma.lead.count({ where }),
    // Conta per nascosto+stato — servirà per i 4 badge
    prisma.lead.groupBy({
      by: ['nascosto', 'stato'],
      where: { ...wsStudio, ...filtroCentro },
      _count: true,
    }),
    // Tutti i centri per il filtro
    prisma.studio.findMany({
      where: { attivo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  // Conta separatamente i lead senza studio (da assegnare)
  const cDaAssegnare = await prisma.lead.count({
    where: { ...wsStudio, nascosto: false, studioId: null },
  })

  // Calcola contatori per bucket
  const STATI_GIA_GESTITI_SET = new Set([...STATI_FISSATI, 'NON_INTERESSATO'])
  let cDaGestire = 0, cFissati = 0, cFollowUp = 0, cNascosti = 0
  for (const r of contatoriRaw) {
    if (r.nascosto) {
      cNascosti += r._count
    } else {
      // "Da gestire" conta solo i lead che non sono ancora fissati/convertiti
      if (!STATI_GIA_GESTITI_SET.has(r.stato)) cDaGestire += r._count
      if (STATI_FISSATI.includes(r.stato))     cFissati   += r._count
      if (STATI_FOLLOW_UP.includes(r.stato))   cFollowUp  += r._count
    }
  }

  const BUCKET = [
    { key: 'da_gestire',  label: 'Da gestire',  count: cDaGestire   },
    { key: 'fissati',     label: 'Fissati',      count: cFissati     },
    { key: 'follow_up',   label: 'Follow-up',    count: cFollowUp    },
    { key: 'da_assegnare',label: 'Da assegnare', count: cDaAssegnare },
    { key: 'nascosti',    label: 'Nascosti',     count: cNascosti    },
  ]

  // Costruisce query string preservando i filtri attivi
  const qp = (extra: Record<string, string>) => {
    const p = new URLSearchParams()
    if (q)        p.set('q', q)
    if (centroId) p.set('centroId', centroId)
    if (filtro)   p.set('filtro', filtro)
    Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  return (
    <div className="space-y-6">

      {/* Intestazione */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-600">Leads</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{leads.length} trovati</span>
          <a href="/leads/nuovo"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            + Nuovo lead
          </a>
        </div>
      </div>

      {/* ── Filtro per centro ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Centro:</span>
        <a href={`/leads${qp({ centroId: '' })}`}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${!centroId ? 'bg-brand text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Tutti
        </a>
        {centri.map((c: { id: string; nome: string }) => (
          <a key={c.id} href={`/leads${qp({ centroId: c.id })}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${centroId === c.id ? 'bg-brand text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {c.nome}
          </a>
        ))}
      </div>

      {/* ── 4 bucket di stato ── */}
      <div className="flex flex-wrap gap-2">
        {BUCKET.map((b) => (
          <a key={b.key} href={`/leads${qp({ filtro: b.key })}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${filtro === b.key ? 'bg-brand text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {b.label}
            {b.count > 0 && <span className="ml-1.5 text-xs opacity-70">({b.count})</span>}
          </a>
        ))}
      </div>

      {/* ── Ricerca testo libero ── */}
      <form method="GET" className="flex gap-3">
        {filtro   && <input type="hidden" name="filtro"   value={filtro} />}
        {centroId && <input type="hidden" name="centroId" value={centroId} />}
        <input name="q" defaultValue={q}
          placeholder="Cerca per nome, cognome, telefono…"
          className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900" />
        <button type="submit"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
          Cerca
        </button>
      </form>

      {/* ── Tabella compatta ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {leads.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Nessun lead in questa categoria.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 font-medium text-slate-600">Telefono</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 md:table-cell">Studio</th>
                <th className="px-4 py-3 font-medium text-slate-600">Stato</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 lg:table-cell">Data</th>
                <th className="hidden px-4 py-3 font-medium text-slate-600 lg:table-cell">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id}
                  className={`${l.urgente ? 'bg-rose-50/40' : 'hover:bg-slate-50'}`}>

                  {/* Nome */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {l.urgente && <span className="text-rose-400 text-[10px]">●</span>}
                      <a href={`/leads/${l.id}`} className="font-semibold text-slate-900 hover:underline">
                        {l.cognome} {l.nome}
                      </a>
                    </div>
                  </td>

                  {/* Telefono + WA */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <a href={`https://wa.me/${l.telefono.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer" title="Chiama su WhatsApp"
                        className="whitespace-nowrap font-medium text-green-700 hover:underline">
                        {formatTelefono(l.telefono)}
                      </a>
                    </div>
                  </td>

                  {/* Studio */}
                  <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">
                    {l.studio?.nome ?? <span className="text-slate-300">—</span>}
                  </td>

                  {/* Stato */}
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[l.stato]}`}>
                      {LABEL[l.stato]}
                    </span>
                  </td>

                  {/* Data */}
                  <td className="hidden px-4 py-2.5 text-xs text-slate-400 lg:table-cell">
                    {l.dataLead.toLocaleDateString('it-IT')}
                    {l.canale && <span className="block text-slate-300">{l.canale}</span>}
                  </td>

                  {/* Note (troncate — tooltip al hover mostra il testo completo) */}
                  <td className="hidden px-4 py-2.5 lg:table-cell">
                    {l.noteOperatore
                      ? <span title={l.noteOperatore} className="cursor-default text-xs text-slate-400 line-clamp-1">{l.noteOperatore}</span>
                      : <span className="text-xs text-slate-200">—</span>}
                  </td>

                  {/* Azioni — icone compatte */}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      {filtro !== 'nascosti' && !STATI_FISSATI.includes(l.stato) && (
                        <a href={`/calendario/nuovo?leadId=${l.id}`}
                          title="Fissa appuntamento"
                          className={iconBtn + ' text-blue-500 hover:bg-blue-50'}>
                          <Clock size={15} />
                        </a>
                      )}
                      <a href={`/leads/${l.id}`}
                        title="Modifica"
                        className={iconBtn + ' text-slate-500 hover:bg-slate-100'}>
                        <Pencil size={15} />
                      </a>
                      {filtro !== 'nascosti' && (
                        <form action={nascondiLead}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <button type="submit" title="Nascondi"
                            className={iconBtn + ' text-slate-400 hover:bg-slate-100'}>
                            <EyeOff size={15} />
                          </button>
                        </form>
                      )}
                      {filtro === 'nascosti' && (
                        <form action={ripristina}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <button type="submit" title="Ripristina"
                            className={iconBtn + ' text-slate-500 hover:bg-slate-100'}>
                            <RotateCcw size={15} />
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Paginazione
        paginaCorrente={pagina}
        totale={totaleLeads}
        perPagina={PER_PAGINA}
        baseUrl="/leads"
        queryParams={{ filtro, q, centroId }}
      />
    </div>
  )
}

const iconBtn = 'inline-flex items-center justify-center rounded-lg p-1.5 transition'

// ── Icone ───────────────────────────────────────────────────────────────────

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.524 5.828L.057 23.886a.5.5 0 0 0 .606.61l6.288-1.65A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.877 9.877 0 0 1-5.034-1.378l-.36-.214-3.733.979.997-3.64-.235-.374A9.859 9.859 0 0 1 2.118 12C2.118 6.533 6.533 2.118 12 2.118S21.882 6.533 21.882 12 17.467 21.882 12 21.882z"/>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
