'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Box "Operatore di riferimento + Team" della scheda paziente.
//
// Comportamento:
//  - In modalità VISUALIZZAZIONE mostra i due valori correnti e un bottone
//    "Modifica".
//  - Cliccando "Modifica" passa in modalità EDIT con due select. L'utente
//    può salvare (server action) oppure annullare per tornare in lettura.
//
// L'operatore di riferimento e il team vengono impostati una volta sola
// alla creazione del paziente, e poi rimangono stabili. Si modificano solo
// da qui: nelle altre pagine (creazione appuntamento, ecc.) non vengono
// più richiesti.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from 'react'
import { aggiornaOperatoreTeam } from './actions'

type Opzione = { id: string; label: string }

export default function OperatoreTeamBox({
  pazienteId,
  operatoreIdIniziale,
  teamIdIniziale,
  operatoreNome,
  teamNome,
  operatori,
  team,
}: {
  pazienteId: string
  operatoreIdIniziale: string | null
  teamIdIniziale: string | null
  // Etichette correnti (per la modalità lettura). Possono essere null se non assegnati.
  operatoreNome: string | null
  teamNome: string | null
  operatori: Opzione[]
  team: Opzione[]
}) {
  // Modalità: false = lettura, true = modifica
  const [modifica, setModifica] = useState(false)
  // Valori selezionati nel form (mantenuti localmente durante la modifica)
  const [operatoreId, setOperatoreId] = useState(operatoreIdIniziale ?? '')
  const [teamId, setTeamId]           = useState(teamIdIniziale ?? '')
  // Flag "salvataggio in corso" (usa useTransition per evitare doppio click)
  const [inAttesa, startTransition] = useTransition()
  // Eventuale errore restituito dalla server action
  const [errore, setErrore] = useState<string | null>(null)

  // Invia la modifica alla server action
  function salva() {
    setErrore(null)
    if (!operatoreId) { setErrore('Seleziona un operatore.'); return }
    if (!teamId)      { setErrore('Seleziona un team.');      return }
    startTransition(async () => {
      try {
        await aggiornaOperatoreTeam(pazienteId, operatoreId, teamId)
        setModifica(false)
      } catch (e: unknown) {
        setErrore(e instanceof Error ? e.message : 'Errore nel salvataggio.')
      }
    })
  }

  // Annulla → ripristina i valori iniziali e torna in lettura
  function annulla() {
    setOperatoreId(operatoreIdIniziale ?? '')
    setTeamId(teamIdIniziale ?? '')
    setErrore(null)
    setModifica(false)
  }

  // Stile comune per i select
  const sel = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900'

  // ── Modalità modifica ────────────────────────────────────────────────────
  if (modifica) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm text-slate-500">Operatore di riferimento</p>
          <select
            value={operatoreId}
            onChange={e => setOperatoreId(e.target.value)}
            disabled={inAttesa}
            className={sel}
          >
            <option value="">— Seleziona —</option>
            {operatori.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-sm text-slate-500">Team di riferimento</p>
          <select
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            disabled={inAttesa}
            className={sel}
          >
            <option value="">— Seleziona —</option>
            {team.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Errore eventuale */}
        {errore && (
          <p className="text-sm text-red-600 sm:col-span-2">{errore}</p>
        )}

        {/* Pulsanti */}
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={salva}
            disabled={inAttesa}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover disabled:opacity-50"
          >
            {inAttesa ? 'Salvo…' : 'Salva'}
          </button>
          <button
            type="button"
            onClick={annulla}
            disabled={inAttesa}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </div>
    )
  }

  // ── Modalità lettura ─────────────────────────────────────────────────────
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <div>
        <p className="text-sm text-slate-500">Operatore</p>
        <p className="mt-0.5 text-slate-900">{operatoreNome ?? '—'}</p>
      </div>
      <div>
        <p className="text-sm text-slate-500">Team</p>
        <p className="mt-0.5 text-slate-900">{teamNome ?? '—'}</p>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={() => setModifica(true)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Modifica
        </button>
      </div>
    </div>
  )
}
