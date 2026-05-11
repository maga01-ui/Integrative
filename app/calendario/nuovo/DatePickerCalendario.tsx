'use client'
// Selettore data + ora con pannello disponibilità del centro.
//
// Come funziona:
//  1. L'utente sceglie la DATA → appare subito la griglia con sale/operatori occupati
//  2. L'utente sceglie l'ORA (dropdown ogni 15 min) → la riga corrispondente si evidenzia
//  3. Un campo hidden "inizio" combina data+ora e viene letto dalla Server Action

import { useState, useEffect } from 'react'

// ── Tipi ──────────────────────────────────────────────────────────────────────

interface Sala      { id: string; nome: string }
interface Operatore { id: string; nome: string; cognome: string }

interface AppuntamentoApi {
  id:       string
  paziente: string   // "Cognome N."
  tipo:     string
  start:    string   // ISO
  end:      string   // ISO
  color:    string   // colore hex
  salaId:   string
  medicoId: string
  sala:     string
  medico:   string
  stato:    string
}

interface Props {
  sale:              Sala[]
  operatori:         Operatore[]
  studioId:          string
  defaultData?:      string   // YYYY-MM-DD — pre-compila la data (usato nella modifica)
  defaultOra?:       string   // HH:mm      — pre-compila l'ora
  defaultSalaId?:    string   // pre-popola la sala selezionata (usato nella modifica)
  defaultSalaNome?:  string   // nome leggibile della sala pre-selezionata
  defaultMedicoId?:  string   // pre-popola l'operatore selezionato (usato nella modifica)
  defaultMedicoNome?: string  // nome leggibile dell'operatore pre-selezionato
}

// Ore visibili nella griglia
const ORE = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

// Opzioni orario ogni 15 minuti, dalle 08:00 alle 20:00
const ORARI: string[] = []
for (let h = 8; h <= 20; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === 20 && m > 0) break
    ORARI.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }
}

// Stile Tailwind condiviso con il resto del form
const inputCls  = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
const selectCls = inputCls

// ── Componente principale ─────────────────────────────────────────────────────

