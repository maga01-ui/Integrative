'use client'
// Bottone "← Indietro".
// Se viene passato `href`, naviga direttamente a quell'URL (hard navigation).
// Altrimenti usa la cronologia del browser (router.back).

import { useRouter } from 'next/navigation'

export default function BackButton({ href, className }: { href?: string; className?: string }) {
  const router = useRouter()

  function handleClick() {
    if (href) {
      // Hard navigation: bypassa la router cache di Next.js
      window.location.href = href
    } else {
      router.back()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className ?? 'text-sm text-slate-500 hover:text-slate-900'}
    >
      ← Indietro
    </button>
  )
}
