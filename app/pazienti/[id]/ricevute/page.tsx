// Ricevute/fatture del paziente.
// Mostra:
//  1. Sezione "Da gestire": appuntamenti + bioscan COMPLETATI/con prezzo > 0 senza ricevuta
//  2. Elenco ricevute già emesse con totali incassato/da pagare

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPatientOrRedirect } from '../patientUtilsFinal'
import { creaOaggiornaFatturaPerAppuntamento, creaOaggiornaFatturaPerBioscan } from '@/lib/fatturazione'
import AzioniRicevuta from './AzioniRicevuta'

// ── Server action: emette la ricevuta per un appuntamento ─────────────────────
async function emettiRicevuta(appId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const app = await prisma.appuntamento.findUnique({ where: { id: appId } })
  // Solo gli appuntamenti COMPLETATI possono generare ricevuta
  if (!app || app.stato !== 'COMPLETATO') return

  await creaOaggiornaFatturaPerAppuntamento(
    { ...app, prezzoApplicato: Number(app.prezzoApplicato) },
    { pagato: false }
  )

  revalidatePath(`/pazienti/${app.pazienteId}/ricevute`)
}

// ── Server action: emette la ricevuta per un bioscan ──────────────────────────
async function emettiBioscanRicevuta(bioscanId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const b = await prisma.bioscan.findUnique({
    where:  { id: bioscanId },
    select: { id: true, studioId: true, pazienteId: true, prezzo: true, effettuato: true },
  })
  // Solo i bioscan effettivamente eseguiti possono generare ricevuta
  if (!b || !b.prezzo || !b.effettuato) return

  await creaOaggiornaFatturaPerBioscan(
    { ...b, prezzo: Number(b.prezzo) },
    { pagato: false }
  )

  revalidatePath(`/pazienti/${b.pazienteId}/ricevute`)
}

// ── Server action: registra il pagamento su una fattura di appuntamento ───────
async function registraPagamento(appId: string, metodo: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const fattura = await prisma.fattura.findUnique({ where: { appuntamentoId: appId } })
  if (!fattura) return

  await prisma.fattura.update({
    where: { id: fattura.id },
    data: {
      stato:           'PAGATA',
      dataPagamento:   new Date(),
      metodoPagamento: metodo as any,
    },
  })

  revalidatePath(`/pazienti/${fattura.pazienteId}/ricevute`)
}

// ── Server action: registra il pagamento su una fattura di bioscan ────────────
async function registraPagamentoBioscan(bioscanId: string, metodo: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const fattura = await prisma.fattura.findUnique({ where: { bioscanId } })
  if (!fattura) return

  await prisma.fattura.update({
    where: { id: fattura.id },
    data: {
      stato:           'PAGATA',
      dataPagamento:   new Date(),
      metodoPagamento: metodo as any,
    },
  })

  revalidatePath(`/pazienti/${fattura.pazienteId}/ricevute`)
}

