import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  href:   string
  label:  string
  icon:   LucideIcon
  badge?: number   // se > 0 mostra pallino rosso con numero
}

export default function NavItem({ href, label, icon: Icon, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}
