// Funzioni per ottenere il contesto dell'utente loggato (studio, ruolo, permessi)
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'

// Restituisce tutti i dati dell'utente loggato e dello studio a cui appartiene
export async function getTenantContext() {
  // Legge la sessione JWT dal cookie (lato server)
  const session = await getServerSession(authOptions)

  if (!session?.user) throw new Error('UNAUTHORIZED')

  const userId = (session.user as { id?: string }).id
  if (!userId) throw new Error('UNAUTHORIZED')

  const utente = await prisma.utente.findUnique({
    where: { id: userId },
    include: {
      permessi: true,
      teamMembri: { where: { dataFine: null } }
    }
  })

  if (!utente || !utente.attivo) throw new Error('UNAUTHORIZED')

  // SUPERADMIN e MARKETING possono accedere a tutti gli studi senza essere assegnati a uno
  const tuttiStudi = utente.ruolo === 'SUPERADMIN' || utente.ruolo === 'MARKETING'

  return {
    utenteId: utente.id,
    studioId: utente.studioId,
    ruolo: utente.ruolo,
    tuttiStudi,
    permessi: Object.fromEntries(
      utente.permessi.map((p: { sezione: string; livello: string }) => [p.sezione, p.livello])
    ),
    teams: utente.teamMembri,
    isManager: utente.teamMembri.some((t: { isManager: boolean }) => t.isManager)
  }
}

// Aggiunge il filtro per studioId alle query Prisma (usato nelle API)
export function buildStudioWhere(studioId: string | null) {
  if (!studioId) return {}
  return { studioId }
}

// Lancia un errore se l'utente non ha il permesso richiesto su una sezione
export function requirePermesso(
  permessi: Record<string, string>,
  sezione: string,
  livello: 'READ' | 'WRITE'
) {
  const p = permessi[sezione]
  if (!p || p === 'NONE') throw new Error('FORBIDDEN')
  if (livello === 'WRITE' && p !== 'WRITE') throw new Error('FORBIDDEN')
}

// ── Routing per ruolo / permessi ──────────────────────────────────────────────
// Ordine in cui scegliere la "pagina di atterraggio" dopo il login (o quando
// l'utente apre una sezione a cui non ha accesso). Deve restare allineato
// all'ordine del MENU in components/layout/Sidebar.tsx.
const ORDINE_PAGINE: Array<{ sezione: string; href: string }> = [
  { sezione: 'dashboard',           href: '/dashboard' },
  { sezione: 'dashboard_marketing', href: '/dashboard/marketing' },
  { sezione: 'leads',               href: '/leads' },
  { sezione: 'pazienti',            href: '/pazienti' },
  { sezione: 'calendario',          href: '/calendario' },
  { sezione: 'fatture',             href: '/fatture' },
  { sezione: 'profitti',            href: '/profitti' },
  { sezione: 'bi',                  href: '/bi' },
  { sezione: 'impostazioni',        href: '/impostazioni' },
  { sezione: 'chat',                href: '/chat' },
]

// Restituisce l'href della prima pagina a cui l'utente ha accesso (livello !== NONE),
// oppure null se l'utente non ha accesso a nessuna sezione.
export function primaPaginaAccessibile(permessi: Record<string, string>): string | null {
  for (const p of ORDINE_PAGINE) {
    if ((permessi[p.sezione] ?? 'NONE') !== 'NONE') return p.href
  }
  return null
}
