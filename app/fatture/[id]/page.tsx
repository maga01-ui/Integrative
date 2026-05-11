// Pagina dettaglio fattura e modifica
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function modificaFattura(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })

  const importo = Number(formData.get('importo'))
  const dataScadenzaValue = formData.get('dataScadenza') as string
  const dataPagValue = formData.get('dataPagamento') as string
  const metodoPagamentoValue = formData.get('metodoPagamento') as string | null
  const stato = formData.get('stato') as string
  const pagato = stato === 'PAGATA'

  await prisma.fattura.update({
    where: { id },
    data: {
      pazienteId: formData.get('pazienteId') as string,
      tipo: formData.get('tipo') as never,
      importo,
      stato: stato as never,
      dataScadenza: dataScadenzaValue ? new Date(dataScadenzaValue) : null,
      dataPagamento: pagato ? (dataPagValue ? new Date(dataPagValue) : new Date()) : null,
      metodoPagamento: metodoPagamentoValue ? (metodoPagamentoValue as 'CASH' | 'BONIFICO' | 'CARTA' | 'OMAGGIO') : null,
      notePdf: (formData.get('notePdf') as string) || null,
    },
  })

  redirect('/fatture')
}

function fmtDateForInput(date: Date | null | undefined) {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

export default async function FatturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true, ruolo: true } })

  const { id } = await params
  const fattura = await prisma.fattura.findUnique({
    where: { id },
    include: {
      paziente: { select: { id: true, nome: true, cognome: true, ragioneSociale: true, tipo: true } },
      studio: { select: { id: true, nome: true } },
    },
  })
  // SUPERADMIN vede tutte le fatture; gli altri solo quelle del proprio studio
  const studioIdUtente = utente?.studioId ?? null
  const isSuperAdmin = utente?.ruolo === 'SUPERADMIN'
  if (!fattura || (!isSuperAdmin && fattura.studioId !== studioIdUtente)) notFound()

  const pazienti = await prisma.paziente.findMany({
    where: { studioId: fattura.studioId, attivo: true },
    select: { id: true, nome: true, cognome: true, ragioneSociale: true, tipo: true },
    orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
  })

  const updateAction = modificaFattura.bind(null, id)
  const titoloPaziente = fattura.paziente.tipo === 'AZIENDA'
    ? (fattura.paziente.ragioneSociale ?? fattura.paziente.nome)
    : `${fattura.paziente.cognome ?? ''} ${fattura.paziente.nome}`.trim()
  const tipoDocumento = fattura.paziente.tipo === 'AZIENDA' ? 'Fattura' : 'Ricevuta'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <BackButton />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-600">
              {tipoDocumento} {fattura.anno}/{String(fattura.numero).padStart(4, '0')}
            </h1>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {tipoDocumento}
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Studio: <span className="font-medium text-slate-900">{fattura.studio?.nome ?? '—'}</span>
          </div>
        </div>
      </div>

      <form action={updateAction} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Paziente</label>
          <select name="pazienteId" required defaultValue={fattura.pazienteId} className={cls}>
            {pazienti.map(p => (
              <option key={p.id} value={p.id}>
                {p.tipo === 'AZIENDA' ? p.ragioneSociale : `${p.cognome ?? ''} ${p.nome}`.trim()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tipo</label>
            <select name="tipo" required defaultValue={fattura.tipo} className={cls}>
              {['BIOSCAN','TRATTAMENTO','FITOTERAPIA','MANTENIMENTO'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Stato</label>
            <select name="stato" defaultValue={fattura.stato} className={cls}>
              <option value="EMESSA">Emessa</option>
              <option value="PAGATA">Pagata</option>
              <option value="ANNULLATA">Annullata</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Importo (€)</label>
            <input
              type="number"
              name="importo"
              step="0.01"
              min="0"
              defaultValue={Number(fattura.importo).toFixed(2)}
              className={cls}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Metodo pagamento</label>
            <select name="metodoPagamento" defaultValue={fattura.metodoPagamento ?? 'CARTA'} className={cls}>
              <option value="CASH">Cash</option>
              <option value="BONIFICO">Bonifico</option>
              <option value="CARTA">Carta</option>
              <option value="OMAGGIO">Omaggio</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Data scadenza</label>
            <input
              type="date"
              name="dataScadenza"
              defaultValue={fmtDateForInput(fattura.dataScadenza)}
              className={cls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Data pagamento</label>
            <input
              type="date"
              name="dataPagamento"
              defaultValue={fmtDateForInput(fattura.dataPagamento)}
              className={cls}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Note PDF</label>
          <textarea
            name="notePdf"
            rows={3}
            className={cls}
            defaultValue={fattura.notePdf ?? ''}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/fatture" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
