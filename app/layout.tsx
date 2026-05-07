// Layout principale dell'applicazione.
// Carica i permessi reali dell'utente connesso dal database e li passa alla Sidebar.
// Se l'utente non è autenticato (es. pagina di login), la sidebar non mostra voci.

import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/layout/Sidebar'
import type { LivelloPermesso, PermessiRecord } from '@/types'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMESSI_DEFAULT } from '@/lib/permessi'

export const metadata: Metadata = {
  title: 'Integrative',
  description: 'Gestionale multi-tenant per studi medici'
}

// Tutte le sezioni del sistema (inclusa "chat" non presente in PERMESSI_DEFAULT)
const TUTTE_LE_SEZIONI = [
  'dashboard', 'leads', 'pazienti', 'calendario',
  'fatture', 'impostazioni', 'bi', 'profitti', 'chat'
] as const

// Permessi vuoti: usati quando nessun utente è autenticato
const PERMESSI_VUOTI: PermessiRecord = Object.fromEntries(
  TUTTE_LE_SEZIONI.map(s => [s, 'NONE' as LivelloPermesso])
)

// Permessi completi per SUPERADMIN (accesso totale a tutto)
const PERMESSI_SUPERADMIN: PermessiRecord = Object.fromEntries(
  TUTTE_LE_SEZIONI.map(s => [s, 'WRITE' as LivelloPermesso])
)

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Carica i permessi reali dell'utente connesso
  let permessi: PermessiRecord = PERMESSI_VUOTI

  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string })?.id

    if (userId) {
      // Carica il ruolo e i permessi personalizzati dell'utente dal DB
      const utente = await prisma.utente.findUnique({
        where: { id: userId },
        select: {
          ruolo: true,
          permessi: { select: { sezione: true, livello: true } }
        }
      })

      if (utente) {
        // Parti dal profilo base del ruolo
        const basePerRuolo: PermessiRecord =
          utente.ruolo === 'SUPERADMIN'
            ? { ...PERMESSI_SUPERADMIN }
            : {
                // Permessi vuoti come punto di partenza sicuro
                ...PERMESSI_VUOTI,
                // Permessi standard del ruolo (da lib/permessi.ts)
                ...(PERMESSI_DEFAULT as Record<string, Record<string, LivelloPermesso>>)[utente.ruolo] ?? {}
              }

        // I permessi salvati nel DB sovrascrivono i default del ruolo
        // (consentono personalizzazioni specifiche per singolo utente)
        const permessiDB: PermessiRecord = Object.fromEntries(
          utente.permessi.map(p => [p.sezione, p.livello as LivelloPermesso])
        )

        permessi = { ...basePerRuolo, ...permessiDB }
      }
    }
  } catch {
    // In caso di errore DB, nessun accesso (sicuro per default)
  }

  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900" suppressHydrationWarning>
        <div className="mx-auto flex min-h-screen max-w-[1400px] gap-4 px-4 py-6">
          <Sidebar permessi={permessi} />
          <main className="flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
