// Configurazione NextAuth per autenticazione locale con email + password
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from './prisma'

// Helpers di navigazione (usati nelle pagine protette)
export function requireAuth(isAuthenticated: boolean) {
  if (!isAuthenticated) redirect('/login')
}

export function redirectToLogin() {
  redirect('/login')
}

// Configurazione NextAuth esportata sia per l'API route che per getServerSession()
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credenziali',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' }
      },

      // Funzione chiamata al login: verifica email e password nel database
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Cerca l'utente per email
        const utente = await prisma.utente.findUnique({
          where: { email: credentials.email }
        })

        // Utente non trovato, disattivato o senza password impostata
        if (!utente || !utente.attivo) return null

        const hash = (utente as unknown as { passwordHash?: string | null }).passwordHash
        if (!hash) return null

        // Confronta la password inserita con l'hash salvato nel DB
        const valida = await bcrypt.compare(credentials.password, hash)
        if (!valida) return null

        // Aggiorna la data e ora dell'ultimo accesso
        // Avvolto in try/catch: se il client Prisma non è ancora aggiornato non blocca il login
        try {
          await prisma.utente.update({
            where: { id: utente.id },
            data: { ultimoAccesso: new Date() }
          })
        } catch {
          // Ignorato: il login procede comunque
        }

        // Restituisce i dati che NextAuth metterà nel token JWT
        return { id: utente.id, email: utente.email, name: `${utente.nome} ${utente.cognome}` }
      }
    })
  ],

  // Usa JWT — nessuna tabella di sessioni nel database necessaria
  session: { strategy: 'jwt' },

  // Pagina di login personalizzata
  pages: { signIn: '/login' },

  callbacks: {
    // Salva l'id utente nel token JWT
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    // Espone l'id utente nella sessione lato client/server
    session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string
      return session
    }
  }
}
