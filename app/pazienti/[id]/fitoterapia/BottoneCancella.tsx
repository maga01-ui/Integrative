// Componente client per cancellare una prescrizione con finestra di conferma
'use client'

import { useState, useTransition } from 'react'
import { eliminaPrescrizioneFito } from './actions'

interface Props {
  prescrizioneId: string
  pazienteId: string
  /** Testo breve per la finestra di conferma, es. "Prescrizione del 01/01/2025" */
  labelConferma: string
}

export default function BottoneCancella({ prescrizioneId, pazienteId, labelConferma }: Props) {
  // aperto = mostra la finestra modale di conferma
  const [aperto, setAperto] = useState(false)
  // isPending = la server action è in esecuzione (mostra il caricamento)
  const [isPending, startTransition] = useTransition()

  function handleConferma() {
    startTransition(async () => {
      await eliminaPrescrizioneFito(prescrizioneId, pazienteId)
    })
  }

  return (
    <>
      {/* Bottone "Elimina" accanto a "Modifica" */}
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="flex-shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Elimina
      </button>

      {/* Finestra modale di conferma */}
      {aperto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Eliminare la prescrizione?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {labelConferma}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Questa operazione è irreversibile. Le eventuali fatture associate resteranno invariate.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              {/* Annulla */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => setAperto(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Annulla
              </button>

              {/* Conferma eliminazione */}
              <button
                type="button"
                disabled={isPending}
                onClick={handleConferma}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
