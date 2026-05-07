'use client'
// Componente client per le righe prodotto nella modifica prescrizione
// Simile a RigheProdotti ma accetta righe iniziali pre-compilate

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Prodotto    { id: string; nome: string; prezzoMese: number }
interface RigaIniziale { key: number; prodottoId: string; durataM: number; prezzoMese: number; posologia: string }

export default function RigheProdottiModifica({
  prodotti,
  righeIniziali,
}: {
  prodotti:      Prodotto[]
  righeIniziali: RigaIniziale[]
}) {
  const [righe, setRighe] = useState<RigaIniziale[]>(
    righeIniziali.length > 0 ? righeIniziali : [{ key: 0, prodottoId: '', durataM: 1, prezzoMese: prodotti[0]?.prezzoMese ?? 0, posologia: '' }]
  )

  function aggiungi() {
    setRighe(r => [...r, { key: Date.now(), prodottoId: '', durataM: 1, prezzoMese: prodotti[0]?.prezzoMese ?? 0, posologia: '' }])
  }

  function rimuovi(key: number) {
    if (righe.length <= 1) return
    setRighe(r => r.filter(x => x.key !== key))
  }

  function aggiornaProdotto(key: number, pid: string) {
    const p = prodotti.find(x => x.id === pid)
    setRighe(r => r.map(x => x.key === key ? { ...x, prodottoId: pid, prezzoMese: p?.prezzoMese ?? x.prezzoMese } : x))
  }

  function aggiornaPrezzo(key: number, val: number) {
    setRighe(r => r.map(x => x.key === key ? { ...x, prezzoMese: val } : x))
  }

  return (
    <div className="space-y-3">
      {righe.map((riga, idx) => (
        <RigaProdotto
          key={riga.key}
          idx={idx}
          prodotti={prodotti}
          riga={riga}
          onProdottoChange={pid => aggiornaProdotto(riga.key, pid)}
          onPrezzoChange={val => aggiornaPrezzo(riga.key, val)}
          onRimuovi={() => rimuovi(riga.key)}
          mostraRimuovi={righe.length > 1}
        />
      ))}

      <button type="button" onClick={aggiungi}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700">
        <Plus size={14} /> Aggiungi prodotto
      </button>
    </div>
  )
}

function RigaProdotto({ idx, prodotti, riga, onProdottoChange, onPrezzoChange, onRimuovi, mostraRimuovi }: {
  idx:            number
  prodotti:       Prodotto[]
  riga:           RigaIniziale
  onProdottoChange: (id: string) => void
  onPrezzoChange:   (val: number) => void
  onRimuovi:      () => void
  mostraRimuovi:  boolean
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[2fr_1fr_1fr_2fr_auto]">
      {/* Prodotto */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Prodotto *</label>
        <select name="prodottoId" required className={cls}
          defaultValue={riga.prodottoId}
          onChange={e => onProdottoChange(e.target.value)}>
          <option value="">Seleziona…</option>
          {prodotti.map(p => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      {/* Durata mesi */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mesi *</label>
        <input type="number" name="durataM" min="1" required className={cls}
          defaultValue={riga.durataM} />
      </div>

      {/* Prezzo/mese — modificabile */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">€/mese</label>
        <input type="number" name="prezzoMese" min="0" step="0.01" className={cls}
          value={riga.prezzoMese}
          onChange={e => onPrezzoChange(Number(e.target.value))} />
      </div>

      {/* Posologia */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Posologia</label>
        <input type="text" name="posologia" placeholder="es. 2 capsule/giorno…" className={cls}
          defaultValue={riga.posologia} />
      </div>

      {/* Rimuovi */}
      <div className="flex items-end pb-0.5">
        {mostraRimuovi && (
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
