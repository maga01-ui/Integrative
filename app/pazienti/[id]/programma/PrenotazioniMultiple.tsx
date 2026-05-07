'use client'
// Form per prenotare più sessioni con griglia disponibilità in popup (modal).
// Ogni riga ha: data, ora, badge sala+operatore, bottone apri modal, prezzo, elimina.
// Il modal mostra la griglia con evidenziazione sia dell'ora che della colonna selezionata.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Tipi ──────────────────────────────────────────────────────────────────────

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

type Props = {
  pazienteId:          string
  studioId:            string
  programmaPazienteId: string
  percorsoId:          string
  sessioni:            number
  primoProgressivo:    number   // numero da cui partire (es. 3 se ci sono già 2 sessioni salvate)
  tipoPrestazione:     string
  prezzoBase:          number
  operatori:           Operatore[]
  sale:                Sala[]
}

// Stato per ogni riga del form (senza mostraCalendario: ora è gestito dal modal)
type SessioneInput = {
  data:         string
  ora:          string
  medicoId:     string
  salaId:       string
  prezzo:       number
  appuntamenti: AppuntamentoApi[]
  caricando:    boolean
}

// ── Costanti ──────────────────────────────────────────────────────────────────

const ORE = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

const ORARI: string[] = []
for (let h = 8; h <= 20; h++) {
  for (const m of [0, 30]) {
    if (h === 20 && m > 0) break
    ORARI.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }
}

const cls = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-900'

// Crea una riga vuota — sala e operatore iniziano vuoti, l'utente li sceglie dal modal
function rigaVuota(prezzoBase: number): SessioneInput {
  return {
    data:         '',
    ora:          '09:00',
    medicoId:     '',
    salaId:       '',
    prezzo:       prezzoBase,
    appuntamenti: [],
    caricando:    false,
  }
}

// ── Componente principale ─────────────────────────────────────────────────────

