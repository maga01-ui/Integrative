// Form creazione nuovo lead
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOriginiPerStudio, getOriginiTutteAttive } from '@/lib/origini'
import SelectProvincia from '@/components/ui/SelectProvincia'
import BackButton from '@/components/ui/BackButton'
import TelefonoInput from '@/components/ui/TelefonoInput'

// ── Helper: prima lettera maiuscola, resto minuscolo ──
// Es: "mario rossi" → "Mario Rossi", "ROMA" → "Roma"
function capitalizza(val: string | null): string | null {
  if (!val) return null
  return val
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Server Action: salva il lead nel database ──
async function creaLead(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Applica capitalizzazione a nome, cognome e città
  const nome    = capitalizza(formData.get('nome')    as string) ?? ''
  const cognome = capitalizza(formData.get('cognome') as string) ?? ''
  const citta   = capitalizza(formData.get('citta')   as string)
  const provincia = (formData.get('provincia') as string)?.trim().toUpperCase() || null

  const studioId = (formData.get('studioId') as string) || null

  await prisma.lead.create({
    data: {
      studioId,
      nome,
      cognome,
      telefono:      formData.get('telefono') as string,
      email:         (formData.get('email') as string) || null,
      canale:        formData.get('canale') as string,
      campagna:      (formData.get('campagna') as string) || null,
      citta,
      provincia,
      stato:         (formData.get('stato') as never) ?? 'NUOVO',
      urgente:       formData.get('urgente') === 'on',
      noteOperatore: (formData.get('noteOperatore') as string) || null,
    }
  })
  redirect('/leads')
}

// ── Pagina ──
export default async function NuovoLeadPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Carica tutti gli studi attivi per il dropdown "Assegna a"
  const studi = await prisma.studio.findMany({
    where: { attivo: true },
    select: { id: true, nome: true, citta: true },
    orderBy: { nome: 'asc' },
  })

  // Carica le origini attive (manuali + referral) tramite l'helper.
  // - SUPERADMIN: tutte le origini
  // - Altri ruoli: solo quelle del proprio studio
  const userId = (session.user as { id?: string }).id!
  const utente = await prisma.utente.findUnique({
    where:  { id: userId },
    select: { studioId: true, ruolo: true },
  })
  const origini = utente?.ruolo === 'SUPERADMIN'
    ? await getOriginiTutteAttive()
    : utente?.studioId
      ? await getOriginiPerStudio(utente.studioId)
      : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-3xl font-semibold text-slate-600">Nuovo lead</h1>
      </div>

      <form action={creaLead} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        {/* Dati anagrafici */}
        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Nome *"    name="nome"    required />
          <Campo label="Cognome *" name="cognome" required />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <TelefonoInput label="Telefono *" name="telefono" required />
          <Campo label="Email"      name="email"    type="email" />
        </div>

        {/* Provenienza */}
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Canale *</label>
            <select name="canale" required className={cls}>
              <option value="">Seleziona…</option>
              {origini.map(o => (
                <option key={o.id} value={o.nome}>{o.nome}</option>
              ))}
            </select>
          </div>
          <Campo label="Campagna" name="campagna" placeholder="es. Promo primavera" />
        </div>

        {/* Città e provincia — usate anche per auto-match dello studio */}
        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Città"     name="citta" />
          <SelectProvincia />
        </div>

        {/* Stato e studio */}
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Stato</label>
            <select name="stato" defaultValue="NUOVO" className={cls}>
              <option value="NUOVO">Nuovo</option>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="FISSATO">Fissato</option>
              <option value="IN_ATTESA_CENTRO">In attesa centro</option>
              <option value="APPUNTAMENTO">Appuntamento</option>
              <option value="NON_INTERESSATO">Non interessato</option>
            </select>
          </div>

          {/* Dropdown studi: selezione manuale, nessun auto-detect */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Assegna a (studio)</label>
            <select name="studioId" className={cls}>
              <option value="">— Nessuno —</option>
              {studi.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nome}{s.citta ? ` — ${s.citta}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Note operatore */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Note</label>
          <textarea name="noteOperatore" rows={3} placeholder="Note interne sul lead…" className={cls} />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="urgente" className="rounded" />
          Segna come urgente
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <a href="/leads"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva lead
          </button>
        </div>
      </form>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function Campo({ label, name, type = 'text', required = false, placeholder = '', maxLength }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; maxLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} placeholder={placeholder}
        maxLength={maxLength} className={cls} />
    </div>
  )
}
