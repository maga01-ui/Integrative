'use client'
// Menu a tendina per filtrare gli utenti per centro — si aggiorna al cambio selezione

import { useRouter } from 'next/navigation'

export default function FiltroUtenti({
  studi,
  centroIdAttivo,
}: {
  studi:         { id: string; nome: string }[]
  centroIdAttivo: string | undefined
}) {
  const router = useRouter()

  return (
    <select
      value={centroIdAttivo ?? ''}
      onChange={e => {
        const val = e.target.value
        router.push(val ? `/impostazioni?centroId=${val}#utenti` : '/impostazioni#utenti')
      }}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400"
    >
      <option value="">Tutti i centri</option>
      {studi.map(s => (
        <option key={s.id} value={s.id}>{s.nome}</option>
      ))}
    </select>
  )
}
