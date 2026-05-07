'use client'
// Calendario settimanale custom — sidebar filtri + griglia timeGrid
//
// Layout: sidebar sinistra (sale, operatori, legenda, da programmare)
//         + barra controlli + griglia ore × giorni
//
// Colori per tipo prestazione (hardcoded):
//   Bioscan → viola  |  Trattamento → verde  |  Fitoterapia → ambra
//   Lettura referto → corallo  |  Mantenimento → grigio

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Briefcase, X, Clock, Check, AlertCircle } from 'lucide-react'

// ── Tipi ──────────────────────────────────────────────────────────────────────

interface Sala {
  id:                 string
  nome:               string
  colore:             string
  // Stato e date di attività: servono per mostrare la sala in sidebar
  // solo nei giorni in cui era effettivamente attiva.
  attiva?:             boolean
  dataAttivazione?:    string  // ISO date
  dataDisattivazione?: string | null
}
interface Operatore   { id: string; nome: string; cognome: string }
interface Prestazione { id: string; nome: string; colore: string }
interface Studio      { id: string; nome: string; citta?: string | null }

interface Appuntamento {
  id:         string
  pazienteId: string // ID del paziente — usato per aprire la cartella clinica
  paziente:   string // "Cognome N."
  tipo:       string // nome prestazione
  start:      string // ISO
  end:        string // ISO
  color:      string // colore dal DB (verrà sovrascritto dalla palette)
  salaId:     string
  medicoId:   string
  sala:       string
  salaColore: string
  medico:     string
  stato:               string
  bioscanSenzaLettura: boolean
  bioscanControllo:    boolean  // true se è lettura referto di un bioscan di CONTROLLO
}

export interface CalendarioClientProps {
  sale:             Sala[]
  operatori:        Operatore[]
  prestazioni:      Prestazione[]           // dalla tabella Prestazione (Fitoterapia, Lettura referto…)
  tipologieBioscan: { id: string; nome: string }[]  // da TipologiaBioscan (Bioscan, Bioscan Controllo, Standard, Mantenimento…)
  studi:            Studio[]
  studioId:         string
  daProgrammare:    number
}

// ── Palette colori per tipo prestazione ──────────────────────────────────────
const COLORI: Record<string, string> = {
  BIOSCAN:         '#6366f1',
  TRATTAMENTO:     '#10b981',
  FITOTERAPIA:     '#f59e0b',
  LETTURA_REFERTO: '#f43f5e',
  MANTENIMENTO:    '#94a3b8',
}

const LABEL_COLORI: Record<string, string> = {
  BIOSCAN:         'Bioscan',
  TRATTAMENTO:     'Trattamento',
  FITOTERAPIA:     'Fitoterapia',
  LETTURA_REFERTO: 'Lettura referto',
  MANTENIMENTO:    'Mantenimento',
}

// Restituisce il colore in base al nome del tipo prestazione
function colorePerTipo(tipo: string): string {
  const key = Object.keys(COLORI).find(k => tipo.toUpperCase().includes(k))
  return key ? COLORI[key] : '#64748b'
}

// Palette per i dot degli operatori nella sidebar
const PALETTE_OP = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6']

// Chiave speciale per il filtro "Prestazioni" raggruppato
const FILTRO_PRESTAZIONI = '__PRESTAZIONI__'

// Prestazioni dalla tabella Prestazione mostrate singolarmente (prima del bottone raggruppato)
const PRESTAZIONI_SINGOLE: { key: string; label: string; colore: string }[] = [
  { key: 'TRATTAMENTO',  label: 'Standard',     colore: '#10b981' },
  { key: 'MANTENIMENTO', label: 'Mantenimento',  colore: '#94a3b8' },
]

// ── Utilità date ──────────────────────────────────────────────────────────────

