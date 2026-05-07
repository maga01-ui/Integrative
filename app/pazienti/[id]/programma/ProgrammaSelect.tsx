'use client'
// Selezione programma: card cliccabili con evidenziazione gestita via useState

import { useState } from 'react'

type Programma = {
  id:                     string
  nome:                   string
  descrizione:            string | null
  tipo:                   string
  defaultSessioni:        number
  prezzoSessione:         number
  prezzoBioscanIniziale:  number
  prezzoBioscanControllo: number
}

const TIPO_LABEL: Record<string, string> = {
  TRATTAMENTI: 'Trattamenti',
  FITOTERAPIA: 'Fitoterapia',
  ENTRAMBI:    'Trattamenti + Fitoterapia',
}

export default function ProgrammaSelect({
  programmi,
  defaultSessioni = 8,
}: {
  programmi:       Programma[]
  defaultSessioni?: number
}) {
  const [selectedId, setSelectedId] = useState<string>('')
  const selected = programmi.find(p => p.id === selectedId)

  return (
    <div className="space-y-5">

      {/* Card selezionabili */}
      <div className="grid gap-3 sm:grid-cols-2">
        {programmi.map(prog => {
          const costoTotale =
            prog.prezzoBioscanIniziale +
            (prog.defaultSessioni * prog.prezzoSessione) +
            prog.prezzoBioscanControllo
          const isSelected = selectedId === prog.id

          return (
            <label key={prog.id} className="cursor-pointer" onClick={() => setSelectedId(prog.id)}>
              <input
                type="radio"
                name="programmaId"
                value={prog.id}
                checked={isSelected}
                onChange={() => setSelectedId(prog.id)}
                className="sr-only"
              />
              <div className={`rounded-2xl border-2 p-4 transition ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{prog.nome}</p>
                    {prog.descrizione && (
                      <p className="mt-0.5 text-xs text-slate-500">{prog.descrizione}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 whitespace-nowrap">
                    {TIPO_LABEL[prog.tipo] ?? prog.tipo}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <div>
                    <p className="font-medium text-slate-700">{prog.defaultSessioni}</p>
                    <p>sessioni</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">€ {prog.prezzoSessione.toFixed(0)}</p>
                    <p>a sessione</p>
                  </div>
                  <div>
                    <p className="font-semibold text-indigo-700">€ {costoTotale.toLocaleString('it-IT')}</p>
                    <p>totale</p>
                  </div>
                </div>
              </div>
            </label>
          )
        })}
      </div>

      {/* Numero sessioni — si aggiorna automaticamente con il default del programma selezionato */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Numero di sessioni</label>
        <p className="mb-1.5 text-xs text-slate-400">
          Modifica se diverso dal default del programma selezionato.
        </p>
        <input
          type="number"
          name="sessioniTotali"
          min="1"
          max="50"
          key={selected?.id ?? 'default'}
          defaultValue={selected?.defaultSessioni ?? defaultSessioni}
          className="mt-1 w-32 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-900"
        />
      </div>

    </div>
  )
}
