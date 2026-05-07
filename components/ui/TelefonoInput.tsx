'use client'
// Input telefono con prefisso internazionale.
// Mostra un select per il prefisso + un campo per il numero.
// Il valore combinato (+39XXXXXXXXXX) viene inviato via campo nascosto
// con il `name` passato come prop, in modo che le Server Actions lo leggano correttamente.

import { useState } from 'react'

// Prefissi più comuni per uno studio medico italiano
const PREFISSI = [
  { code: '+39',  label: '🇮🇹 +39 Italia' },
  { code: '+41',  label: '🇨🇭 +41 Svizzera' },
  { code: '+43',  label: '🇦🇹 +43 Austria' },
  { code: '+33',  label: '🇫🇷 +33 Francia' },
  { code: '+49',  label: '🇩🇪 +49 Germania' },
  { code: '+44',  label: '🇬🇧 +44 UK' },
  { code: '+34',  label: '🇪🇸 +34 Spagna' },
  { code: '+351', label: '🇵🇹 +351 Portogallo' },
  { code: '+32',  label: '🇧🇪 +32 Belgio' },
  { code: '+31',  label: '🇳🇱 +31 Olanda' },
  { code: '+48',  label: '🇵🇱 +48 Polonia' },
  { code: '+40',  label: '🇷🇴 +40 Romania' },
  { code: '+380', label: '🇺🇦 +380 Ucraina' },
  { code: '+30',  label: '🇬🇷 +30 Grecia' },
  { code: '+1',   label: '🇺🇸 +1 USA/Canada' },
  { code: '+55',  label: '🇧🇷 +55 Brasile' },
  { code: '+52',  label: '🇲🇽 +52 Messico' },
  { code: '+86',  label: '🇨🇳 +86 Cina' },
  { code: '+81',  label: '🇯🇵 +81 Giappone' },
]

// Estrae prefisso e numero da un valore già salvato (es. "+393331234567" → { prefix: "+39", numero: "3331234567" })
function parsaTelefono(val: string | null | undefined): { prefix: string; numero: string } {
  if (!val) return { prefix: '+39', numero: '' }

  if (val.startsWith('+')) {
    // Cerca il prefisso più lungo che corrisponde — es. +351 prima di +35
    const match = PREFISSI
      .filter(p => val.startsWith(p.code))
      .sort((a, b) => b.code.length - a.code.length)[0]
    if (match) {
      // Rimuove il prefisso e gli eventuali spazi iniziali
      return { prefix: match.code, numero: val.slice(match.code.length).replace(/^\s+/, '') }
    }
  }

  // Nessun prefisso riconosciuto: usa +39 di default
  return { prefix: '+39', numero: val }
}

// ── Stili (coerenti con il resto dell'app) ────────────────────────────────────
const clsSelect = [
  'mt-1.5 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2.5',
  'text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200',
  'cursor-pointer flex-shrink-0',
].join(' ')

const clsInput = [
  'mt-1.5 min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5',
  'text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200',
].join(' ')

// ── Componente ────────────────────────────────────────────────────────────────
export default function TelefonoInput({
  label,
  name,
  required   = false,
  defaultValue = '',
}: {
  label:         string
  name:          string
  required?:     boolean
  defaultValue?: string
}) {
  const parsed = parsaTelefono(defaultValue)
  const [prefix, setPrefix] = useState(parsed.prefix)
  const [numero, setNumero] = useState(parsed.numero)

  // Valore finale inviato con il form: prefisso + numero senza spazi doppi
  const valoreCombinato = `${prefix}${numero}`

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>

      {/* Select prefisso + input numero affiancati */}
      <div className="flex gap-2">
        <select
          value={prefix}
          onChange={e => setPrefix(e.target.value)}
          className={clsSelect}
          aria-label="Prefisso paese"
        >
          {PREFISSI.map(p => (
            <option key={p.code} value={p.code}>{p.label}</option>
          ))}
        </select>

        <input
          type="tel"
          value={numero}
          onChange={e => setNumero(e.target.value)}
          placeholder="3XX XXX XXXX"
          required={required}
          className={clsInput}
          aria-label={label}
        />
      </div>

      {/* Campo nascosto letto dalla Server Action tramite formData.get(name) */}
      <input type="hidden" name={name} value={valoreCombinato} />
    </div>
  )
}
