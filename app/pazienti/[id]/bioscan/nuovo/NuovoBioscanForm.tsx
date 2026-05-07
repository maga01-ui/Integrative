'use client'
// Form bioscan: selezione tipologia, team, calendario disponibilità, prezzo, raccomandazioni

import { useState } from 'react'
import TeamOperatoriSection from '@/app/calendario/nuovo/TeamOperatoriSection'

type Tipologia = { id: string; tipologia: string; prezzo: string; durataMinuti: number }
type Operatore = { id: string; nome: string; cognome: string }
type Sala      = { id: string; nome: string }
type Team      = { id: string; nome: string; collaboratori: { utenteId: string }[] }

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function NuovoBioscanForm({
  action,
  tipologie,
  operatori,
  tipologiaDefaultId,
  sale,
  studioId,
  team,
}: {
  action:             (formData: FormData) => Promise<void>
  tipologie:          Tipologia[]
  operatori:          Operatore[]
  tipologiaDefaultId: string
  sale:               Sala[]
  studioId:           string
  team:               Team[]
}) {
  // Tracciamo solo l'ID della tipologia selezionata; il prezzo viene impostato
  // come defaultValue (non controllato) così l'utente può digitare liberamente.
  const [selectedTipId, setSelectedTipId] = useState(tipologiaDefaultId)
  const selectedTip = tipologie.find(t => t.id === selectedTipId)

  function onTipologiaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedTipId(e.target.value)
  }

  return (
    <form action={action} className="space-y-5">

      {/* Tipologia bioscan */}
      {tipologie.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Tipologia</label>
          <select name="tipologiaId" defaultValue={tipologiaDefaultId}
            onChange={onTipologiaChange} className={cls}>
            <option value="">— seleziona tipologia —</option>
            {tipologie.map(t => (
              <option key={t.id} value={t.id}>
                {t.tipologia} — {t.durataMinuti} min
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Team, data e operatore — TeamOperatoriSection mostra il selettore team solo se ce ne sono 2+ */}
      <TeamOperatoriSection
        team={team}
        tuttiOperatori={operatori}
        sale={sale}
        studioId={studioId}
      />

      {/* Prezzo: key forza il re-mount quando cambia tipologia, aggiornando defaultValue */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Prezzo (€)</label>
        <input
          key={selectedTipId || 'nessuna'}
          name="prezzo"
          type="number"
          step="0.01"
          min="0"
          defaultValue={selectedTip?.prezzo ?? ''}
          placeholder="0.00"
          className={cls}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Raccomandazioni</label>
        <textarea name="raccomandazioni" rows={3} placeholder="Note o raccomandazioni…" className={cls} />
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit"
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
          Salva Bioscan
        </button>
      </div>
    </form>
  )
}
