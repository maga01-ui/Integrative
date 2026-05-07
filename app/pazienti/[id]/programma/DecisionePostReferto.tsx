'use client'
// Pannello di decisione mostrato dopo la consegna del referto del bioscan di controllo.
// Il medico può scegliere tra: aggiungere nuove sessioni al programma oppure chiuderlo.

import { useState } from 'react'

interface Props {
  chiudiAction:    () => Promise<void>
  aggiungiAction:  (formData: FormData) => Promise<void>
}

export default function DecisionePostReferto({ chiudiAction, aggiungiAction }: Props) {
  // 'idle' | 'aggiungi' | 'chiudi'
  const [modalita, setModalita] = useState<'idle' | 'aggiungi' | 'chiudi'>('idle')
  const [caricando, setCaricando] = useState(false)

  async function handleChiudi() {
    if (!confirm('Confermi di chiudere definitivamente il programma?')) return
    setCaricando(true)
    await chiudiAction()
    setCaricando(false)
  }

  async function handleAggiungi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCaricando(true)
    await aggiungiAction(new FormData(e.currentTarget))
    setCaricando(false)
  }

  return (
    <div className="mx-6 mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
      <p className="text-sm font-semibold text-indigo-800 mb-3">
        Referto letto — cosa si decide?
      </p>

      {modalita === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModalita('aggiungi')}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
          >
            Aggiungi sessioni al programma
          </button>
          <button
            onClick={() => setModalita('chiudi')}
            className="rounded-full border border-indigo-300 px-4 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
          >
            Il programma è terminato
          </button>
        </div>
      )}

      {/* Scelta: aggiungi sessioni */}
      {modalita === 'aggiungi' && (
        <form onSubmit={handleAggiungi} className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-indigo-700 font-medium">Sessioni da aggiungere:</label>
          <input
            name="sessioniDaAggiungere"
            type="number"
            min={1}
            max={50}
            defaultValue={8}
            required
            className="w-20 rounded-xl border border-indigo-300 bg-white px-3 py-1.5 text-sm text-center outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={caricando}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {caricando ? 'Salvo…' : 'Conferma'}
          </button>
          <button
            type="button"
            onClick={() => setModalita('idle')}
            className="text-xs text-indigo-500 hover:underline"
          >
            Annulla
          </button>
        </form>
      )}

      {/* Scelta: chiudi programma */}
      {modalita === 'chiudi' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-indigo-700">Il programma verrà marcato come completato.</p>
          <button
            onClick={handleChiudi}
            disabled={caricando}
            className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
          >
            {caricando ? 'Salvo…' : 'Chiudi programma'}
          </button>
          <button
            type="button"
            onClick={() => setModalita('idle')}
            className="text-xs text-indigo-500 hover:underline"
          >
            Annulla
          </button>
        </div>
      )}
    </div>
  )
}
