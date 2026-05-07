'use client'
// Select prestazione + input prezzo applicato collegati:
// quando si cambia la prestazione, il prezzo applicato si aggiorna automaticamente
// con il prezzo standard. L'utente può poi modificarlo manualmente.

import { useState } from 'react'

interface Prestazione {
  id:            string
  nome:          string
  prezzoBase:    number
  durataMinuti:  number
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function PrestazioneSelect({
  prestazioni,
  defaultPrestazioneId = '',
  defaultPrezzo,
}: {
  prestazioni:           Prestazione[]
  defaultPrestazioneId?: string
  defaultPrezzo?:        number   // usato nella pagina modifica per pre-compilare
}) {
  const trovaPrezzoBase = (id: string) =>
    prestazioni.find(p => p.id === id)?.prezzoBase ?? null

  const [prestazioneId, setPrestazioneId] = useState(defaultPrestazioneId)
  const [prezzo, setPrezzo] = useState<string>(
    defaultPrezzo != null
      ? defaultPrezzo.toFixed(2)
      : (trovaPrezzoBase(defaultPrestazioneId)?.toFixed(2) ?? '')
  )

  function cambiaPrestazioneId(id: string) {
    setPrestazioneId(id)
    const base = trovaPrezzoBase(id)
    if (base != null) setPrezzo(base.toFixed(2))
    else setPrezzo('')
  }

  return (
    <>
      {/* Select prestazione */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Tipo prestazione *</label>
        <select
          name="prestazioneId"
          required
          value={prestazioneId}
          onChange={e => cambiaPrestazioneId(e.target.value)}
          className={cls}
        >
          <option value="">Seleziona tipo…</option>
          {prestazioni.map(p => (
            <option key={p.id} value={p.id}>
              {p.nome} — €{p.prezzoBase.toFixed(2)} — {p.durataMinuti} min
            </option>
          ))}
        </select>
        {prestazioni.length === 0 && (
          <p className="mt-1 text-xs text-slate-400">
            <a href="/impostazioni/prestazioni/nuovo" className="underline">
              Configura le prestazioni
            </a>{' '}
            prima di procedere.
          </p>
        )}
      </div>

      {/* Prezzo applicato — pre-compilato con il prezzo standard */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Prezzo applicato (€)</label>
        <input
          type="number"
          name="prezzoApplicato"
          step="0.01"
          min="0"
          value={prezzo}
          onChange={e => setPrezzo(e.target.value)}
          placeholder="Seleziona prima una prestazione"
          className={cls}
        />
        {prezzo && trovaPrezzoBase(prestazioneId) != null &&
          Number(prezzo) !== trovaPrezzoBase(prestazioneId) && (
          <p className="mt-1 text-xs text-amber-600">
            Prezzo modificato rispetto allo standard (€{trovaPrezzoBase(prestazioneId)!.toFixed(2)})
          </p>
        )}
      </div>
    </>
  )
}
