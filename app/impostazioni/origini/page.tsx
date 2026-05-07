// Impostazioni › Origini acquisizione
// Permette di gestire le origini con cui arrivano i pazienti
// (es. Diretto, Marketing, Passaparola + voci personalizzate).
// Mostra anche gli operatori segnati come "referral" (sola lettura),
// che vengono gestiti dalla pagina del team del collaboratore.
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import BackButton from '@/components/ui/BackButton'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getOriginiPerImpostazioni } from '@/lib/origini'
import BtnElimina from './BtnElimina'

// ── Tipo ristretto per le righe restituite dalla query raw ────────────────────
type OrigineRow = { id: string; nome: string; ordine: number; attivo: boolean }

// ── Elimina un'origine ───────────────────────────────────────────────────────
async function eliminaOrigine(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.$executeRaw`DELETE FROM "OrigineAcquisizione" WHERE id = ${id}`
  revalidatePath('/impostazioni/origini')
}

// ── Attiva / disattiva un'origine ─────────────────────────────────────────────
async function toggleAttivo(id: string, attivo: boolean) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Inverte il flag attivo
  await prisma.$executeRaw`
    UPDATE "OrigineAcquisizione" SET attivo = ${!attivo} WHERE id = ${id}`

  revalidatePath('/impostazioni/origini')
}

// ── Sposta su / giù scambiando i valori di ordine ─────────────────────────────
async function spostaOrdine(id: string, direzione: 'su' | 'giu') {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Carica il record corrente
  const [corrente] = await prisma.$queryRaw<OrigineRow[]>`
    SELECT id, "studioId", ordine FROM "OrigineAcquisizione" WHERE id = ${id}`
  if (!corrente) return

  // Trova il record adiacente (precedente o successivo per ordine)
  const adiacenti = direzione === 'su'
    ? await prisma.$queryRaw<OrigineRow[]>`
        SELECT id, ordine FROM "OrigineAcquisizione"
        WHERE "studioId" = ${(corrente as unknown as { studioId: string }).studioId}
          AND ordine < ${corrente.ordine}
        ORDER BY ordine DESC LIMIT 1`
    : await prisma.$queryRaw<OrigineRow[]>`
        SELECT id, ordine FROM "OrigineAcquisizione"
        WHERE "studioId" = ${(corrente as unknown as { studioId: string }).studioId}
          AND ordine > ${corrente.ordine}
        ORDER BY ordine ASC LIMIT 1`

  const adiacente = adiacenti[0]
  if (!adiacente) return

  // Scambia gli ordini
  await prisma.$executeRaw`
    UPDATE "OrigineAcquisizione" SET ordine = ${adiacente.ordine} WHERE id = ${corrente.id}`
  await prisma.$executeRaw`
    UPDATE "OrigineAcquisizione" SET ordine = ${corrente.ordine} WHERE id = ${adiacente.id}`

  revalidatePath('/impostazioni/origini')
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function OriginiPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true, ruolo: true },
  })

  const studioId = utente?.studioId

  // Carica le origini (manuali + referral) tramite l'helper condiviso.
  // - SUPERADMIN: vede tutte le origini di tutti gli studi.
  // - Altri ruoli: solo quelle del proprio studio.
  const origini = await getOriginiPerImpostazioni(
    utente?.ruolo === 'SUPERADMIN' ? null : studioId ?? null,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Origini acquisizione</h1>
      </div>

      <div className="flex justify-end">
        <a
          href="/impostazioni/origini/nuovo"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          + Nuova origine
        </a>
      </div>

      {origini.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-slate-500">Nessuna origine configurata.</p>
          <a
            href="/impostazioni/origini/nuovo"
            className="mt-3 inline-block text-sm font-medium text-slate-900 underline"
          >
            Aggiungi la prima origine →
          </a>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Attiva</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Ordine</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Calcoliamo l'ultima posizione tra le sole voci manuali, così
                  i pulsanti "su/giù" delle voci normali non vengono disattivati
                  per colpa di una riga referral subito sotto. */}
              {(() => {
                const manuali = origini.filter(o => !o.isReferral)
                const ultimoManualeIdx = manuali.length - 1

                return origini.map((o) => {
                  // Le voci "referral" sono di sola lettura: niente toggle,
                  // niente riordino, niente eliminazione (si gestiscono dalla
                  // pagina del team del collaboratore).
                  if (o.isReferral) {
                    return (
                      <tr key={o.id} className="bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {o.nome}
                          <span className="ml-2 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                            Referral
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400">automatico</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400">—</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400">
                          <span title="Per disattivare, modifica il collaboratore nel team">
                            gestito dal team
                          </span>
                        </td>
                      </tr>
                    )
                  }

                  // Trova la posizione di questa voce manuale nella lista delle sole manuali
                  const idxManuale = manuali.findIndex(m => m.id === o.id)
                  const toggle   = toggleAttivo.bind(null, o.id, o.attivo)
                  const spSu     = spostaOrdine.bind(null, o.id, 'su')
                  const spGiu    = spostaOrdine.bind(null, o.id, 'giu')
                  const elimina  = eliminaOrigine.bind(null, o.id)

                  return (
                    <tr key={o.id} className={o.attivo ? '' : 'opacity-50'}>
                      <td className="px-4 py-3 font-medium text-slate-900">{o.nome}</td>

                      {/* Toggle attiva/disattiva */}
                      <td className="px-4 py-3 text-center">
                        <form action={toggle}>
                          <button
                            type="submit"
                            title={o.attivo ? 'Disattiva' : 'Attiva'}
                            className={`inline-block h-5 w-9 rounded-full transition-colors ${o.attivo ? 'bg-green-500' : 'bg-slate-300'}`}
                          >
                            <span className={`block h-4 w-4 rounded-full bg-white shadow mx-0.5 transition-transform ${o.attivo ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </form>
                      </td>

                      {/* Riordina */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex flex-col gap-0.5">
                          <form action={spSu}>
                            <button type="submit" disabled={idxManuale === 0}
                              className="block rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20"
                              title="Sposta su">▲</button>
                          </form>
                          <form action={spGiu}>
                            <button type="submit" disabled={idxManuale === ultimoManualeIdx}
                              className="block rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-20"
                              title="Sposta giù">▼</button>
                          </form>
                        </span>
                      </td>

                      {/* Elimina — client component per il confirm() */}
                      <td className="px-4 py-3 text-right">
                        <BtnElimina action={elimina} nome={o.nome} />
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
