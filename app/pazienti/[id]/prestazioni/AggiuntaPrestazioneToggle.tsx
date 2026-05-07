'use client'
// Wrapper con bottone toggle per mostrare/nascondere il form di aggiunta prestazione

import { useState } from 'react'
import NuovaCuraForm from './NuovaCuraForm'

type Prestazione = { id: string; nome: string; prezzoBase: number; durataMinuti: number }
type Operatore   = { id: string; nome: string; cognome: string }
type Sala        = { id: string; nome: string }

interface Props {
  action:      (formData: FormData) => Promise<void>
  prestazioni: Prestazione[]
  operatori:   Operatore[]
  sale:        Sala[]
  studioId:    string
}

export default function AggiuntaPrestazioneToggle(props: Props) {
  const [aperto, setAperto] = useState(false)

  return (
    <div className="space-y-4">
      {/* Bottone sempre visibile in alto a sinistra */}
      <div>
        {!aperto ? (
          <button
            type="button"
            onClick={() => setAperto(true)}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            + Aggiungi prestazione
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAperto(false)}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            ✕ Annulla
          </button>
        )}
      </div>

      {/* Form — appare sotto il bottone */}
      {aperto && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-700">Nuova prestazione</h2>
          <NuovaCuraForm {...props} onSuccess={() => setAperto(false)} />
        </div>
      )}
    </div>
  )
}
