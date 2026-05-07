// Pagina stampa prescrizione: layout pulito, ottimizzato per la stampa e il salvataggio in PDF.
// Aperta in un nuovo tab dal bottone "Stampa" nella lista prescrizioni del paziente.
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PrintButton from './PrintButton'

export default async function StampaPrescrizionePage({
  params,
}: {
  params: Promise<{ prescId: string }>
}) {
  const { prescId } = await params

  // Carica la prescrizione con tutti i dati necessari per la stampa
  const presc = await prisma.prescrizione.findUnique({
    where: { id: prescId },
    include: {
      paziente: { select: { nome: true, cognome: true, dataNascita: true, codiceFiscale: true } },
      medico:   { select: { nome: true, cognome: true } },
      studio:   { select: { nome: true, indirizzo: true, citta: true, provincia: true, telefono: true, email: true } },
    },
  })
  if (!presc) notFound()

  const nomePaziente  = `${presc.paziente.cognome ?? ''} ${presc.paziente.nome}`.trim()
  const nomeOperatore = `${presc.medico.cognome ?? ''} ${presc.medico.nome}`.trim()
  const dataStampa    = presc.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  const dataNascita = presc.paziente.dataNascita
    ? presc.paziente.dataNascita.toLocaleDateString('it-IT')
    : null

  return (
    <>
      {/* Stili di stampa: nasconde tutto tranne il documento */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { margin: 2cm; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 print:bg-white">

        {/* Barra azioni — visibile solo a schermo, nascosta in stampa */}
        <div className="print:hidden bg-slate-800 px-6 py-3 flex items-center gap-4">
          <a
            href={`/pazienti/${presc.pazienteId}/prescrizioni`}
            className="text-sm text-slate-300 hover:text-white transition"
          >
            ← Chiudi
          </a>
          <span className="flex-1 text-center text-sm font-medium text-white">
            Prescrizione del {dataStampa} — {nomePaziente}
          </span>
          <PrintButton />
        </div>

        {/* Foglio A4 simulato a schermo */}
        <div className="mx-auto max-w-2xl print:max-w-none">
          <div className="m-6 print:m-0 bg-white shadow-lg print:shadow-none rounded-2xl print:rounded-none p-10 print:p-0">

            {/* ── Intestazione studio ───────────────────────────────────── */}
            <div className="border-b border-slate-200 pb-6 mb-6">
              <h1 className="text-xl font-bold text-slate-900">{presc.studio.nome}</h1>
              {(presc.studio.indirizzo || presc.studio.citta) && (
                <p className="mt-1 text-sm text-slate-600">
                  {presc.studio.indirizzo}
                  {presc.studio.citta ? `, ${presc.studio.citta}` : ''}
                  {presc.studio.provincia ? ` (${presc.studio.provincia})` : ''}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-500">
                {presc.studio.telefono && <span>Tel. {presc.studio.telefono}</span>}
                {presc.studio.email    && <span>{presc.studio.email}</span>}
              </div>
            </div>

            {/* ── Titolo documento ─────────────────────────────────────── */}
            <div className="text-center mb-8">
              <h2 className="text-lg font-semibold uppercase tracking-widest text-slate-700">
                Prescrizione Medica
              </h2>
              <p className="mt-1 text-sm text-slate-500">del {dataStampa}</p>
            </div>

            {/* ── Dati paziente ────────────────────────────────────────── */}
            <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Paziente</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Nome e cognome: </span>
                  <span className="font-semibold text-slate-800">{nomePaziente}</span>
                </div>
                {dataNascita && (
                  <div>
                    <span className="text-slate-500">Data di nascita: </span>
                    <span className="text-slate-800">{dataNascita}</span>
                  </div>
                )}
                {presc.paziente.codiceFiscale && (
                  <div>
                    <span className="text-slate-500">C.F.: </span>
                    <span className="text-slate-800">{presc.paziente.codiceFiscale}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Corpo della prescrizione ─────────────────────────────── */}
            <div className="mb-8">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Prescrizione</p>
              {/* Mantieni gli a-capo del testo inserito dall'utente */}
              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {presc.contenuto}
              </div>
            </div>

            {/* ── Spazio firma ─────────────────────────────────────────── */}
            <div className="mt-12 flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Data</p>
                <div className="w-40 border-b border-slate-300 pb-0.5 text-sm text-slate-600">
                  {dataStampa}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Il professionista</p>
                <p className="text-sm font-semibold text-slate-800">{nomeOperatore}</p>
                <div className="mt-6 w-48 border-b border-slate-300" />
                <p className="mt-1 text-xs text-slate-400">Firma</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
