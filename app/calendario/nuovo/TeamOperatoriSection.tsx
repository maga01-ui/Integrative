'use client'
// Sezione Operatore + Sala + DatePicker per il form di creazione appuntamento.
//
// NOTA: il team NON è più scelto in questo form. Viene preso automaticamente
// dal paziente (campo Paziente.teamId, impostato in fase di creazione del
// paziente e modificabile solo dalla sua scheda). Qui usiamo il defaultTeamId
// solo come campo nascosto, così la server action lo salva sull'appuntamento.
// La lista degli operatori viene filtrata in base ai membri di quel team
// (se presente), in modo che si possa scegliere come operatore della singola
// prestazione anche un operatore diverso, purché appartenente al team.

import DatePickerCalendario from './DatePickerCalendario'

interface Operatore { id: string; nome: string; cognome: string }
interface Sala      { id: string; nome: string }
interface Team      { id: string; nome: string; collaboratori: { utenteId: string }[] }

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
  // Il team da usare è esclusivamente quello del paziente.
  const teamId = defaultTeamId

  // Filtra gli operatori in base ai membri del team del paziente.
  // Se il paziente non ha un team (caso vecchi pazienti), mostriamo tutti
  // gli operatori dello studio.
  const operatoriFiltrati = teamId
    ? tuttiOperatori.filter(op =>
        team.find(t => t.id === teamId)?.collaboratori.some(c => c.utenteId === op.id)
      )
    : tuttiOperatori

  return (
    <>
      {/* Team: hidden input — valore preso dal paziente. */}
      <input type="hidden" name="teamId" value={teamId} />

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
