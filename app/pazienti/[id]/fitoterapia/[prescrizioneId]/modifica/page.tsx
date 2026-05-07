// Modifica una prescrizione fitoterapica esistente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import RigheProdottiModifica from './RigheProdottiModifica'
import BackButton from '@/components/ui/BackButton'

async function aggiornaPrescrizioneFito(
  pazienteId: string,
  prescrizioneId: string,
  formData: FormData
) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const medicoId   = formData.get('medicoId')   as string
  const dataInizio = new Date(formData.get('dataInizio') as string)
  const stato      = formData.get('stato')       as string
  const note       = (formData.get('note') as string) || null

  // Array paralleli per i prodotti
  const prodottoIds = formData.getAll('prodottoId')  as string[]
  const durateMesi  = formData.getAll('durataM')     as string[]
  const posologie   = formData.getAll('posologia')   as string[]
  const prezziMese  = formData.getAll('prezzoMese')  as string[]

  // Filtra le righe dove è stato selezionato un prodotto
  const prodottiValidi = prodottoIds
    .map((pid, i) => ({
      pid,
      durataM:    Number(durateMesi[i]) || 1,
      posologia:  posologie[i] || null,
      prezzoMese: prezziMese[i] ? Number(prezziMese[i]) : null,
    }))
    .filter(p => p.pid)

  // Aggiorna prescrizione e ricrea i prodotti nella stessa transazione
  await prisma.$transaction(async tx => {
    await tx.prescrizioneFito.update({
      where: { id: prescrizioneId },
      data:  { medicoId, dataInizio, stato: stato as any, note },
    })

    // Elimina le righe precedenti e ricrea con i nuovi valori
    await tx.prescrizioneProdotto.deleteMany({ where: { prescrizioneId } })
    await tx.prescrizioneProdotto.createMany({
      data: prodottiValidi.map(p => ({
        prescrizioneId,
        prodottoId: p.pid,
        durataM:    p.durataM,
        posologia:  p.posologia,
        // prezzoMese salvato solo dopo prisma generate
      })),
    })
  })

  redirect(`/pazienti/${pazienteId}/fitoterapia`)
}

export default async function ModificaFitoPage({
  params,
}: {
  params: Promise<{ id: string; prescrizioneId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: pazienteId, prescrizioneId } = await params

  // Carica la prescrizione esistente con tutti i prodotti
  const prescrizione = await prisma.prescrizioneFito.findUnique({
    where: { id: prescrizioneId },
    include: {
      prodotti: {
        include: { prodotto: { select: { prezzoMese: true } } },
      },
    },
  })
  if (!prescrizione || prescrizione.pazienteId !== pazienteId) notFound()

  const paziente = await prisma.paziente.findUnique({
    where:  { id: pazienteId },
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
    select:  { id: true, nome: true, prezzoMese: true },
    orderBy: { ordine: 'asc' },
  })

  // Righe iniziali per il componente client
  const righeIniziali = prescrizione.prodotti.map((p, i) => ({
    key:        i,
    prodottoId: p.prodottoId,
    durataM:    p.durataM,
    prezzoMese: Number((p as any).prezzoMese ?? p.prodotto.prezzoMese ?? 0),
    posologia:  p.posologia ?? '',
  }))

  const salva = aggiornaPrescrizioneFito.bind(null, pazienteId, prescrizioneId)
  const nomePaziente = `${paziente.cognome ?? ''} ${paziente.nome}`.trim()
  const dataInizioStr = new Date(prescrizione.dataInizio).toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-semibold text-slate-700">Modifica prescrizione</h1>
      </div>
      <p className="text-sm text-slate-500">Paziente: <strong>{nomePaziente}</strong></p>

      <form action={salva} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Data inizio *</label>
            <input type="date" name="dataInizio" required defaultValue={dataInizioStr} className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Medico *</label>
            <select name="medicoId" required defaultValue={prescrizione.medicoId} className={cls}>
              <option value="">Seleziona…</option>
              {medici.map(m => (
                <option key={m.id} value={m.id}>{m.cognome} {m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Stato</label>
          <select name="stato" defaultValue={prescrizione.stato} className={cls}>
            <option value="ATTIVA">Attiva</option>
            <option value="SOSPESA">Sospesa</option>
            <option value="CONCLUSA">Conclusa</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="note" rows={2} placeholder="Indicazioni generali…" className={cls}
            defaultValue={prescrizione.note ?? ''} />
        </div>

        {/* Righe prodotti — componente client con valori pre-compilati */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Prodotti *</label>
          <RigheProdottiModifica
            prodotti={prodotti.map(p => ({ id: p.id, nome: p.nome, prezzoMese: Number(p.prezzoMese ?? 0) }))}
            righeIniziali={righeIniziali}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href={`/pazienti/${pazienteId}/fitoterapia`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
