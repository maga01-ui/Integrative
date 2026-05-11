'use client'
// TipoAppuntamentoSelect — tre box mutuamente esclusivi per scegliere il tipo di appuntamento:
//   1. Bioscan     → seleziona una tipologia bioscan (Bioscan, Controllo, …)
//   2. Programmi   → seleziona il programma attivo del paziente e la sessione
//   3. Prestazioni → seleziona una prestazione standard (Fitoterapia, Lettura referto, …)
//
// Emette tre input hidden letti dalla Server Action:
//   - prestazioneId       : "BIOSCAN:{id}" | "{id}" | ""
//   - programmaPazienteId : "{id}" | ""
//   - prezzoApplicato     : numero

import { useState, useEffect } from 'react'

// ── Tipi ─────────────────────────────────────────────────────────────────────

interface TipologiaBioscan {
  id:           string
  tipologia:    string
  prezzo:       number
  durataMinuti: number
}

interface Prestazione {
  id:           string
  nome:         string
  prezzoBase:   number
  durataMinuti: number
}

interface ProgrammaPaziente {
  id:                  string
  nome:                string
  tipo:                string
  sessioniTotali:      number
  sessioniCompletate:  number
  sessioniProgrammate: number
}

type BoxAttivo = 'bioscan' | 'programma' | 'prestazione'

// ── Helper: determina il box iniziale dal defaultPrestazioneId ────────────────

function boxDaDefault(id: string): BoxAttivo {
  if (id.startsWith('BIOSCAN:')) return 'bioscan'
  if (id === '__PROGRAMMA__')    return 'programma'
  if (id)                        return 'prestazione'
  return 'bioscan'  // default: bioscan
}

// ── Stile condiviso ───────────────────────────────────────────────────────────

const select = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
const inputN = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

// ── Componente principale ─────────────────────────────────────────────────────

