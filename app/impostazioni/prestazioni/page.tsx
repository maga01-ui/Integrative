// Lista prestazioni dello studio: riordinabili, attivabili/disattivabili, modificabili, eliminabili
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import BackButton from '@/components/ui/BackButton'
import BtnElimina from '@/app/impostazioni/origini/BtnElimina'

// ── Sposta una prestazione su o giù scambiando i valori di ordine ─────────────
async function spostaOrdine(id: string, direzione: 'su' | 'giu') {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Carica la prestazione corrente
  const corrente = await prisma.prestazione.findUnique({ where: { id } })
  if (!corrente) return

  // Cerca l'elemento adiacente nello stesso studio
  const adiacente = await prisma.prestazione.findFirst({
    where: {
      studioId: corrente.studioId,
      ordine:   direzione === 'su'
        ? { lt: corrente.ordine }   // il precedente ha ordine minore
        : { gt: corrente.ordine },  // il successivo ha ordine maggiore
    },
    orderBy: { ordine: direzione === 'su' ? 'desc' : 'asc' },
  })

  if (!adiacente) return  // già in cima o in fondo

  // Scambia i valori di ordine tra i due record
  await prisma.$transaction([
    prisma.prestazione.update({ where: { id: corrente.id  }, data: { ordine: adiacente.ordine } }),
    prisma.prestazione.update({ where: { id: adiacente.id }, data: { ordine: corrente.ordine  } }),
  ])

  revalidatePath('/impostazioni/prestazioni')
}

// ── Elimina una prestazione ───────────────────────────────────────────────────
async function eliminaPrestazione(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.prestazione.delete({ where: { id } })
  revalidatePath('/impostazioni/prestazioni')
}

// ── Attiva o disattiva una prestazione ────────────────────────────────────────
async function toggleAttiva(id: string, attiva: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.prestazione.update({ where: { id }, data: { attiva: !attiva } })
  revalidatePath('/impostazioni/prestazioni')
}

// ── Server actions Bioscan ────────────────────────────────────────────────────
async function toggleBioscan(id: string, attiva: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.tipologiaBioscan.update({ where: { id }, data: { attiva: !attiva } })
  revalidatePath('/impostazioni/prestazioni')
}

async function eliminaBioscan(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.tipologiaBioscan.delete({ where: { id } })
  revalidatePath('/impostazioni/prestazioni')
}

async function spostaOrdineBioscan(id: string, direzione: 'su' | 'giu') {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const corrente = await prisma.tipologiaBioscan.findUnique({ where: { id } })
  if (!corrente) return
  const adiacente = await prisma.tipologiaBioscan.findFirst({
    where: {
      studioId: corrente.studioId,
      ordine: direzione === 'su' ? { lt: corrente.ordine } : { gt: corrente.ordine },
    },
    orderBy: { ordine: direzione === 'su' ? 'desc' : 'asc' },
  })
  if (!adiacente) return
  await prisma.$transaction([
    prisma.tipologiaBioscan.update({ where: { id: corrente.id  }, data: { ordine: adiacente.ordine } }),
    prisma.tipologiaBioscan.update({ where: { id: adiacente.id }, data: { ordine: corrente.ordine  } }),
  ])
  revalidatePath('/impostazioni/prestazioni')
}

async function eliminaFito(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.prodottoFito.delete({ where: { id } })
  revalidatePath('/impostazioni/prestazioni')
}

async function toggleFito(id: string, attivo: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.prodottoFito.update({ where: { id }, data: { attivo: !attivo } })
  revalidatePath('/impostazioni/prestazioni')
}

// ── Server actions per i Programmi ───────────────────────────────────────────
async function spostaOrdineProg(id: string, direzione: 'su' | 'giu') {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const corrente = await prisma.programma.findUnique({ where: { id } })
  if (!corrente) return
  const adiacente = await prisma.programma.findFirst({
    where: { ordine: direzione === 'su' ? { lt: corrente.ordine } : { gt: corrente.ordine } },
    orderBy: { ordine: direzione === 'su' ? 'desc' : 'asc' },
  })
  if (!adiacente) return
  await prisma.$transaction([
    prisma.programma.update({ where: { id: corrente.id  }, data: { ordine: adiacente.ordine } }),
    prisma.programma.update({ where: { id: adiacente.id }, data: { ordine: corrente.ordine  } }),
  ])
  revalidatePath('/impostazioni/prestazioni')
}

