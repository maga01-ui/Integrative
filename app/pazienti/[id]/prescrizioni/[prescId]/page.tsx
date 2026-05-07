// Modifica una prescrizione esistente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import BackButton from '@/components/ui/BackButton'

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

// ── Server action: aggiorna la prescrizione ───────────────────────────────────
async function aggiornaPrescrizione(prescrizioneId: string, pazienteId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const medicoId  = formData.get('medicoId') as string
  const dataRaw   = formData.get('data') as string
  const contenuto = (formData.get('contenuto') as string).trim()
  const note      = ((formData.get('note') as string) || '').trim() || null

  if (!medicoId || !dataRaw || !contenuto) return

  await prisma.prescrizione.update({
    where: { id: prescrizioneId },
    data:  { medicoId, data: new Date(dataRaw), contenuto, note },
  })

  redirect(`/pazienti/${pazienteId}/prescrizioni`)
}

// ── Formatta data per input type="date" (YYYY-MM-DD) ─────────────────────────
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function ModificaPrescrizionePage({
  params,
}: {
  params: Promise<{ id: string; prescId: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { id: pazienteId, prescId } = await params

  // Carica la prescrizione
  const presc = await prisma.prescrizione.findUnique({
    where:   { id: prescId },
    include: { paziente: { select: { nome: true, cognome: true, studioId: true } } },
  })
  if (!presc || presc.pazienteId !== pazienteId) notFound()

  // Carica gli operatori dello studio del paziente
  const medici = await prisma.utente.findMany({
    where:   { studioId: presc.paziente.studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
    select:  { id: true, nome: true, cognome: true },
    orderBy: { cognome: 'asc' },
  })

  const nomePaziente = `${presc.paziente.cognome ?? ''} ${presc.paziente.nome}`.trim()
  const aggiorna     = aggiornaPrescrizione.bind(null, prescId, pazienteId)

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        <BackButton />
        <h2 className="text-2xl font-semibold text-slate-600">Modifica prescrizione</h2>
      </div>

      <form action={aggiorna} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Paziente: solo visualizzazione */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Paziente</label>
          <div className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-700 font-medium">
            {nomePaziente}
          </div>
        </div>

        {/* Operatore */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Operatore *</label>
          <select name="medicoId" required defaultValue={presc.medicoId} className={cls}>
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
            defaultValue={toDateInput(presc.data)}
            className={cls}
          />
        </div>

        {/* Testo prescrizione */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Testo della prescrizione *</label>
          <textarea
            name="contenuto"
            required
            rows={8}
            defaultValue={presc.contenuto}
            className={`${cls} resize-y`}
          />
        </div>

        {/* Note interne */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Note interne{' '}
            <span className="font-normal text-slate-400">(non appaiono nella stampa)</span>
          </label>
          <textarea
            name="note"
            rows={2}
            defaultValue={presc.note ?? ''}
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
            Salva modifiche
          </button>
        </div>

      </form>
    </div>
  )
}
