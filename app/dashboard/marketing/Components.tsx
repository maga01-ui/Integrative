// Componenti riutilizzabili della Dashboard Marketing.
// Usati dalle tab Leads, Pazienti, Bioscan.
//
// - KpiBox: rettangolino con etichetta + numero (opzionale: sottotitolo, link, icona)
// - BarChart: grafico a barre verticali (un valore per colonna)
// - OriginiList: lista canali con barra orizzontale di percentuale

import type { ElementType } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// KpiBox: card con un singolo KPI numerico.
// Se è passato `href` diventa cliccabile.
// ─────────────────────────────────────────────────────────────────────────────

type Colore =
  | 'slate'
  | 'blue'
  | 'amber'
  | 'green'
  | 'purple'
  | 'rose'
  | 'indigo'
  | 'orange'
  | 'red'
  | 'violet'
  | 'teal'

const PALETTE: Record<
  Colore,
  { bg: string; border: string; num: string; lbl: string; iconCol: string }
> = {
  slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  num: 'text-slate-800',  lbl: 'text-slate-500',  iconCol: 'bg-slate-100 text-slate-600' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   num: 'text-blue-800',   lbl: 'text-blue-600',   iconCol: 'bg-blue-100 text-blue-600' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  num: 'text-amber-800',  lbl: 'text-amber-600',  iconCol: 'bg-amber-100 text-amber-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  num: 'text-green-700',  lbl: 'text-green-600',  iconCol: 'bg-green-100 text-green-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', num: 'text-purple-700', lbl: 'text-purple-600', iconCol: 'bg-purple-100 text-purple-600' },
  rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   num: 'text-rose-700',   lbl: 'text-rose-600',   iconCol: 'bg-rose-100 text-rose-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', num: 'text-indigo-700', lbl: 'text-indigo-600', iconCol: 'bg-indigo-100 text-indigo-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', num: 'text-orange-700', lbl: 'text-orange-600', iconCol: 'bg-orange-100 text-orange-600' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    num: 'text-red-700',    lbl: 'text-red-600',    iconCol: 'bg-red-100 text-red-600' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', num: 'text-violet-700', lbl: 'text-violet-600', iconCol: 'bg-violet-100 text-violet-600' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   num: 'text-teal-700',   lbl: 'text-teal-600',   iconCol: 'bg-teal-100 text-teal-600' },
}

export function KpiBox({
  label,
  value,
  subtitle,
  href,
  colore = 'slate',
  icon: Icon,
}: {
  label:     string
  value:     string | number
  subtitle?: string                 // testo piccolo sotto il numero (es. "% conversione")
  href?:     string                  // se presente, l'intero box diventa cliccabile
  colore?:   Colore
  icon?:     ElementType
}) {
  const c = PALETTE[colore]

  // Contenuto interno (uguale per box statico e box-link)
  const inner = (
    <>
      {Icon && (
        <div className={`mb-3 inline-flex rounded-2xl p-3 ${c.iconCol}`}>
          <Icon size={20} />
        </div>
      )}
      <p className={`text-sm font-medium ${c.lbl}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${c.num}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </>
  )

  const baseClass = `rounded-3xl border ${c.bg} ${c.border} p-5 shadow-sm`

  // Box cliccabile: aggiunge effetto hover
  if (href) {
    return (
      <a
        href={href}
        className={`block ${baseClass} transition hover:shadow-md hover:-translate-y-0.5`}
      >
        {inner}
      </a>
    )
  }

  return <div className={baseClass}>{inner}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// BarChart: grafico a barre verticali, un valore per colonna.
// Replicato dallo stile di app/bi/page.tsx per coerenza visiva.
// ─────────────────────────────────────────────────────────────────────────────

export function BarChart({
  items,
  format,
  color = 'slate',
}: {
  items:   { label: string; value: number }[]
  format?: (v: number) => string  // come formattare il numero al hover (default: numero crudo)
  color?:  'slate' | 'indigo' | 'emerald' | 'amber' | 'sky'
}) {
  const colorBar: Record<string, string> = {
    slate:   'bg-slate-700',
    indigo:  'bg-indigo-600',
    emerald: 'bg-emerald-600',
    amber:   'bg-amber-500',
    sky:     'bg-sky-600',
  }

  // Massimo per scalare le altezze; almeno 1 per evitare divisioni per 0
  const maxV = Math.max(...items.map(i => i.value), 1)
  const BARRA_MAX_PX = 120

  return (
    <div className="flex items-end gap-1" style={{ height: `${BARRA_MAX_PX + 36}px` }}>
      {items.map((item, i) => {
        // Altezza della barra (in pixel) proporzionale al massimo; minimo 8px se > 0
        const altPx = item.value > 0
          ? Math.max(Math.round((item.value / maxV) * BARRA_MAX_PX), 8)
          : 3
        const isZero = item.value === 0

        return (
          <div
            key={i}
            className="group flex flex-1 flex-col items-center justify-end gap-1"
            style={{ height: `${BARRA_MAX_PX + 20}px` }}
          >
            {/* Etichetta numerica visibile al hover */}
            <span
              className={`text-xs text-slate-500 ${
                item.value > 0 ? 'opacity-0 group-hover:opacity-100' : 'invisible'
              } transition-opacity`}
            >
              {format ? format(item.value) : item.value}
            </span>

            {/* Barra */}
            <div
              className={`w-full rounded-t-lg transition-all ${
                isZero ? 'bg-slate-100' : colorBar[color]
              }`}
              style={{ height: `${altPx}px` }}
            />

            {/* Etichetta mese / categoria sotto la barra */}
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OriginiList: lista di canali con barra orizzontale che mostra la percentuale.
// Usata nella tab Leads per "leads per origine".
// ─────────────────────────────────────────────────────────────────────────────

export function OriginiList({ items }: { items: { canale: string; count: number }[] }) {
  // Totale di tutti i canali (denominatore per la percentuale).
  // Almeno 1 per evitare divisioni per zero.
  const tot = items.reduce((s, i) => s + i.count, 0) || 1

  // Ordina dal canale con più lead a quello con meno
  const sorted = [...items].sort((a, b) => b.count - a.count)

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400">Nessun lead nel periodo selezionato.</p>
  }

  return (
    <ul className="space-y-3">
      {sorted.map(o => {
        const pct = Math.round((o.count / tot) * 100)
        return (
          <li key={o.canale || '__none__'} className="flex items-center gap-4">
            {/* Nome canale (limitato in larghezza) */}
            <span className="w-32 truncate text-sm text-slate-700">
              {o.canale || 'Non specificata'}
            </span>

            {/* Barra orizzontale proporzionale alla percentuale */}
            <div
              className="flex-1 overflow-hidden rounded-full bg-slate-100"
              style={{ height: 8 }}
            >
              <div className="h-full rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
            </div>

            {/* Numero assoluto + percentuale */}
            <span className="w-20 text-right text-sm text-slate-600">
              {o.count} ({pct}%)
            </span>
          </li>
        )
      })}
    </ul>
  )
}