export default function PrenotazioniMultiple({
  pazienteId,
  studioId,
  programmaPazienteId,
  percorsoId,
  sessioni,
  primoProgressivo,
  tipoPrestazione,
  prezzoBase,
  operatori,
  sale,
}: Props) {
  const router = useRouter()

  const [righe, setRighe] = useState<SessioneInput[]>(
    Array.from({ length: sessioni }, () => rigaVuota(prezzoBase))
  )
  const [stato,     setStato]     = useState<'idle' | 'invio' | 'ok' | 'errore'>('idle')
  const [erroreMsg, setErroreMsg] = useState('')

  // Indice della riga il cui modal è aperto (null = chiuso)
  const [modalRiga, setModalRiga] = useState<number | null>(null)

  // Aggiorna i campi di una riga specifica
  function aggiornaRiga(idx: number, aggiornamenti: Partial<SessioneInput>) {
    setRighe(prev => prev.map((r, i) => i === idx ? { ...r, ...aggiornamenti } : r))
  }

  // Quando cambia la data: carica gli appuntamenti di quel giorno e apre subito il modal
  async function cambiaData(idx: number, val: string) {
    aggiornaRiga(idx, { data: val, appuntamenti: [], caricando: !!val })
    if (!val) { setModalRiga(null); return }

    setModalRiga(idx)   // apre il popup automaticamente alla scelta della data
    const inizio = new Date(`${val}T00:00:00`)
    const fine   = new Date(`${val}T23:59:59`)
    try {
      const res  = await fetch(`/api/appuntamenti?start=${inizio.toISOString()}&end=${fine.toISOString()}&studioId=${studioId}`)
      const dati = await res.json()
      aggiornaRiga(idx, { appuntamenti: Array.isArray(dati) ? dati : [], caricando: false })
    } catch {
      aggiornaRiga(idx, { appuntamenti: [], caricando: false })
    }
  }

  // Apre il modal per modificare sala/operatore di una riga già compilata
  function apriModal(idx: number) {
    setModalRiga(idx)
    const r = righe[idx]
    if (r.data && r.appuntamenti.length === 0 && !r.caricando) {
      cambiaData(idx, r.data)
    }
  }

  function eliminaRiga(idx: number) {
    setRighe(prev => prev.filter((_, i) => i !== idx))
    // Se il modal era aperto su questa riga, chiudilo
    if (modalRiga === idx) setModalRiga(null)
  }

  function aggiungiRiga() {
    setRighe(prev => [...prev, rigaVuota(prezzoBase)])
  }

  // Invia tutti gli appuntamenti con data, sala e operatore compilati
  async function invia() {
    const righeValide = righe.filter(r => r.data && r.medicoId && r.salaId)
    if (righeValide.length === 0) {
      setErroreMsg('Inserisci almeno una data e seleziona sala e operatore per procedere.')
      return
    }
    setStato('invio')
    setErroreMsg('')

    const appuntamenti = righeValide.map(r => ({
      studioId,
      pazienteId,
      medicoId:            r.medicoId,
      salaId:              r.salaId,
      tipoPrestazione,
      inizio:              `${r.data}T${r.ora}:00`,
      durataMinuti:        60,
      prezzoBase,
      prezzoApplicato:     r.prezzo,
      percorsoId,
      programmaPazienteId,
    }))

    const res = await fetch('/api/appuntamenti/bulk', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ appuntamenti }),
    })

    if (res.ok) {
      setStato('ok')
      setRighe([rigaVuota(prezzoBase)])
      router.refresh()
    } else {
      const err = await res.json()
      setErroreMsg(err.error ?? 'Errore durante la creazione degli appuntamenti.')
      setStato('errore')
    }
  }

  // Riga corrente mostrata nel modal
  const rigaModal = modalRiga !== null ? righe[modalRiga] : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Intestazione colonne */}
      <div className="hidden md:grid md:grid-cols-[2rem_auto_auto_1fr_auto_2rem] gap-3 px-1">
        <span />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Data</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Ora</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Sala e operatore</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Prezzo €</span>
        <span />
      </div>

      {/* Lista sessioni */}
      {righe.map((r, idx) => (
        <div key={idx}
          className="grid grid-cols-[2rem_auto_auto_1fr_auto_2rem] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">

          {/* Numero sessione */}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 flex-shrink-0">
            {primoProgressivo + idx}
          </span>

          {/* Data — onChange per data nuova, onClick per stessa data già selezionata */}
          <input
            type="date"
            value={r.data}
            onChange={e => cambiaData(idx, e.target.value)}
            onClick={() => { if (r.data) apriModal(idx) }}
            className={cls}
          />

          {/* Ora */}
          <select
            value={r.ora}
            onChange={e => aggiornaRiga(idx, { ora: e.target.value })}
            className={`${cls} w-[90px]`}
          >
            {ORARI.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {/* Badge sala+operatore + bottone per aprire il modal */}
          <div className="flex flex-wrap items-center gap-2">
            {r.salaId && (
              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
                {sale.find(s => s.id === r.salaId)?.nome ?? ''}
              </span>
            )}
            {r.medicoId && (
              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
                {(() => { const op = operatori.find(o => o.id === r.medicoId); return op ? `${op.cognome} ${op.nome}` : '' })()}
              </span>
            )}
            <button
              type="button"
              onClick={() => apriModal(idx)}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
            >
              {r.salaId || r.medicoId ? '✏️ Modifica' : '📅 Scegli sala e operatore'}
            </button>
          </div>

          {/* Prezzo modificabile */}
          <input
            type="number"
            min="0"
            step="0.01"
            value={r.prezzo}
            onChange={e => aggiornaRiga(idx, { prezzo: Number(e.target.value) })}
            className={`${cls} w-[90px]`}
          />

          {/* Elimina riga */}
          <button
            type="button"
            onClick={() => eliminaRiga(idx)}
            title="Rimuovi sessione"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors text-base leading-none"
          >
            ×
          </button>
        </div>
      ))}

      {/* ── Modal disponibilità ─────────────────────────────────────────────── */}
      {modalRiga !== null && rigaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay scuro */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModalRiga(null)}
          />
          {/* Pannello */}
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">

            {/* Header sticky */}
            <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <p className="font-semibold text-slate-800 whitespace-nowrap">
                  Disponibilità — Sessione {primoProgressivo + modalRiga}
                </p>
                {/* Data modificabile anche dall'interno del modal */}
                <input
                  type="date"
                  value={rigaModal.data}
                  onChange={e => cambiaData(modalRiga, e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={rigaModal.ora}
                  onChange={e => aggiornaRiga(modalRiga, { ora: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
                >
                  {ORARI.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setModalRiga(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {rigaModal.caricando ? (
                <p className="py-8 text-center text-sm text-slate-400">Caricamento…</p>
              ) : !rigaModal.data ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Seleziona prima una data per vedere le disponibilità.
                </p>
              ) : (
                <>
                  {sale.length > 0 && (
                    <GrigliaDisponibilità
                      titolo="Sale"
                      colonne={sale.map(s => ({ id: s.id, label: s.nome }))}
                      appuntamenti={rigaModal.appuntamenti}
                      chiaveCella="salaId"
                      oraSelezionata={parseInt(rigaModal.ora.split(':')[0], 10)}
                      colonnaSelezionata={rigaModal.salaId}
                      onSlotClick={(h, id) => aggiornaRiga(modalRiga, {
                        ora:    `${h.toString().padStart(2, '0')}:00`,
                        salaId: id,
                      })}
                    />
                  )}
                  {operatori.length > 0 && (
                    <GrigliaDisponibilità
                      titolo="Operatori"
                      colonne={operatori.map(op => ({ id: op.id, label: `${op.cognome} ${op.nome}` }))}
                      appuntamenti={rigaModal.appuntamenti}
                      chiaveCella="medicoId"
                      oraSelezionata={parseInt(rigaModal.ora.split(':')[0], 10)}
                      colonnaSelezionata={rigaModal.medicoId}
                      onSlotClick={(h, id) => aggiornaRiga(modalRiga, {
                        ora:      `${h.toString().padStart(2, '0')}:00`,
                        medicoId: id,
                      })}
                    />
                  )}
                  {rigaModal.appuntamenti.length === 0 && (
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

            {/* Footer sticky */}
            <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalRiga(null)}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => setModalRiga(null)}
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pulsante aggiungi sessione */}
      <button
        type="button"
        onClick={aggiungiRiga}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-300 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        + Aggiungi sessione
      </button>

      {/* Messaggi feedback */}
      {erroreMsg && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {erroreMsg}
        </p>
      )}
      {stato === 'ok' && (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          Appuntamenti creati con successo! Controlla la tabella qui sopra per modificarli.
        </p>
      )}

      <p className="text-xs text-slate-400">
        Puoi lasciare vuote le date delle sessioni che non vuoi ancora prenotare.
      </p>

      {/* Pulsante invio */}
      <div className="flex justify-end">
        <button
          onClick={invia}
          disabled={stato === 'invio' || stato === 'ok'}
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {stato === 'invio' ? 'Creazione in corso…' : 'Prenota sessioni selezionate'}
        </button>
      </div>
    </div>
  )
}

// ── Griglia disponibilità ─────────────────────────────────────────────────────
// Tabella: righe = ore (8–20), colonne = sale oppure operatori.
// Evidenzia sia la riga dell'ora scelta sia la colonna della risorsa selezionata.

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
  colonnaSelezionata: string   // id della sala o operatore attualmente selezionato
  onSlotClick:        (ora: number, colonnaId: string) => void
}) {
  // Gli appuntamenti CANCELLATI e DA_RIPROGRAMMARE non bloccano la risorsa.
  function trovaCella(colonnaId: string, ora: number): AppuntamentoApi | undefined {
    return appuntamenti.find(a => {
      if (a.stato === 'CANCELLATO' || a.stato === 'DA_RIPROGRAMMARE') return false
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
                      ? 'border-indigo-400 text-indigo-700'   // intestazione colonna selezionata
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
                          // Slot occupato
                          <div
                            className="truncate rounded px-1 py-0.5 text-[10px] leading-tight text-white"
                            style={{ backgroundColor: app.color }}
                            title={`${app.paziente} — ${app.tipo}\nOp: ${app.medico}\nSala: ${app.sala}`}>
                            {app.paziente}
                          </div>
                        ) : (
                          // Slot libero — cliccabile
                          <div
                            onClick={() => onSlotClick(ora, col.id)}
                            title={`Seleziona ${ora}:00 — ${col.label}`}
                            className={`h-5 rounded border cursor-pointer transition-colors ${
                              isOraScelta && col.id === colonnaSelezionata
                                ? 'border-indigo-500 bg-indigo-400'           // ora + colonna selezionate
                                : isOraScelta
                                ? 'border-indigo-300 bg-indigo-100 hover:bg-indigo-200'  // solo ora
                                : col.id === colonnaSelezionata
                                ? 'border-indigo-200 bg-indigo-50'            // solo colonna
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
