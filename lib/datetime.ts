// ─────────────────────────────────────────────────────────────────────────────
// Helper di gestione date/ore indipendenti dal timezone del server.
//
// PROBLEMA che risolve:
// In produzione (Google Cloud Run) il server gira in UTC, in locale gira in
// Europe/Rome. Quando il browser invia una stringa tipo "2026-05-08T14:30"
// (input HTML datetime-local, senza indicazione di fuso), JavaScript la
// interpreta come ora locale del SERVER:
//   - su Cloud Run (UTC):     14:30 viene salvata come 14:30 UTC
//                              → riletta in Italia (estate) appare alle 16:30 (+2h)
//   - in locale (Europe/Rome): 14:30 viene salvata come 12:30 UTC
//                              → riletta in Italia appare alle 14:30 (corretto)
//
// Da qui lo sfasamento di +2 ore (o +1 in inverno) segnalato dagli utenti.
//
// SOLUZIONE:
// Tutte le date/orari del gestionale rappresentano eventi nel fuso italiano
// (Europe/Rome). Convertendo SEMPRE le stringhe ricevute dai form come se
// fossero ora di Roma (gestendo automaticamente CET/CEST), il salvataggio
// risulta corretto a prescindere dal fuso del server.
//
// Nessuna libreria esterna: usiamo Intl.DateTimeFormat per ricavare l'offset
// di Europe/Rome al momento giusto (così l'ora legale viene gestita da sola).
// ─────────────────────────────────────────────────────────────────────────────

const TZ_ITALIA = 'Europe/Rome'

/**
 * Restituisce l'offset (in millisecondi) del fuso Europe/Rome rispetto a UTC
 * nel momento indicato dal Date passato.
 *
 * Esempi:
 *   - in inverno (CET): +1h →  3_600_000
 *   - in estate (CEST): +2h →  7_200_000
 *
 * Tecnica: chiediamo a Intl di formattare il Date come se fossimo a Roma,
 * ricostruiamo un timestamp UTC con quei numeri e confrontiamo con l'originale.
 * La differenza è esattamente l'offset di Roma in quell'istante.
 */
function offsetRomaMs(date: Date): number {
  const parti = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_ITALIA,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  // Costruisco una mappa { year: "2026", month: "05", ... }
  const map: Record<string, string> = {}
  for (const p of parti) map[p.type] = p.value

  // Ricostruisco lo stesso "wall time" come se fosse UTC: il delta tra questo
  // valore e il timestamp originale è proprio l'offset di Roma.
  // NB: Intl può restituire "24" come ora a mezzanotte; lo normalizziamo a 0.
  const ora = map.hour === '24' ? 0 : Number(map.hour)
  const comeUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    ora,
    Number(map.minute),
    Number(map.second),
  )

  return comeUtc - date.getTime()
}

/**
 * Converte una stringa "YYYY-MM-DDTHH:mm" (formato emesso dagli input HTML
 * datetime-local) in un oggetto Date interpretato come ORA ITALIANA, qualunque
 * sia il fuso del server.
 *
 * Esempio:
 *   parseDataOraItalia("2026-05-08T14:30")
 *   → un Date che, riletto in Europe/Rome, mostra le 14:30 dell'8 maggio 2026
 *     (cioè 12:30 UTC, perché in maggio è in vigore l'ora legale CEST = +2h)
 *
 * Lancia errore se la stringa non è nel formato atteso.
 */
export function parseDataOraItalia(input: string): Date {
  // Accetta sia "YYYY-MM-DDTHH:mm" sia "YYYY-MM-DDTHH:mm:ss"
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input)
  if (!match) {
    throw new Error(`Formato data/ora non valido: "${input}". Atteso "YYYY-MM-DDTHH:mm".`)
  }

  const [, y, mo, d, h, mi, s] = match
  const anno    = Number(y)
  const mese    = Number(mo) - 1   // i mesi in JS partono da 0
  const giorno  = Number(d)
  const ora     = Number(h)
  const minuto  = Number(mi)
  const secondo = s ? Number(s) : 0

  // Passo 1: costruisco un timestamp UTC "ingenuo" usando i numeri così come
  // arrivano dal form. È solo un'ipotesi di partenza, da correggere con
  // l'offset reale di Roma.
  const ipotesiUtc = Date.UTC(anno, mese, giorno, ora, minuto, secondo)

  // Passo 2: calcolo l'offset di Roma in quel momento (CET o CEST).
  // Sottraendolo otteniamo il vero istante UTC corrispondente alle "14:30 di Roma".
  const offset = offsetRomaMs(new Date(ipotesiUtc))

  return new Date(ipotesiUtc - offset)
}
