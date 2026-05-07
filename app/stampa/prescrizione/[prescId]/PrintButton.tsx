'use client'
// Bottone stampa: chiama window.print() che permette anche il salvataggio come PDF
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-full bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 transition"
    >
      Stampa / Salva PDF
    </button>
  )
}
