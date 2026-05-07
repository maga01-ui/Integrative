'use client'
// Componente di ricerca paziente con autocomplete.
// Mostra un campo testo: mentre si digita filtra la lista e propone i risultati.
// Quando si seleziona un paziente, scrive l'ID in un campo hidden "pazienteId".

import { useState, useRef, useEffect } from 'react'

interface Paziente {
  id:      string
  nome:    string
  // Nel DB il cognome è opzionale (string | null). Sotto, dove lo
  // visualizziamo, lo trattiamo con `?? ''` per evitare la stringa "null".
  cognome: string | null
}

interface Props {
  pazienti:      Paziente[]
  defaultId?:    string   // ID del paziente già associato (può essere "AUTO" per i lead)
  defaultLabel?: string   // Testo da mostrare quando defaultId è "AUTO" (es. nome del lead)
  required?:     boolean
}

export default function PazienteSearch({ pazienti, defaultId, defaultLabel, required }: Props) {

  // Trova il paziente pre-selezionato; se non trovato ma c'è un defaultLabel (caso lead AUTO) usalo
  const preselezionato = pazienti.find(p => p.id === defaultId)
  const labelPresel    = preselezionato
    ? `${preselezionato.cognome ?? ''} ${preselezionato.nome}`.trim()
    : (defaultLabel ?? '')

  const [query,          setQuery]          = useState(labelPresel)
  // Se defaultId è "AUTO" lo teniamo così finché l'utente non seleziona un paziente esistente
  const [idSelezionato,  setIdSelezionato]  = useState(defaultId ?? '')
  const [aperto,         setAperto]         = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Chiude il dropdown cliccando fuori
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAperto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filtra i pazienti in base al testo digitato
  const filtrati = query.trim().length === 0
    ? pazienti
    : pazienti.filter(p => {
        const full = `${p.cognome ?? ''} ${p.nome}`.toLowerCase()
        return query.toLowerCase().split(' ').every(t => full.includes(t))
      })

  function seleziona(p: Paziente) {
    setQuery(`${p.cognome ?? ''} ${p.nome}`.trim())
    setIdSelezionato(p.id)
    setAperto(false)
    document.dispatchEvent(new CustomEvent('pazienteSelezionato', { detail: { id: p.id } }))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setIdSelezionato('')   // resetta la selezione se l'utente ri-digita
    setAperto(true)
    document.dispatchEvent(new CustomEvent('pazienteSelezionato', { detail: { id: '' } }))
  }

  const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

  return (
    <div ref={wrapRef} className="relative">
      {/* Campo hidden che porta l'ID al server action */}
      <input type="hidden" name="pazienteId" value={idSelezionato} />

      <label className="block text-sm font-medium text-slate-700">Paziente *</label>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => setAperto(true)}
        placeholder="Cerca per cognome o nome…"
        required={required}
        autoComplete="off"
        className={cls}
      />

      {/* Dropdown risultati */}
      {aperto && filtrati.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
          {filtrati.slice(0, 50).map(p => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={() => seleziona(p)}  // mousedown prima del blur
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="font-medium">{p.cognome ?? ''}</span> {p.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
