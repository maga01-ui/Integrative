// Form creazione nuovo utente — struttura identica alla pagina di modifica
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import BackButton from '@/components/ui/BackButton'
import { Prisma } from '@prisma/client'
import CampoPassword from '@/components/ui/CampoPassword'
import TelefonoInput from '@/components/ui/TelefonoInput'

// ── Sezioni dell'app con etichette leggibili (identico a modifica) ─────────────
// IMPORTANTE: tenere allineato con SEZIONI in [id]/modifica/page.tsx e con il
// MENU della Sidebar. Quando aggiungi una pagina nel side menu va aggiunta anche qui.
const SEZIONI = [
  { key: 'dashboard',           label: 'Dashboard' },
  { key: 'dashboard_marketing', label: 'Dashboard Marketing' },
  { key: 'leads',               label: 'Leads' },
  { key: 'pazienti',            label: 'Pazienti' },
  { key: 'calendario',          label: 'Calendario' },
  { key: 'fatture',             label: 'Fatture' },
  { key: 'profitti',            label: 'Profitti' },
  { key: 'bi',                  label: 'Business Intelligence' },
  { key: 'impostazioni',        label: 'Impostazioni' },
  { key: 'chat',                label: 'Assistente AI' },
]

// ── Helper: prima lettera maiuscola ───────────────────────────────────────────
function capitalizza(val: string | null | undefined): string | null {
  if (!val) return null
  return val.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Server Action: crea l'utente e i permessi di default ─────────────────────
async function creaUtente(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const password     = formData.get('password') as string
  const passwordHash = await bcrypt.hash(password, 10)
  const studioIdForm = (formData.get('studioId') as string) || null

  let nuovoId: string

  try {
    const nuovo = await prisma.utente.create({
      data: {
        studioId:      studioIdForm,
        nome:          capitalizza(formData.get('nome') as string) ?? '',
        cognome:       capitalizza(formData.get('cognome') as string) ?? '',
        email:         (formData.get('email') as string).trim().toLowerCase(),
        passwordHash,
        ruolo:         formData.get('ruolo') as never,
        telefono:      (formData.get('telefono') as string) || null,
        emailContatto: (formData.get('emailContatto') as string)?.trim().toLowerCase() || null,
        partitaIva:    (formData.get('partitaIva') as string) || null,
        indirizzo:     (formData.get('indirizzo') as string) || null,
        colore:        (formData.get('colore') as string) || '#6366f1',
        attivo:        formData.get('attivo') !== 'false',
      },
    })
    nuovoId = nuovo.id
  } catch (e) {
    // Errore P2002 = violazione unique constraint (email già in uso)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      redirect('/impostazioni/utenti/nuovo?errore=email')
    }
    throw e
  }

  // Salva i permessi per ogni sezione
  await Promise.all(
    SEZIONI.map(s => {
      const livello = (formData.get(`perm_${s.key}`) as string) || 'NONE'
      return prisma.permesso.create({
        data: { utenteId: nuovoId, sezione: s.key, livello: livello as never },
      })
    })
  )

  redirect('/impostazioni#utenti')
}

// ── Pagina ────────────────────────────────────────────────────────────────────
export default async function NuovoUtentePage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { errore } = await searchParams

  // Carica tutti gli studi attivi per il selettore
  const studi = await prisma.studio.findMany({
    where:   { attivo: true },
    select:  { id: true, nome: true, citta: true },
    orderBy: { nome: 'asc' },
  })

  return (
    <div className="space-y-8">

      {/* Intestazione */}
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo utente</h1>
      </div>

      {/* Banner errore email duplicata */}
      {errore === 'email' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Questa email è già in uso. Scegli un indirizzo diverso o{' '}
          <a href="/impostazioni" className="font-medium underline">cerca l&apos;utente esistente</a>.
        </div>
      )}

      {/* ── Form dati anagrafici ── */}
      <form action={creaUtente} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dati operatore</p>

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Nome *"    name="nome"    required />
          <Campo label="Cognome *" name="cognome" required />
        </div>

        {/* Email con evidenziazione errore */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Email *</label>
          <input
            type="email"
            name="email"
            required
            className={errore === 'email' ? clsError : cls}
          />
          {errore === 'email' && (
            <p className="mt-1 text-xs text-red-600">Email già registrata nel sistema.</p>
          )}
        </div>

        <CampoPassword label="Password *" name="password" required placeholder="Minimo 8 caratteri" />

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Ruolo *</label>
            <select name="ruolo" required className={cls}>
              <option value="">Seleziona…</option>
              {['MARKETING', 'MEDICO', 'STAFF', 'SUPERADMIN'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <TelefonoInput label="Telefono" name="telefono" />
        </div>

        {/* Studio principale */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Studio principale</label>
          <select name="studioId" className={cls}>
            <option value="">— Nessuno —</option>
            {studi.map(s => (
              <option key={s.id} value={s.id}>
                {s.nome}{s.citta ? ` — ${s.citta}` : ''}
              </option>
            ))}
          </select>
        </div>

        <Campo label="Email contatto" name="emailContatto" type="email" />

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Partita IVA" name="partitaIva" />
          <Campo label="Indirizzo"   name="indirizzo" />
        </div>

        {/* Colore identificativo nel calendario */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="color"
              name="colore"
              defaultValue="#6366f1"
              className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-1"
            />
            <span className="text-xs text-slate-400">
              Colore identificativo nel calendario
            </span>
          </div>
        </div>

        {/* Stato account */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Stato account</label>
          <select name="attivo" defaultValue="true" className={cls}>
            <option value="true">Attivo</option>
            <option value="false">Disattivato</option>
          </select>
        </div>

        {/* ── Sezione permessi inline ── */}
        <div className="border-t border-slate-100 pt-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Permessi di accesso
          </p>
          <p className="mb-4 text-sm text-slate-500">
            Definisci cosa può vedere e modificare questo operatore.
          </p>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">Sezione</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Nessun accesso</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Solo lettura</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Lettura e scrittura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SEZIONI.map(s => (
                  <tr key={s.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.label}</td>
                    {(['NONE', 'READ', 'WRITE'] as const).map(v => (
                      <td key={v} className="px-4 py-3 text-center">
                        <input
                          type="radio"
                          name={`perm_${s.key}`}
                          value={v}
                          defaultChecked={v === 'NONE'}
                          className="h-4 w-4 accent-brand cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a
            href="/impostazioni"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </a>
          <button
            type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover"
          >
            Crea utente
          </button>
        </div>
      </form>

    </div>
  )
}

// ── Stili condivisi ───────────────────────────────────────────────────────────
const cls      = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'
const clsError = 'mt-1.5 w-full rounded-2xl border border-red-400 bg-red-50 px-4 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100'

function Campo({
  label, name, type = 'text', required = false, placeholder = '',
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} placeholder={placeholder} className={cls} />
    </div>
  )
}
