'use client'

// Wrapper che nasconde il contenuto (sessioni, bioscan, costi, form) quando
// il programma non è ATTIVO. Un bottone "Dettagli" lo espande su richiesta.

import { useState } from 'react'

export default function ProgrammaCollassabile({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean
  children: React.ReactNode
}) {
  const [aperto, setAperto] = useState(!defaultCollapsed)

  return (
    <>
      {/* Bottone toggle — sempre visibile */}
      <div className="border-t border-slate-100 px-6 py-3">
        <button
          onClick={() => setAperto(v => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
        >
          {aperto ? '▲ Chiudi dettagli' : '▼ Dettagli'}
        </button>
      </div>

      {/* Contenuto espandibile */}
      {aperto && children}
    </>
  )
}
