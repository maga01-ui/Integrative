'use client'
// Tabella degli appuntamenti di un programma con modifica inline.
// Cliccando "Modifica" su una riga, compare un pannello di editing sotto di essa.
// Scegliendo la data, si apre automaticamente il popup per sala e operatore.

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Tipi ──────────────────────────────────────────────────────────────────────

export type AppRow = {
  id:              string
  inizio:          string   // ISO
  dataFormattata:  string   // pre-formattata dal server per evitare hydration mismatch
  oraFormattata:   string
  stato:           string
  prezzoApplicato: number
  medicoId:        string
  salaId:          string
  medicoNome:      string   // "Cognome Nome" pre-formattato dal server
  salaNome:        string
}

type Operatore = { id: string; nome: string; cognome: string }
type Sala      = { id: string; nome: string }

type AppuntamentoApi = {
  id:       string
  start:    string
  end:      string
  salaId:   string
  medicoId: string
  paziente: string
  tipo:     string
  color:    string
  medico:   string
  sala:     string
  stato:    string
}

type EditState = {
  data:         string   // YYYY-MM-DD
  ora:          string   // HH:mm
  medicoId:     string
  salaId:       string
  appuntamenti: AppuntamentoApi[]
  caricando:    boolean
  salvando:     boolean
}

// ── Costanti ──────────────────────────────────────────────────────────────────

const ORE = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

const ORARI: string[] = []
for (let h = 8; h <= 20; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === 20 && m > 0) break
    ORARI.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }
}

const STATO_BADGE: Record<string, string> = {
  COMPLETATO:       'bg-green-50 text-green-700',
  CANCELLATO:       'bg-red-50 text-red-500',
  NO_SHOW:          'bg-amber-50 text-amber-700',
  DA_RIPROGRAMMARE: 'bg-purple-50 text-purple-700',
}

// ── Componente principale ─────────────────────────────────────────────────────

