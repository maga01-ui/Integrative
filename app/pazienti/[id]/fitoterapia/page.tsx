// Pagina fitoterapia del paziente
// Mostra prescrizioni di integratori con riepilogo totale speso e mesi di cura

import { prisma } from '@/lib/prisma'
import { getPatientOrRedirect } from '../patientUtilsFinal'
import BottoneCancella from './BottoneCancella'

export default async function FitoterapiaPage({ params }: { params: any }) {
  const { id } = await Promise.resolve(params) as { id: string }
  await getPatientOrRedirect(id)

  const pazienteConPrescrizioni = await prisma.paziente.findUnique({
    where: { id },
    include: {
      prescrizioni: {
        orderBy: { dataInizio: 'desc' },
        include: {
          medico:   { select: { nome: true, cognome: true } },
          prodotti: {
            include: {
              prodotto: { select: { nome: true, produttore: true, prezzoMese: true } },
              // prezzoMese override è già nel record PrescrizioneProdotto
            },
          },
        },
      },
    },
  })

  if (!pazienteConPrescrizioni) return null

  const prescrizioni = pazienteConPrescrizioni.prescrizioni

  // ── Calcolo totali ─────────────────────────────────────────────────────────
  // Totale speso = somma di (prezzoMese × durataM) per ogni prodotto in ogni prescrizione
  // Usa prezzoMese della riga se presente (override), altrimenti quello del prodotto
  const prezzoEffettivo = (p: { prezzoMese: any; prodotto: { prezzoMese: any } }) =>
    Number(p.prezzoMese ?? p.prodotto.prezzoMese ?? 0)

  const totaleSpeso = prescrizioni.reduce((sum, pr) =>
    sum + pr.prodotti.reduce((s, p) =>
      s + (prezzoEffettivo(p) * p.durataM), 0
    ), 0
  )

  // Mesi totali = per ogni prescrizione prendiamo la durata massima tra i suoi prodotti,
  // poi sommiamo tutte le prescrizioni (perché sono cicli consecutivi)
  const mesiTotali = prescrizioni.reduce((sum, pr) => {
    const maxMesi = pr.prodotti.reduce((m, p) => Math.max(m, p.durataM), 0)
    return sum + maxMesi
  }, 0)

  const prescrizioniAttive = prescrizioni.filter(pr => pr.stato === 'ATTIVA')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Fitoterapia</p>
          <p className="text-sm text-slate-500">
            Integratori e prodotti acquistati per l'uso domiciliare.
          </p>
        </div>
        <a href={`/pazienti/${id}/fitoterapia/nuovo`}
          className="flex-shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
          + Nuova prescrizione
        </a>
      </div>

      {/* ── Riepilogo statistiche ── */}
      {prescrizioni.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Prescrizioni totali</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{prescrizioni.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Mesi di integratori</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{mesiTotali}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Totale speso</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              € {totaleSpeso.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {prescrizioniAttive.length > 0 && (
            <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-green-600">Prescrizioni attive</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{prescrizioniAttive.length}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Lista prescrizioni ── */}
      {prescrizioni.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Nessuna prescrizione di fitoterapia disponibile.
        </p>
      ) : (
        <div className="space-y-4">
          {prescrizioni.map(prescrizione => {
            // Calcola il costo totale di questa prescrizione
            const costoPrescriz = prescrizione.prodotti.reduce(
              (s, p) => s + (prezzoEffettivo(p) * p.durataM), 0
            )
            // Durata della prescrizione = max durata tra i prodotti
            const durataPrescriz = prescrizione.prodotti.reduce(
              (m, p) => Math.max(m, p.durataM), 0
            )

            return (
              <div key={prescrizione.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        Prescrizione del {new Date(prescrizione.dataInizio).toLocaleDateString('it-IT')}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        prescrizione.stato === 'ATTIVA'   ? 'bg-green-100 text-green-700' :
                        prescrizione.stato === 'SOSPESA'  ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {prescrizione.stato}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {prescrizione.dataFine
                        ? `Fino al ${new Date(prescrizione.dataFine).toLocaleDateString('it-IT')}`
                        : 'In corso'}
                      {durataPrescriz > 0 && ` · ${durataPrescriz} ${durataPrescriz === 1 ? 'mese' : 'mesi'}`}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        € {costoPrescriz.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-400">totale prescrizione</p>
                    </div>
                    <a href={`/pazienti/${id}/fitoterapia/${prescrizione.id}/modifica`}
                      className="flex-shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      Modifica
                    </a>
                    {/* Bottone elimina con conferma */}
                    <BottoneCancella
                      prescrizioneId={prescrizione.id}
                      pazienteId={id}
                      labelConferma={`Prescrizione del ${new Date(prescrizione.dataInizio).toLocaleDateString('it-IT')}`}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Medico</p>
                    <p className="mt-1 text-sm text-slate-800">
                      Dr. {prescrizione.medico.cognome} {prescrizione.medico.nome}
                    </p>
                  </div>
                  {prescrizione.note && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Note</p>
                      <p className="mt-1 text-sm text-slate-700">{prescrizione.note}</p>
                    </div>
                  )}
                </div>

                {/* Lista prodotti */}
                <div className="mt-4 space-y-2">
                  {prescrizione.prodotti.map(prod => {
                    const costoTotaleProdotto = prezzoEffettivo(prod) * prod.durataM
                    return (
                      <div key={prod.id} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{prod.prodotto.nome}</p>
                            {prod.prodotto.produttore && (
                              <p className="text-xs text-slate-500">{prod.prodotto.produttore}</p>
                            )}
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold text-slate-800">
                              € {costoTotaleProdotto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-slate-400">
                              € {prezzoEffettivo(prod).toLocaleString('it-IT', { minimumFractionDigits: 2 })}/mese × {prod.durataM} {prod.durataM === 1 ? 'mese' : 'mesi'}
                            </p>
                          </div>
                        </div>
                        {prod.posologia && (
                          <p className="mt-2 text-sm text-slate-600">
                            <span className="font-medium text-slate-500">Posologia: </span>
                            {prod.posologia}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
