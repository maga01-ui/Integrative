'use client'
// Componente client per aggiungere/rimuovere righe prodotto nella prescrizione

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Prodotto { id: string; nome: string; durataDefaultMesi: number; prezzoMese: number }

export default function RigheProdotti({ prodotti }: { prodotti: Prodotto[] }) {
  const [righe, setRighe] = useState([{ key: 0, prezzoDefault: prodotti[0]?.prezzoMese ?? 0 }])

  function aggiungi() {
    setRighe(r => [...r, { key: Date.now(), prezzoDefault: prodotti[0]?.prezzoMese ?? 0 }])
  }

  function rimuovi(key: number) {
    setRighe(r => r.filter(x => x.key !== key))
  }

  // Aggiorna prezzoDefault quando l'utente cambia il prodotto
  function aggiornaPrezzoRiga(idx: number, pid: string) {
    const p = prodotti.find(x => x.id === pid)
    setRighe(r => r.map((x, i) => i === idx ? { ...x, prezzoDefault: p?.prezzoMese ?? 0 } : x))
  }

  return (
    <div className="space-y-3">
      {righe.map((riga, idx) => (
        <RigaProdotto
          key={riga.key}
          idx={idx}
          prodotti={prodotti}
          prezzoDefault={riga.prezzoDefault}
          onProdottoChange={pid => aggiornaPrezzoRiga(idx, pid)}
          onRimuovi={() => rimuovi(riga.key)}
        />
      ))}

      <button type="button" onClick={aggiungi}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
        <Plus size={14} /> Aggiungi prodotto
      </button>
    </div>
  )
}

function RigaProdotto({ idx, prodotti, prezzoDefault, onProdottoChange, onRimuovi }: {
  idx:             number
  prodotti:        Prodotto[]
  prezzoDefault:   number
  onProdottoChange:(id: string) => void
  onRimuovi:       () => void
}) {
  // Stato locale per il prezzo, così l'utente può modificarlo liberamente
  const [prezzo, setPrezzo] = useState(prezzoDefault)

  // Quando il prodotto cambia, aggiorna il prezzo con il valore di default del prodotto
  function handleProdottoChange(pid: string) {
    const p = prodotti.find(x => x.id === pid)
    setPrezzo(p?.prezzoMese ?? 0)
    onProdottoChange(pid)
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[2fr_1fr_1fr_2fr_auto]">
      {/* Prodotto */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Prodotto *</label>
        <select name="prodottoId" required className={cls}
          onChange={e => handleProdottoChange(e.target.value)}>
          <option value="">Seleziona…</option>
          {prodotti.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      {/* Durata mesi */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mesi *</label>
        <input type="number" name="durataM" min="1" defaultValue="1" required className={cls} />
      </div>

      {/* Prezzo/mese — modificabile, pre-compilato dal prodotto selezionato */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">€/mese</label>
        <input type="number" name="prezzoMese" min="0" step="0.01"
          value={prezzo}
          onChange={e => setPrezzo(Number(e.target.value))}
          className={cls} />
      </div>

      {/* Posologia */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Posologia</label>
        <input type="text" name="posologia" placeholder="es. 2 capsule/giorno…" className={cls} />
      </div>

      {/* Rimuovi */}
      <div className="flex items-end pb-0.5">
        {idx > 0 && (
          <button type="button" onClick={onRimuovi}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

const cls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