async function toggleAttivoProg(id: string, attivo: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.programma.update({ where: { id }, data: { attivo: !attivo } })
  revalidatePath('/impostazioni/prestazioni')
}

async function eliminaProg(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.programma.delete({ where: { id } })
  revalidatePath('/impostazioni/prestazioni')
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function PrestazioniPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true, ruolo: true } })
  const isSuperAdmin = utente?.ruolo === 'SUPERADMIN'
  const studioFilter = isSuperAdmin ? {} : { studioId: utente?.studioId ?? '__nessuno__' }

  const [prestazioni, programmi, prodottiFito, tipologieBioscan] = await Promise.all([
    prisma.prestazione.findMany({ where: studioFilter, orderBy: { ordine: 'asc' }, include: { studio: { select: { nome: true } } } }),
    prisma.programma.findMany({ orderBy: { ordine: 'asc' } }),
    prisma.prodottoFito.findMany({ where: studioFilter, orderBy: { ordine: 'asc' } }),
    prisma.tipologiaBioscan.findMany({ where: studioFilter, orderBy: { ordine: 'asc' } }),
  ])

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Prestazioni</h1>
      </div>

      {/* ── Sezione Prestazioni ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-700">Prestazioni</h2>
          <a href="/impostazioni/prestazioni/nuovo" className={btnCls}>+ Nuova prestazione</a>
        </div>

        {prestazioni.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-slate-500">Nessuna prestazione configurata.</p>
            <a href="/impostazioni/prestazioni/nuovo" className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
              Aggiungi la prima prestazione →
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={thL}>Prestazione</th>
                  <th className={thR}>Prezzo</th>
                  <th className={thR}>Durata</th>
                  <th className={thC}>Attiva</th>
                  <th className={thC}>Ordine</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prestazioni.map((p, idx) => {
                  const spSu    = spostaOrdine.bind(null, p.id, 'su')
                  const spGiu   = spostaOrdine.bind(null, p.id, 'giu')
                  const toggle  = toggleAttiva.bind(null, p.id, p.attiva)
                  const elimina = eliminaPrestazione.bind(null, p.id)
                  return (
                    <tr key={p.id} className={p.attiva ? 'hover:bg-slate-50' : 'opacity-50 hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: p.colore }} />
                          <span className="font-medium text-slate-900">{p.nome}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">€ {Number(p.prezzoBase).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{p.durataMinuti} min</td>
                      <td className="px-4 py-3 text-center">{toggleBtn(toggle, p.attiva)}</td>
                      <td className="px-4 py-3 text-center">{ordineBtn(spSu, spGiu, idx, prestazioni.length)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/impostazioni/prestazioni/${p.id}/modifica`} className={modCls}>Modifica</a>
                          <BtnElimina action={elimina} nome={p.nome} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sezione Programmi ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-700">Programmi</h2>
          <a href="/impostazioni/programmi/nuovo" className={btnCls}>+ Nuovo programma</a>
        </div>

        {programmi.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-slate-500">Nessun programma configurato.</p>
            <a href="/impostazioni/programmi/nuovo" className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
              Crea il primo programma →
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={thL}>Programma</th>
                  <th className={thR}>Sessioni</th>
                  <th className={thR}>Durata</th>
                  <th className={thR}>€/sessione</th>
                  <th className={thC}>Attivo</th>
                  <th className={thC}>Ordine</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programmi.map((prog, idx) => {
                  const spSu   = spostaOrdineProg.bind(null, prog.id, 'su')
                  const spGiu  = spostaOrdineProg.bind(null, prog.id, 'giu')
                  const toggle = toggleAttivoProg.bind(null, prog.id, prog.attivo)
                  const elim   = eliminaProg.bind(null, prog.id)
                  return (
                    <tr key={prog.id} className={prog.attivo ? 'hover:bg-slate-50' : 'opacity-50 hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{prog.nome}</p>
                        {prog.descrizione && <p className="text-xs text-slate-400">{prog.descrizione}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{prog.defaultSessioni}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{(prog as any).durataSessioneMinuti ?? 60} min</td>
                      <td className="px-4 py-3 text-right text-slate-700">€ {Number(prog.prezzoSessione).toFixed(0)}</td>
                      <td className="px-4 py-3 text-center">{toggleBtn(toggle, prog.attivo)}</td>
                      <td className="px-4 py-3 text-center">{ordineBtn(spSu, spGiu, idx, programmi.length)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/impostazioni/programmi/${prog.id}/modifica`} className={modCls}>Modifica</a>
                          <BtnElimina action={elim} nome={prog.nome} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sezione Bioscan ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-700">Bioscan</h2>
          <a href="/impostazioni/bioscan/nuovo" className={btnCls}>+ Nuova tipologia</a>
        </div>

        {tipologieBioscan.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-slate-500">Nessuna tipologia Bioscan configurata.</p>
            <a href="/impostazioni/bioscan/nuovo" className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
              Aggiungi la prima tipologia →
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={thL}>Tipologia</th>
                  <th className={thR}>Prezzo</th>
                  <th className={thR}>Durata</th>
                  <th className={thC}>Attiva</th>
                  <th className={thC}>Ordine</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tipologieBioscan.map((b, idx) => {
                  const spSu    = spostaOrdineBioscan.bind(null, b.id, 'su')
                  const spGiu   = spostaOrdineBioscan.bind(null, b.id, 'giu')
                  const toggle  = toggleBioscan.bind(null, b.id, b.attiva)
                  const elimina = eliminaBioscan.bind(null, b.id)
                  return (
                    <tr key={b.id} className={b.attiva ? 'hover:bg-slate-50' : 'opacity-50 hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: (b as any).colore ?? '#6366f1' }} />
                          <span className="font-medium text-slate-900">{b.tipologia}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">€ {Number(b.prezzo).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{b.durataMinuti} min</td>
                      <td className="px-4 py-3 text-center">{toggleBtn(toggle, b.attiva)}</td>
                      <td className="px-4 py-3 text-center">{ordineBtn(spSu, spGiu, idx, tipologieBioscan.length)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/impostazioni/bioscan/${b.id}/modifica`} className={modCls}>Modifica</a>
                          <BtnElimina action={elimina} nome={b.tipologia} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sezione Fitoterapia ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-700">Fitoterapia</h2>
          <a href="/impostazioni/fitoterapia/nuovo" className={btnCls}>+ Nuovo fitoterapico</a>
        </div>

        {prodottiFito.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-slate-500">Nessun prodotto fitoterapico configurato.</p>
            <a href="/impostazioni/fitoterapia/nuovo"
              className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
              Aggiungi il primo prodotto →
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className={thL}>Prodotto</th>
                  <th className={thL}>Note</th>
                  <th className={thR}>Durata (mesi)</th>
                  <th className={thR}>€/mese</th>
                  <th className={thC}>Attivo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prodottiFito.map(p => {
                  const toggle = toggleFito.bind(null, p.id, p.attivo)
                  const elim   = eliminaFito.bind(null, p.id)
                  return (
                    <tr key={p.id} className={p.attivo ? 'hover:bg-slate-50' : 'opacity-50 hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.nome}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{(p as any).note ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{(p as any).durataDefaultMesi ?? 1} mesi</td>
                      <td className="px-4 py-3 text-right text-slate-700">€ {Number(p.prezzoMese).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">{toggleBtn(toggle, p.attivo)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/impostazioni/fitoterapia/${p.id}/modifica`} className={modCls}>Modifica</a>
                          <BtnElimina action={elim} nome={p.nome} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Helpers UI condivisi tra le due tabelle ───────────────────────────────────

function toggleBtn(action: () => Promise<void>, attivo: boolean) {
  return (
    <form action={action}>
      <button type="submit" title={attivo ? 'Disattiva' : 'Attiva'}
        className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${attivo ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${attivo ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </form>
  )
}

function ordineBtn(spSu: () => Promise<void>, spGiu: () => Promise<void>, idx: number, total: number) {
  return (
    <span className="inline-flex flex-col gap-0.5">
      <form action={spSu}>
        <button type="submit" disabled={idx === 0}
          className="block rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
          title="Sposta su">▲</button>
      </form>
      <form action={spGiu}>
        <button type="submit" disabled={idx === total - 1}
          className="block rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
          title="Sposta giù">▼</button>
      </form>
    </span>
  )
}

// ── Stili condivisi ───────────────────────────────────────────────────────────
const thL    = 'px-4 py-3 text-left font-medium text-slate-600'
const thR    = 'px-4 py-3 text-right font-medium text-slate-600'
const thC    = 'px-4 py-3 text-center font-medium text-slate-600'
const btnCls = 'rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover'
const modCls = 'rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900'
const inCls  = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
