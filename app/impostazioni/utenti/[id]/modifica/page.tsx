// Pagina di modifica dati utente + gestione permessi per sezione
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import BackButton from '@/components/ui/BackButton'
import CampoPassword from '@/components/ui/CampoPassword'
import TelefonoInput from '@/components/ui/TelefonoInput'

// ── Sezioni dell'app con etichette leggibili ──────────────────────────────────
// IMPORTANTE: ogni voce del side menu (components/layout/Sidebar.tsx) deve avere
// qui il suo permesso. Per gli utenti già creati il livello assente in DB viene
// trattato come 'NONE' più sotto (vedi `permessiMap[s.key] ?? 'NONE'`).
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

// ── Helper ────────────────────────────────────────────────────────────────────
function capitalizza(val: string | null | undefined): string | null {
  if (!val) return null
  return val.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Server Action: salva i dati anagrafici ────────────────────────────────────
async function modificaUtente(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const nuovaPassword = formData.get('password') as string
  const studioIdForm  = (formData.get('studioId') as string) || null

  const dati: Record<string, unknown> = {
    nome:          capitalizza(formData.get('nome') as string) ?? '',
    cognome:       capitalizza(formData.get('cognome') as string) ?? '',
    email:         (formData.get('email') as string).trim().toLowerCase(),
    ruolo:         formData.get('ruolo') as never,
    telefono:      (formData.get('telefono') as string) || null,
    emailContatto: (formData.get('emailContatto') as string)?.trim().toLowerCase() || null,
    partitaIva:    (formData.get('partitaIva') as string) || null,
    indirizzo:     (formData.get('indirizzo') as string) || null,
    colore:        (formData.get('colore') as string) || '#6366f1',
    attivo:        formData.get('attivo') === 'true',
    studioId:      studioIdForm,
  }

  if (nuovaPassword && nuovaPassword.length >= 8) {
    dati.passwordHash = await bcrypt.hash(nuovaPassword, 10)
  }

  await prisma.utente.update({ where: { id }, data: dati })
  redirect('/impostazioni#utenti')
}

// ── Server Action: salva i permessi per sezione ───────────────────────────────
async function aggiornaPermessi(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Per ogni sezione, leggi il livello dal form e fai upsert
  await Promise.all(
    SEZIONI.map(s => {
      const livello = (formData.get(`perm_${s.key}`) as string) || 'NONE'
      return prisma.permesso.upsert({
        where:  { utenteId_sezione: { utenteId: id, sezione: s.key } },
        update: { livello: livello as never },
        create: { utenteId: id, sezione: s.key, livello: livello as never },
      })
    })
  )

  redirect('/impostazioni#utenti')
}

// ── Pagina ────────────────────────────────────────────────────────────────────
export default async function ModificaUtentePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params

  // Carica utente, studi e permessi correnti in parallelo
  const [utente, studi, permessi] = await Promise.all([
    prisma.utente.findUnique({ where: { id } }),
    prisma.studio.findMany({
      where:   { attivo: true },
      select:  { id: true, nome: true, citta: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.permesso.findMany({ where: { utenteId: id } }),
  ])

  if (!utente) notFound()

  // Mappa permessi esistenti: sezione → livello
  const permessiMap: Record<string, string> = {}
  for (const p of permessi) permessiMap[p.sezione] = p.livello

  const salva             = modificaUtente.bind(null, id)
  const salvaPermessi     = aggiornaPermessi.bind(null, id)

  return (
    <div className="space-y-8">

      {/* Intestazione */}
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">
          {utente.nome} {utente.cognome}
        </h1>
      </div>

      {/* ── Form dati anagrafici ── */}
      <form action={salva} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dati operatore</p>

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Nome *"    name="nome"    required defaultValue={utente.nome} />
          <Campo label="Cognome *" name="cognome" required defaultValue={utente.cognome} />
        </div>

        <Campo label="Email *" name="email" type="email" required defaultValue={utente.email} />

        <CampoPassword
          label="Nuova password"
          name="password"
          placeholder="Lascia vuoto per non cambiare (min. 8 caratteri)"
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Ruolo *</label>
            <select name="ruolo" required defaultValue={utente.ruolo} className={cls}>
              {/* ADMIN rimosso: gestito solo a livello di sistema */}
              {['MARKETING', 'MEDICO', 'STAFF', 'SUPERADMIN'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <TelefonoInput label="Telefono" name="telefono" defaultValue={utente.telefono ?? ''} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Studio principale</label>
          <select name="studioId" defaultValue={utente.studioId ?? ''} className={cls}>
            <option value="">— Nessuno —</option>
            {studi.map(s => (
              <option key={s.id} value={s.id}>
                {s.nome}{s.citta ? ` — ${s.citta}` : ''}
              </option>
            ))}
          </select>
        </div>

        <Campo label="Email contatto" name="emailContatto" type="email" defaultValue={utente.emailContatto ?? ''} />

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Partita IVA" name="partitaIva" defaultValue={utente.partitaIva ?? ''} />
          <Campo label="Indirizzo"   name="indirizzo"  defaultValue={utente.indirizzo ?? ''} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Colore nel calendario</label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="color"
              name="colore"
              defaultValue={(utente as any).colore ?? '#6366f1'}
              className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-1"
            />
            <span className="text-xs text-slate-400">
              Colore identificativo nel calendario
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Stato account</label>
          <select name="attivo" defaultValue={utente.attivo ? 'true' : 'false'} className={cls}>
            <option value="true">Attivo</option>
            <option value="false">Disattivato</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/impostazioni" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva dati
          </button>
        </div>
      </form>

      {/* ── Form permessi ── */}
      <form action={salvaPermessi} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Permessi di accesso</p>
        <p className="text-sm text-slate-500">
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
              {SEZIONI.map(s => {
                const livello = permessiMap[s.key] ?? 'NONE'
                return (
                  <tr key={s.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.label}</td>
                    {(['NONE', 'READ', 'WRITE'] as const).map(v => (
                      <td key={v} className="px-4 py-3 text-center">
                        <input
                          type="radio"
                          name={`perm_${s.key}`}
                          value={v}
                          defaultChecked={livello === v}
                          className="h-4 w-4 accent-brand cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva permessi
          </button>
        </div>
      </form>

    </div>
  )
}

// ── Stile condiviso ───────────────────────────────────────────────────────────
const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function Campo({
  label, name, type = 'text', required = false, placeholder = '', defaultValue = '',
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} placeholder={placeholder}
        defaultValue={defaultValue} className={cls} />
    </div>
  )
}
