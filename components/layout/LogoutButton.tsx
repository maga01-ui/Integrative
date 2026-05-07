'use client'
// Bottone logout — deve essere un Client Component perché usa signOut di NextAuth
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
    >
      <LogOut size={18} />
      Esci
    </button>
  )
}
