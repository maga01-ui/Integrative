'use client'
// Bottone "Converti" per la lista pazienti — apre il modal decisione identico al calendario.
// isControllo=true → opzioni dopo bioscan di controllo (aggiungi sessione, mantenimento, ecc.)
// isControllo=false → opzioni dopo bioscan iniziale (programma, prestazione, fitoterapia, ecc.)

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  pazienteId:  string
  isControllo: boolean
}

export default function BottoneConverti({ pazienteId, isControllo }: Props) {
  const [aperto,       setAperto]       = useState(false)
  const [espanso,      setEspanso]      = useState<'DA_RICHIAMARE' | 'NON_INTERESSATO' | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [dataRichiamo, setDataRichiamo] = useState('')
  const [noteRichiamo, setNoteRichiamo] = useState('')
  const [motivazione,  setMotivazione]  = useState('')

  async function registra(decisione: string, data?: string, nota?: string) {
    setLoading(true)
    try {
      const res  = await fetch(`/api/pazienti/${pazienteId}/decisione`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ decisione, dataRichiamo: data, motivazione: nota }),
      })
      const json = await res.json()
      if (json.redirect) window.location.href = json.redirect
      else setAperto(false)
    } finally {
      setLoading(false)
    }
  }

  function apri() { setAperto(true); setEspanso(null); setDataRichiamo(''); setNoteRichiamo(''); setMotivazione('') }

  const box = 'rounded-2xl border p-3 text-xs font-semibold transition cursor-pointer text-center disabled:opacity-40'

  return (
    <>
      {/* Bottone nella cella tabella */}
      <button
        onClick={apri}
        className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 hover:bg-teal-200 transition"
      >
        Converti
      </button>

      {aperto && (
        <>
          {/* Overlay scuro */}
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setAperto(false)} />

          {/* Modal centrato */}
          <div className="fixed z-[70] left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto max-h-[90vh] rounded-2xl bg-white shadow-2xl p-5 space-y-4">

            {/* Intestazione */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Decisione del paziente</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isControllo ? 'Dopo bioscan di controllo' : 'Dopo bioscan iniziale'} — cosa ha deciso?
                </p>
              </div>
              <button onClick={() => setAperto(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>

            {/* ── Opzioni bioscan di CONTROLLO ── */}
            {isControllo ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={loading} onClick={() => registra('AGGIUNGI_SESSIONE')}
                    className={`${box} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
                    Aggiungi<br />sessione
                  </button>
                  <button disabled={loading} onClick={() => registra('MANTENIMENTO')}
                    className={`${box} border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100`}>
                    Programma<br />mantenimento
                  </button>
                  <button disabled={loading} onClick={() => registra('FISIOTERAPIA')}
                    className={`${box} border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100`}>
                    Prendi<br />fitoterapia
                  </button>
                  <button disabled={loading} onClick={() => registra('PROGRAMMA_TERMINATO')}
                    className={`${box} border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100`}>
                    Programma<br />terminato
                  </button>
                </div>
                <button
                  onClick={() => setEspanso(e => e === 'DA_RICHIAMARE' ? null : 'DA_RICHIAMARE')}
                  className={`${box} border-amber-300 text-amber-800 w-full text-left
                    ${espanso === 'DA_RICHIAMARE' ? 'bg-amber-100 ring-2 ring-amber-300' : 'bg-amber-50 hover:bg-amber-100'}`}>
                  Deve pensarci
                </button>
              </>
            ) : (
              /* ── Opzioni bioscan INIZIALE ── */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={loading} onClick={() => registra('PROGRAMMA')}
                    className={`${box} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
                    Prenota<br />programma
                  </button>
                  <button disabled={loading} onClick={() => registra('PRESTAZIONE')}
                    className={`${box} border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100`}>
                    Prenota<br />prestazione
                  </button>
                  <button disabled={loading} onClick={() => registra('FITOTERAPIA')}
                    className={`${box} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                    Prenota<br />fitoterapia
                  </button>
                  <button
                    onClick={() => setEspanso(e => e === 'DA_RICHIAMARE' ? null : 'DA_RICHIAMARE')}
                    className={`${box} border-amber-300 text-amber-800
                      ${espanso === 'DA_RICHIAMARE' ? 'bg-amber-100 ring-2 ring-amber-300' : 'bg-amber-50 hover:bg-amber-100'}`}>
                    Deve<br />pensarci
                  </button>
                </div>
                <button
                  onClick={() => setEspanso(e => e === 'NON_INTERESSATO' ? null : 'NON_INTERESSATO')}
                  className={`${box} border-slate-300 text-slate-600 w-full text-left
                    ${espanso === 'NON_INTERESSATO' ? 'bg-slate-200 ring-2 ring-slate-400' : 'bg-slate-50 hover:bg-slate-100'}`}>
                  Non interessato
                </button>
                {espanso === 'NON_INTERESSATO' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Motivazione (opzionale)</p>
                    <textarea rows={2} value={motivazione} onChange={e => setMotivazione(e.target.value)}
                      placeholder="Es. costo, non convinto del trattamento…"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none" />
                    <div className="flex gap-2">
                      <button disabled={loading}
                        onClick={() => registra('NON_INTERESSATO', undefined, motivazione || undefined)}
                        className="rounded-full bg-slate-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
                        Conferma — non interessato
                      </button>
                      <button onClick={() => setEspanso(null)}
                        className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Form "Da richiamare" (comune a entrambi i flussi) */}
            {espanso === 'DA_RICHIAMARE' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-800">Quando richiamare?</p>
                <input type="date" value={dataRichiamo} onChange={e => setDataRichiamo(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none w-full" />
                <textarea rows={2} value={noteRichiamo} onChange={e => setNoteRichiamo(e.target.value)}
                  placeholder="Note (opzionale)…"
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none" />
                <div className="flex gap-2">
                  <button disabled={loading || !dataRichiamo}
                    onClick={() => registra('DA_RICHIAMARE', dataRichiamo, noteRichiamo || undefined)}
                    className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
                    Conferma
                  </button>
                  <button onClick={() => setEspanso(null)}
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                    Annulla
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </>
  )
}
