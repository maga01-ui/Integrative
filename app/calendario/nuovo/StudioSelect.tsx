'use client'
// Selettore studio interattivo: quando si cambia studio, ricarica la pagina
// con il nuovo studioId come parametro URL, così operatori, sale e team si aggiornano.
// Usa window.location.href per forzare un reload completo del server component
// (router.push usa la cache e potrebbe non ricaricare team/sale del nuovo studio).

interface Studio {
  id: string
  nome: string
  citta?: string | null
}

export default function StudioSelect({
  studi,
  selectedId,
  leadId,
  className,
}: {
  studi: Studio[]
  selectedId: string
  leadId?: string
  className?: string
}) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams()
    params.set('studioId', e.target.value)
    if (leadId) params.set('leadId', leadId)
    window.location.href = `/calendario/nuovo?${params.toString()}`
  }

  return (
    <select
      name="studioId"
      defaultValue={selectedId}
      onChange={handleChange}
      className={className}
    >
      {studi.map(s => (
        <option key={s.id} value={s.id}>
          {s.nome}{s.citta ? ` — ${s.citta}` : ''}
        </option>
      ))}
    </select>
  )
}
