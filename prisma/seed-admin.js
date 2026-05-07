// Script di inizializzazione: crea il primo studio e un utente SUPERADMIN
// per poter fare login la prima volta su un DB vuoto.
//
// Esecuzione (da terminale, nella root del progetto):
//
//   DATABASE_URL="postgresql://..." \
//   ADMIN_EMAIL="tuamail@example.com" \
//   ADMIN_PASSWORD="UnaPasswordRobusta" \
//   node prisma/seed-admin.js
//
// IMPORTANTE: usare la "Direct connection" di Supabase (porta 5432), non il
// pooler — il pooler in transaction mode non gestisce bene i comandi DDL/seed.

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// Tutte le sezioni del menu — devono restare allineate con components/layout/Sidebar.tsx
const SEZIONI = [
  'dashboard',
  'dashboard_marketing',
  'leads',
  'pazienti',
  'calendario',
  'fatture',
  'profitti',
  'bi',
  'impostazioni',
  'chat',
]

async function main() {
  // ── Controlli sulle env var ─────────────────────────────────────────────
  const email    = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('❌ Imposta ADMIN_EMAIL e ADMIN_PASSWORD prima di eseguire lo script.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('❌ La password deve essere almeno 8 caratteri.')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    // ── Studio principale: lo creo se non c'è nessuno studio nel DB ─────────
    let studio = await prisma.studio.findFirst()
    if (!studio) {
      studio = await prisma.studio.create({
        data: { nome: 'Studio principale', attivo: true },
      })
      console.log(`✓ Studio creato: "${studio.nome}" (id ${studio.id})`)
    } else {
      console.log(`→ Studio già esistente: "${studio.nome}"`)
    }

    // ── Utente SUPERADMIN: upsert in modo che sia idempotente ───────────────
    const passwordHash = await bcrypt.hash(password, 10)
    const admin = await prisma.utente.upsert({
      where:  { email },
      update: { passwordHash, attivo: true, ruolo: 'SUPERADMIN' },
      create: {
        email,
        nome:        'Admin',
        cognome:     'Iniziale',
        ruolo:       'SUPERADMIN',
        attivo:      true,
        passwordHash,
        studioId:    studio.id,
      },
    })
    console.log(`✓ Utente admin pronto: ${admin.email}`)

    // ── Permessi WRITE su tutte le sezioni ──────────────────────────────────
    for (const sezione of SEZIONI) {
      await prisma.permesso.upsert({
        where:  { utenteId_sezione: { utenteId: admin.id, sezione } },
        update: { livello: 'WRITE' },
        create: { utenteId: admin.id, sezione, livello: 'WRITE' },
      })
    }
    console.log(`✓ Permessi WRITE assegnati a ${SEZIONI.length} sezioni`)

    console.log('\n✅ Fatto! Ora puoi loggarti con:')
    console.log(`   email:    ${email}`)
    console.log(`   password: (quella che hai inserito)\n`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('❌ Errore durante il seed:', err)
  process.exit(1)
})
