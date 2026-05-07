/**
 * API Route: POST /api/chat
 *
 * Riceve la cronologia dei messaggi dal client e restituisce
 * la risposta di Claude in streaming (Server-Sent Events).
 *
 * Il modello è configurato come assistente specializzato per
 * studi medici: può aiutare con pazienti, appuntamenti, fatturazione, ecc.
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

// Messaggio di sistema: descrive il ruolo dell'assistente
const SYSTEM_PROMPT = `Sei un assistente AI integrato nel gestionale "Integrative Suite" per studi medici.
Il tuo compito è supportare il personale dello studio con:
- Gestione dei pazienti e delle loro informazioni
- Organizzazione degli appuntamenti e del calendario
- Fatturazione e aspetti amministrativi
- Analisi e report sui dati dello studio
- Consigli su workflow e best practice per studi medici

Rispondi sempre in italiano, con tono professionale ma cordiale.
Sii conciso e pratico. Se non conosci la risposta, dillo chiaramente.
Non inventare informazioni cliniche o legali specifiche.`

// Tipo per i messaggi che arrivano dal client
interface Messaggio {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  // Legge la cronologia messaggi dal body della richiesta
  let messaggi: Messaggio[]
  try {
    const body = await request.json()
    messaggi = body.messaggi
    if (!Array.isArray(messaggi) || messaggi.length === 0) {
      return new Response('Parametro "messaggi" mancante o vuoto', { status: 400 })
    }
  } catch {
    return new Response('JSON non valido', { status: 400 })
  }

  // Controlla che la chiave API sia configurata
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your-anthropic-api-key') {
    return new Response(
      'Chiave API Anthropic non configurata. Aggiorna ANTHROPIC_API_KEY in .env.local',
      { status: 503 }
    )
  }

  const client = new Anthropic({ apiKey })

  // Crea uno stream leggibile da inviare al browser
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Usa lo streaming di Claude per rispondere in tempo reale
        const claudeStream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          thinking: { type: 'adaptive' }, // Claude decide quando e quanto ragionare
          system: SYSTEM_PROMPT,
          messages: messaggi, // invia tutta la cronologia
        })

        // Invia i chunk di testo man mano che arrivano
        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            // Codifica il testo come bytes e lo invia al client
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        // In caso di errore, invia un messaggio di errore nel flusso
        const msg = err instanceof Error ? err.message : 'Errore sconosciuto'
        controller.enqueue(encoder.encode(`\n\n[Errore: ${msg}]`))
      } finally {
        // Chiude lo stream quando Claude ha finito
        controller.close()
      }
    },
  })

  // Risponde con uno stream di testo (non JSON)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Disabilita il buffering su Nginx/proxy intermedi
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}
