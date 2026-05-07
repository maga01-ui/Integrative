'use client'
// Bottoni Modifica e Cancella per ogni riga dell'agenda paziente.
// Se l'appuntamento ha una ricevuta emessa, la cancellazione mostra un avviso.

import { useTransition } from 'react'

interface Props {
  appId:        string
  pazienteId:   string
  haRicevuta:   boolean   // true se esiste una fattura associata
  onCancella:   (appId: string) => Promise<void>
}

export default function AzioniAppuntamento({ appId, pazienteId, haRicevuta, onCancella }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleCancella() {
    const msg = haRicevuta
      ? '⚠️ Attenzione: questo appuntamento ha una ricevuta emessa.\nCancellando l\'appuntamento la ricevuta rimarrà nel sistema.\n\nConfermi la cancellazione?'
      : 'Confermi la cancellazione di questo appuntamento?'
    if (!confirm(msg)) return
    startTransition(() => onCancella(appId))
  }

  return (
    <div className="flex items-center gap-2">
      {haRicevuta && (
        <span
          title="Ricevuta emessa"
          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
        >
          Ricevuta
        </span>
      )}
      <a
        href={`/pazienti/${pazienteId}/agenda/${appId}`}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
      >
        Modifica
      </a>
      <button
        onClick={handleCancella}
        disabled={isPending}
        className="rounded-full border border-red-100 px-3 py-1 text-xs font-medium text-red-400 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
      >
        {isPending ? '…' : 'Cancella'}
      </button>
    </div>
  )
}
