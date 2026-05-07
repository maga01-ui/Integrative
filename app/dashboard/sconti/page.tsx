// Pagina dettaglio sconti del mese
import { redirect } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'

export default async function ScontiPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string; anno?: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { mese: meseS, anno: annoS } = await searchParams
  const oggi  = new Date()
  const anno  = annoS ? Number(annoS)  : oggi.getFullYear()
  const mese  = meseS ? Number(meseS)  : oggi.getMonth()   // 0-based

  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}

  const inizioMese = new Date(anno, mese, 1)
  const fineMese   = new Date(anno, mese + 1, 1)

  // Recupera tutti gli appuntamenti completati del mese con prezzi
  const appuntamenti = await prisma.appuntamento.findMany({
    where: {
      ...ws,
      stato: 'COMPLETATO',
      inizio: { gte: inizioMese, lt: fineMese },
    },
    select: {
      id:             true,
      inizio:         true,
      tipoPrestazione: true,
      prezzoBase:     true,
      prezzoApplicato: true,
      paziente: { select: { id: true, nome: true, cognome: true } },
      medico:   { select: { nome: true, cognome: true } },
    },
    orderBy: { inizio: 'asc' },
  })

  // Filtra solo quelli con sconto reale
  const sconti = appuntamenti.filter(
    a => Number(a.prezzoApplicato) < Number(a.prezzoBase)
  )

  const totaleSconto  = sconti.reduce((s, a) => s + (Number(a.prezzoBase) - Number(a.prezzoApplicato)), 0)
  const totaleBase    = sconti.reduce((s, a) => s + Number(a.prezzoBase),    0)
  const totaleApplica = sconti.reduce((s, a) => s + Number(a.prezzoApplicato), 0)

  function fmt(n: number) {
    return `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Navigazione mese precedente / successivo
  const mesePrecAnno  = mese === 0  ? anno - 1 : anno
  const mesePrecMese  = mese === 0  ? 11        : mese - 1
  const meseSuccAnno  = mese === 11 ? anno + 1 : anno
  const meseSuccMese  = mese === 11 ? 0         : mese + 1

  const mesiLabels = [
    'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
  ]

  return (
    <div className="space-y-6">

      {/* Intestazione */}
      <div className="flex items-center gap-4">
        <a href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft size={16} />
          Dashboard
        </a>
        <h1 className="text-3xl font-semibold text-slate-600">Sconti del mese</h1>
      </div>

      {/* Navigazione mese */}
      <div className="flex items-center gap-3">
        <a
          href={`/dashboard/sconti?anno=${mesePrecAnno}&mese=${mesePrecMese}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          ← {mesiLabels[mesePrecMese]}
        </a>
        <span className="text-lg font-semibold text-slate-700">
          {mesiLabels[mese]} {anno}
        </span>
        <a
          href={`/dashboard/sconti?anno=${meseSuccAnno}&mese=${meseSuccMese}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          {mesiLabels[meseSuccMese]} →
        </a>
      </div>

      {/* Riepilogo totale */}
      {sconti.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sconti effettuati</p>
            <p className="mt-1 text-2xl font-semibold text-slate-700">{sconti.length}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Totale sconto</p>
            <p className="mt-1 text-2xl font-semibold text-rose-600">{fmt(totaleSconto)}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Incasso effettivo vs atteso</p>
            <p className="mt-1 text-lg font-semibold text-slate-700">
              {fmt(totaleApplica)} <span className="text-sm text-slate-400">/ {fmt(totaleBase)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Tabella sconti */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {sconti.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nessuno sconto effettuato in {mesiLabels[mese]} {anno}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Paziente</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Operatore</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Prestazione</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Prezzo base</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Applicato</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Sconto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sconti.map(a => {
                  const sconto = Number(a.prezzoBase) - Number(a.prezzoApplicato)
                  const pctSconto = Math.round((sconto / Number(a.prezzoBase)) * 100)
                  const operatore = a.medico
                    ? `${a.medico.nome} ${a.medico.cognome ?? ''}`.trim()
                    : '—'
                  const pazNome = `${a.paziente.cognome ?? ''} ${a.paziente.nome}`.trim()
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {a.inizio.toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/pazienti/${a.paziente.id}`}
                          className="font-medium text-slate-800 hover:underline"
                        >
                          {pazNome}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{operatore}</td>
                      <td className="px-4 py-3 text-slate-600">{a.tipoPrestazione}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmt(Number(a.prezzoBase))}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {fmt(Number(a.prezzoApplicato))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-rose-600">{fmt(sconto)}</span>
                        <span className="ml-1.5 text-xs text-slate-400">−{pctSconto}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Riga totale */}
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-slate-700">
                    Totale ({sconti.length} sconti)
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-500">{fmt(totaleBase)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(totaleApplica)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-600">{fmt(totaleSconto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
