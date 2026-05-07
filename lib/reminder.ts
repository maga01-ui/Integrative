import { Resend } from 'resend'
import twilio from 'twilio'
import { prisma } from './prisma'

const resend = new Resend(process.env.RESEND_API_KEY ?? '')
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID ?? '',
  process.env.TWILIO_AUTH_TOKEN ?? ''
)

export async function inviaReminderAppuntamento(appuntamentoId: string) {
  const apt = await prisma.appuntamento.findUnique({
    where: { id: appuntamentoId },
    include: { paziente: true }
  })

  if (!apt) return

  const data = apt.inizio.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  if (apt.paziente.email) {
    await resend.emails.send({
      from: 'noreply@integrative.it',
      to: apt.paziente.email,
      subject: `Promemoria appuntamento — ${data}`,
      html: `<p>Gentile ${apt.paziente.nome}, promemoria appuntamento: ${data}.</p>`
    })
  }

  if (apt.paziente.telefonoWa) {
    await twilioClient.messages.create({
      from: 'whatsapp:+14155238886',
      to: `whatsapp:${apt.paziente.telefonoWa}`,
      body: `Gentile ${apt.paziente.nome}, promemoria appuntamento: ${data}. Studio Integrative.`
    })
  }
}
