'use client'
// Pulsante di cancellazione con finestra di conferma prima di procedere.
// Usato per sospendere un programma attivo o eliminare definitivamente uno già sospeso.

interface Props {
  action: () => Promise<void>
  label?: string
  confirmMessage?: string
}

export default function CancellaButton({
  action,
  label = 'Cancella programma',
  confirmMessage = 'Attenzione: cancellando il programma verranno eliminati tutti i prossimi appuntamenti non ancora effettuati. Continuare?',
}: Props) {
  return (
    <form action={action}>
      <button
        type="submit"
        onClick={e => {
          if (!confirm(confirmMessage)) e.preventDefault()
        }}
        className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
      >
        {label}
      </button>
    </form>
  )
}
