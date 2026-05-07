'use client'
// Form wrapper che, al termine della server action, scrolla automaticamente in cima alla pagina.
// Usa useTransition: quando isPending passa da true a false la navigazione è conclusa.

import { useTransition, useEffect, useRef } from 'react'

interface Props {
  action:    (formData: FormData) => Promise<void>
  children:  React.ReactNode
  className?: string
}

export default function FormConScroll({ action, children, className }: Props) {
  const [isPending, startTransition] = useTransition()
  const inCorso = useRef(false)

  // Quando la transizione finisce (isPending: true → false) scrolla in cima
  useEffect(() => {
    if (inCorso.current && !isPending) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      inCorso.current = false
    }
  }, [isPending])

  return (
    <form
      className={className}
      action={(formData: FormData) => {
        inCorso.current = true
        startTransition(() => action(formData))
      }}
    >
      {children}
    </form>
  )
}
