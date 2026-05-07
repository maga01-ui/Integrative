// Route handler che espone tutti gli endpoint NextAuth (login, logout, sessione, ecc.)
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
