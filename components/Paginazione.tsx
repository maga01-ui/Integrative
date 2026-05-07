// Componente paginazione riutilizzabile — passa i searchParams esistenti e aggiunge/sostituisce "page"

interface Props {
  paginaCorrente: number
  totale:         number
  perPagina:      number
  baseUrl:        string   // es. "/leads" o "/fatture"
  queryParams?:   Record<string, string | undefined>  // altri filtri attivi da preservare
  pageParam?:     string   // nome del query param per la pagina (default: "page")
}

export default function Paginazione({ paginaCorrente, totale, perPagina, baseUrl, queryParams = {}, pageParam = 'page' }: Props) {
  const totalePagine = Math.ceil(totale / perPagina)
  if (totalePagine <= 1) return null

  function urlPagina(p: number) {
    const params = new URLSearchParams()
    Object.entries(queryParams).forEach(([k, v]) => { if (v) params.set(k, v) })
    if (p > 1) params.set(pageParam, String(p))
    else params.delete(pageParam)
    const qs = params.toString()
    return `${baseUrl}${qs ? `?${qs}` : ''}`
  }

  // Mostra al massimo 5 numeri di pagina attorno a quella corrente
  const pagine: (number | '…')[] = []
  for (let i = 1; i <= totalePagine; i++) {
    if (i === 1 || i === totalePagine || (i >= paginaCorrente - 2 && i <= paginaCorrente + 2)) {
      pagine.push(i)
    } else if (pagine[pagine.length - 1] !== '…') {
      pagine.push('…')
    }
  }

  return (
    <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
      <span>{totale} risultati · pagina {paginaCorrente} di {totalePagine}</span>
      <div className="flex items-center gap-1">
        {/* Precedente */}
        {paginaCorrente > 1 ? (
          <a href={urlPagina(paginaCorrente - 1)} className={btnCls}>‹</a>
        ) : (
          <span className={`${btnCls} pointer-events-none opacity-30`}>‹</span>
        )}

        {/* Numeri */}
        {pagine.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-300">…</span>
          ) : (
            <a key={p} href={urlPagina(p)}
              className={`${btnCls} ${p === paginaCorrente ? 'bg-brand font-semibold text-slate-900' : ''}`}>
              {p}
            </a>
          )
        )}

        {/* Successivo */}
        {paginaCorrente < totalePagine ? (
          <a href={urlPagina(paginaCorrente + 1)} className={btnCls}>›</a>
        ) : (
          <span className={`${btnCls} pointer-events-none opacity-30`}>›</span>
        )}
      </div>
    </div>
  )
}

const btnCls = 'flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition'
