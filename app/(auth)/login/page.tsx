'use client'

// Pagina di login: email + password, usa NextAuth credentials provider
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [loading, setLoading] = useState(false)
  const [pwVisibile, setPwVisibile] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrore('')

    // Chiama NextAuth con le credenziali inserite (non reindirizza automaticamente)
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false
    })

    if (result?.error) {
      setErrore('Email o password non corretti.')
    } else {
      // Navigazione "hard" verso la dashboard: forza una nuova richiesta HTTP al server
      // così il layout (Server Component) viene ri-renderizzato con la sessione appena creata.
      // router.push() è client-side e usa la cache del layout senza sessione.
      window.location.href = '/dashboard'
    }

    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-semibold text-slate-600">Accedi</h1>
      <p className="mt-2 text-slate-600">Inserisci email e password per entrare nel gestionale.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="nome@studio.it"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <div className="relative mt-2">
            <input
              type={pwVisibile ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 pr-11 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setPwVisibile(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              tabIndex={-1}
              aria-label={pwVisibile ? 'Nascondi password' : 'Mostra password'}
            >
              {pwVisibile ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full justify-center rounded-full bg-brand px-4 py-3 font-semibold text-slate-800 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>

        {errore && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errore}
          </p>
        )}
      </form>
    </div>
  )
}
