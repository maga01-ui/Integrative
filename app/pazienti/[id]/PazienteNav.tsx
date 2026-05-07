'use client'
// Menu secondario della scheda paziente — evidenzia la sezione attiva
import { usePathname } from 'next/navigation'

interface Sezione {
  id:    string
  label: string
}

interface Props {
  pazienteId:   string
  sezioni:      Sezione[]
  haContenuto:  Record<string, boolean>
  sezioniAlert?: string[]  // sezioni con badge arancione (es. ricevute da emettere)
}

export default function PazienteNav({ pazienteId, sezioni, haContenuto, sezioniAlert = [] }: Props) {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-20 -mx-6 mb-6 border-b border-slate-200 bg-white shadow-sm px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {sezioni.map(sezione => {
          const href     = `/pazienti/${pazienteId}/${sezione.id}`
          const attiva   = pathname === href || pathname.startsWith(href + '/')
          const hasData  = haContenuto[sezione.id]
          const hasAlert = sezioniAlert.includes(sezione.id)

          let cls: string
          if (attiva && hasAlert) {
            cls = 'rounded-full border border-red-500 bg-red-500 px-4 py-2 text-sm font-semibold text-white transition'
          } else if (attiva) {
            cls = 'rounded-full border border-[#2cb88e] bg-[#2cb88e] px-4 py-2 text-sm font-semibold text-white transition'
          } else if (hasAlert) {
            cls = 'rounded-full border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200'
          } else if (hasData) {
            cls = 'rounded-full border border-[#5ADCB4]/60 bg-[#5ADCB4]/20 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#5ADCB4]/30'
          } else {
            cls = 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-50'
          }

          return (
            <a key={sezione.id} href={href} className={cls}>
              {sezione.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
