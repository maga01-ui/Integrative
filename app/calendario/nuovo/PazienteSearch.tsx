'use client'
// Combobox di ricerca paziente — filtra per nome/cognome mentre si digita.
// Scrive l'ID selezionato in un input hidden (name="pazienteId") per il form.

import { useState, useRef, useEffect } from 'react'

interface Paziente { id: string; nome: string; cognome: string | null }

// Stile di default per l'input — coerente con gli altri form dell'app
const CLS_DEFAULT = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function PazienteSearch({
  pazienti,
  defaultId = '',
  cls = CLS_DEFAULT,   // opzionale: chi non passa cls usa lo stile standard
}: {
  pazienti:  Paziente[]
  defaultId?: string
  cls?:      string
}) {
  // Trova il paziente preselezionato (es. arrivando dall'agenda paziente)
  const iniziale = pazienti.find(p => p.id === defaultId)

  const [query,     setQuery]     = useState(iniziale ? `${iniziale.cognome ?? ''} ${iniziale.nome}`.trim() : '')
  const [selId,     setSelId]     = useState(defaultId)
  const [aperto,    setAperto]    = useState(false)
  const [hoverId,   setHoverId]   = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Chiude il dropdown se si clicca fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAperto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Filtra i pazienti in base alla query (cerca in nome + cognome)
  const risultati = query.length === 0
    ? pazienti.slice(0, 30)  // mostra i primi 30 quando non c'è testo
    : pazienti.filter(p => {
        const testo = `${p.cognome ?? ''} ${p.nome}`.toLowerCase()
        return testo.includes(query.toLowerCase())
      }).slice(0, 30)

  function seleziona(p: Paziente) {
    setSelId(p.id)
    setQuery(`${p.cognome ?? ''} ${p.nome}`.trim())
    setAperto(false)
    // Notifica i componenti della stessa pagina (es. TipoAppuntamentoSelect)
    document.dispatchEvent(new CustomEvent('pazienteSelezionato', { detail: { id: p.id } }))
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setSelId('')   // reset selezione quando l'utente modifica il testo
    setAperto(true)
    document.dispatchEvent(new CustomEvent('pazienteSelezionato', { detail: { id: '' } }))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input hidden — contiene l'ID effettivo inviato dal form */}
      <input type="hidden" name="pazienteId" value={selId} />

      {/* Campo testo visibile */}
      <input
        type="text"
        autoComplete="off"
        placeholder="Cerca per cognome o nome…"
        value={query}
        onChange={handleInput}
        onFocus={() => setAperto(true)}
        className={cls}
        required
      />

      {/* Dropdown risultati */}
      {aperto && risultati.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
          {risultati.map(p => {
            const label = `${p.cognome ?? ''} ${p.nome}`.trim()
            const isHov = hoverId === p.id
            return (
              <li
                key={p.id}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
                onMouseDown={() => seleziona(p)}   // mouseDown anziché click → prima del blur
                className={`cursor-pointer px-4 py-2 text-sm ${isHov ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
              >
                {label}
              </li>
            )
          })}
        </ul>
      )}

      {/* Avviso se nessun risultato */}
      {aperto && query.length > 0 && risultati.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-xl">
          Nessun paziente trovato
        </div>
      )}
    </div>
  )
}
