// Dettaglio lead: visualizza tutti i dati e permette di modificarli
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOriginiTutteAttive } from '@/lib/origini'
import SelectProvincia from '@/components/ui/SelectProvincia'
import BackButton from '@/components/ui/BackButton'
import TelefonoInput from '@/components/ui/TelefonoInput'
import { formatTelefono } from '@/lib/telefono'

// ── Helper: prima lettera maiuscola, resto minuscolo ──
// Es: "mario rossi" → "Mario Rossi", "ROMA" → "Roma"
function capitalizza(val: string | null | undefined): string | null {
  if (!val) return null
  return val.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Server Action: nasconde il lead (id passato con .bind) ──
async function nascondiLead(id: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  await prisma.lead.update({ where: { id }, data: { nascosto: true } })
  redirect('/leads')
}

// ── Server Action: aggiorna il lead (id passato con .bind) ──
async function aggiornaLead(id: string, formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Se studioId è vuoto stringa, salva null
  const studioId = (formData.get('studioId') as string) || null

  // Normalizzazione testo: nome/cognome/città → prima lettera maiuscola
  // provincia → prima lettera maiuscola, email → tutto minuscolo
  const nome     = capitalizza(formData.get('nome')     as string) ?? ''
  const cognome  = capitalizza(formData.get('cognome')  as string) ?? ''
  const citta    = capitalizza(formData.get('citta')    as string)
  const provincia = (formData.get('provincia') as string)?.toUpperCase() || null
  const email    = (formData.get('email') as string)?.trim().toLowerCase() || null

  await prisma.lead.update({
    where: { id },
    data: {
      nome,
      cognome,
      telefono:      formData.get('telefono') as string,
      email,
      canale:        formData.get('canale') as string,
      campagna:      (formData.get('campagna') as string) || null,
      citta,
      provincia,
      stato:         formData.get('stato') as never,
      studioId,
      urgente:            formData.get('urgente') === 'on',
      noteOperatore:      (formData.get('noteOperatore') as string) || null,
      servizioInteresse:  (formData.get('servizioInteresse') as string) || null,
      // Data follow-up opzionale
      dataFollowup: formData.get('dataFollowup')
        ? new Date(formData.get('dataFollowup') as string)
        : null,
    }
  })

  redirect('/leads')
}

// Colori badge stato
const BADGE: Record<string, string> = {
  NUOVO:            'bg-sky-100 text-sky-700',
  DA_RICHIAMARE:    'bg-amber-100 text-amber-700',
  FOLLOW_UP:        'bg-orange-100 text-orange-700',
  FISSATO:          'bg-blue-100 text-blue-700',
  IN_ATTESA_CENTRO: 'bg-purple-100 text-purple-700',
  APPUNTAMENTO:     'bg-green-100 text-green-700',
  CONVERTITO:       'bg-emerald-100 text-emerald-700',
  NON_INTERESSATO:  'bg-slate-100 text-slate-500',
}

// DA_RICHIAMARE rimosso dall'UI — unificato con FOLLOW_UP
const STATI = [
  { value: 'NUOVO',            label: 'Nuovo' },
  { value: 'FOLLOW_UP',        label: 'Follow-up' },
  { value: 'FISSATO',          label: 'Fissato' },
  { value: 'IN_ATTESA_CENTRO', label: 'In attesa centro' },
  { value: 'APPUNTAMENTO',     label: 'Appuntamento' },
  { value: 'CONVERTITO',       label: 'Convertito' },
  { value: 'NON_INTERESSATO',  label: 'Non interessato' },
]

// ── Pagina ──
export default async function DettaglioLeadPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const { id } = await params

  // Carica lead con studio associato e, se convertito, il paziente collegato
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { studio: { select: { nome: true } } }
  })
  if (!lead) notFound()

  // Se il lead è stato convertito, carica i dati del paziente per mostrare il link
  const pazienteCollegato = lead.convertitoPazienteId
    ? await prisma.paziente.findUnique({
        where:  { id: lead.convertitoPazienteId },
        select: { id: true, nome: true, cognome: true },
      })
    : null

  // Studi disponibili per il dropdown
  const studi = await prisma.studio.findMany({
    where: { attivo: true },
    select: { id: true, nome: true, citta: true },
    orderBy: { nome: 'asc' }
  })

  // Carica le origini (manuali + referral) — sono GLOBALI: stessa lista
  // per tutti gli utenti e per tutti gli studi (vedi /impostazioni/origini).
  const origini = await getOriginiTutteAttive()

  // Lega l'id del lead alle server action tramite .bind (pattern affidabile)
  const nascondi = nascondiLead.bind(null, lead.id)
  const aggiorna = aggiornaLead.bind(null, lead.id)

  // Formatta data per input datetime-local (YYYY-MM-DDTHH:mm)
  const fmtDatetime = (d: Date | null) =>
    d ? d.toISOString().slice(0, 16) : ''

  return (
    <div className="space-y-6">

      {/* Breadcrumb + intestazione */}
      <div>
        <BackButton />
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-slate-600">
            {lead.cognome} {lead.nome}
          </h1>
          {lead.urgente && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600">Urgente</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[lead.stato]}`}>
            {STATI.find(s => s.value === lead.stato)?.label ?? lead.stato}
          </span>
        </div>
        {lead.studio && (
          <p className="mt-1 text-sm text-slate-500">Studio: <strong>{lead.studio.nome}</strong></p>
        )}
      </div>

      {/* Azioni di gestione lead */}
      <div className="flex flex-wrap gap-3">

        {/* Converti in paziente: apre il form anagrafica obbligatoria */}
        {!lead.convertitoPazienteId && lead.stato !== 'NON_INTERESSATO' && (
          <a href={`/leads/${lead.id}/converti`}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Converti in paziente
          </a>
        )}

        {/* Link alla scheda paziente se il lead è già stato convertito */}
        {pazienteCollegato && (
          <a href={`/pazienti/${pazienteCollegato.id}`}
            className="rounded-full bg-emerald-100 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-200">
            Vedi scheda paziente → {pazienteCollegato.cognome} {pazienteCollegato.nome}
          </a>
        )}

        {/* Fissa appuntamento */}
        {!['APPUNTAMENTO','CONVERTITO'].includes(lead.stato) && (
          <a
            href={
              lead.convertitoPazienteId
                // Lead già paziente: vai direttamente al calendario con l'ID paziente
                ? `/calendario/nuovo?pazienteId=${lead.convertitoPazienteId}`
                // Lead non ancora paziente: prima compila l'anagrafica, poi vai al calendario
                : `/leads/${lead.id}/converti?next=calendario`
            }
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Fissa appuntamento
          </a>
        )}

        {/* Nascondi lead: rimuove dalla lista (nascosto=true) */}
        <form action={nascondi}>
          <button type="submit"
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Nascondi lead
          </button>
        </form>
      </div>

      {/* Bottoni azione rapida: WhatsApp, chiamata, email */}
      {(lead.telefono || lead.email) && (
        <div className="flex flex-wrap gap-3">
          {/* Scrivi su WhatsApp */}
          {lead.telefono && (
            <a
              href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              <WaIcon className="h-4 w-4" />
              Scrivi — {formatTelefono(lead.telefono)}
            </a>
          )}
          {/* Chiama via WhatsApp */}
          {lead.telefono && (
            <a
              href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <PhoneIcon className="h-4 w-4" />
              Chiama
            </a>
          )}
          {/* Invia email */}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-2 rounded-full bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand"
            >
              <MailIcon className="h-4 w-4" />
              Email
            </a>
          )}
        </div>
      )}

      {/* Form modifica */}
      <form action={aggiorna} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

        <h2 className="text-base font-semibold text-slate-800">Dati anagrafici</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Nome *"    name="nome"    required defaultValue={lead.nome} />
          <Campo label="Cognome *" name="cognome" required defaultValue={lead.cognome} />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <TelefonoInput label="Telefono *" name="telefono" required defaultValue={lead.telefono ?? ''} />
          <Campo label="Email"      name="email"    type="email" defaultValue={lead.email ?? ''} />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Campo label="Città"     name="citta"     defaultValue={lead.citta ?? ''} />
          <SelectProvincia defaultValue={lead.provincia ?? ''} />
        </div>

        <hr className="border-slate-100" />
        <h2 className="text-base font-semibold text-slate-800">Gestione lead</h2>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Stato */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Stato</label>
            <select name="stato" defaultValue={lead.stato} className={cls}>
              {STATI.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Servizio di interesse */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Servizio di interesse</label>
            <select name="servizioInteresse" defaultValue={(lead as any).servizioInteresse ?? 'BIOSCAN'} className={cls}>
              <option value="">— Non specificato —</option>
              <option value="BIOSCAN">Bioscan</option>
              <option value="TRATTAMENTI">Trattamenti</option>
              <option value="FITOTERAPIA">Fitoterapia</option>
              <option value="ENTRAMBI">Trattamenti + Fitoterapia</option>
            </select>
          </div>

          {/* Studio assegnato */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Studio assegnato</label>
            <select name="studioId" defaultValue={lead.studioId ?? ''} className={cls}>
              <option value="">— Nessuno —</option>
              {studi.map((s: { id: string; nome: string; citta: string | null }) => (
                <option key={s.id} value={s.id}>
                  {s.nome}{s.citta ? ` — ${s.citta}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Canale e campagna */}
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Origine *</label>
            {/* Il campo nel DB si chiama ancora "canale" per compatibilità con
                i lead esistenti; nell'interfaccia lo mostriamo come "Origine". */}
            <select name="canale" required defaultValue={lead.canale ?? ''} className={cls}>
              <option value="">— Seleziona origine —</option>
              {origini.map((o: { id: string; nome: string }) => (
                <option key={o.id} value={o.nome}>{o.nome}</option>
              ))}
            </select>
          </div>
          <Campo label="Campagna" name="campagna" defaultValue={lead.campagna ?? ''} />
        </div>

        {/* Data follow-up */}
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-slate-700">Data follow-up</label>
          <input type="datetime-local" name="dataFollowup"
            defaultValue={fmtDatetime(lead.dataFollowup)}
            className={cls} />
        </div>

        {/* Note interne */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Note operatore</label>
          <textarea name="noteOperatore" rows={4}
            defaultValue={lead.noteOperatore ?? ''}
            placeholder="Note interne, non visibili al lead…"
            className={cls} />
        </div>

        {/* Urgente */}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="urgente" defaultChecked={lead.urgente} className="rounded" />
          Segna come urgente (appare in cima alla lista)
        </label>

        {/* Azioni */}
        <div className="flex justify-end gap-3 pt-2">
          <a href="/leads"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Annulla
          </a>
          <button type="submit"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-brand-hover">
            Salva modifiche
          </button>
        </div>
      </form>

      {/* Metadati in fondo */}
      <div className="text-xs text-slate-400 space-y-0.5">
        <p>Lead creato il {lead.createdAt.toLocaleString('it-IT')}</p>
        <p>Data lead: {lead.dataLead.toLocaleDateString('it-IT')}</p>
      </div>
    </div>
  )
}

const cls = 'mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200'

function Campo({ label, name, type = 'text', required = false, defaultValue = '', placeholder = '', maxLength }: {
  label: string; name: string; type?: string; required?: boolean
  defaultValue?: string; placeholder?: string; maxLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input type={type} name={name} required={required} defaultValue={defaultValue}
        placeholder={placeholder} maxLength={maxLength} className={cls} />
    </div>
  )
}

// ── Icona WhatsApp ──
function WaIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`shrink-0 ${className}`}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.524 5.828L.057 23.886a.5.5 0 0 0 .606.61l6.288-1.65A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.877 9.877 0 0 1-5.034-1.378l-.36-.214-3.733.979.997-3.64-.235-.374A9.859 9.859 0 0 1 2.118 12C2.118 6.533 6.533 2.118 12 2.118S21.882 6.533 21.882 12 17.467 21.882 12 21.882z"/>
    </svg>
  )
}

// ── Icona email ──
function MailIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

// ── Icona telefono ──
function PhoneIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
