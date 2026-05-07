'use client'
// Componente input password con bottone per mostrare/nascondere il testo
// Usalo al posto di <input type="password"> in qualsiasi form
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const cls = 'w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

export default function CampoPassword({
  name,
  label,
  required = false,
  placeholder = '',
  clsInput,       // override stile input (opzionale)
  clsLabel,       // override stile label (opzionale)
}: {
  name: string
  label: string
  required?: boolean
  placeholder?: string
  clsInput?: string
  clsLabel?: string
}) {
  // Alterna tra tipo "password" (testo nascosto) e "text" (testo visibile)
  const [visibile, setVisibile] = useState(false)

  return (
    <div>
      <label className={clsLabel ?? 'block text-sm font-medium text-slate-700'}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          type={visibile ? 'text' : 'password'}
          name={name}
          required={required}
          placeholder={placeholder}
          // pr-10 lascia spazio per l'icona a destra
          className={`${clsInput ?? cls} pr-10`}
        />
        {/* Bottone occhio: alterna visibilità */}
        <button
          type="button"
          onClick={() => setVisibile(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          tabIndex={-1}                    // non interferisce con la navigazione da tastiera
          aria-label={visibile ? 'Nascondi password' : 'Mostra password'}
        >
          {visibile ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
