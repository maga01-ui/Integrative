import { redirect, notFound } from 'next/navigation'
import { getTenantContext } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

export async function getPatientOrRedirect(id: string) {
  let ctx
  try {
    ctx = await getTenantContext()
  } catch {
    redirect('/login')
  }

  const ws = ctx.studioId ? { studioId: ctx.studioId } : {}
  const paziente = await prisma.paziente.findFirst({
    where: { id, ...ws },
    select: {
      id: true,
      tipo: true,
      nome: true,
      cognome: true,
      ragioneSociale: true,
      telefono: true,
      telefonoWa: true,
      email: true,
      referente: true,
      dataNascita: true,
      dataDiventaPaziente: true,
      attivo: true,
      indirizzo: true,
      cap: true,
      citta: true,
      provincia: true,
      stato: true,
      codiceFiscale: true,
      partitaIva: true,
      pec: true,
      studioId: true,
    },
  })

  if (!paziente) notFound()
  return paziente
}

export function formatPatientName(paziente: any) {
  if (paziente.tipo === 'AZIENDA') {
    return paziente.ragioneSociale || paziente.nome || 'Paziente'
  }
  return `${paziente.cognome ?? ''} ${paziente.nome ?? ''}`.trim() || 'Paziente'
}

export function cleanPhoneValue(value: string | null | undefined) {
  return value ? value.replace(/[^\d+]/g, '') : null
}

export function createPhoneUrl(value: string | null | undefined) {
  const cleaned = cleanPhoneValue(value)
  return cleaned ? `tel:${cleaned}` : null
}

export function createWhatsAppUrl(value: string | null | undefined) {
  const cleaned = cleanPhoneValue(value)
  const number = cleaned?.replace(/^\+/, '')
  return number ? `https://wa.me/${number}` : null
}
