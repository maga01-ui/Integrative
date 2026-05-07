// Nuova prescrizione fitoterapica per un paziente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import RigheProdotti from './RigheProdotti'
import BackButton from '@/components/ui/BackButton'

async function creaPrescrizioneFito(pazienteId: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const paziente = await prisma.paziente.findUnique({
    where: { id: pazienteId },
    select: { studioId: true },
  })
  if (!paziente) return

  // Recupera o crea il percorso attivo del paziente
  let percorso = await prisma.percorso.findFirst({
    where: { pazienteId, attivo: true },
  })
  if (!percorso) {
    percorso = await prisma.percorso.create({
      data: {
        pazienteId,
        studioId:  paziente.studioId,
        fase:      'IN_CURA',
        attivo:    true,
      },
    })
  }

  const medicoId   = formData.get('medicoId') as string
  const dataInizio = new Date(formData.get('dataInizio') as string)
  const note       = (formData.get('note') as string) || null

  // Raccoglie i prodotti (gli array paralleli prodottoId[], durataM[], posologia[], prezzoMese[])
  const prodottoIds  = formData.getAll('prodottoId')  as string[]
  const durateMesi   = formData.getAll('durataM')     as string[]
  const posologie    = formData.getAll('posologia')   as string[]
  const prezziMese   = formData.getAll('prezzoMese')  as string[]

  // Filtra le righe dove è stato selezionato un prodotto
  const prodottiValidi = prodottoIds
    .map((pid, i) => ({
      pid,
      durataM:   Number(durateMesi[i]) || 1,
      posologia: posologie[i] || null,
      prezzoMese: prezziMese[i] ? Number(prezziMese[i]) : null,
    }))
    .filter(p => p.pid)

  if (prodottiValidi.length === 0) redirect(`/pazienti/${pazienteId}/fitoterapia`)

  // Crea prescrizione + prodotti in una transazione
  await prisma.$transaction(async tx => {
    const prescrizione = await tx.prescrizioneFito.create({
      data: {
        studioId:   paziente.studioId,
        percorsoId: percorso!.id,
        pazienteId,
        medicoId,
        dataInizio,
        note,
        stato: 'ATTIVA',
      },
    })
    await tx.prescrizioneProdotto.createMany({
      data: prodottiValidi.map(p => ({
        prescrizioneId: prescrizione.id,
        prodottoId:     p.pid,
        durataM:        p.durataM,
        posologia:      p.posologia,
        prezzoMese:     p.prezzoMese,
      })),
    })
  })

  redirect(`/pazienti/${pazienteId}/fitoterapia`)
}

export default async function NuovaFitoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: pazienteId } = await params

  const paziente = await prisma.paziente.findUnique({
    where: { id: pazienteId },
    select: { id: true, nome: true, cognome: true, studioId: true },
  })
  if (!paziente) notFound()

  // Medici dello studio
  const medici = await prisma.utente.findMany({
    where:   { studioId: paziente.studioId, attivo: true, ruolo: { not: 'SUPERADMIN' } },
    select:  { id: true, nome: true, cognome: true },
    orderBy: { cognome: 'asc' },
  })

  // Prodotti fitoterapici attivi
  const prodotti = await prisma.prodottoFito.findMany({
    where:   { studioId: paziente.studioId, attivo: true },
    select:  { id: true, nome: true, durataDefaultMesi: true, prezzoMese: true },
    orderBy: { ordine: 'asc' },
  })

  const salva = creaPrescrizioneFito.bind(null, pazienteId)
  const oggi  = new Date().toISOString().slice(0, 10)
  const nomePaziente = `${paziente.cognome ?? ''} ${paziente.nome}`.trim()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-semibold text-slate-700">Nuova prescrizione</h1>
      </div>
      <p className="text-sm text-slate-500">Paziente: <strong>{nomePaziente}</strong></p>

      <form action={salva} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Data inizio *</label>
            <input type="date" name="dataInizio" required defaultValue={oggi} className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Medico *</label>
            <select name="medicoId" required className={cls}>
              <option value="">Seleziona…</option>
              {medici.map(m => (
                <option key={m.id} value={m.id}>{m.cognome} {m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="note" rows={2} placeholder="Indicazioni generali…" className={cls} />
        </div>

        {/* Righe prodotti — componente client */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Prodotti *</label>
          {prodotti.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
              Nessun prodotto fitoterapico configurato.{' '}
              <a href="/impostazioni/prestazioni" className="underline">Aggiungili nelle impostazioni</a>.
            </p>
          ) : (
            <RigheProdotti prodotti={prodotti.map(p => ({
              id: p.id,
              nome: p.nome,
              durataDefaultMesi: p.durataDefaultMesi ?? 1,
              prezzoMese: Number(p.prezzoMese ?? 0),
            }))} />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href={`/pazienti/${pazienteId}/fitoterapia`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva prescrizione
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
