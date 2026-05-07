'use client'

// Pulsante "Perso" nella scheda paziente.
// Quando si clicca per segnare come perso appare un campo note per inserire il motivo.
// Quando invece si rimuove lo stato perso, l'azione avviene direttamente.

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { togglePerso } from './actions'

export default function PersoButton({
  pazienteId,
  perso,
  persoNota,
  appuntamentiFuturi,
}: {
  pazienteId:         string
  perso:              boolean
  persoNota?:         string | null
  appuntamentiFuturi: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Controlla se stiamo mostrando il form con la nota
  const [mostraNota, setMostraNota] = useState(false)
  const [nota, setNota] = useState('')

  // Click sul pulsante quando il paziente NON è ancora perso
  function handleClickPerso() {
    // Mostra il campo note invece di procedere subito
    setMostraNota(true)
    setNota('')
  }

  // Conferma: salva lo stato perso con la nota inserita
  function handleConferma() {
    const proseguire =
      appuntamentiFuturi > 0
        ? confirm(
            `Attenzione, ${appuntamentiFuturi} appuntament${appuntamentiFuturi === 1 ? 'o' : 'i'} in corso verr${appuntamentiFuturi === 1 ? 'à' : 'anno'} cancellat${appuntamentiFuturi === 1 ? 'o' : 'i'}.\n\nProcedere?`
          )
        : true

    if (!proseguire) return

    startTransition(async () => {
      await togglePerso(pazienteId, false, nota.trim() || undefined)
      setMostraNota(false)
      router.refresh()
    })
  }

  // Annulla: chiude il form senza salvare
  function handleAnnulla() {
    setMostraNota(false)
    setNota('')
  }

  // Click quando il paziente è già perso → rimuove lo stato direttamente
  function handleRimuovi() {
    startTransition(async () => {
      await togglePerso(pazienteId, true)
      router.refresh()
    })
  }

  // ── Caso: paziente già segnato come perso ─────────────────────────────────────
  if (perso) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={handleRimuovi}
          disabled={pending}
          title="Rimuovi stato perso"
          className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
        >
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {pending ? '…' : 'Perso'}
        </button>
      </div>
    )
  }

  // ── Caso: mostra il form con la nota ─────────────────────────────────────────
  if (mostraNota) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
        <p className="text-xs font-semibold text-red-700">Motivo (opzionale)</p>
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Es. ha cambiato studio, non interessato…"
          rows={2}
          className="w-56 resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConferma}
            disabled={pending}
            className="flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? '…' : 'Conferma'}
          </button>
          <button
            type="button"
            onClick={handleAnnulla}
            disabled={pending}
            className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </div>
    )
  }

  // ── Caso: pulsante normale (paziente non ancora perso) ────────────────────────
  return (
    <button
      type="button"
      onClick={handleClickPerso}
      disabled={pending}
      title="Segna come perso"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
    >
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      Perso
    </button>
  )
}
