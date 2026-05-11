'use client'
// Gestisce i bottoni "Ricevuta emessa" e "Pagamento" per ogni appuntamento da fatturare.
// È un componente client perché il flusso pagamento richiede stato locale (mostra/nasconde il form).

import { useState, useTransition } from 'react'

interface Props {
  itemId:          string
  onEmettiRicevuta: (itemId: string) => Promise<void>
  onRegistraPagamento: (itemId: string, metodo: string) => Promise<void>
  statoIniziale:  'da_emettere' | 'emessa'
}

const METODI = [
  { v: 'CASH',     l: 'Contanti' },
  { v: 'CARTA',    l: 'Carta' },
  { v: 'BONIFICO', l: 'Bonifico' },
  { v: 'OMAGGIO',  l: 'Omaggio' },
]

export default function AzioniRicevuta({ itemId, onEmettiRicevuta, onRegistraPagamento, statoIniziale }: Props) {
  const [stato,        setStato]        = useState<'da_emettere' | 'emessa' | 'pagamento' | 'pagata'>(statoIniziale)
  const [metodo,       setMetodo]       = useState('CARTA')
  const [isPending,    startTransition] = useTransition()

  function handleEmettiRicevuta() {
    startTransition(async () => {
      await onEmettiRicevuta(itemId)
      setStato('emessa')
    })
  }

  function handlePagamento() {
    setStato('pagamento')
  }

  function handleConferma() {
    startTransition(async () => {
      await onRegistraPagamento(itemId, metodo)
      setStato('pagata')
    })
  }

  if (stato === 'pagata') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        Pagata
      </span>
    )
  }

  if (stato === 'pagamento') {
    return (
      <div className="flex items-center gap-2">
        <select
          value={metodo}
          onChange={e => setMetodo(e.target.value)}
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs outline-none"
        >
          {METODI.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <button
          onClick={handleConferma}
          disabled={isPending}
          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {isPending ? '…' : 'Conferma'}
        </button>
        <button
          onClick={() => setStato('emessa')}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Annulla
        </button>
      </div>
    )
  }

  if (stato === 'emessa') {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Emessa
        </span>
        <button
          onClick={handlePagamento}
          className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Pagamento →
        </button>
      </div>
    )
  }

  // stato === 'da_emettere'
  return (
    <button
      onClick={handleEmettiRicevuta}
      disabled={isPending}
      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-500 hover:bg-slate-50 disabled:opacity-40"
    >
      {isPending ? '…' : 'Emetti ricevuta'}
    </button>
  )
}
