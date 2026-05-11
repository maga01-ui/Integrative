'use client'
// Form per aggiungere una cura singola.
// Usa DatePickerCalendario per mostrare la griglia disponibilità sale/operatori.

import { useState } from 'react'
import DatePickerCalendario from '@/app/calendario/nuovo/DatePickerCalendario'

type Prestazione = { id: string; nome: string; prezzoBase: number; durataMinuti: number }
type Operatore   = { id: string; nome: string; cognome: string }
type Sala        = { id: string; nome: string }

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function NuovaCuraForm({
  action,
  prestazioni,
  operatori,
  sale,
  studioId,
  onSuccess,
}: {
  action:      (formData: FormData) => Promise<void>
  prestazioni: Prestazione[]
  operatori:   Operatore[]
  sale:        Sala[]
  studioId:    string
  onSuccess?:  () => void
}) {
  const [prezzo, setPrezzo] = useState('')
  const [durata, setDurata] = useState(60)

  // Aggiorna prezzo e durata nascosta quando si sceglie la prestazione
  function onPrestazioneChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = prestazioni.find(p => p.id === e.target.value)
    if (p) { setPrezzo(String(p.prezzoBase)); setDurata(p.durataMinuti) }
    else   { setPrezzo(''); setDurata(60) }
  }

  async function handleAction(formData: FormData) {
    await action(formData)
    onSuccess?.()
  }

  return (
    <form action={handleAction} className="space-y-5">

      {/* Durata nascosta: serve alla server action per calcolare l'orario di fine */}
      <input type="hidden" name="durata" value={durata} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Prestazione */}
        <div>
          <label className="text-sm font-medium text-slate-700">Prestazione *</label>
          <select name="prestazioneId" required onChange={onPrestazioneChange} className={cls}>
            <option value="">— seleziona —</option>
            {prestazioni.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome} — {p.durataMinuti} min
              </option>
            ))}
          </select>
        </div>

        {/* Prezzo (si aggiorna in automatico dalla prestazione, modificabile) */}
        <div>
          <label className="text-sm font-medium text-slate-700">Prezzo (€) *</label>
          <input
            type="number"
            name="prezzo"
            required
            min="0"
            step="0.01"
            value={prezzo}
            onChange={e => setPrezzo(e.target.value)}
            placeholder="0.00"
            className={cls}
          />
        </div>
      </div>

      {/* Selettore data/ora con griglia disponibilità sale e operatori.
          DatePickerCalendario gestisce internamente ora, sala e operatore tramite il popup
          e scrive i campi hidden "inizio", "salaId" e "medicoId" letti dalla Server Action.
          Non duplichiamo i select qui: ora/sala/operatore si modificano SOLO dal popup. */}
      <DatePickerCalendario
        sale={sale}
        operatori={operatori}
        studioId={studioId}
      />

      {/* Note */}
      <div>
        <label className="text-sm font-medium text-slate-700">Note (opzionale)</label>
        <textarea name="note" rows={2} placeholder="Note per questa cura…" className={cls} />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
        >
          Salva prestazione
        </button>
      </div>
    </form>
  )
}