export default function TabellaAppuntamenti({
  appuntamenti,
  operatori,
  sale,
  studioId,
}: {
  appuntamenti: AppRow[]
  operatori:    Operatore[]
  sale:         Sala[]
  studioId:     string
}) {
  const router = useRouter()

  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editState,  setEditState]  = useState<EditState | null>(null)
  const [modalAperto, setModalAperto] = useState(false)

  // Avvia la modifica inline per un appuntamento
  function avviaModifica(a: AppRow) {
    const dt = new Date(a.inizio)
    const data = dt.toISOString().slice(0, 10)
    const ora  = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`
    setEditingId(a.id)
    setEditState({ data, ora, medicoId: a.medicoId, salaId: a.salaId, appuntamenti: [], caricando: false, salvando: false })
    setModalAperto(false)
  }

  function annullaModifica() {
    setEditingId(null)
    setEditState(null)
    setModalAperto(false)
  }

  function aggEdit(aggiornamenti: Partial<EditState>) {
    setEditState(prev => prev ? { ...prev, ...aggiornamenti } : prev)
  }

  // Quando cambia la data: carica disponibilità e apre subito il modal
  async function cambiaData(val: string) {
    aggEdit({ data: val, appuntamenti: [], caricando: !!val })
    if (!val) { setModalAperto(false); return }

    setModalAperto(true)
    const inizio = new Date(`${val}T00:00:00`)
    const fine   = new Date(`${val}T23:59:59`)
    try {
      const res  = await fetch(`/api/appuntamenti?start=${inizio.toISOString()}&end=${fine.toISOString()}&studioId=${studioId}`)
      const dati = await res.json()
      aggEdit({ appuntamenti: Array.isArray(dati) ? dati : [], caricando: false })
    } catch {
      aggEdit({ appuntamenti: [], caricando: false })
    }
  }

  // Salva le modifiche tramite PATCH
  async function salva() {
    if (!editingId || !editState) return
    aggEdit({ salvando: true })

    const res = await fetch(`/api/appuntamenti/${editingId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        inizio:   `${editState.data}T${editState.ora}:00`,
        medicoId: editState.medicoId,
        salaId:   editState.salaId,
      }),
    })

    if (res.ok) {
      setEditingId(null)
      setEditState(null)
      setModalAperto(false)
      router.refresh()
    } else {
      aggEdit({ salvando: false })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 pl-6 text-left text-xs font-medium text-slate-400">#</th>
            <th className="py-2 text-left text-xs font-medium text-slate-400">Data e ora</th>
            <th className="py-2 text-left text-xs font-medium text-slate-400">Operatore</th>
            <th className="py-2 text-left text-xs font-medium text-slate-400">Sala</th>
            <th className="py-2 text-left text-xs font-medium text-slate-400">Stato</th>
            <th className="py-2 text-right text-xs font-medium text-slate-400">€</th>
            <th className="py-2 pr-6 text-right text-xs font-medium text-slate-400" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {appuntamenti.map((a, idx) => {
            const isEditing = editingId === a.id
            return (
              <Fragment key={a.id}>
                {/* ── Riga lettura ───────────────────────────────────────── */}
                <tr className={isEditing ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                  <td className="py-3 pl-6">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      a.stato === 'COMPLETATO' ? 'bg-green-100 text-green-700' :
                      a.stato === 'CANCELLATO' ? 'bg-red-100 text-red-500' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {a.stato === 'COMPLETATO' ? '✓' : idx + 1}
                    </span>
                  </td>
                  <td className="py-3">
                    <p className="font-medium text-slate-800">{a.dataFormattata}</p>
                    <p className="text-xs text-slate-400">{a.oraFormattata}</p>
                  </td>
                  <td className="py-3 text-slate-600">{a.medicoNome || '—'}</td>
                  <td className="py-3 text-xs text-slate-500">{a.salaNome || '—'}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATO_BADGE[a.stato] ?? 'bg-slate-100 text-slate-500'}`}>
                      {a.stato}
                    </span>
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-700">
                    € {a.prezzoApplicato.toFixed(0)}
                  </td>
                  <td className="py-3 pr-6 text-right">
                    {isEditing ? (
                      <button
                        onClick={annullaModifica}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        Annulla
                      </button>
                    ) : (
                      <button
                        onClick={() => avviaModifica(a)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        Modifica
                      </button>
                    )}
                  </td>
                </tr>

                {/* ── Riga di editing (visibile solo quando isEditing) ────── */}
                {isEditing && editState && (
                  <tr>
                    <td colSpan={7} className="pb-4 pt-0 px-4">
                      <div className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm space-y-3">

                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                          Modifica sessione {idx + 1}
                        </p>

                        {/* Stessa struttura di PrenotazioniMultiple */}
                        <div className="flex flex-wrap items-end gap-3">

                          {/* Data — cambiandola si apre il popup */}
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-slate-500">Data</span>
                            {/* onChange per data nuova, onClick per stessa data già selezionata */}
                            <input
                              type="date"
                              value={editState.data}
                              onChange={e => cambiaData(e.target.value)}
                              onClick={() => { if (editState.data) setModalAperto(true) }}
                              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                            />
                          </div>

                          {/* Ora + sala + operatore: badge + bottone modal */}
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="text-xs text-slate-500">Ora, sala e operatore</span>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Badge ora — sempre visibile (è già impostata al valore corrente dell'appuntamento) */}
                              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
                                {editState.ora}
                              </span>
                              {editState.salaId && (
                                <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
                                  {sale.find(s => s.id === editState.salaId)?.nome ?? ''}
                                </span>
                              )}
                              {editState.medicoId && (
                                <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
                                  {(() => { const op = operatori.find(o => o.id === editState.medicoId); return op ? `${op.cognome} ${op.nome}` : '' })()}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  // Se non c'è la data, aspetta che l'utente la scelga
                                  if (editState.data) setModalAperto(true)
                                }}
                                className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                              >
                                {editState.salaId || editState.medicoId ? '✏️ Cambia' : '📅 Scegli sala e operatore'}
                              </button>
                              {!editState.data && (
                                <span className="text-xs text-slate-400">Scegli prima una data</span>
                              )}
                            </div>
                          </div>

                          {/* Salva */}
                          <button
                            type="button"
                            onClick={salva}
                            disabled={editState.salvando}
                            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 self-end"
                          >
                            {editState.salvando ? 'Salvataggio…' : 'Salva'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {/* ── Modal disponibilità (sala e operatore) ───────────────────────────── */}
      {modalAperto && editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModalAperto(false)}
          />
          {/* Pannello */}
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">

            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <p className="font-semibold text-slate-800 whitespace-nowrap">Disponibilità del centro</p>
                <input
                  type="date"
                  value={editState.data}
                  onChange={e => cambiaData(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={editState.ora}
                  onChange={e => aggEdit({ ora: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
                >
                  {ORARI.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setModalAperto(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {editState.caricando ? (
                <p className="py-8 text-center text-sm text-slate-400">Caricamento…</p>
              ) : (
                <>
                  {sale.length > 0 && (
                    <GrigliaDisponibilità
                      titolo="Sale"
                      colonne={sale.map(s => ({ id: s.id, label: s.nome }))}
                      appuntamenti={editState.appuntamenti}
                      chiaveCella="salaId"
                      oraSelezionata={parseInt(editState.ora.split(':')[0], 10)}
                      colonnaSelezionata={editState.salaId}
                      onSlotClick={(h, id) => aggEdit({
                        ora:    `${h.toString().padStart(2, '0')}:00`,
                        salaId: id,
                      })}
                    />
                  )}
                  {operatori.length > 0 && (
                    <GrigliaDisponibilità
                      titolo="Operatori"
                      colonne={operatori.map(op => ({ id: op.id, label: `${op.cognome} ${op.nome}` }))}
                      appuntamenti={editState.appuntamenti}
                      chiaveCella="medicoId"
                      oraSelezionata={parseInt(editState.ora.split(':')[0], 10)}
                      colonnaSelezionata={editState.medicoId}
                      onSlotClick={(h, id) => aggEdit({
                        ora:      `${h.toString().padStart(2, '0')}:00`,
                        medicoId: id,
                      })}
                    />
                  )}
                  {editState.appuntamenti.length === 0 && !editState.caricando && (
                    <p className="py-2 text-center text-xs text-slate-400">
                      Nessun appuntamento — tutte le risorse sono libere.
                    </p>
                  )}
                  {/* Legenda */}
                  <div className="flex items-center gap-4 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-5 rounded border border-green-100 bg-green-50" />Libero
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-5 rounded bg-indigo-400" />Occupato
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-5 rounded bg-indigo-400 opacity-60" />Selezionato
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalAperto(false)}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => setModalAperto(false)}
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Griglia disponibilità ─────────────────────────────────────────────────────
// Tabella: righe = ore (8–20), colonne = sale oppure operatori.
// Evidenzia sia la riga dell'ora scelta che la colonna della risorsa selezionata.

function GrigliaDisponibilità({
  titolo,
  colonne,
  appuntamenti,
  chiaveCella,
  oraSelezionata,
  colonnaSelezionata,
  onSlotClick,
}: {
  titolo:             string
  colonne:            { id: string; label: string }[]
  appuntamenti:       AppuntamentoApi[]
  chiaveCella:        'salaId' | 'medicoId'
  oraSelezionata:     number
  colonnaSelezionata: string
  onSlotClick:        (ora: number, colonnaId: string) => void
}) {
  function trovaCella(colonnaId: string, ora: number): AppuntamentoApi | undefined {
    return appuntamenti.find(a => {
      const inizioH    = new Date(a.start).getHours()
      const fineH      = new Date(a.end).getHours()
      const fineM      = new Date(a.end).getMinutes()
      const occupaFino = fineM > 0 ? fineH + 1 : fineH
      return a[chiaveCella] === colonnaId && inizioH <= ora && ora < occupaFino
    })
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-600">{titolo}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-10 border-b border-slate-200 pb-1 pr-2 text-right font-normal text-slate-400" />
              {colonne.map(col => (
                <th key={col.id}
                  className={`max-w-[80px] border-b px-1 pb-1 text-center font-medium transition ${
                    col.id === colonnaSelezionata
                      ? 'border-indigo-400 text-indigo-700'
                      : 'border-slate-200 text-slate-600'
                  }`}>
                  <span className="block truncate">{col.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORE.map(ora => {
              const isOraScelta = ora === oraSelezionata
              return (
                <tr key={ora} className={isOraScelta ? 'bg-indigo-50' : ''}>
                  <td className={`py-0.5 pr-2 text-right align-middle font-mono leading-none
                    ${isOraScelta ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                    {ora}:00
                  </td>
                  {colonne.map(col => {
                    const app = trovaCella(col.id, ora)
                    return (
                      <td key={col.id} className="px-0.5 py-0.5 align-middle">
                        {app ? (
                          <div
                            className="truncate rounded px-1 py-0.5 text-[10px] leading-tight text-white"
                            style={{ backgroundColor: app.color }}
                            title={`${app.paziente} — ${app.tipo}\nOp: ${app.medico}\nSala: ${app.sala}`}>
                            {app.paziente}
                          </div>
                        ) : (
                          <div
                            onClick={() => onSlotClick(ora, col.id)}
                            title={`Seleziona ${ora}:00 — ${col.label}`}
                            className={`h-5 rounded border cursor-pointer transition-colors ${
                              isOraScelta && col.id === colonnaSelezionata
                                ? 'border-indigo-500 bg-indigo-400'
                                : isOraScelta
                                ? 'border-indigo-300 bg-indigo-100 hover:bg-indigo-200'
                                : col.id === colonnaSelezionata
                                ? 'border-indigo-200 bg-indigo-50'
                                : 'border-green-100 bg-green-50 hover:bg-green-200 hover:border-green-300'
                            }`}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
