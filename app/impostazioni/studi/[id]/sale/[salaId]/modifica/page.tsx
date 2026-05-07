// Form modifica nome e colore di una sala esistente
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Server Action: salva le modifiche alla sala ──
async function aggiornaSala(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const salaId   = formData.get('salaId')   as string
  const studioId = formData.get('studioId') as string

  // Recupera lo stato corrente per capire se l'utente sta cambiando
  // l'attivazione (true→false = "elimina" la sala; false→true = "riattiva").
  const salaCorrente = await prisma.sala.findUnique({
    where:  { id: salaId },
    select: { attiva: true },
  })

  // Nuovo valore checkbox: 'on' se spuntato, altrimenti assente
  const nuovaAttiva = formData.get('attiva') === 'on'
  const eraAttiva   = salaCorrente?.attiva ?? true

  // Calcolo delle date di attività in base alla transizione:
  //   attiva → disattiva : registra "ora" come dataDisattivazione (sala "eliminata")
  //   disattiva → attiva : nuovo periodo di attività, dataAttivazione = ora, dataDisattivazione = null
  //   nessun cambio      : non tocca le date
  // IMPORTANTE: gli appuntamenti collegati a questa sala NON vengono
  // mai cancellati — restano visibili in calendario per le date passate.
  const datePeriodo: { dataAttivazione?: Date; dataDisattivazione?: Date | null } = {}
  if (eraAttiva && !nuovaAttiva) {
    datePeriodo.dataDisattivazione = new Date()
  } else if (!eraAttiva && nuovaAttiva) {
    datePeriodo.dataAttivazione    = new Date()
    datePeriodo.dataDisattivazione = null
  }

  await prisma.sala.update({
    where: { id: salaId },
    data: {
      nome:   formData.get('nome')   as string,
      colore: formData.get('colore') as string,
      attiva: nuovaAttiva,
      ...datePeriodo,
    },
  })

  redirect(`/impostazioni/studi/${studioId}`)
}

// ── Pagina ──
export default async function ModificaSalaPage({
  params,
}: {
  params: Promise<{ id: string; salaId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id: studioId, salaId } = await params

  // Carica studio e sala in parallelo
  const [studio, sala] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nome: true } }),
    prisma.sala.findUnique({ where: { id: salaId } }),
  ])

  if (!studio || !sala) notFound()

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/impostazioni" className="hover:text-slate-900">Impostazioni</a>
        <span>/</span>
        <a href={`/impostazioni/studi/${studioId}`} className="hover:text-slate-900">{studio.nome}</a>
        <span>/</span>
        <span className="text-slate-800">Modifica sala</span>
      </div>

      <h1 className="text-3xl font-semibold text-slate-600">Modifica sala</h1>

      <form action={aggiornaSala} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Campi nascosti con gli ID */}
        <input type="hidden" name="salaId"   value={salaId} />
        <input type="hidden" name="studioId" value={studioId} />

        {/* Nome sala */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome sala *</label>
          <input
            type="text"
            name="nome"
            required
            defaultValue={sala.nome}
            className={cls}
          />
        </div>

        {/* Colore nel calendario */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="color"
              name="colore"
              defaultValue={sala.colore ?? '#7F77DD'}
              className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300"
            />
            <span className="text-xs text-slate-400">Usato nel calendario degli appuntamenti</span>
          </div>
        </div>

        {/* Stato attiva / disattiva
            Disattivare la sala equivale ad "eliminarla": non sarà più
            disponibile per nuovi appuntamenti, ma gli appuntamenti già
            esistenti restano comunque visibili in calendario per le
            date in cui la sala era attiva. */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="attiva"
              defaultChecked={sala.attiva}
              className="rounded"
            />
            Sala attiva (disponibile per nuovi appuntamenti)
          </label>

          <p className="text-xs text-slate-500">
            Disattivando la sala non vengono cancellati gli appuntamenti già fissati:
            la sala continuerà a essere visibile in calendario solo per le date
            in cui era attiva.
          </p>

          {/* Storico periodo di attività corrente */}
          <div className="text-xs text-slate-400">
            Attiva dal: {sala.dataAttivazione.toLocaleDateString('it-IT')}
            {sala.dataDisattivazione && (
              <> · Disattivata il: {sala.dataDisattivazione.toLocaleDateString('it-IT')}</>
            )}
          </div>
        </div>

        {/* Pulsanti azione */}
        <div className="flex justify-end gap-3 pt-2">
          <a
            href={`/impostazioni/studi/${studioId}`}
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

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