function lunedìDella(d: Date): Date {
  const r = new Date(d)
  const dow = r.getDay()
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function aggiungiGiorni(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function stessoGiorno(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate()
}

const GIORNI_IT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom']
const MESI_IT   = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                   'luglio','agosto','settembre','ottobre','novembre','dicembre']
const MESI_B    = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']

function labelGiorno(d: Date): string {
  const dow = d.getDay()
  return `${GIORNI_IT[dow === 0 ? 6 : dow - 1]} ${d.getDate()}`
}

function labelSettimana(lun: Date): string {
  const sab = aggiungiGiorni(lun, 5)
  if (lun.getMonth() === sab.getMonth())
    return `${lun.getDate()} – ${sab.getDate()} ${MESI_IT[sab.getMonth()]} ${sab.getFullYear()}`
  return `${lun.getDate()} ${MESI_B[lun.getMonth()]} – ${sab.getDate()} ${MESI_B[sab.getMonth()]} ${sab.getFullYear()}`
}

// Label per la settimana lavorativa Lun–Ven (vista 5 giorni)
function labelSettimanaLavorativa(lun: Date): string {
  const ven = aggiungiGiorni(lun, 4)
  if (lun.getMonth() === ven.getMonth())
    return `${lun.getDate()} – ${ven.getDate()} ${MESI_IT[ven.getMonth()]} ${ven.getFullYear()}`
  return `${lun.getDate()} ${MESI_B[lun.getMonth()]} – ${ven.getDate()} ${MESI_B[ven.getMonth()]} ${ven.getFullYear()}`
}

function labelGiornoSingolo(d: Date): string {
  const dow = d.getDay()
  return `${GIORNI_IT[dow === 0 ? 6 : dow - 1]} ${d.getDate()} ${MESI_IT[d.getMonth()]} ${d.getFullYear()}`
}

function oraMinuti(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

// Ore visualizzate nella griglia
const ORE = [8,9,10,11,12,13,14,15,16,17,18,19,20]

// ── Componente principale ─────────────────────────────────────────────────────

export default function CalendarioClient({
  sale: saleInit, operatori: operatoriInit, prestazioni, tipologieBioscan, studi, studioId: studioIdInit, daProgrammare,
}: CalendarioClientProps) {

  const router = useRouter()

  // ── Stato ─────────────────────────────────────────────────────────────────
  const [filtroSala,         setFiltroSala]         = useState<string | null>(null)
  const [filtroMedico,       setFiltroMedico]       = useState<string | null>(null)
  const [filtroPrestazione,  setFiltroPrestazione]  = useState<string | null>(null)

  // Vista calendario: sempre '5giorni' al primo render (server e client concordano),
  // poi sovrascritta dal valore in localStorage nell'useEffect (solo client).
  const [periodicita, setPeriodicita] = useState<'5giorni' | 'settimana' | 'giorno'>('5giorni')
  const [vistaMode,    setVistaMode]    = useState<'sala' | 'operatore'>('sala')
  const [studioId,     setStudioId]     = useState(studioIdInit)
  const [dataBase,     setDataBase]     = useState(() => lunedìDella(new Date()))
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([])
  const [loading,      setLoading]      = useState(false)

  // `oggi` è inizializzato solo lato client (useEffect) per evitare hydration mismatch:
  // SSR e client potrebbero avere timezone diversi, quindi le classi CSS "isOggi"
  // produrrebbero HTML diversi. Con null come valore iniziale, il server non evidenzia
  // nessun giorno e il client lo fa dopo il mount.
  const [oggi, setOggi] = useState<Date | null>(null)
  useEffect(() => { setOggi(new Date()) }, [])

  // Ripristina la vista salvata in localStorage dopo il mount (non prima, per evitare hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('calendario-vista') as '5giorni' | 'settimana' | 'giorno' | null
    if (saved) setPeriodicita(saved)
  }, [])

  // Sale e operatori: inizializzati dalle props, poi aggiornati via API al cambio studio
  const [sale,      setSale]      = useState<Sala[]>(saleInit)
  const [operatori, setOperatori] = useState<Operatore[]>(operatoriInit)

  // ── Stato popup appuntamento ──────────────────────────────────────────────
  // popupApp = appuntamento selezionato; null = popup chiuso
  // popupPos = posizione del click nel viewport (per posizionare il popup vicino al click)
  const [popupApp, setPopupApp] = useState<Appuntamento | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // ── "Da gestire": appuntamenti passati ancora aperti ─────────────────────
  const [daGestireApps,  setDaGestireApps]  = useState<Appuntamento[]>([])
  const [daGestireOpen,  setDaGestireOpen]  = useState(false)

  // ── "Da confermare": appuntamenti di oggi/prossimo giorno lav. non confermati ─
  const [daConfermare,     setDaConfermare]     = useState<Appuntamento[]>([])
  const [daConfermarOpen,  setDaConfermarOpen]  = useState(false)

  // ── Carica appuntamenti dall'API ──────────────────────────────────────────
  const carica = useCallback(async () => {
    setLoading(true)
    try {
      const fine = periodicita === 'giorno' ? aggiungiGiorni(dataBase, 1)
                 : periodicita === '5giorni' ? aggiungiGiorni(dataBase, 5)
                 : aggiungiGiorni(dataBase, 7)
      const url  = `/api/appuntamenti?start=${dataBase.toISOString()}&end=${fine.toISOString()}&studioId=${studioId}`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      setAppuntamenti(Array.isArray(data) ? data : [])
    } catch {
      setAppuntamenti([])
    } finally {
      setLoading(false)
    }
  }, [dataBase, periodicita, studioId])

  useEffect(() => { carica() }, [carica])

  // ── Carica appuntamenti "da gestire" (passati e ancora aperti) ───────────
  const caricaDaGestire = useCallback(async () => {
    try {
      const url = `/api/appuntamenti?daGestire=true&studioId=${studioId}`
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      setDaGestireApps(Array.isArray(data) ? data : [])
    } catch {
      setDaGestireApps([])
    }
  }, [studioId])

  useEffect(() => { caricaDaGestire() }, [caricaDaGestire])

  // ── Carica appuntamenti "da confermare" (oggi + prossimo gg lavorativo) ──
  const caricaDaConfermare = useCallback(async () => {
    try {
      const res  = await fetch(`/api/appuntamenti?daConfermare=true&studioId=${studioId}`, { cache: 'no-store' })
      const data = await res.json()
      setDaConfermare(Array.isArray(data) ? data : [])
    } catch {
      setDaConfermare([])
    }
  }, [studioId])

  useEffect(() => { caricaDaConfermare() }, [caricaDaConfermare])

  // Ricarica tutto quando la pagina è ripristinata dalla bfcache (bottone indietro browser)
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        // Forza revalidazione Next.js + ricarica dati client
        router.refresh()
        carica()
        caricaDaGestire()
        caricaDaConfermare()
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [router, carica, caricaDaGestire, caricaDaConfermare])

  // ── Ricarica sale e operatori quando cambia lo studio ────────────────────
  // `primoCambioStudio` evita di chiamare le API al montaggio iniziale
  // (al primo render le props sono già corrette per lo studio iniziale)
  const primoCambioStudio = useRef(true)
  useEffect(() => {
    if (primoCambioStudio.current) { primoCambioStudio.current = false; return }
    async function caricaSalaEOperatori() {
      // tutte=true → otteniamo anche le sale "eliminate" (disattivate),
      // così il filtro per data può mostrarle nei periodi in cui erano attive.
      const [resSale, resOp] = await Promise.all([
        fetch(`/api/sale?studioId=${studioId}&tutte=true`),
        fetch(`/api/operatori?studioId=${studioId}`),
      ])
      const nuoveSale      = await resSale.json()
      const nuoviOperatori = await resOp.json()
      setSale(Array.isArray(nuoveSale) ? nuoveSale : [])
      setOperatori(Array.isArray(nuoviOperatori) ? nuoviOperatori : [])
      // Resetta i filtri: la sala/medico precedente potrebbe non esistere nel nuovo studio
      setFiltroSala(null)
      setFiltroMedico(null)
    }
    caricaSalaEOperatori()
  }, [studioId])

  // Set dei nomi per il bottone raggruppato "Prestazioni":
  // esclude quelle già mostrate singolarmente (Standard, Mantenimento)
  const chiaveSingole = new Set(PRESTAZIONI_SINGOLE.map(s => s.key))
  const prestazioniNomi = new Set(
    prestazioni
      .filter(p => !chiaveSingole.has(p.nome.toUpperCase()))
      .map(p => p.nome.toUpperCase())
  )

  // ── Filtra lato client ────────────────────────────────────────────────────
  const appFiltrati = appuntamenti.filter(a => {
    if (filtroSala   && a.salaId   !== filtroSala)   return false
    if (filtroMedico && a.medicoId !== filtroMedico) return false
    if (filtroPrestazione) {
      if (filtroPrestazione === FILTRO_PRESTAZIONI) {
        if (!prestazioniNomi.has(a.tipo.toUpperCase())) return false
      } else if (PRESTAZIONI_SINGOLE.some(s => s.key === filtroPrestazione)) {
        // Standard / Mantenimento: match per inclusione (cattura varianti di nome)
        if (!a.tipo.toUpperCase().includes(filtroPrestazione)) return false
      } else {
        // Bioscan e altre tipologie: match esatto
        if (a.tipo.toUpperCase() !== filtroPrestazione) return false
      }
    }
    return true
  })

  // ── Navigazione ──────────────────────────────────────────────────────────
  // '5giorni' e 'settimana' navigano a blocchi di 7 giorni (sempre da lunedì)
  const step = periodicita === 'giorno' ? 1 : 7

  function precedente() { setDataBase(d => aggiungiGiorni(d, -step)) }
  function successivo() { setDataBase(d => aggiungiGiorni(d, +step)) }
  function vaiOggi() {
    const oggi = new Date(); oggi.setHours(0,0,0,0)
    setDataBase(periodicita === 'giorno' ? oggi : lunedìDella(new Date()))
  }

  function cambiaPeriodicita(p: '5giorni' | 'settimana' | 'giorno') {
    // Salva la scelta dell'utente in localStorage → persiste tra i login
    localStorage.setItem('calendario-vista', p)
    setPeriodicita(p)
    const oggi = new Date(); oggi.setHours(0,0,0,0)
    setDataBase(p === 'giorno' ? oggi : lunedìDella(new Date()))
  }

  // ── Drag & drop: sposta un appuntamento su un nuovo slot ─────────────────
  // dragId = id dell'appuntamento in corso di trascinamento
  const dragId = useRef<string | null>(null)

  const spostaAppuntamento = useCallback(async (nuovoInizio: Date) => {
    const id = dragId.current
    if (!id) return
    // Aggiornamento ottimistico: sposta subito l'evento nella UI
    setAppuntamenti(prev => prev.map(a => {
      if (a.id !== id) return a
      const vecchioInizio = new Date(a.start)
      const vecchioFine   = new Date(a.end)
      const durata        = vecchioFine.getTime() - vecchioInizio.getTime()
      const nuovaFine     = new Date(nuovoInizio.getTime() + durata)
      return { ...a, start: nuovoInizio.toISOString(), end: nuovaFine.toISOString() }
    }))
    dragId.current = null
    // Salva sul server
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ inizio: nuovoInizio.toISOString() }),
      })
      if (!res.ok) throw new Error('Errore salvataggio')
    } catch {
      // In caso di errore ricarica dal server per ripristinare
      carica()
    }
  }, [carica])

  // ── Apre il popup per un appuntamento ────────────────────────────────────
  // Chiamato da CardAppuntamento al click; salva l'appuntamento e la posizione del mouse.
  function apriPopup(app: Appuntamento, e: React.MouseEvent) {
    setPopupApp(app)
    setPopupPos({ x: e.clientX, y: e.clientY })
  }

  // ── Cancella un appuntamento tramite il popup (cestino) ───────────────────
  const cancellaApp = useCallback(async (id: string) => {
    await fetch(`/api/appuntamenti/${id}`, { method: 'DELETE' })
    setPopupApp(null)
    carica()
  }, [carica])

  // ── Cambia stato appuntamento (FISSATO → CONFERMATO → COMPLETATO) ─────────
  const cambiaStatoApp = useCallback(async (id: string, nuovoStato: string) => {
    await fetch(`/api/appuntamenti/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stato: nuovoStato }),
    })
    // Aggiorna lo stato localmente senza ricaricare tutto il calendario
    setAppuntamenti(prev => prev.map(a => a.id === id ? { ...a, stato: nuovoStato } : a))
    setPopupApp(prev => prev?.id === id ? { ...prev, stato: nuovoStato } : prev)
    // Aggiorna / rimuove dalle liste laterali in base al nuovo stato
    const statiFinalizzati = ['COMPLETATO', 'CANCELLATO', 'DA_RIPROGRAMMARE', 'NO_SHOW']
    if (statiFinalizzati.includes(nuovoStato)) {
      setDaGestireApps(prev => prev.filter(a => a.id !== id))
      setDaConfermare(prev => prev.filter(a => a.id !== id))
    } else {
      setDaGestireApps(prev => prev.map(a => a.id === id ? { ...a, stato: nuovoStato } : a))
      // Se è diventato CONFERMATO, esce dalla lista "da confermare"
      if (nuovoStato === 'CONFERMATO') {
        setDaConfermare(prev => prev.filter(a => a.id !== id))
      } else {
        setDaConfermare(prev => prev.map(a => a.id === id ? { ...a, stato: nuovoStato } : a))
      }
    }
  }, [])

  // ── Giorni visibili nella griglia ─────────────────────────────────────────
  const giorni: Date[] = periodicita === '5giorni'
    ? Array.from({ length: 5 }, (_, i) => aggiungiGiorni(dataBase, i))  // Lun–Ven
    : periodicita === 'settimana'
    ? Array.from({ length: 6 }, (_, i) => aggiungiGiorni(dataBase, i))  // Lun–Sab
    : [dataBase]

  // ── Sale visibili nella sidebar ───────────────────────────────────────────
  // Mostra solo le sale il cui periodo di attività interseca il range
  // dei giorni visualizzati. Una sala appare se era attiva almeno un
  // giorno tra quelli visibili. Le sale "eliminate" (disattivate) restano
  // visibili per le date passate in cui erano attive — così gli appuntamenti
  // vecchi restano filtrabili e leggibili.
  const rangeStart = giorni[0]
  const rangeEnd   = aggiungiGiorni(giorni[giorni.length - 1], 1) // esclusivo
  const saleVisibili = sale.filter(s => {
    // Se non abbiamo le date (vecchie sale o API legacy), fallback: mostra se attiva
    if (!s.dataAttivazione) return s.attiva !== false
    const att = new Date(s.dataAttivazione)
    if (att >= rangeEnd) return false               // attivata dopo la fine del range
    if (s.dataDisattivazione) {
      const dis = new Date(s.dataDisattivazione)
      if (dis < rangeStart) return false            // disattivata prima dell'inizio del range
    }
    return true
  })

  const labelPeriodo = periodicita === '5giorni'
    ? labelSettimanaLavorativa(dataBase)
    : periodicita === 'settimana'
    ? labelSettimana(dataBase)
    : labelGiornoSingolo(dataBase)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="-m-6 flex overflow-hidden rounded-3xl" style={{ height: 'calc(100vh - 72px)' }}>

      {/* ══ SIDEBAR SINISTRA ═══════════════════════════════════════════════ */}
      <aside className="flex w-52 flex-shrink-0 flex-col gap-6 overflow-y-auto border-r border-slate-100 bg-slate-50 px-4 py-6">

        {/* SALE — solo quelle attive (o "eliminate" ma con periodo di
            attività che si sovrappone ai giorni visualizzati) */}
        <SezioneFilter titolo="Sale">
          <VoceFilter colore="#94a3b8" label="Tutte le sale"
            attivo={filtroSala === null}
            onClick={() => { setFiltroSala(null); setVistaMode('sala') }} />
          {saleVisibili.map(s => (
            <VoceFilter key={s.id} colore={s.colore} label={s.nome}
              attivo={filtroSala === s.id}
              onClick={() => {
                setFiltroSala(filtroSala === s.id ? null : s.id)
                setFiltroMedico(null)
                setVistaMode('sala')
              }} />
          ))}
        </SezioneFilter>

        {/* OPERATORI */}
        <SezioneFilter titolo="Operatori">
          <VoceFilter colore="#94a3b8" label="Tutti"
            attivo={filtroMedico === null}
            onClick={() => { setFiltroMedico(null); setVistaMode('operatore') }} />
          {operatori.map((op, i) => (
            <VoceFilter key={op.id}
              colore={PALETTE_OP[i % PALETTE_OP.length]}
              label={`${op.nome} ${op.cognome}`}
              attivo={filtroMedico === op.id}
              onClick={() => {
                setFiltroMedico(filtroMedico === op.id ? null : op.id)
                setFiltroSala(null)
                setVistaMode('operatore')
              }} />
          ))}
        </SezioneFilter>

        {/* PRESTAZIONI — cliccabili per filtrare */}
        <SezioneFilter titolo="Prestazioni">
          <VoceFilter colore="#94a3b8" label="Tutte"
            attivo={filtroPrestazione === null}
            onClick={() => setFiltroPrestazione(null)} />

          {/* Tipologie Bioscan mostrate singolarmente (ordine da impostazioni) */}
          {tipologieBioscan.map(t => {
            const nomeUp = t.nome.toUpperCase()
            const paletteKey = Object.keys(COLORI).find(k => nomeUp.includes(k))
            const colore = paletteKey ? COLORI[paletteKey] : '#6366f1'
            return (
              <VoceFilter key={t.id} colore={colore} label={t.nome}
                attivo={filtroPrestazione === nomeUp}
                onClick={() => setFiltroPrestazione(filtroPrestazione === nomeUp ? null : nomeUp)} />
            )
          })}

          {/* Standard e Mantenimento: voci fisse per i due tipi di trattamento */}
          {PRESTAZIONI_SINGOLE.map(({ key, label, colore }) => (
            <VoceFilter key={key} colore={colore} label={label}
              attivo={filtroPrestazione === key}
              onClick={() => setFiltroPrestazione(filtroPrestazione === key ? null : key)} />
          ))}

          {/* Voce raggruppata per le restanti Prestazioni (Fitoterapia, Lettura referto…) */}
          {prestazioni.some(p => !PRESTAZIONI_SINGOLE.some(s => s.key === p.nome.toUpperCase())) && (
            <VoceFilter colore="#64748b" label="Prestazioni"
              attivo={filtroPrestazione === FILTRO_PRESTAZIONI}
              onClick={() => setFiltroPrestazione(
                filtroPrestazione === FILTRO_PRESTAZIONI ? null : FILTRO_PRESTAZIONI
              )} />
          )}
        </SezioneFilter>

        {/* DA GESTIRE — appuntamenti passati con stato ancora aperto */}
        <div className="space-y-0.5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Azioni</p>
          <button
            onClick={() => setDaGestireOpen(true)}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition
              ${daGestireApps.length > 0
                ? 'text-orange-700 hover:bg-orange-50 hover:text-orange-900'
                : 'text-slate-400 hover:bg-white/80'}`}
          >
            <AlertCircle size={14} className={daGestireApps.length > 0 ? 'text-orange-500' : 'text-slate-300'} />
            <span className="flex-1 truncate">Da gestire</span>
            {daGestireApps.length > 0 && (
              <span className="flex-shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {daGestireApps.length}
              </span>
            )}
          </button>

          {/* DA CONFERMARE — appuntamenti di oggi/prossimo giorno lav. non ancora confermati */}
          <button
            onClick={() => setDaConfermarOpen(true)}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition
              ${daConfermare.length > 0
                ? 'text-blue-700 hover:bg-blue-50 hover:text-blue-900'
                : 'text-slate-400 hover:bg-white/80'}`}
          >
            <Clock size={14} className={daConfermare.length > 0 ? 'text-blue-500' : 'text-slate-300'} />
            <span className="flex-1 truncate">Da confermare</span>
            {daConfermare.length > 0 && (
              <span className="flex-shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {daConfermare.length}
              </span>
            )}
          </button>
        </div>

      </aside>

      {/* ══ AREA PRINCIPALE ════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Barra controlli */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">

            <select value={periodicita}
              onChange={e => cambiaPeriodicita(e.target.value as '5giorni' | 'settimana' | 'giorno')}
              className={selCls}>
              <option value="5giorni">Sett. lavorativa (Lun–Ven)</option>
              <option value="settimana">Settimana (Lun–Sab)</option>
              <option value="giorno">Giorno</option>
            </select>

            <select value={vistaMode}
              onChange={e => setVistaMode(e.target.value as 'sala' | 'operatore')}
              className={selCls}>
              <option value="sala">Vista per sala</option>
              <option value="operatore">Vista per operatore</option>
            </select>

            {studi.length > 1 && (
              <select value={studioId} onChange={e => setStudioId(e.target.value)} className={selCls}>
                {studi.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nome}{s.citta ? ` — ${s.citta}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <a href="/calendario/nuovo"
            className="flex-shrink-0 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            + Nuovo appuntamento
          </a>
        </div>

        {/* Barra navigazione */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-5 py-2.5">
          <button onClick={precedente} className={navBtn}>‹</button>
          <button onClick={successivo} className={navBtn}>›</button>
          <span className="ml-1 text-sm font-medium text-slate-700">{labelPeriodo}</span>
          {loading && <span className="text-xs text-slate-400">Caricamento…</span>}
          <button onClick={vaiOggi}
            className="ml-auto rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50">
            Oggi
          </button>
        </div>

        {/* Griglia */}
        <div className="flex-1 overflow-auto bg-white">
          <GrigliaCalendario
            giorni={giorni}
            appuntamenti={appFiltrati}
            vistaMode={vistaMode}
            oggi={oggi}
            onDragStart={id => { dragId.current = id }}
            onDrop={spostaAppuntamento}
            onCardClick={apriPopup}
          />
        </div>

        {/* Legenda */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-4 border-t border-slate-100 bg-white px-5 py-3">
          {Object.entries(COLORI).map(([tipo, colore]) => (
            <span key={tipo} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colore }} />
              {LABEL_COLORI[tipo]}
            </span>
          ))}
        </div>

      </div>

      {/* ══ POPUP APPUNTAMENTO ══════════════════════════════════════════════
          Visibile quando l'utente clicca su una card.
          Usa position:fixed → non viene tagliato dall'overflow-hidden del container.  */}
      {popupApp && (
        <PopupAppuntamento
          app={popupApp}
          pos={popupPos}
          onClose={() => setPopupApp(null)}
          onCancella={cancellaApp}
          onCambiaStato={cambiaStatoApp}
        />
      )}

      {/* ══ PANNELLO "DA GESTIRE" ═══════════════════════════════════════════
          Slide-over da destra: lista appuntamenti passati con stato ancora aperto */}
      {daGestireOpen && (
        <PannelloDaGestire
          appuntamenti={daGestireApps}
          onClose={() => setDaGestireOpen(false)}
          onCambiaStato={cambiaStatoApp}
        />
      )}

      {/* ══ PANNELLO "DA CONFERMARE" ════════════════════════════════════════
          Slide-over da destra: appuntamenti di oggi/prossimo gg lav. non confermati */}
      {daConfermarOpen && (
        <PannelloDaConfermare
          appuntamenti={daConfermare}
          onClose={() => setDaConfermarOpen(false)}
          onCambiaStato={cambiaStatoApp}
        />
      )}

    </div>
  )
}

