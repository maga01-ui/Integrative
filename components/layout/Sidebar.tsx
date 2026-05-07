import {
  BarChart2,
  BarChart3,
  BotMessageSquare,
  Calendar,
  FileText,
  LayoutGrid,
  Settings,
  TrendingUp,
  User,
  Users
} from 'lucide-react'
import NavItem from './NavItem'
import LogoutButton from './LogoutButton'
import type { PermessiRecord } from '@/types'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MENU = [
  { href: '/dashboard',           label: 'Dashboard',      sezione: 'dashboard',           icon: LayoutGrid    },
  // Dashboard Marketing ha un permesso dedicato ("dashboard_marketing"),
  // così può essere abilitata/disabilitata in modo indipendente dalla Dashboard standard.
  { href: '/dashboard/marketing', label: 'Dashboard Mktg', sezione: 'dashboard_marketing', icon: BarChart3     },
  { href: '/leads',               label: 'Leads',          sezione: 'leads',         icon: Users         },
  { href: '/pazienti',      label: 'Pazienti',       sezione: 'pazienti',      icon: User          },
  { href: '/calendario',    label: 'Calendario',     sezione: 'calendario',    icon: Calendar      },
  { href: '/fatture',       label: 'Fatture',        sezione: 'fatture',       icon: FileText      },
  { href: '/profitti',      label: 'Compensi',       sezione: 'profitti',      icon: TrendingUp    },
  { href: '/bi',            label: 'Business intel.', sezione: 'bi',           icon: BarChart2     },
  { href: '/impostazioni',  label: 'Impostazioni',   sezione: 'impostazioni',  icon: Settings      },
  { href: '/chat',          label: 'Assistente AI',  sezione: 'chat',          icon: BotMessageSquare },
]

export default async function Sidebar({ permessi }: { permessi: PermessiRecord }) {
  // Recupera lo studio dell'utente connesso per filtrare i pazienti
  let alertPazienti = 0
  try {
    const session = await getServerSession(authOptions)
    const userId  = (session?.user as { id?: string })?.id
    if (userId) {
      const utente = await prisma.utente.findUnique({
        where:  { id: userId },
        select: { studioId: true },
      })
      const ws  = utente?.studioId ? { studioId: utente.studioId } : {}
      const now = new Date()

      // Pazienti con almeno un appuntamento DA_RIPROGRAMMARE
      const nDaRiprogrammare = await prisma.paziente.count({
        where: { ...ws, appuntamenti: { some: { stato: 'DA_RIPROGRAMMARE' } } },
      })

      // Pazienti attivi senza appuntamenti futuri non cancellati.
      // "Attivo" = ha programma attivo, fito attiva, o bioscan non ancora refertato.
      // Esclusi quelli già contati in nDaRiprogrammare per evitare doppi.
      const nSenzaApp = await prisma.paziente.count({
        where: {
          ...ws,
          appuntamenti: { none: { stato: 'DA_RIPROGRAMMARE' } },  // no doppio conteggio
          OR: [
            { assegnamenti: { some: { stato: { in: ['ATTIVO', 'SOSPESO'] } } } },
            { prescrizioni: { some: { stato: 'ATTIVA' } } },
            { bioscan:      { some: { refertoConsegnato: false } } },
          ],
          // Nessun appuntamento futuro non cancellato
          AND: [
            { appuntamenti: { none: { stato: { notIn: ['CANCELLATO'] }, inizio: { gte: now } } } },
          ],
        },
      })

      alertPazienti = nDaRiprogrammare + nSenzaApp
    }
  } catch {
    // In caso di errore (es. DB non raggiungibile) non mostrare il badge
  }

  return (
    <aside className="flex min-h-screen w-[280px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-8 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Integrative" className="mx-auto block" />
      </div>
      <nav className="space-y-1">
        {/* Mostra solo le voci con permesso esplicito diverso da 'NONE'.
            Se la chiave non è in DB (es. nuova pagina aggiunta dopo che l'utente
            era già stato creato) la trattiamo come 'NONE' → voce nascosta. */}
        {MENU.filter((item) => (permessi[item.sezione] ?? 'NONE') !== 'NONE').map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badge={item.sezione === 'pazienti' ? alertPazienti : undefined}
          />
        ))}
      </nav>

      {/* Bottone logout in fondo alla sidebar */}
      <div className="mt-auto pt-6 border-t border-slate-100">
        <LogoutButton />
      </div>
    </aside>
  )
}
