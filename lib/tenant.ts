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

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE DI VISIBILITÀ PER MANAGER DEL TEAM
//
// Regole applicate nelle pagine "economiche" (dashboard di dettaglio e BI):
//   • SUPERADMIN      → vede tutti i dati (nessun filtro di team)
//   • Manager di team → vede SOLO i dati dei team in cui è marcato come
//                       isManager=true (sui campi/relazioni teamId)
//   • Altri utenti    → nessun filtro extra (il filtro per studioId resta
//                       comunque attivo: ognuno vede solo il proprio studio)
//
// Gli helper qui sotto restituiscono direttamente i frammenti di "where"
// Prisma da fondere (...spread) nelle query.
// ─────────────────────────────────────────────────────────────────────────────

// Tipo "leggero" del contesto: prendo solo i campi che servono allo scope,
// così questi helper non dipendono dall'intera struttura di getTenantContext.
type ScopeCtx = {
  ruolo: string
  teams: Array<{ teamId: string; isManager: boolean }>
}

// True quando l'utente deve essere limitato ai soli team che gestisce.
// In pratica: non è SUPERADMIN ed è isManager di almeno un team.
export function isScopeTeamManager(ctx: ScopeCtx): boolean {
  if (ctx.ruolo === 'SUPERADMIN') return false
  return ctx.teams.some(t => t.isManager)
}

// Lista degli ID dei team gestiti dall'utente come manager.
export function managedTeamIds(ctx: ScopeCtx): string[] {
  return ctx.teams.filter(t => t.isManager).map(t => t.teamId)
}

// ── Implementazione interna ────────────────────────────────────────────────
//
// Paziente.teamId è un campo nuovo. Per evitare di dipendere dalla
// rigenerazione del client Prisma (che richiede stop del dev server),
// recuperiamo gli ID dei pazienti del team via SQL raw. Le where clause
// poi filtrano sulla foreign key `pazienteId` che è già nel client.
//
// Pre-calcoliamo la lista una sola volta per ctx, in una mappa weak —
// così pagine che chiamano più helper non ripetono la query.
const cachePazienteIds = new WeakMap<ScopeCtx, Promise<string[]>>()

async function pazienteIdsDelManager(ctx: ScopeCtx): Promise<string[]> {
  // Cache per-ctx: la stessa istanza di ctx riusa la promise
  const giaPresente = cachePazienteIds.get(ctx)
  if (giaPresente) return giaPresente

  const p = (async () => {
    const teamIds = managedTeamIds(ctx)
    if (teamIds.length === 0) return [] as string[]
    // Costruisco un placeholder $1,$2,… per ogni id e li passo come parametri
    // Uso il modulo Prisma per costruire una query parametrizzata sicura
    const placeholders = teamIds.map((_, i) => `$${i + 1}`).join(',')
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Paziente" WHERE "teamId" IN (${placeholders})`,
      ...teamIds,
    )
    return rows.map(r => r.id)
  })()

  cachePazienteIds.set(ctx, p)
  return p
}

// Where clause Prisma per filtrare Appuntamento per il manager di team.
// Filtra per pazienteId nei pazienti dei team gestiti.
//
// Esempio d'uso:
//   const wsApp = await teamScopeAppuntamento(ctx)
//   prisma.appuntamento.findMany({ where: { ...ws, ...wsApp } })
export async function teamScopeAppuntamento(ctx: ScopeCtx) {
  if (!isScopeTeamManager(ctx)) return {}
  const ids = await pazienteIdsDelManager(ctx)
  return { pazienteId: { in: ids } }
}

// Where clause Prisma per filtrare Fattura: solo fatture di pazienti del team.
export async function teamScopeFattura(ctx: ScopeCtx) {
  if (!isScopeTeamManager(ctx)) return {}
  const ids = await pazienteIdsDelManager(ctx)
  return { pazienteId: { in: ids } }
}

// Where clause Prisma per filtrare Paziente: solo pazienti del team.
// (Filtra per ID diretto del paziente.)
export async function teamScopePaziente(ctx: ScopeCtx) {
  if (!isScopeTeamManager(ctx)) return {}
  const ids = await pazienteIdsDelManager(ctx)
  return { id: { in: ids } }
}

// Where clause Prisma per filtrare PrescrizioneFito: prescrizioni di
// pazienti del team del manager.
export async function teamScopePrescrizioneFito(ctx: ScopeCtx) {
  if (!isScopeTeamManager(ctx)) return {}
  const ids = await pazienteIdsDelManager(ctx)
  return { pazienteId: { in: ids } }
}