export default function TipoAppuntamentoSelect({
  tipologieBioscan,
  prestazioni,
  defaultPrestazioneId   = '',
  defaultProgrammaId     = '',
  defaultBox,
  defaultPrezzo,
  pazienteIdIniziale     = '',
}: {
  tipologieBioscan:      TipologiaBioscan[]
  prestazioni:           Prestazione[]
  defaultPrestazioneId?: string
  defaultProgrammaId?:   string
  defaultBox?:           BoxAttivo
  defaultPrezzo?:        number
  pazienteIdIniziale?:   string
}) {
  // ── Stato ──────────────────────────────────────────────────────────────────

  const [boxAttivo,    setBoxAttivo]    = useState<BoxAttivo>(() => {
    if (defaultProgrammaId) return 'programma'
    if (defaultBox)         return defaultBox
    return boxDaDefault(defaultPrestazioneId)
  })

  // Box Bioscan
  const bioscanIdDefault = defaultPrestazioneId.startsWith('BIOSCAN:')
    ? defaultPrestazioneId.replace('BIOSCAN:', '')
    : (tipologieBioscan[0]?.id ?? '')
  const [bioscanId,    setBioscanId]    = useState(bioscanIdDefault)

  // Box Programmi
  const [pazienteId,   setPazienteId]   = useState(pazienteIdIniziale)
  const [programmi,    setProgrammi]    = useState<ProgrammaPaziente[]>([])
  const [programmaId,  setProgrammaId]  = useState(defaultProgrammaId)
  const [loadingProg,  setLoadingProg]  = useState(false)

  // Box Prestazioni
  const prestazioneDefault = defaultPrestazioneId.startsWith('BIOSCAN:') ? '' : defaultPrestazioneId
  const [prestazioneId, setPrestazioneId] = useState(prestazioneDefault)

  // Prezzo applicato condiviso tra i tre box
  const [prezzo, setPrezzo] = useState<string>(() => {
    if (defaultPrezzo != null) return defaultPrezzo.toFixed(2)
    if (defaultPrestazioneId.startsWith('BIOSCAN:')) {
      const id  = defaultPrestazioneId.replace('BIOSCAN:', '')
      const tip = tipologieBioscan.find(t => t.id === id)
      return tip ? tip.prezzo.toFixed(2) : ''
    }
    const p = prestazioni.find(p => p.id === defaultPrestazioneId)
    if (p) return p.prezzoBase.toFixed(2)
    // Nessun default: il box bioscan è attivo e usa il primo della lista
    if (!defaultPrestazioneId && !defaultProgrammaId && tipologieBioscan.length > 0) {
      return tipologieBioscan[0].prezzo.toFixed(2)
    }
    return ''
  })

  // ── Ascolta il cambio paziente emesso da PazienteSearch ──────────────────
  useEffect(() => {
    function handler(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail.id
      setPazienteId(id)
      setProgrammaId('')
      setProgrammi([])
    }
    document.addEventListener('pazienteSelezionato', handler)
    return () => document.removeEventListener('pazienteSelezionato', handler)
  }, [])

  // ── Carica programmi quando cambia il pazienteId ──────────────────────────
  useEffect(() => {
    if (!pazienteId) { setProgrammi([]); return }
    setLoadingProg(true)
    fetch(`/api/programmi-paziente?pazienteId=${pazienteId}`)
      .then(r => r.json())
      .then((data: ProgrammaPaziente[]) => {
        setProgrammi(Array.isArray(data) ? data : [])
        // Pre-seleziona il primo programma se nessuno è già selezionato
        if (!programmaId && data.length > 0) setProgrammaId(data[0].id)
      })
      .catch(() => setProgrammi([]))
      .finally(() => setLoadingProg(false))
  }, [pazienteId])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calcola i valori degli input hidden in base al box attivo ─────────────

  const hiddenPrestazioneId = boxAttivo === 'bioscan' && bioscanId
    ? `BIOSCAN:${bioscanId}`
    : boxAttivo === 'prestazione'
    ? prestazioneId
    : ''

  const hiddenProgrammaId = boxAttivo === 'programma' ? programmaId : ''

  // ── Attiva un box: resetta gli altri e aggiorna il prezzo ─────────────────

  function attivaBox(box: BoxAttivo) {
    setBoxAttivo(box)
    if (box !== 'bioscan')    { setBioscanId('');     }
    if (box !== 'prestazione') { setPrestazioneId(''); }
    if (box !== 'programma')   { setProgrammaId('');   }
    setPrezzo('')
  }

  function selezionaBioscan(id: string) {
    setBioscanId(id)
    setBoxAttivo('bioscan')
    setPrestazioneId(''); setProgrammaId('')
    const tip = tipologieBioscan.find(t => t.id === id)
    if (tip) setPrezzo(tip.prezzo.toFixed(2))
    else setPrezzo('')
  }

  function selezionaPrestazione(id: string) {
    setPrestazioneId(id)
    setBoxAttivo('prestazione')
    setBioscanId(''); setProgrammaId('')
    const p = prestazioni.find(p => p.id === id)
    if (p) setPrezzo(p.prezzoBase.toFixed(2))
    else setPrezzo('')
  }

  function selezionaProgamma(id: string) {
    setProgrammaId(id)
    setBoxAttivo('programma')
    setBioscanId(''); setPrestazioneId('')
    setPrezzo('')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">Tipo appuntamento *</label>

      {/* Input hidden letti dalla Server Action */}
      <input type="hidden" name="prestazioneId"       value={hiddenPrestazioneId} />
      <input type="hidden" name="programmaPazienteId" value={hiddenProgrammaId} />

      {/* Tre box affiancati */}
      <div className="grid grid-cols-3 gap-3">

        {/* ── Box 1: Bioscan ─────────────────────────────────────────────── */}
        <BoxContenitore
          attivo={boxAttivo === 'bioscan'}
          colore="indigo"
          titolo="Bioscan"
          onClick={() => attivaBox('bioscan')}
        >
          {tipologieBioscan.length === 0 ? (
            <p className="text-xs text-slate-400">Nessuna tipologia configurata</p>
          ) : (
            <select
              value={bioscanId}
              onChange={e => selezionaBioscan(e.target.value)}
              className={select}
              onClick={e => e.stopPropagation()}
            >
              <option value="">Seleziona…</option>
              {tipologieBioscan.map(t => (
                <option key={t.id} value={t.id}>
                  {t.tipologia} — {t.durataMinuti} min
                </option>
              ))}
            </select>
          )}
        </BoxContenitore>

        {/* ── Box 2: Programmi ───────────────────────────────────────────── */}
        <BoxContenitore
          attivo={boxAttivo === 'programma'}
          colore="emerald"
          titolo="Programma"
          onClick={() => attivaBox('programma')}
        >
          {!pazienteId ? (
            <p className="text-xs text-slate-400 italic">Effettua prima il Bioscan</p>
          ) : loadingProg ? (
            <p className="text-xs text-slate-400">Caricamento…</p>
          ) : programmi.length === 0 ? (
            <p className="text-xs text-slate-400">Nessun programma attivo</p>
          ) : (
            <select
              value={programmaId}
              onChange={e => selezionaProgamma(e.target.value)}
              className={select}
              onClick={e => { e.stopPropagation(); setBoxAttivo('programma') }}
            >
              <option value="">Seleziona programma…</option>
              {programmi.map(pp => {
                const prossima = pp.sessioniCompletate + pp.sessioniProgrammate + 1
                const rimaste  = pp.sessioniTotali - pp.sessioniCompletate - pp.sessioniProgrammate
                return (
                  <option key={pp.id} value={pp.id} disabled={rimaste <= 0}>
                    {pp.nome} — Sessione {prossima}/{pp.sessioniTotali}
                    {rimaste <= 0 ? ' (completato)' : ''}
                  </option>
                )
              })}
            </select>
          )}
        </BoxContenitore>

        {/* ── Box 3: Prestazioni ─────────────────────────────────────────── */}
        <BoxContenitore
          attivo={boxAttivo === 'prestazione'}
          colore="amber"
          titolo="Prestazioni"
          onClick={() => attivaBox('prestazione')}
        >
          {prestazioni.length === 0 ? (
            <p className="text-xs text-slate-400">Nessuna prestazione configurata</p>
          ) : (
            <select
              value={prestazioneId}
              onChange={e => selezionaPrestazione(e.target.value)}
              className={select}
              onClick={e => e.stopPropagation()}
            >
              <option value="">Seleziona…</option>
              {prestazioni.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {p.durataMinuti} min
                </option>
              ))}
            </select>
          )}
        </BoxContenitore>

      </div>

      {/* Prezzo applicato — condiviso tra tutti e tre i box.
          Larghezza ridotta a metà tramite grid a 2 colonne. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Prezzo applicato (€)</label>
          <input
            type="number"
            name="prezzoApplicato"
            step="0.01"
            min="0"
            value={prezzo}
            onChange={e => setPrezzo(e.target.value)}
            placeholder="0.00"
            className={inputN}
          />
        </div>
      </div>

    </div>
  )
}

// ── Box contenitore con bordo colorato e stato attivo/inattivo ────────────────

function BoxContenitore({
  attivo, colore, titolo, children, onClick,
}: {
  attivo:   boolean
  colore:   'indigo' | 'emerald' | 'amber'
  titolo:   string
  children: React.ReactNode
  onClick:  () => void
}) {
  const ring = {
    indigo:  attivo ? 'ring-2 ring-indigo-400 border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-slate-300',
    emerald: attivo ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-slate-300',
    amber:   attivo ? 'ring-2 ring-amber-400 border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white hover:border-slate-300',
  }
  const dot = {
    indigo:  attivo ? 'bg-indigo-500' : 'bg-slate-300',
    emerald: attivo ? 'bg-emerald-500' : 'bg-slate-300',
    amber:   attivo ? 'bg-amber-500' : 'bg-slate-300',
  }
  const label = {
    indigo:  attivo ? 'text-indigo-700' : 'text-slate-500',
    emerald: attivo ? 'text-emerald-700' : 'text-slate-500',
    amber:   attivo ? 'text-amber-700' : 'text-slate-500',
  }

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border p-4 transition-all ${ring[colore]}`}
    >
      {/* Indicatore attivo + titolo */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full transition-colors ${dot[colore]}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${label[colore]}`}>
          {titolo}
        </span>
      </div>

      {children}
    </div>
  )
}
