'use client'
// Wrapper client che gestisce studioId come stato e ricarica team/operatori/sale
// dall'API ogni volta che lo studio cambia. Passa i dati aggiornati a TeamOperatoriSection.

import { useState, useEffect } from 'react'
import TeamOperatoriSection from './TeamOperatoriSection'

interface Studio    { id: string; nome: string; citta?: string | null }
interface Operatore { id: string; nome: string; cognome: string }
interface Sala      { id: string; nome: string }
interface Team      { id: string; nome: string; collaboratori: { utenteId: string }[] }

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function FormStudioWrapper({
  studi,
  studioIdIniziale,
  team:              teamIniziale,
  operatori:         operatoriIniziali,
  sale:              saleIniziali,
  mostraSelect,
  pazienteIdIniziale = '',
}: {
  studi:              Studio[]
  studioIdIniziale:   string
  team:               Team[]
  operatori:          Operatore[]
  sale:               Sala[]
  mostraSelect:       boolean
  pazienteIdIniziale?: string
}) {
  const [studioId,      setStudioId]      = useState(studioIdIniziale)
  const [team,          setTeam]          = useState<Team[]>(teamIniziale)
  const [operatori,     setOperatori]     = useState<Operatore[]>(operatoriIniziali)
  const [sale,          setSale]          = useState<Sala[]>(saleIniziali)
  const [caricando,     setCaricando]     = useState(false)
  const [defaultTeamId, setDefaultTeamId] = useState('')

  // Carica l'ultimo team usato per un paziente
  function caricaTeamPaziente(pazienteId: string) {
    if (!pazienteId) { setDefaultTeamId(''); return }
    fetch(`/api/paziente-ultimo-team?pazienteId=${pazienteId}`)
      .then(r => r.json())
      .then(data => setDefaultTeamId(data.teamId ?? ''))
      .catch(() => setDefaultTeamId(''))
  }

  // Quando il paziente iniziale è noto (URL param), carica subito il team
  useEffect(() => {
    caricaTeamPaziente(pazienteIdIniziale)
  }, [pazienteIdIniziale])  // eslint-disable-line react-hooks/exhaustive-deps

  // Ascolta la selezione dinamica del paziente dal campo di ricerca
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail.id
      caricaTeamPaziente(id)
    }
    document.addEventListener('pazienteSelezionato', handler)
    return () => document.removeEventListener('pazienteSelezionato', handler)
  }, [])

  // Quando lo studio cambia, ricarica team/operatori/sale dall'API
  useEffect(() => {
    // Al primo render usa i dati server (già corretti), ricarica solo ai cambi successivi
    setCaricando(true)
    fetch(`/api/team?studioId=${studioId}`)
      .then(r => r.json())
      .then(data => {
        setTeam(data.team        ?? [])
        setOperatori(data.operatori ?? [])
        setSale(data.sale        ?? [])
      })
      .catch(() => {
        setTeam([])
        setOperatori([])
        setSale([])
      })
      .finally(() => setCaricando(false))
  }, [studioId])

  return (
    <>
      {/* ── Selettore studio ───────────────────────────────────────────
          Larghezza ridotta a metà tramite grid a 2 colonne. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Studio *</label>
          {mostraSelect ? (
            <select
              name="studioId"
              value={studioId}
              onChange={e => setStudioId(e.target.value)}
              className={cls}
            >
              {studi.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome}{s.citta ? ` — ${s.citta}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="studioId" value={studioId} />
              <div className={`${cls} bg-slate-100 text-slate-500 cursor-not-allowed`}>
                {studi[0]?.nome ?? studioId}
              </div>
            </>
          )}
        </div>
      </div>

      {caricando && (
        <p className="text-xs text-slate-400">Caricamento dati studio…</p>
      )}

      {/* ── Team + Data/ora + Operatore + Sala ───────────────────────── */}
      {!caricando && (
        <TeamOperatoriSection
          key={defaultTeamId}
          team={team}
          tuttiOperatori={operatori}
          sale={sale}
          studioId={studioId}
          defaultTeamId={defaultTeamId}
        />
      )}
    </>
  )
}