// ── Griglia ore × giorni ──────────────────────────────────────────────────────

function GrigliaCalendario({ giorni, appuntamenti, vistaMode, oggi, onDragStart, onDrop, onCardClick }: {
  giorni:       Date[]
  appuntamenti: Appuntamento[]
  vistaMode:    'sala' | 'operatore'
  oggi:         Date | null   // null durante SSR → nessun giorno evidenziato
  onDragStart:  (id: string) => void
  onDrop:       (nuovoInizio: Date) => void
  onCardClick:  (app: Appuntamento, e: React.MouseEvent) => void
}) {
  const MAX  = 3   // massimo card visibili per slot prima di "+N altri"

  // Cella evidenziata durante il drag
  const [hoverCell, setHoverCell] = useState<string | null>(null)

  // Appuntamenti che iniziano in uno slot giorno+ora
  function slot(giorno: Date, ora: number): Appuntamento[] {
    return appuntamenti.filter(a => {
      const d = new Date(a.start)
      return stessoGiorno(d, giorno) && d.getHours() === ora
    })
  }

  function cellKey(g: Date, ora: number) {
    return `${g.toDateString()}-${ora}`
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="sticky top-0 z-10 border-b border-slate-100 bg-white">
          <th className="w-14 border-r border-slate-100" />
          {giorni.map(g => {
            const isOggi = oggi ? stessoGiorno(g, oggi) : false
            return (
              <th key={g.toISOString()}
                className={`border-l border-slate-100 px-2 py-2.5 text-center text-sm font-medium
                  ${isOggi ? 'text-indigo-600' : 'text-slate-600'}`}>
                <span className={`inline-block rounded-full px-2.5 py-0.5
                  ${isOggi ? 'bg-indigo-50 font-semibold' : ''}`}>
                  {labelGiorno(g)}
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {ORE.map(ora => (
          <tr key={ora} className="border-b border-slate-50">
            <td className="w-14 border-r border-slate-100 pr-3 pt-2 text-right align-top text-xs text-slate-400">
              {ora}:00
            </td>
            {giorni.map(g => {
              const apps     = slot(g, ora)
              const visibili = apps.slice(0, MAX)
              const extra    = apps.length - MAX
              const key      = cellKey(g, ora)
              const isHover  = hoverCell === key

              return (
                <td
                  key={g.toISOString()}
                  className={`min-h-[64px] border-l border-slate-100 px-1 py-1 align-top transition-colors
                    ${isHover ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50/30'}`}
                  // Permette il drop su questa cella
                  onDragOver={e => { e.preventDefault(); setHoverCell(key) }}
                  onDragLeave={() => setHoverCell(null)}
                  onDrop={e => {
                    e.preventDefault()
                    setHoverCell(null)
                    // Costruisce il nuovo datetime: stessa data della cella, ora della cella
                    const nuovoInizio = new Date(g)
                    nuovoInizio.setHours(ora, 0, 0, 0)
                    onDrop(nuovoInizio)
                  }}
                >
                  {/* Appuntamenti sulla stessa riga se sono più di uno nello slot */}
                  <div className="flex gap-1">
                    {visibili.map(a => (
                      <CardAppuntamento
                        key={a.id}
                        app={a}
                        vistaMode={vistaMode}
                        onDragStart={onDragStart}
                        onCardClick={onCardClick}
                      />
                    ))}
                  </div>
                  {extra > 0 && (
                    <p className="mt-0.5 px-1 text-xs text-slate-400">
                      +{extra} {extra === 1 ? 'altro' : 'altri'}
                    </p>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Card appuntamento ─────────────────────────────────────────────────────────
// Cliccando sulla card si apre il popup con le azioni.
// Trascinandola si sposta l'appuntamento (drag & drop).

function CardAppuntamento({ app, vistaMode, onDragStart, onCardClick }: {
  app:         Appuntamento
  vistaMode:   'sala' | 'operatore'
  onDragStart: (id: string) => void
  onCardClick: (app: Appuntamento, e: React.MouseEvent) => void
}) {
  const colore    = colorePerTipo(app.tipo)
  const rigaSotto = vistaMode === 'operatore' ? app.medico : app.sala
  // Bollino "da gestire": data passata e stato ancora aperto
  const daGestire = new Date(app.start) < new Date()
    && (app.stato === 'FISSATO' || app.stato === 'CONFERMATO')

  // Usiamo un ref (non state) per tracciare il drag senza ri-renderizzare.
  // Se il drag è avvenuto, il click successivo non apre il popup.
  const didDrag = useRef(false)

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(app.id)
        didDrag.current = true
      }}
      onDragEnd={() => {
        // Piccolo delay: assicuriamoci che l'onClick (se scatta) legga ancora didDrag=true
        setTimeout(() => { didDrag.current = false }, 100)
      }}
      onClick={e => {
        // Non aprire il popup se stavamo trascinando
        if (!didDrag.current) onCardClick(app, e)
      }}
      className="min-w-0 flex-1 max-w-[180px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100
        transition-all hover:shadow-md hover:ring-slate-300 cursor-pointer"
      style={{ borderLeft: `3px solid ${colore}` }}
      title={`${app.paziente} — ${app.tipo}\nMedico: ${app.medico}\nSala: ${app.sala}\nClicca per dettagli · Trascina per spostare`}
    >
      <div className="px-2 py-1" style={{ background: `${app.salaColore}30` }}>
        <p className="truncate text-xs font-semibold leading-tight text-slate-800">
          {app.paziente}
        </p>
      </div>
      <div className="px-2 pb-1">
        <p className="truncate text-[11px] text-slate-500">
          {app.tipo} — {oraMinuti(app.start)}
        </p>
        {rigaSotto && (
          <p className="flex items-center gap-1 truncate text-[10px] text-slate-400">
            <span className="truncate">{rigaSotto}</span>
            {daGestire                   && <span className="flex-shrink-0 h-2 w-2 rounded-full bg-red-500"    title="Da gestire" />}
            {app.bioscanSenzaLettura     && <span className="flex-shrink-0 h-2 w-2 rounded-full bg-amber-400"  title="Lettura referto da fissare" />}
            {app.stato === 'CANCELLATO'  && <Trash2 size={13} className="flex-shrink-0 text-red-400" />}
            {app.stato === 'CONFERMATO'  && !daGestire && <Clock size={13} className="flex-shrink-0 text-blue-500" />}
            {app.stato === 'COMPLETATO'  && <Check  size={13} className="flex-shrink-0 text-emerald-500" />}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Sidebar: sezione con titolo ───────────────────────────────────────────────

function SezioneFilter({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{titolo}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

// ── Sidebar: voce filtrabile ──────────────────────────────────────────────────

function VoceFilter({ colore, label, attivo, onClick }: {
  colore: string; label: string; attivo: boolean; onClick: () => void
}) {
  return (
    <li>
      <button onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition
          ${attivo
            ? 'bg-white font-semibold text-slate-900 shadow-sm'
            : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'}`}>
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: colore }} />
        <span className="truncate">{label}</span>
      </button>
    </li>
  )
}

// ── Stili condivisi ───────────────────────────────────────────────────────────
const selCls = 'rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400 cursor-pointer'
const navBtn = 'flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-600 hover:bg-slate-50 leading-none'

// ── Popup appuntamento ────────────────────────────────────────────────────────
// Appare cliccando su una card del calendario.
// Mostra le informazioni principali e tre azioni:
//   - Matita  → modifica (naviga a /calendario/[id])
//   - Cestino → cancella (chiama DELETE /api/appuntamenti/[id])
//   - Valigetta → cartella clinica (naviga a /pazienti/[pazienteId])

function PopupAppuntamento({ app, pos, onClose, onCancella, onCambiaStato }: {
  app:            Appuntamento
  pos:            { x: number; y: number }
  onClose:        () => void
  onCancella:     (id: string) => Promise<void>
  onCambiaStato:  (id: string, stato: string) => Promise<void>
}) {
  const [cancellando,    setCancellando]    = useState(false)
  const [cambiandoStato, setCambiandoStato] = useState(false)

  // Stato per il modal "Converti" (opzioni dopo lettura referto completata)
  const [mostraConversione, setMostraConversione] = useState(false)
  const [convEspanso, setConvEspanso]             = useState<'DA_RICHIAMARE' | 'NON_INTERESSATO' | null>(null)
  const [convLoading, setConvLoading]             = useState(false)

  // La lettura referto completata sblocca il bottone "Converti"
  const isLetturaCompletata = app.tipo.toLowerCase().includes('lettura') && app.stato === 'COMPLETATO'
  // Distingue tra lettura referto di bioscan iniziale (→ opzioni programma) e di controllo (→ opzioni avanzamento)
  const isLetturaControlloCompletata = isLetturaCompletata && app.bioscanControllo

  // Calcola dove posizionare il popup evitando che esca dallo schermo.
  const popW = 288
  const popH = 220
  const vw = window.innerWidth
  const vh = window.innerHeight
  const x = Math.min(pos.x + 12, vw - popW - 16)
  const y = Math.min(pos.y + 12, vh - popH - 16)

  async function handleCancella() {
    if (!confirm('Cancellare questo appuntamento?')) return
    setCancellando(true)
    await onCancella(app.id)
    setCancellando(false)
  }

  // Chiama l'API /api/pazienti/[id]/decisione e naviga alla pagina restituita
  async function registraDecisione(decisione: string, dataRichiamo?: string, motivazione?: string) {
    setConvLoading(true)
    try {
      const res  = await fetch(`/api/pazienti/${app.pazienteId}/decisione`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ decisione, dataRichiamo, motivazione }),
      })
      const data = await res.json()
      if (data.redirect) {
        window.location.href = data.redirect
      } else {
        setMostraConversione(false)
        onClose()
      }
    } finally {
      setConvLoading(false)
    }
  }

  const boxBase = 'rounded-2xl border p-4 text-xs font-semibold transition cursor-pointer text-center'

  return (
    <>
      {/* Overlay invisibile: clic fuori dal popup lo chiude */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Card popup */}
      <div
        className="fixed z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ left: x, top: y }}
      >
        {/* ── Barra icone ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-0.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <a href={`/calendario/${app.id}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            title="Modifica appuntamento">
            <Pencil size={15} />
          </a>
          <button onClick={handleCancella} disabled={cancellando}
            className="rounded-lg p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
            title="Cancella appuntamento">
            <Trash2 size={15} />
          </button>
          <a href={`/pazienti/${app.pazienteId}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            title="Cartella clinica paziente">
            <Briefcase size={15} />
          </a>
          <button onClick={onClose}
            className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title="Chiudi">
            <X size={15} />
          </button>
        </div>

        {/* ── Contenuto ───────────────────────────────────────────────── */}
        <div className="space-y-2 px-4 py-3">
          <div>
            <h3 className="font-semibold text-slate-900">{app.paziente}</h3>
            <p className="text-xs text-slate-500">{app.tipo}</p>
          </div>
          <p className="text-xs text-slate-500">
            {new Date(app.start).toLocaleDateString('it-IT', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}{' '}
            {oraMinuti(app.start)} – {oraMinuti(app.end)}
          </p>
          <div className="space-y-0.5 text-xs text-slate-600">
            <p><span className="font-medium">Medico:</span> {app.medico}</p>
            <p><span className="font-medium">Sala:</span>   {app.sala}</p>
          </div>

          {/* Stato + bottoni avanzamento flusso */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeStatoApp(app.stato)}`}>
              {STATO_LABEL[app.stato] ?? app.stato}
            </span>
            {app.stato === 'FISSATO' && (
              <button disabled={cambiandoStato}
                onClick={async () => { setCambiandoStato(true); await onCambiaStato(app.id, 'CONFERMATO'); setCambiandoStato(false) }}
                className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-40">
                Conferma
              </button>
            )}
            {app.stato === 'CONFERMATO' && (
              <button disabled={cambiandoStato}
                onClick={async () => { setCambiandoStato(true); await onCambiaStato(app.id, 'COMPLETATO'); setCambiandoStato(false) }}
                className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-40">
                Effettuato
              </button>
            )}
            {/* Bottone "Converti" — appare solo su lettura referto completata */}
            {isLetturaCompletata && (
              <button
                onClick={() => { setMostraConversione(true); setConvEspanso(null) }}
                className="rounded-full bg-teal-100 px-3 py-0.5 text-xs font-semibold text-teal-700 hover:bg-teal-200"
              >
                Converti
              </button>
            )}
            {(app.stato === 'FISSATO' || app.stato === 'CONFERMATO') && (
              <button disabled={cambiandoStato}
                onClick={async () => { setCambiandoStato(true); await onCambiaStato(app.id, 'DA_RIPROGRAMMARE'); setCambiandoStato(false) }}
                className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-40">
                Da riprogrammare
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ MODAL CONVERSIONE — opzioni dopo lettura referto completata ══════ */}
      {mostraConversione && (
        <>
          {/* Overlay scuro: clic fuori chiude il modal (non il popup) */}
          <div className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setMostraConversione(false)} />

          <div className="fixed z-[70] left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2
            overflow-y-auto max-h-[90vh] rounded-2xl bg-white shadow-2xl p-5 space-y-4">

            {/* Intestazione */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Decisione del paziente</p>
                <p className="text-xs text-slate-500 mt-0.5">{app.paziente} — cosa ha deciso?</p>
              </div>
              <button onClick={() => setMostraConversione(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>

            {/* ── Opzioni bioscan di CONTROLLO ── */}
            {isLetturaControlloCompletata ? (
              <>
                <div className="grid grid-cols-2 gap-3">

                  {/* Aggiungi sessione */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('AGGIUNGI_SESSIONE')}
                    className={`${boxBase} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40`}>
                    Aggiungi<br />sessione
                  </button>

                  {/* Programma mantenimento */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('MANTENIMENTO')}
                    className={`${boxBase} border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 disabled:opacity-40`}>
                    Programma<br />mantenimento
                  </button>

                  {/* Prendi Fisioterapia */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('FISIOTERAPIA')}
                    className={`${boxBase} border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-40`}>
                    Prendi<br />fitoterapia
                  </button>

                  {/* Programma terminato */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('PROGRAMMA_TERMINATO')}
                    className={`${boxBase} border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40`}>
                    Programma<br />terminato
                  </button>
                </div>

                {/* Deve pensarci — espande date picker */}
                <button
                  onClick={() => setConvEspanso(e => e === 'DA_RICHIAMARE' ? null : 'DA_RICHIAMARE')}
                  className={`${boxBase} border-amber-300 text-amber-800 w-full text-left
                    ${convEspanso === 'DA_RICHIAMARE' ? 'bg-amber-100 ring-2 ring-amber-300' : 'bg-amber-50 hover:bg-amber-100'}`}>
                  Deve pensarci
                </button>
              </>
            ) : (
              <>
                {/* ── Opzioni bioscan INIZIALE (flusso standard) ── */}
                <div className="grid grid-cols-2 gap-3">

                  {/* Fissa programma */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('PROGRAMMA')}
                    className={`${boxBase} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40`}>
                    Fissa<br />programma
                  </button>

                  {/* Fissa prestazione */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('PRESTAZIONE')}
                    className={`${boxBase} border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 disabled:opacity-40`}>
                    Fissa<br />prestazione
                  </button>

                  {/* Fissa fitoterapia */}
                  <button disabled={convLoading}
                    onClick={() => registraDecisione('FITOTERAPIA')}
                    className={`${boxBase} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40`}>
                    Fissa<br />fitoterapia
                  </button>

                  {/* Deve pensarci — espande date picker */}
                  <button
                    onClick={() => setConvEspanso(e => e === 'DA_RICHIAMARE' ? null : 'DA_RICHIAMARE')}
                    className={`${boxBase} border-amber-300 text-amber-800
                      ${convEspanso === 'DA_RICHIAMARE' ? 'bg-amber-100 ring-2 ring-amber-300' : 'bg-amber-50 hover:bg-amber-100'}`}>
                    Deve<br />pensarci
                  </button>
                </div>

                {/* Box "Non interessato" — espande textarea motivazione */}
                <button
                  onClick={() => setConvEspanso(e => e === 'NON_INTERESSATO' ? null : 'NON_INTERESSATO')}
                  className={`${boxBase} border-slate-300 text-slate-600 w-full text-left
                    ${convEspanso === 'NON_INTERESSATO' ? 'bg-slate-200 ring-2 ring-slate-400' : 'bg-slate-50 hover:bg-slate-100'}`}>
                  Non interessato
                </button>

                {/* Form "Non interessato" espanso */}
                {convEspanso === 'NON_INTERESSATO' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Motivazione (opzionale)</p>
                    <textarea id="conv-motivazione" rows={2}
                      placeholder="Es. costo, non convinto del trattamento…"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                    <div className="flex gap-2">
                      <button disabled={convLoading}
                        onClick={() => {
                          const m = (document.getElementById('conv-motivazione') as HTMLTextAreaElement)?.value
                          registraDecisione('NON_INTERESSATO', undefined, m || undefined)
                        }}
                        className="rounded-full bg-slate-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
                        Conferma — non interessato
                      </button>
                      <button onClick={() => setConvEspanso(null)}
                        className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Form "Da richiamare" espanso (comune a entrambi i flussi) */}
            {convEspanso === 'DA_RICHIAMARE' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-800">Quando richiamare?</p>
                <input id="conv-data-richiamo" type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 w-full"
                />
                <textarea id="conv-note-richiamo" rows={2}
                  placeholder="Note (opzionale)…"
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <div className="flex gap-2">
                  <button disabled={convLoading}
                    onClick={() => {
                      const d = (document.getElementById('conv-data-richiamo') as HTMLInputElement)?.value
                      const n = (document.getElementById('conv-note-richiamo') as HTMLTextAreaElement)?.value
                      if (d) registraDecisione('DA_RICHIAMARE', d, n || undefined)
                    }}
                    className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40">
                    Conferma
                  </button>
                  <button onClick={() => setConvEspanso(null)}
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                    Annulla
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </>
  )
}

// Colore del badge stato
function badgeStatoApp(stato: string): string {
  const map: Record<string, string> = {
    FISSATO:          'bg-blue-100 text-blue-700',
    CONFERMATO:       'bg-green-100 text-green-700',
    COMPLETATO:       'bg-emerald-100 text-emerald-700',
    CANCELLATO:       'bg-red-100 text-red-600',
    NO_SHOW:          'bg-orange-100 text-orange-600',
    DA_RIPROGRAMMARE: 'bg-purple-100 text-purple-700',
  }
  return map[stato] ?? 'bg-slate-100 text-slate-600'
}

// ── Pannello "Da confermare" ──────────────────────────────────────────────────
// Slide-over da destra: appuntamenti di oggi e prossimo giorno lavorativo
// ancora in stato FISSATO (non confermati). L'azione principale è "Conferma".

function PannelloDaConfermare({ appuntamenti, onClose, onCambiaStato }: {
  appuntamenti:  Appuntamento[]
  onClose:       () => void
  onCambiaStato: (id: string, stato: string) => Promise<void>
}) {
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  async function gestisci(id: string, stato: string) {
    setCambiandoId(id)
    await onCambiaStato(id, stato)
    setCambiandoId(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">

        {/* Intestazione */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-800">Da confermare</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {appuntamenti.length}
            </span>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {appuntamenti.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nessun appuntamento da confermare.
            </p>
          ) : (
            appuntamenti.map(app => (
              <div key={app.id} className="px-5 py-4 space-y-2">

                {/* Paziente + tipo */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{app.paziente}</p>
                    <p className="text-xs text-slate-500">{app.tipo}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStatoApp(app.stato)}`}>
                    {STATO_LABEL[app.stato] ?? app.stato}
                  </span>
                </div>

                {/* Data e ora */}
                <p className="text-xs text-slate-500">
                  {new Date(app.start).toLocaleDateString('it-IT', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}{' '}
                  {oraMinuti(app.start)} – {oraMinuti(app.end)}
                </p>

                {/* Medico e sala */}
                <p className="text-xs text-slate-400">{app.medico} · {app.sala}</p>

                {/* Azioni */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    disabled={cambiandoId === app.id}
                    onClick={() => gestisci(app.id, 'CONFERMATO')}
                    className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-40"
                  >
                    Conferma
                  </button>
                  <button
                    disabled={cambiandoId === app.id}
                    onClick={() => gestisci(app.id, 'DA_RIPROGRAMMARE')}
                    className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-40"
                  >
                    Da riprogrammare
                  </button>
                  <a
                    href={`/calendario/${app.id}`}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Modifica
                  </a>
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </>
  )
}

// Etichetta leggibile per lo stato
const STATO_LABEL: Record<string, string> = {
  FISSATO:          'Fissato',
  CONFERMATO:       'Confermato',
  COMPLETATO:       'Effettuato',
  CANCELLATO:       'Cancellato',
  NO_SHOW:          'No Show',
  DA_RIPROGRAMMARE: 'Da riprogrammare',
}

// ── Pannello "Da gestire" ─────────────────────────────────────────────────────
// Slide-over da destra che mostra gli appuntamenti passati con stato ancora aperto
// (FISSATO o CONFERMATO). Da qui si può cambiare lo stato di ogni appuntamento.

function PannelloDaGestire({ appuntamenti, onClose, onCambiaStato }: {
  appuntamenti:  Appuntamento[]
  onClose:       () => void
  onCambiaStato: (id: string, stato: string) => Promise<void>
}) {
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  async function gestisci(id: string, stato: string) {
    setCambiandoId(id)
    await onCambiaStato(id, stato)
    setCambiandoId(null)
  }

  return (
    <>
      {/* Overlay scuro semitrasparente — clic fuori chiude il pannello */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Pannello slide-over da destra */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">

        {/* Intestazione */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-orange-500" />
            <h2 className="text-base font-semibold text-slate-800">Da gestire</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
              {appuntamenti.length}
            </span>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Lista appuntamenti */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {appuntamenti.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nessun appuntamento da gestire.
            </p>
          ) : (
            appuntamenti.map(app => (
              <div key={app.id} className="px-5 py-4 space-y-2">

                {/* Paziente + tipo */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{app.paziente}</p>
                    <p className="text-xs text-slate-500">{app.tipo}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStatoApp(app.stato)}`}>
                    {STATO_LABEL[app.stato] ?? app.stato}
                  </span>
                </div>

                {/* Data e ora */}
                <p className="text-xs text-slate-500">
                  {new Date(app.start).toLocaleDateString('it-IT', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })}{' '}
                  {oraMinuti(app.start)} – {oraMinuti(app.end)}
                </p>

                {/* Medico e sala */}
                <p className="text-xs text-slate-400">
                  {app.medico} · {app.sala}
                </p>

                {/* Azioni: bottoni cambio stato */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {app.stato === 'FISSATO' && (
                    <button
                      disabled={cambiandoId === app.id}
                      onClick={() => gestisci(app.id, 'CONFERMATO')}
                      className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-40"
                    >
                      Conferma
                    </button>
                  )}
                  <button
                    disabled={cambiandoId === app.id}
                    onClick={() => gestisci(app.id, 'COMPLETATO')}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-40"
                  >
                    Effettuato
                  </button>
                  <button
                    disabled={cambiandoId === app.id}
                    onClick={() => gestisci(app.id, 'NO_SHOW')}
                    className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-40"
                  >
                    No Show
                  </button>
                  <button
                    disabled={cambiandoId === app.id}
                    onClick={() => gestisci(app.id, 'DA_RIPROGRAMMARE')}
                    className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-40"
                  >
                    Da riprogrammare
                  </button>
                  <a
                    href={`/calendario/${app.id}`}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Modifica
                  </a>
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </>
  )
}
