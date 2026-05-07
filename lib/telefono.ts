// Utility per la formattazione dei numeri di telefono

// Prefissi riconosciuti (ordinati dal più lungo per evitare match parziali)
const PREFISSI = [
  '+380', '+351',
  '+39', '+41', '+43', '+33', '+49', '+44', '+34', '+32', '+31',
  '+48', '+40', '+30', '+55', '+52', '+86', '+81',
  '+1',
]

/**
 * Formatta un numero di telefono salvato nel DB nel formato leggibile:
 *   "+393331234567" → "+39 333.1234567"
 * Se non riconosce un prefisso, restituisce il valore originale.
 */
export function formatTelefono(tel: string | null | undefined): string {
  if (!tel) return ''

  // Trova il prefisso più lungo che corrisponde
  const prefix = PREFISSI.find(p => tel.startsWith(p))
  if (!prefix) return tel

  const numero = tel.slice(prefix.length).replace(/^\s+/, '')

  // Inserisce un punto dopo i primi 3 cifre del numero
  const formatted = numero.length > 3
    ? `${numero.slice(0, 3)}.${numero.slice(3)}`
    : numero

  return `${prefix} ${formatted}`
}
