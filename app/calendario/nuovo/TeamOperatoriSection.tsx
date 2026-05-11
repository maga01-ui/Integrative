'use client'
// Sezione Team + Operatore + Sala + DatePicker.
// Riceve dati già aggiornati da FormStudioWrapper — non fa fetch autonomi.
// Se team è vuoto, il campo team non viene mostrato.

import { useState } from 'react'
import DatePickerCalendario from './DatePickerCalendario'

interface Operatore { id: string; nome: string; cognome: string }
interface Sala      { id: string; nome: string }
interface Team      { id: string; nome: string; collaboratori: { utenteId: string }[] }

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function TeamOperatoriSection({
  team,
  tuttiOperatori,
  sale,
  studioId,
  defaultTeamId = '',
}: {
  team:           Team[]
  tuttiOperatori: Operatore[]
  sale:           Sala[]
  studioId:       string
  defaultTeamId?: string
}) {
  // Priorità: defaultTeamId dal paziente → team unico → vuoto
  const [teamId, setTeamId] = useState(() => {
    if (defaultTeamId && team.some(t => t.id === defaultTeamId)) return defaultTeamId
    if (team.length === 1) return team[0].id
    return ''
  })

  const operatoriFiltrati = teamId
    ? tuttiOperatori.filter(op =>
        team.find(t => t.id === teamId)?.collaboratori.some(c => c.utenteId === op.id)
      )
    : tuttiOperatori

  // Mostra il selettore solo se ci sono 2+ team; con 1 solo team lo si seleziona in automatico
  const mostraSelectTeam = team.length > 1

  return (
    <>
      {/* Team — visibile solo se lo studio ha 2 o più team attivi.
          Larghezza ridotta a metà (come Tipologia e Giorno) tramite grid a 2 colonne. */}
      {mostraSelectTeam ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Team *</label>
            <select
              name="teamId"
              required
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              className={cls}
            >
              <option value="">Seleziona team…</option>
              {team.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        /* 0 team → stringa vuota; 1 team → id automatico */
        <input type="hidden" name="teamId" value={team[0]?.id ?? ''} />
      )}

      {/* Data e ora */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Data e ora inizio *</label>
        <DatePickerCalendario
          sale={sale}
          operatori={operatoriFiltrati}
          studioId={studioId}
        />
      </div>

    </>
  )
}
