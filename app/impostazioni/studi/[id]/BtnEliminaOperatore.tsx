'use client'
// Pulsanti per disattivare / rimuovere un operatore da un team, con conferma.
// Sono client component perché usano confirm() del browser per evitare azioni
// accidentali.

// ── Disattiva (soft delete) ───────────────────────────────────────────────────
// Imposta la dataFine sul collaboratore: resta nel team ma marcato come
// "Disattivato", e non compare più nei form/selezioni. Si può riattivare.
export function BtnDisattivaOperatore({
  action,
  nome,
}: {
  action: () => Promise<void>
  nome:   string
}) {
  return (
    <form
      action={action}
      onSubmit={e => {
        if (!confirm(`Disattivare "${nome}" dal team?\n\nResterà visibile come disattivato e potrai riattivarlo in seguito.`)) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-amber-200 px-3 py-1 text-xs font-medium text-amber-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700"
      >
        Disattiva
      </button>
    </form>
  )
}

// ── Riattiva (annulla soft delete) ────────────────────────────────────────────
// Azzera la dataFine: l'operatore torna attivo nel team.
export function BtnRiattivaOperatore({
  action,
}: {
  action: () => Promise<void>
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="rounded-full border border-green-200 px-3 py-1 text-xs font-medium text-green-600 hover:border-green-400 hover:bg-green-50 hover:text-green-700"
      >
        Riattiva
      </button>
    </form>
  )
}

// ── Rimuovi (hard delete) ─────────────────────────────────────────────────────
// Cancella DEFINITIVAMENTE il record CollaboratoreTeam: l'operatore non potrà
// essere riattivato, dovrà essere ri-aggiunto manualmente. Da usare solo se
// l'associazione è stata creata per errore.
export default function BtnEliminaOperatore({
  action,
  nome,
}: {
  action: () => Promise<void>
  nome:   string
}) {
  return (
    <form
      action={action}
      onSubmit={e => {
        if (!confirm(`Rimuovere DEFINITIVAMENTE "${nome}" dal team?\n\nQuesta azione non si può annullare.`)) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-500 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
      >
        Rimuovi
      </button>
    </form>
  )
}
