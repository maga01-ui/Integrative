'use client'
// Pannello decisione paziente dopo lettura referto.
// Gestisce localmente l'espansione dei form per "Da richiamare" e "Non interessato".

import { useState } from 'react'

interface Props {
  pazienteId:      string
  pazienteNome:    string
  registraAction:  (formData: FormData) => Promise<void>
}

export default function DecisionePanel({ pazienteId, pazienteNome, registraAction }: Props) {
  // quale box è espanso per la raccolta di input aggiuntivi
  const [espanso, setEspanso] = useState<'DA_RICHIAMARE' | 'NON_INTERESSATO' | null>(null)

  const boxBase = 'rounded-2xl border p-4 text-xs font-semibold transition cursor-pointer'

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-800">Decisione del paziente dopo la lettura</p>
      <p className="text-xs text-slate-500">Cosa ha deciso di fare {pazienteNome}?</p>

      {/* ── Quattro box diretti (senza input aggiuntivi) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        {/* Programma */}
        <form action={registraAction}>
          <input type="hidden" name="pazienteId" value={pazienteId} />
          <input type="hidden" name="decisione"  value="PROGRAMMA" />
          <button type="submit" className={`w-full ${boxBase} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
            Fissa<br />programma
          </button>
        </form>

        {/* Prestazione */}
        <form action={registraAction}>
          <input type="hidden" name="pazienteId" value={pazienteId} />
          <input type="hidden" name="decisione"  value="PRESTAZIONE" />
          <button type="submit" className={`w-full ${boxBase} border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100`}>
            Fissa<br />prestazione
          </button>
        </form>

        {/* Fitoterapia */}
        <form action={registraAction}>
          <input type="hidden" name="pazienteId" value={pazienteId} />
          <input type="hidden" name="decisione"  value="FITOTERAPIA" />
          <button type="submit" className={`w-full ${boxBase} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
            Fissa<br />fitoterapia
          </button>
        </form>

        {/* Da richiamare — espande il form con la data */}
        <button
          type="button"
          onClick={() => setEspanso(e => e === 'DA_RICHIAMARE' ? null : 'DA_RICHIAMARE')}
          className={`${boxBase} border-amber-300 ${espanso === 'DA_RICHIAMARE' ? 'bg-amber-100 ring-2 ring-amber-300' : 'bg-amber-50 hover:bg-amber-100'} text-amber-800`}
        >
          Deve<br />pensarci
        </button>
      </div>

      {/* ── Form "Da richiamare" espanso ── */}
      {espanso === 'DA_RICHIAMARE' && (
        <form action={registraAction} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <input type="hidden" name="pazienteId" value={pazienteId} />
          <input type="hidden" name="decisione"  value="DA_RICHIAMARE" />
          <p className="text-xs font-semibold text-amber-800">Quando richiamare?</p>
          <input
            type="date"
            name="dataRichiamo"
            required
            min={new Date().toISOString().slice(0, 10)}
            className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
              Conferma
            </button>
            <button type="button" onClick={() => setEspanso(null)} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* ── Box "Non interessato" — espande il form con la motivazione ── */}
      <button
        type="button"
        onClick={() => setEspanso(e => e === 'NON_INTERESSATO' ? null : 'NON_INTERESSATO')}
        className={`${boxBase} border-slate-300 ${espanso === 'NON_INTERESSATO' ? 'bg-slate-200 ring-2 ring-slate-400' : 'bg-slate-50 hover:bg-slate-100'} text-slate-600 w-full text-left`}
      >
        Non interessato
      </button>

      {/* ── Form "Non interessato" espanso ── */}
      {espanso === 'NON_INTERESSATO' && (
        <form action={registraAction} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <input type="hidden" name="pazienteId" value={pazienteId} />
          <input type="hidden" name="decisione"  value="NON_INTERESSATO" />
          <p className="text-xs font-semibold text-slate-700">Motivazione (opzionale)</p>
          <textarea
            name="motivazione"
            rows={2}
            placeholder="Es. costo, non convinto del trattamento…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-slate-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
              Conferma — non interessato
            </button>
            <button type="button" onClick={() => setEspanso(null)} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
