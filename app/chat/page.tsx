/**
 * Pagina Chat AI — /chat
 *
 * Interfaccia di chat con l'assistente AI Claude.
 * I messaggi vengono inviati all'API route /api/chat
 * che risponde in streaming per un'esperienza fluida.
 *
 * È un Client Component perché usa stato React e eventi browser.
 */

'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { SendHorizontal, Bot, User, Loader2, Trash2 } from 'lucide-react'

// Struttura di un singolo messaggio nella chat
interface Messaggio {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  // Lista dei messaggi nella conversazione
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])

  // Testo che l'utente sta digitando
  const [input, setInput] = useState('')

  // true mentre aspettiamo la risposta di Claude
  const [caricamento, setCaricamento] = useState(false)

  // Ref per scorrere automaticamente in fondo alla chat
  const fineChat = useRef<HTMLDivElement>(null)

  // Ref per il campo di testo, per rimettere il focus dopo l'invio
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scorri in fondo ogni volta che arriva un nuovo messaggio
  useEffect(() => {
    fineChat.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messaggi])

  // Invia il messaggio e gestisce lo streaming della risposta
  async function inviaMessaggio(e: FormEvent) {
    e.preventDefault()
    const testo = input.trim()
    if (!testo || caricamento) return

    // Aggiunge il messaggio dell'utente alla chat
    const nuoviMessaggi: Messaggio[] = [
      ...messaggi,
      { role: 'user', content: testo },
    ]
    setMessaggi(nuoviMessaggi)
    setInput('')
    setCaricamento(true)

    // Aggiunge subito un messaggio vuoto dell'assistente (verrà riempito dallo stream)
    setMessaggi((prev) => [
      ...prev,
      { role: 'assistant', content: '' },
    ])

    try {
      // Chiama l'API route che usa Claude in streaming
      const risposta = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaggi: nuoviMessaggi }),
      })

      if (!risposta.ok) {
        const errore = await risposta.text()
        throw new Error(errore)
      }

      // Legge il corpo della risposta come stream di testo
      const reader = risposta.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Stream non disponibile')

      // Legge i chunk man mano che arrivano e aggiorna l'ultimo messaggio
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        // Aggiorna il contenuto dell'ultimo messaggio (quello dell'assistente)
        setMessaggi((prev) => {
          const copia = [...prev]
          copia[copia.length - 1] = {
            role: 'assistant',
            content: copia[copia.length - 1].content + chunk,
          }
          return copia
        })
      }
    } catch (err) {
      // In caso di errore mostra il problema nell'ultimo messaggio
      const msg = err instanceof Error ? err.message : 'Errore di rete'
      setMessaggi((prev) => {
        const copia = [...prev]
        copia[copia.length - 1] = {
          role: 'assistant',
          content: `Si è verificato un errore: ${msg}`,
        }
        return copia
      })
    } finally {
      setCaricamento(false)
      // Rimetti il focus sul campo di testo
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  // Cancella tutta la conversazione
  function svuotaChat() {
    setMessaggi([])
    setInput('')
    inputRef.current?.focus()
  }

  // Gestisce Invio per inviare (Shift+Invio per andare a capo)
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      inviaMessaggio(e as unknown as FormEvent)
    }
  }

  return (
    <div className="flex h-full flex-col" style={{ minHeight: 'calc(100vh - 96px)' }}>
      {/* Intestazione */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-600">Assistente AI</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fai domande sullo studio, sui pazienti, sulla gestione e molto altro.
          </p>
        </div>
        {/* Bottone per svuotare la chat (visibile solo se ci sono messaggi) */}
        {messaggi.length > 0 && (
          <button
            onClick={svuotaChat}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} />
            Nuova chat
          </button>
        )}
      </div>

      {/* Area messaggi — cresce per riempire lo spazio disponibile */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
        {messaggi.length === 0 ? (
          // Schermata iniziale con suggerimenti
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="rounded-3xl bg-blue-50 p-5">
              <Bot size={40} className="text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-700">
                Come posso aiutarti oggi?
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Sono specializzato per supportare il tuo studio medico.
              </p>
            </div>
            {/* Suggerimenti di domande */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGERIMENTI.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Lista dei messaggi
          <div className="space-y-4">
            {messaggi.map((m, i) => (
              <BollaMissaggio key={i} messaggio={m} />
            ))}
            {/* Div invisibile per lo scroll automatico */}
            <div ref={fineChat} />
          </div>
        )}
      </div>

      {/* Campo di input in fondo */}
      <form onSubmit={inviaMessaggio} className="mt-4 flex gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Scrivi un messaggio… (Invio per inviare, Shift+Invio per andare a capo)"
          rows={2}
          disabled={caricamento}
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={caricamento || !input.trim()}
          className="flex h-[66px] w-[66px] flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {caricamento ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <SendHorizontal size={20} />
          )}
        </button>
      </form>
    </div>
  )
}

// -------------------------------------------------------
// Componente: singola bolla di messaggio
// -------------------------------------------------------
function BollaMissaggio({ messaggio }: { messaggio: Messaggio }) {
  const isUser = messaggio.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl ${
          isUser ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Testo del messaggio */}
      <div
        className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-blue-600 text-white'
            : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {/* Mostra un cursore lampeggiante se il messaggio è vuoto (Claude sta scrivendo) */}
        {messaggio.content ? (
          // Preserva le andate a capo nel testo
          <span className="whitespace-pre-wrap">{messaggio.content}</span>
        ) : (
          <span className="inline-block h-4 w-1 animate-pulse bg-current opacity-70" />
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------
// Suggerimenti mostrati nella schermata iniziale
// -------------------------------------------------------
const SUGGERIMENTI = [
  'Come posso migliorare la gestione degli appuntamenti?',
  'Quali KPI dovrei monitorare per il mio studio?',
  'Aiutami a redigere un promemoria per i pazienti',
  'Come gestire i pazienti che non si presentano?',
]
