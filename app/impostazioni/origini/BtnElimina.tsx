'use client'
// Pulsante elimina con conferma — client component necessario per usare confirm()

export default function BtnElimina({ action, nome }: {
  action: () => Promise<void>
  nome:   string
}) {
  return (
    <form action={action} onSubmit={e => {
      if (!confirm(`Eliminare "${nome}"?`)) e.preventDefault()
    }}>
      <button
        type="submit"
        className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-500 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
      >
        Elimina
      </button>
    </form>
  )
}
