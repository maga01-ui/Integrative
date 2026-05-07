// Dashboard Mktg — pagina unica con due sezioni:
//   1) Pazienti  — 4 box (nuovi del mese + 3 alert)
//   2) Leads     — funnel di conversione + grafico mensile + ripartizione origini
//
// Ogni sezione è un Server Component indipendente che esegue le proprie query.

import { redirect } from 'next/navigation'
import { getTenantContext, primaPaginaAccessibile } from '@/lib/tenant'
import LeadsTab    from './LeadsTab'
import PazientiTab from './PazientiTab'

export default async function DashboardMarketingPage() {
  // Verifica autenticazione → redirect al login se non loggato
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  // Se l'utente non ha il permesso "dashboard_marketing", lo dirottiamo alla
  // prima pagina a cui ha accesso (es. /dashboard se ha solo quello).
  if ((ctx.permessi.dashboard_marketing ?? 'NONE') === 'NONE') {
    const dest = primaPaginaAccessibile(ctx.permessi)
    redirect(dest ?? '/login')
  }

  return (
    <div className="space-y-8">

      {/* ── Intestazione ─────────────────────────────────────────────────── */}
      <h1 className="text-3xl font-semibold text-slate-600">Dashboard Mktg</h1>

      {/* ── Sezione Pazienti ─────────────────────────────────────────────── */}
      <PazientiTab studioId={ctx.studioId} />

      {/* ── Sezione Leads ────────────────────────────────────────────────── */}
      <LeadsTab studioId={ctx.studioId} />

    </div>
  )
}
