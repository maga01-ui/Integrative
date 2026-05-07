// Form creazione nuova fattura
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import BackButton from '@/components/ui/BackButton'

async function creaFattura(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })
  if (!utente?.studioId) redirect('/impostazioni/studio')

  const studioId = utente.studioId
  const anno = new Date().getFullYear()

  // Transazione per numerazione atomica per studio
  await prisma.$transaction(async (tx) => {
    const ultima = await tx.fattura.findFirst({
      where:   { studioId, anno },
      orderBy: { numero: 'desc' },
      select:  { numero: true },
    })
    const numero = (ultima?.numero ?? 0) + 1

    await tx.fattura.create({
      data: {
        studioId,
        pazienteId:   formData.get('pazienteId') as string,
        tipo:         formData.get('tipo') as never,
        numero,
        anno,
        importo:      Number(formData.get('importo')),
        stato:        (formData.get('stato') as never) ?? 'EMESSA',
        dataScadenza: (formData.get('dataScadenza') as string) ? new Date(formData.get('dataScadenza') as string) : null,
        notePdf:      (formData.get('notePdf') as string) || null,
      },
    })
  })
  redirect('/fatture')
}

export default async function NuovaFatturaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({ where: { id: userId }, select: { studioId: true } })
  if (!utente?.studioId) redirect('/impostazioni/studio')

  const pazienti = await prisma.paziente.findMany({
    where: { studioId: utente.studioId, attivo: true },
    select: { id: true, nome: true, cognome: true, ragioneSociale: true, tipo: true },
    orderBy: [{ cognome: 'asc' }, { nome: 'asc' }]
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuova fattura</h1>
      </div>

      <form action={creaFattura} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <div>
          <label className="block text-sm font-medium text-slate-700">Paziente *</label>
          <select name="pazienteId" required className={cls}>
            <option value="">Seleziona paziente…</option>
            {pazienti.map(p => (
              <option key={p.id} value={p.id}>
                {p.tipo === 'AZIENDA' ? p.ragioneSociale : `${p.cognome ?? ''} ${p.nome}`.trim()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tipo *</label>
            <select name="tipo" required className={cls}>
              <option value="">Seleziona…</option>
              {['BIOSCAN','TRATTAMENTO','FITOTERAPIA','MANTENIMENTO'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Stato</label>
            <select name="stato" defaultValue="EMESSA" className={cls}>
              <option value="EMESSA">Emessa</option>
              <option value="PAGATA">Pagata</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Importo (€) *</label>
            <input type="number" name="importo" step="0.01" min="0" required className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Data scadenza</label>
            <input type="date" name="dataScadenza" className={cls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Note PDF</label>
          <textarea name="notePdf" rows={3} className={cls}
            placeholder="Testo aggiuntivo da includere nella fattura" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/fatture" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva fattura
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
