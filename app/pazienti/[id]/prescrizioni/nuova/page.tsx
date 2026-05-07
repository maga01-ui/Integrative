// Form per creare una nuova prescrizione medica per il paziente
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import BackButton from '@/components/ui/BackButton'

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

// ── Server action: salva la nuova prescrizione ────────────────────────────────
async function salvaPrescrizioneAction(pazienteId: string, studioId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const medicoId   = formData.get('medicoId') as string
  const dataRaw    = formData.get('data') as string
  const contenuto  = (formData.get('contenuto') as string).trim()
  const note       = ((formData.get('note') as string) || '').trim() || null

  if (!medicoId || !dataRaw || !contenuto) return  // validazione base

  await prisma.prescrizione.create({
    data: {
      studioId,
      pazienteId,
      medicoId,
      data:      new Date(dataRaw),
      contenuto,
      note,
    },
  })

  redirect(`/pazienti/${pazienteId}/prescrizioni`)
}

export default async function NuovaPrescrizionePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { id: pazienteId } = await params
  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}

  // Carica il paziente — include studioId per usarlo nella server action
  const paziente = await prisma.paziente.findUnique({
    where:  { id: pazienteId },
    select: { id: true, nome: true, cognome: true, studioId: true },
  })
  if (!paziente) redirect('/pazienti')

  // Carica gli operatori dello studio del paziente
  const medici = await prisma.utente.findMany({
    where:   { studioId: paziente.studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
    select:  { id: true, nome: true, cognome: true },
    orderBy: { cognome: 'asc' },
  })

  // Data di oggi in formato YYYY-MM-DD per il campo date
  const oggi = new Date()
  const dataDefault = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`

  const nomePaziente = `${paziente.cognome ?? ''} ${paziente.nome}`.trim()
  // Usa lo studioId del paziente come fonte affidabile (ctx.studioId è null per i superadmin)
  const studioId     = paziente.studioId ?? ctx.studioId ?? ''

  const salva = salvaPrescrizioneAction.bind(null, pazienteId, studioId)

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        <BackButton />
        <h2 className="text-2xl font-semibold text-slate-600">Nuova prescrizione</h2>
      </div>

      <form action={salva} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Paziente: precompilato e non modificabile */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Paziente</label>
          <div className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-700 font-medium">
            {nomePaziente}
          </div>
        </div>

        {/* Operatore */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Operatore *</label>
          <select name="medicoId" required className={cls}>
            <option value="">Seleziona operatore…</option>
            {medici.map(m => (
              <option key={m.id} value={m.id}>{m.cognome} {m.nome}</option>
            ))}
          </select>
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Data *</label>
          <input
            type="date"
            name="data"
            required
            defaultValue={dataDefault}
            className={cls}
          />
        </div>

        {/* Contenuto della prescrizione */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Testo della prescrizione *</label>
          <p className="mt-0.5 text-xs text-slate-400">
            Scrivi qui il testo che apparirà nella prescrizione stampata (farmaci, integratori, istruzioni, ecc.)
          </p>
          <textarea
            name="contenuto"
            required
            rows={8}
            placeholder="Es. Si prescrive al Sig./Sig.ra… una terapia a base di…"
            className={`${cls} resize-y`}
          />
        </div>

        {/* Note interne (non appaiono nella stampa) */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Note interne{' '}
            <span className="font-normal text-slate-400">(non appaiono nella stampa)</span>
          </label>
          <textarea
            name="note"
            rows={2}
            placeholder="Annotazioni ad uso interno…"
            className={`${cls} resize-y`}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href={`/pazienti/${pazienteId}/prescrizioni`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Salva prescrizione
          </button>
        </div>

      </form>
    </div>
  )
}