export default function DatePickerCalendario({ sale, operatori, studioId, defaultData, defaultOra, defaultSalaId, defaultSalaNome, defaultMedicoId, defaultMedicoNome }: Props) {
  const [data,              setData]              = useState(defaultData ?? '')
  const [ora,               setOra]               = useState(defaultOra  ?? '09:00')
  const [appuntamenti,      setAppuntamenti]      = useState<AppuntamentoApi[]>([])
  const [caricando,         setCaricando]         = useState(false)
  // Pre-seleziona il primo disponibile come default (modificabile dal modal)
  const [salaSelezionata,   setSalaSelezionata]   = useState(defaultSalaId   ?? sale[0]?.id        ?? '')
  const [medicoSelezionato, setMedicoSelezionato] = useState(defaultMedicoId ?? operatori[0]?.id   ?? '')
  const [modalAperto,       setModalAperto]       = useState(false)

  // Nomi derivati dall'elenco corrente — si aggiornano automaticamente al cambio studio
  const salaNome   = sale.find(s => s.id === salaSelezionata)?.nome
                  ?? defaultSalaNome ?? ''
  const medicoNome = (() => {
    const op = operatori.find(o => o.id === medicoSelezionato)
    return op ? `${op.cognome} ${op.nome}` : (defaultMedicoNome ?? '')
  })()

  // Quando le sale cambiano (cambio studio), mantieni la selezione corrente se ancora valida;
  // altrimenti ricadi sulla prima sala disponibile
  useEffect(() => {
    setSalaSelezionata(prev => sale.some(s => s.id === prev) ? prev : (sale[0]?.id ?? ''))
  }, [sale])

  // Stesso comportamento per gli operatori (cambio studio o filtro team)
  useEffect(() => {
    setMedicoSelezionato(prev => operatori.some(o => o.id === prev) ? prev : (operatori[0]?.id ?? ''))
  }, [operatori])

  // Se c'è una data di default (modifica appuntamento), carica subito le disponibilità
  useEffect(() => {
    if (!defaultData) return
    const inizio = new Date(`${defaultData}T00:00:00`)
    const fine   = new Date(`${defaultData}T23:59:59`)
    setCaricando(true)
    fetch(`/api/appuntamenti?start=${inizio.toISOString()}&end=${fine.toISOString()}&studioId=${studioId}`)
      .then(r => r.json())
      .then(d => setAppuntamenti(Array.isArray(d) ? d : []))
      .catch(() => setAppuntamenti([]))
      .finally(() => setCaricando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // solo al mount

  // Valore combinato per il campo hidden letto dalla Server Action
  const valoreInizio = data ? `${data}T${ora}` : ''

  // Ora selezionata come numero intero (per evidenziare la riga)
  const oraNum = parseInt(ora.split(':')[0], 10)

  // ── Quando si sceglie la data: carica gli appuntamenti del giorno ─────────
  async function cambiaData(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setData(val)
    if (!val) { setAppuntamenti([]); return }

    const inizioGiorno = new Date(`${val}T00:00:00`)
    const fineGiorno   = new Date(`${val}T23:59:59`)

    setCaricando(true)
    setModalAperto(true)
    try {
      const url  = `/api/appuntamenti?start=${inizioGiorno.toISOString()}&end=${fineGiorno.toISOString()}&studioId=${studioId}`
      const res  = await fetch(url)
      const dati = await res.json()
      setAppuntamenti(Array.isArray(dati) ? dati : [])
    } catch {
      setAppuntamenti([])
    } finally {
      setCaricando(false)
    }
  }

  // Label leggibile per la data scelta
  const labelData = data
    ? new Date(`${data}T12:00:00`).toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Campi hidden letti dalla Server Action.
          L'ora NON ha più un campo visibile nella pagina: si modifica solo dal popup.
          Quando ora cambia (dentro il popup) il valoreInizio si aggiorna automaticamente. */}
      <input type="hidden" name="inizio"   value={valoreInizio} />
      <input type="hidden" name="salaId"   value={salaSelezionata} />
      <input type="hidden" name="medicoId" value={medicoSelezionato} />

      {/* Selezione DATA — unico campo editabile nella pagina.
          Quando si sceglie la data si apre automaticamente il popup
          dove poi si scelgono ora, sala e operatore.
          Larghezza ridotta a metà (come il select Prestazione) usando un grid a 2 colonne. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-slate-500 mb-0.5">Giorno</label>
          <input
            type="date"
            value={data}
            onChange={cambiaData}
            required
            className={inputCls}
          />
        </div>
      </div>

      <p className="text-xs text-slate-400">
        L&apos;ora di fine viene calcolata automaticamente dalla durata della prestazione.
      </p>

      {/* Riepilogo selezione (non editabile dalla pagina) + bottone per aprire il popup.
          Ora, sala e operatore appaiono qui come chip dopo aver chiuso il popup;
          per modificarli bisogna riaprire il popup. */}
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* Chip ORA — solo lettura: l'ora si cambia esclusivamente dal popup */}
          <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
            Ora: {ora}
          </span>
          {salaSelezionata && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
              Sala: {salaNome || sale.find(s => s.id === salaSelezionata)?.nome || ''}
            </span>
          )}
          {medicoSelezionato && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
              Op: {medicoNome || ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setModalAperto(true)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-indigo-700 hover:bg-indigo-100 transition"
          >
            {salaSelezionata || medicoSelezionato ? '✏️ Modifica ora, sala e operatore' : '📅 Seleziona ora, sala e operatore'}
          </button>
        </div>
      )}

      {/* Modal disponibilità */}
      {modalAperto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModalAperto(false)}
          />
          {/* Pannello */}
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">

            {/* Header modal */}
            <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <p className="font-semibold text-slate-800 whitespace-nowrap">Disponibilità del centro</p>
                <input
                  type="date"
                  value={data}
                  onChange={cambiaData}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={ora}
                  onChange={e => setOra(e.target.value)}
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
              {caricando ? (
                <p className="py-8 text-center text-sm text-slate-400">Caricamento…</p>
              ) : (
                <>
                  {sale.length > 0 && (
                    <GrigliaDisponibilità
                      titolo="Sale"
                      colonne={sale.map(s => ({ id: s.id, label: s.nome }))}
                      appuntamenti={appuntamenti}
                      chiaveCella="salaId"
                      selectName="salaId"
                      oraSelezionata={oraNum}
                      colonnaSelezionata={salaSelezionata}
                      onSlotClick={(h, colonnaId) => {
                        setOra(`${h.toString().padStart(2, '0')}:00`)
                        setSalaSelezionata(colonnaId)
                      }}
                    />
                  )}
                  {operatori.length > 0 && (
                    <GrigliaDisponibilità
                      titolo="Operatori"
                      colonne={operatori.map(op => ({ id: op.id, label: `${op.cognome} ${op.nome}` }))}
                      appuntamenti={appuntamenti}
                      chiaveCella="medicoId"
                      selectName="medicoId"
                      oraSelezionata={oraNum}
                      colonnaSelezionata={medicoSelezionato}
                      onSlotClick={(h, colonnaId) => {
                        setOra(`${h.toString().padStart(2, '0')}:00`)
                        setMedicoSelezionato(colonnaId)
                      }}
                    />
                  )}
                  {appuntamenti.length === 0 && (
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

            {/* Footer modal con conferma */}
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
    </div>
  )
}

// ── Griglia disponibilità ─────────────────────────────────────────────────────
// Tabella: righe = ore (8–20), colonne = sale oppure operatori

function GrigliaDisponibilità({
  titolo,
  colonne,
  appuntamenti,
  chiaveCella,
  selectName,
  oraSelezionata,
  colonnaSelezionata,
  onSlotClick,
}: {
  titolo:              string
  colonne:             { id: string; label: string }[]
  appuntamenti:        AppuntamentoApi[]
  chiaveCella:         'salaId' | 'medicoId'
  selectName:          string
  oraSelezionata:      number
  colonnaSelezionata:  string
  onSlotClick:         (ora: number, colonnaId: string, colonnaLabel: string) => void
}) {
  // Cerca un appuntamento che occupa la risorsa in una certa ora.
  // Gli appuntamenti CANCELLATI e DA_RIPROGRAMMARE non bloccano la risorsa.
  function trovaCella(colonnaId: string, ora: number): AppuntamentoApi | undefined {
    return appuntamenti.find(a => {
      if (a.stato === 'CANCELLATO' || a.stato === 'DA_RIPROGRAMMARE') return false
      const inizioH = new Date(a.start).getHours()
      const fineH   = new Date(a.end).getHours()
      const fineM   = new Date(a.end).getMinutes()
      // L'appuntamento occupa l'ora se inizia prima o durante, e finisce dopo (o a fine esatta con minuti > 0)
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
                            title={`${app.paziente} — ${app.tipo}\nMedico: ${app.medico}\nSala: ${app.sala}`}>
                            {app.paziente}
                          </div>
                        ) : (
                          <div
                            onClick={() => onSlotClick(ora, col.id, col.label)}
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
