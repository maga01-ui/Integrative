// Form per avviare un nuovo percorso per un paziente.
// Il percorso definisce il tipo di cura (trattamenti, fitoterapia, o entrambi)
// e quante sessioni sono pianificate nel ciclo.

import { redirect, notFound } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ── Server action: crea il percorso nel database ───────────────────────────
async function avviaPercorso(pazienteId: string, formData: FormData) {
  'use server'

  const ctx = await getTenantContext()
  if (!ctx.studioId) redirect('/impostazioni/studio')

  const tipoCura       = formData.get('tipoCura') as string
  const sessioniTotali = Number(formData.get('sessioniTotali') || 6)
  const note           = (formData.get('note') as string) || null

  // Se esiste già un percorso attivo, lo disattiva prima di crearne uno nuovo
  await prisma.percorso.updateMany({
    where: { pazienteId, attivo: true },
    data:  { attivo: false, dataFine: new Date() },
  })

  // Crea il nuovo percorso
  await prisma.percorso.create({
    data: {
      studioId:      ctx.studioId,
      pazienteId,
      fase:          'BIOSCAN_INIZIALE',
      tipoCura:      tipoCura as 'TRATTAMENTI' | 'FITOTERAPIA' | 'ENTRAMBI',
      sessioniTotali,
    },
  })

  revalidatePath(`/pazienti/${pazienteId}`)
  redirect(`/pazienti/${pazienteId}`)
}

// ── Pagina ─────────────────────────────────────────────────────────────────
export default async function NuovoPercorsoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { id } = await params

  // Verifica che il paziente esista e appartenga allo studio
  const ws       = ctx.studioId ? { studioId: ctx.studioId } : {}
  const paziente = await prisma.paziente.findFirst({ where: { id, ...ws } })
  if (!paziente) notFound()

  // Controlla se esiste già un percorso attivo (per mostrare un avviso)
  const percorsoEsistente = await prisma.percorso.findFirst({
    where: { pazienteId: id, attivo: true },
  })

  const nomePaziente = paziente.tipo === 'AZIENDA'
    ? (paziente.ragioneSociale ?? paziente.nome)
    : `${paziente.cognome ?? ''} ${paziente.nome}`.trim()

  // Lega il server action all'id del paziente
  const avvia = avviaPercorso.bind(null, id)

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/pazienti" className="hover:text-slate-900">Pazienti</a>
        <span className="text-slate-300">/</span>
        <a href={`/pazienti/${id}`} className="hover:text-slate-900">{nomePaziente}</a>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700">Nuovo percorso</span>
      </div>

      <h1 className="text-3xl font-semibold text-slate-600">Avvia percorso</h1>

      {/* Avviso se c'è già un percorso attivo */}
      {percorsoEsistente && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ Questo paziente ha già un percorso attivo. Avviandone uno nuovo,
          il precedente verrà chiuso automaticamente.
        </div>
      )}

      <form action={avvia} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Tipo di cura */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Tipo di cura *
          </label>
          <div className="grid gap-3 sm:grid-cols-3">

            {/* Trattamenti */}
            <label className="relative flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-slate-200 p-4 hover:border-indigo-400 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
              <input type="radio" name="tipoCura" value="TRATTAMENTI" className="sr-only" defaultChecked />
              <span className="text-sm font-semibold text-slate-900">Trattamenti</span>
              <span className="text-xs text-slate-500">Ciclo di sessioni di trattamento (es. 6)</span>
            </label>

            {/* Fitoterapia */}
            <label className="relative flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-slate-200 p-4 hover:border-emerald-400 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
              <input type="radio" name="tipoCura" value="FITOTERAPIA" className="sr-only" />
              <span className="text-sm font-semibold text-slate-900">Fitoterapia</span>
              <span className="text-xs text-slate-500">Cura mensile con prodotti fitoterapici (€150/mese)</span>
            </label>

            {/* Entrambi */}
            <label className="relative flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-slate-200 p-4 hover:border-amber-400 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
              <input type="radio" name="tipoCura" value="ENTRAMBI" className="sr-only" />
              <span className="text-sm font-semibold text-slate-900">Entrambi</span>
              <span className="text-xs text-slate-500">Trattamenti + cura fitoterapica in parallelo</span>
            </label>

          </div>
        </div>

        {/* Numero sessioni trattamento */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Sessioni di trattamento nel ciclo
          </label>
          <p className="mb-2 text-xs text-slate-400">
            Il numero standard è 6. Modificalo solo se il piano terapeutico prevede un ciclo diverso.
          </p>
          <input
            type="number"
            name="sessioniTotali"
            defaultValue={6}
            min={1}
            max={20}
            className={cls}
          />
        </div>

        {/* Riepilogo costi previsti (informativo) */}
        <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm">
          <p className="mb-2 font-medium text-slate-700">Costi previsti (indicativi)</p>
          <ul className="space-y-1 text-slate-600">
            <li>• Bioscan iniziale: <strong>€ 300</strong></li>
            <li>• Lettura referto: <strong>€ 0</strong></li>
            <li>• Sessioni trattamento (6×€500): <strong>€ 3.000</strong></li>
            <li>• Bioscan di controllo: <strong>€ 300</strong></li>
            <li className="text-xs text-slate-400 pt-1">
              La fitoterapia verrà aggiunta separatamente (€ 150/mese).
            </li>
          </ul>
        </div>

        {/* Pulsanti azione */}
        <div className="flex justify-end gap-3 pt-1">
          <a
            href={`/pazienti/${id}`}
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Avvia percorso →
          </button>
        </div>

      </form>
    </div>
  )
}

// Stile comune per gli input
const cls = 'mt-1 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
