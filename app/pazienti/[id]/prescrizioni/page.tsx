// Elenco prescrizioni mediche del paziente
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { FileText, Plus, Printer, Trash2, Mail, Pencil } from 'lucide-react'
import { getTenantContext } from '@/lib/tenant'

// ── Server action: elimina una prescrizione ───────────────────────────────────
async function eliminaPrescrizione(prescrizioneId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  await prisma.prescrizione.delete({ where: { id: prescrizioneId } })
  revalidatePath(`/pazienti/${pazienteId}/prescrizioni`)
}

// ── Server action: invia la prescrizione per email al paziente ────────────────
async function inviaEmail(prescrizioneId: string, pazienteId: string) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // Carica la prescrizione con tutti i dati necessari
  const presc = await prisma.prescrizione.findUnique({
    where: { id: prescrizioneId },
    include: {
      paziente: { select: { nome: true, cognome: true, email: true } },
      medico:   { select: { nome: true, cognome: true } },
      studio:   { select: { nome: true, email: true } },
    },
  })
  if (!presc || !presc.paziente.email) return  // nessuna email: ignora

  const nomePaziente  = `${presc.paziente.cognome ?? ''} ${presc.paziente.nome}`.trim()
  const nomeOperatore = `${presc.medico.cognome ?? ''} ${presc.medico.nome}`.trim()
  const dataFormatted = presc.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  const studioNome    = presc.studio.nome
  // Mittente: email dello studio se disponibile, altrimenti dominio generico
  const fromEmail     = presc.studio.email
    ? `${studioNome} <${presc.studio.email}>`
    : `${studioNome} <noreply@integrative.it>`

  // Corpo HTML dell'email
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 4px; font-size: 18px; color: #1a1a1a;">${studioNome}</h2>
      </div>

      <h3 style="font-size: 16px; color: #1a1a1a; margin-bottom: 4px;">Prescrizione Medica</h3>
      <p style="font-size: 13px; color: #666; margin-top: 0;">del ${dataFormatted}</p>

      <p style="font-size: 14px;">Gentile <strong>${nomePaziente}</strong>,</p>
      <p style="font-size: 14px; margin-bottom: 24px;">
        in allegato trova la prescrizione medica emessa in data ${dataFormatted}.
      </p>

      <div style="background: #f8f9fa; border-left: 3px solid #6366f1; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #333; white-space: pre-wrap; margin: 0;">${presc.contenuto}</p>
      </div>

      <p style="font-size: 13px; color: #666;">
        Cordiali saluti,<br/>
        <strong>${nomeOperatore}</strong><br/>
        ${studioNome}
      </p>
    </div>
  `

  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  await resend.emails.send({
    from:    fromEmail,
    to:      presc.paziente.email,
    subject: `Prescrizione medica del ${dataFormatted} — ${studioNome}`,
    html:    htmlBody,
  })

  revalidatePath(`/pazienti/${pazienteId}/prescrizioni`)
}

export default async function PrescrizioniPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let ctx
  try { ctx = await getTenantContext() }
  catch { redirect('/login') }

  const { id: pazienteId } = await params

  // Carica il paziente con studio ed email
  const paziente = await prisma.paziente.findUnique({
    where:  { id: pazienteId },
    select: {
      id: true, nome: true, cognome: true, email: true,
      studio: { select: { nome: true } },
    },
  })
  if (!paziente) redirect('/pazienti')

  // Carica tutte le prescrizioni del paziente, ordinate per data decrescente
  const prescrizioni = await prisma.prescrizione.findMany({
    where:   { pazienteId },
    orderBy: { data: 'desc' },
    include: {
      medico: { select: { nome: true, cognome: true } },
    },
  })

  const haEmail = !!paziente.email

  return (
    <div className="space-y-4">

      {/* Intestazione + bottone nuova */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Prescrizioni</p>
          <p className="text-sm text-slate-500">Documenti medici emessi per il paziente.</p>
        </div>
        <a
          href={`/pazienti/${pazienteId}/prescrizioni/nuova`}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-brand-hover transition"
        >
          <Plus size={16} />
          Nuova prescrizione
        </a>
      </div>

      {/* Avviso se il paziente non ha email */}
      {!haEmail && prescrizioni.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Il paziente non ha un&apos;email registrata in anagrafica — il bottone email non sarà disponibile.
        </div>
      )}

      {/* Lista prescrizioni */}
      {prescrizioni.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
          Nessuna prescrizione ancora. Clicca su «Nuova prescrizione» per aggiungerne una.
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {prescrizioni.map(p => {
              const data      = p.data.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
              const operatore = `${p.medico.cognome ?? ''} ${p.medico.nome}`.trim()
              const anteprima = p.contenuto.length > 100
                ? p.contenuto.slice(0, 100) + '…'
                : p.contenuto
              const elimina   = eliminaPrescrizione.bind(null, p.id, pazienteId)
              const invia     = inviaEmail.bind(null, p.id, pazienteId)

              return (
                <li key={p.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 transition">

                  {/* Icona documento */}
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                    <FileText size={18} className="text-blue-600" />
                  </div>

                  {/* Contenuto */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{data}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-sm text-slate-600">{operatore}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{anteprima}</p>
                    {p.note && (
                      <p className="mt-0.5 text-xs text-slate-400 italic">{p.note}</p>
                    )}
                  </div>

                  {/* Azioni */}
                  <div className="flex shrink-0 items-center gap-2">

                    {/* Modifica */}
                    <a
                      href={`/pazienti/${pazienteId}/prescrizioni/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                      title="Modifica prescrizione"
                    >
                      <Pencil size={13} />
                      Modifica
                    </a>

                    {/* Stampa */}
                    <a
                      href={`/stampa/prescrizione/${p.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                      title="Apri in formato stampabile / PDF"
                    >
                      <Printer size={13} />
                      Stampa
                    </a>

                    {/* Email */}
                    {haEmail ? (
                      <form action={invia}>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
                          title={`Invia per email a ${paziente.email}`}
                        >
                          <Mail size={13} />
                          Email
                        </button>
                      </form>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-300 cursor-not-allowed"
                        title="Nessuna email registrata per questo paziente"
                      >
                        <Mail size={13} />
                        Email
                      </span>
                    )}

                    {/* Elimina */}
                    <form action={elimina}>
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-full border border-red-200 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Elimina prescrizione"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>

                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