// ── Pagina ─────────────────────────────────────────────────────────────────────
export default async function RicevutePage({ params }: { params: any }) {
  const { id } = await Promise.resolve(params) as { id: string }
  const paziente = await getPatientOrRedirect(id)

  // Appuntamenti COMPLETATI con prezzo > 0 senza fattura → da fatturare
  // bioscan: { is: null } esclude gli appuntamenti bioscan, già gestiti sotto
  const daFatturare = await prisma.appuntamento.findMany({
    where: {
      pazienteId:      id,
      stato:           'COMPLETATO',
      prezzoApplicato: { gt: 0 },
      fattura:         { is: null },
      bioscan:         { is: null },
    },
    orderBy: { inizio: 'desc' },
    select:  { id: true, inizio: true, tipoPrestazione: true, prezzoApplicato: true },
  })

  // Appuntamenti con ricevuta EMESSA ma non pagata
  const emesseNonPagate = await prisma.appuntamento.findMany({
    where: {
      pazienteId:            id,
      stato:                 'COMPLETATO',
      fattura:               { is: { stato: 'EMESSA' } },
      bioscan:               { is: null },
    },
    orderBy: { inizio: 'desc' },
    select:  { id: true, inizio: true, tipoPrestazione: true, prezzoApplicato: true },
  })

  // Bioscan EFFETTUATI con prezzo > 0 senza fattura → da fatturare
  const bioscanDaFatturare = await prisma.bioscan.findMany({
    where: {
      pazienteId: id,
      effettuato: true,
      prezzo:     { gt: 0 },
      fattura:    { is: null },
    },
    orderBy: { dataEsecuzione: 'desc' },
    select:  { id: true, dataEsecuzione: true, prezzo: true },
  })

  // Bioscan EFFETTUATI con ricevuta EMESSA ma non pagata
  const bioscanEmessiNonPagati = await prisma.bioscan.findMany({
    where: {
      pazienteId: id,
      effettuato: true,
      fattura:    { is: { stato: 'EMESSA' } },
    },
    orderBy: { dataEsecuzione: 'desc' },
    select:  { id: true, dataEsecuzione: true, prezzo: true },
  })

  // Fatture già presenti (per la tabella storico)
  const fatture = await prisma.fattura.findMany({
    where:   { pazienteId: id },
    orderBy: [{ anno: 'desc' }, { numero: 'desc' }],
  })

  const totaleIncassato = fatture
    .filter(f => f.stato === 'PAGATA')
    .reduce((sum, f) => sum + Number(f.importo), 0)

  const totaleDaPagare = fatture
    .filter(f => f.stato === 'EMESSA')
    .reduce((sum, f) => sum + Number(f.importo), 0)

  const titoloDoc = paziente.tipo === 'AZIENDA' ? 'Fatture' : 'Ricevute'

  const totDaGestire = daFatturare.length + emesseNonPagate.length + bioscanDaFatturare.length + bioscanEmessiNonPagati.length

  return (
    <div className="space-y-8">

      <div>
        <p className="text-sm uppercase tracking-wide text-slate-400">{titoloDoc}</p>
        <p className="text-sm text-slate-500">Elenco dei documenti emessi per questo paziente.</p>
      </div>

      {/* ── Riepilogo totali ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Incassato</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-900">
            € {totaleIncassato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-xs uppercase tracking-wide text-amber-700">Da pagare</p>
          <p className="mt-3 text-3xl font-semibold text-amber-900">
            € {totaleDaPagare.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* ── Da gestire: appuntamenti + bioscan ── */}
      {totDaGestire > 0 && (
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6">
          <h2 className="mb-4 text-base font-semibold text-orange-800">
            Da gestire
            <span className="ml-2 text-sm font-normal text-orange-500">
              ({totDaGestire})
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">Data</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Prestazione</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Importo</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">

                {/* Appuntamenti da emettere */}
                {daFatturare.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(a.inizio).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{a.tipoPrestazione}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      € {Number(a.prezzoApplicato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <AzioniRicevuta
                        itemId={a.id}
                        statoIniziale="da_emettere"
                        onEmettiRicevuta={emettiRicevuta}
                        onRegistraPagamento={registraPagamento}
                      />
                    </td>
                  </tr>
                ))}

                {/* Appuntamenti emessi non pagati */}
                {emesseNonPagate.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(a.inizio).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{a.tipoPrestazione}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      € {Number(a.prezzoApplicato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <AzioniRicevuta
                        itemId={a.id}
                        statoIniziale="emessa"
                        onEmettiRicevuta={emettiRicevuta}
                        onRegistraPagamento={registraPagamento}
                      />
                    </td>
                  </tr>
                ))}

                {/* Bioscan da emettere */}
                {bioscanDaFatturare.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(b.dataEsecuzione).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">Bioscan</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      € {Number(b.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <AzioniRicevuta
                        itemId={b.id}
                        statoIniziale="da_emettere"
                        onEmettiRicevuta={emettiBioscanRicevuta}
                        onRegistraPagamento={registraPagamentoBioscan}
                      />
                    </td>
                  </tr>
                ))}

                {/* Bioscan emessi non pagati */}
                {bioscanEmessiNonPagati.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(b.dataEsecuzione).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">Bioscan</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      € {Number(b.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <AzioniRicevuta
                        itemId={b.id}
                        statoIniziale="emessa"
                        onEmettiRicevuta={emettiBioscanRicevuta}
                        onRegistraPagamento={registraPagamentoBioscan}
                      />
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Storico ricevute emesse ── */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-700">Storico {titoloDoc.toLowerCase()}</h2>
        {fatture.length === 0 ? (
          <p className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            Nessuna ricevuta o fattura emessa per questo paziente.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-100 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium text-slate-600">N°</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Importo</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Stato</th>
                  <th className="px-5 py-3 font-medium text-slate-600">Pagamento</th>
                  <th className="hidden px-5 py-3 font-medium text-slate-600 md:table-cell">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {fatture.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-slate-700">
                      {f.anno}/{String(f.numero).padStart(4, '0')}
                    </td>
                    <td className="px-5 py-3 text-slate-900">{f.tipo}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      € {Number(f.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        f.stato === 'PAGATA'    ? 'bg-emerald-100 text-emerald-700' :
                        f.stato === 'ANNULLATA' ? 'bg-red-100 text-red-600' :
                                                  'bg-amber-100 text-amber-700'
                      }`}>
                        {f.stato === 'PAGATA' ? 'Pagata' : f.stato === 'ANNULLATA' ? 'Annullata' : 'Emessa'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{f.metodoPagamento ?? '—'}</td>
                    <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                      {f.dataEmissione.toLocaleDateString('it-IT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
