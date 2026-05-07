// Script per popolare il database con dati demo realistici
// Eseguire con: node prisma/seed-demo.js

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// ── ID esistenti nel database ─────────────────────────────────────────────────
const STUDIO_MI      = 'b9c5a095-b5c0-49ac-8eb9-4cfead959c0d'
const STUDIO_RO      = '70f777c9-90ae-4e39-a030-00b8e94398a8'
const MEDICO_FABIO   = 'a3cc0880-80be-429c-a914-49c18c816a31'
const MEDICO_MAURI   = 'a3da6280-0795-4322-adab-977671e10e47'
const MEDICO_ROBERTA = '1eb63e5c-b7b8-4f7b-b3d6-a43cb09b1fc2'
const SALA1_MI       = '99a4cff8-ff2c-400c-8764-57596188c4fe'
const SALA2_MI       = 'd57eef90-f020-4e89-b4ed-7dba1480e074'
const SALA3_MI       = '2c59df85-a967-4499-8ebb-2cab6a85086a'
const SALA1_RO       = 'fc12747a-a363-45cd-afce-5add03f91f97'
const BIOSCAN_ID     = 'c3344621-6f11-496b-adb8-2e804d5d7879'
const CURA_ID        = '28ca8b69-8ce4-4f05-84bc-9dc0e93a090e'
const MANT_ID        = '8f4c6694-d892-4eaf-8594-43e43548bf88'
const FITO_ID        = '0064c2e7-0d70-45ef-afd3-c5eb8f83d7e0'

// ── Leads da creare ───────────────────────────────────────────────────────────
const nuoviLead = [
  { nome: 'Giulia',    cognome: 'Ferretti',  telefono: '3481234567', email: 'giulia.ferretti@gmail.com',    citta: 'Milano',            provincia: 'MI', canale: 'Facebook',    studioId: STUDIO_MI, stato: 'NUOVO'            },
  { nome: 'Marco',     cognome: 'Bianchi',   telefono: '3291234568', email: 'marco.bianchi@libero.it',      citta: 'Milano',            provincia: 'MI', canale: 'Passaparola', studioId: STUDIO_MI, stato: 'DA_RICHIAMARE'    },
  { nome: 'Silvia',    cognome: 'Greco',     telefono: '3661234569', email: 'silvia.greco@gmail.com',       citta: 'Sesto S.Giovanni',  provincia: 'MI', canale: 'Instagram',   studioId: STUDIO_MI, stato: 'FOLLOW_UP'        },
  { nome: 'Luca',      cognome: 'Moretti',   telefono: '3471234570', email: 'luca.moretti@hotmail.com',     citta: 'Monza',             provincia: 'MB', canale: 'Google',      studioId: STUDIO_MI, stato: 'FISSATO'          },
  { nome: 'Anna',      cognome: 'Ricci',     telefono: '3801234571', email: 'anna.ricci@gmail.com',         citta: 'Cinisello Balsamo', provincia: 'MI', canale: 'Facebook',    studioId: STUDIO_MI, stato: 'NUOVO'            },
  { nome: 'Carlo',     cognome: 'Esposito',  telefono: '3461234572', email: 'carlo.esposito@gmail.com',     citta: 'Roma',              provincia: 'RM', canale: 'Google',      studioId: STUDIO_RO, stato: 'NUOVO'            },
  { nome: 'Federica',  cognome: 'Conti',     telefono: '3491234573', email: 'federica.conti@libero.it',     citta: 'Roma',              provincia: 'RM', canale: 'Instagram',   studioId: STUDIO_RO, stato: 'DA_RICHIAMARE'    },
  { nome: 'Davide',    cognome: 'Mancini',   telefono: '3751234574', email: 'davide.mancini@gmail.com',     citta: 'Roma',              provincia: 'RM', canale: 'Passaparola', studioId: STUDIO_RO, stato: 'FOLLOW_UP'        },
  { nome: 'Valentina', cognome: 'Lombardi',  telefono: '3451234575', email: 'valentina.lombardi@gmail.com', citta: 'Milano',            provincia: 'MI', canale: 'Passaparola', studioId: STUDIO_MI, stato: 'APPUNTAMENTO'     },
  { nome: 'Roberto',   cognome: 'Gallo',     telefono: '3331234576', email: 'roberto.gallo@gmail.com',      citta: 'Milano',            provincia: 'MI', canale: 'Google',      studioId: STUDIO_MI, stato: 'NUOVO'            },
  { nome: 'Chiara',    cognome: 'Martini',   telefono: '3591234577', email: 'chiara.martini@yahoo.it',      citta: 'Rho',               provincia: 'MI', canale: 'Facebook',    studioId: STUDIO_MI, stato: 'IN_ATTESA_CENTRO' },
  { nome: 'Paolo',     cognome: 'Ferrari',   telefono: '3471234578', email: 'paolo.ferrari@gmail.com',      citta: 'Segrate',           provincia: 'MI', canale: 'Passaparola', studioId: STUDIO_MI, stato: 'NUOVO'            },
]

// ── Pazienti da creare ────────────────────────────────────────────────────────
const nuoviPazienti = [
  { nome: 'Elena',      cognome: 'Russo',    dataNascita: new Date('1982-03-15'), telefono: '3481122334', email: 'elena.russo@gmail.com',       citta: 'Milano',          provincia: 'MI', sesso: 'F', studioId: STUDIO_MI, canale: 'Passaparola' },
  { nome: 'Giorgio',    cognome: 'Testa',    dataNascita: new Date('1975-07-22'), telefono: '3291122335', email: 'giorgio.testa@libero.it',     citta: 'Milano',          provincia: 'MI', sesso: 'M', studioId: STUDIO_MI, canale: 'Facebook'    },
  { nome: 'Marta',      cognome: 'Bruno',    dataNascita: new Date('1990-11-08'), telefono: '3661122336', email: 'marta.bruno@gmail.com',       citta: 'Cologno Monzese', provincia: 'MI', sesso: 'F', studioId: STUDIO_MI, canale: 'Google'      },
  { nome: 'Stefano',    cognome: 'Costa',    dataNascita: new Date('1968-05-30'), telefono: '3471122337', email: 'stefano.costa@hotmail.com',   citta: 'Monza',           provincia: 'MB', sesso: 'M', studioId: STUDIO_MI, canale: 'Passaparola' },
  { nome: 'Laura',      cognome: 'Villa',    dataNascita: new Date('1985-09-12'), telefono: '3801122338', email: 'laura.villa@gmail.com',       citta: 'Sesto S.Giovanni',provincia: 'MI', sesso: 'F', studioId: STUDIO_MI, canale: 'Instagram'   },
  { nome: 'Francesco',  cognome: 'Fontana',  dataNascita: new Date('1978-01-25'), telefono: '3461122339', email: 'francesco.fontana@gmail.com', citta: 'Roma',            provincia: 'RM', sesso: 'M', studioId: STUDIO_RO, canale: 'Google'      },
  { nome: 'Alessandra', cognome: 'Messina',  dataNascita: new Date('1993-06-17'), telefono: '3491122340', email: 'alessandra.messina@libero.it',citta: 'Roma',            provincia: 'RM', sesso: 'F', studioId: STUDIO_RO, canale: 'Passaparola' },
  { nome: 'Daniele',    cognome: 'Riva',     dataNascita: new Date('1972-12-03'), telefono: '3751122341', email: 'daniele.riva@gmail.com',      citta: 'Milano',          provincia: 'MI', sesso: 'M', studioId: STUDIO_MI, canale: 'Passaparola' },
  { nome: 'Cristina',   cognome: 'De Luca',  dataNascita: new Date('1988-04-20'), telefono: '3451122342', email: 'cristina.deluca@gmail.com',   citta: 'Milano',          provincia: 'MI', sesso: 'F', studioId: STUDIO_MI, canale: 'Facebook'    },
  { nome: 'Matteo',     cognome: 'Caruso',   dataNascita: new Date('1980-08-14'), telefono: '3331122343', email: 'matteo.caruso@yahoo.it',      citta: 'Roma',            provincia: 'RM', sesso: 'M', studioId: STUDIO_RO, canale: 'Instagram'   },
  { nome: 'Paola',      cognome: 'Marini',   dataNascita: new Date('1965-02-28'), telefono: '3591122344', email: 'paola.marini@gmail.com',      citta: 'Milano',          provincia: 'MI', sesso: 'F', studioId: STUDIO_MI, canale: 'Passaparola' },
  { nome: 'Andrea',     cognome: 'Serra',    dataNascita: new Date('1983-10-07'), telefono: '3471122345', email: 'andrea.serra@gmail.com',      citta: 'Milano',          provincia: 'MI', sesso: 'M', studioId: STUDIO_MI, canale: 'Google'      },
]

async function seed() {
  const now = new Date()

  // ── Leads ──────────────────────────────────────────────────────────────────
  let leadCount = 0
  for (const l of nuoviLead) {
    await p.lead.create({ data: { ...l, dataLead: new Date() } })
    leadCount++
  }
  console.log(`✓ ${leadCount} lead inseriti`)

  // ── Pazienti ───────────────────────────────────────────────────────────────
  const pazientiCreati = []
  for (const paz of nuoviPazienti) {
    const creato = await p.paziente.create({
      data: { ...paz, tipo: 'PRIVATO', dataDiventaPaziente: new Date() },
    })
    pazientiCreati.push(creato)
  }
  console.log(`✓ ${pazientiCreati.length} pazienti inseriti`)

  // ── Appuntamenti passati (COMPLETATO) ──────────────────────────────────────
  const passati = [
    { giorniFA: 28, ora: 9,  idx: 0,  medico: MEDICO_FABIO,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 25, ora: 10, idx: 1,  medico: MEDICO_FABIO,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 23, ora: 14, idx: 3,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 21, ora: 11, idx: 0,  medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 20, ora: 9,  idx: 2,  medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 18, ora: 15, idx: 3,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 17, ora: 10, idx: 1,  medico: MEDICO_FABIO,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 16, ora: 9,  idx: 5,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 14, ora: 9,  idx: 0,  medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 14, ora: 11, idx: 4,  medico: MEDICO_FABIO,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 13, ora: 15, idx: 6,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 12, ora: 16, idx: 5,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 11, ora: 10, idx: 2,  medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 10, ora: 9,  idx: 7,  medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 9,  ora: 11, idx: 3,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 8,  ora: 14, idx: 9,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 7,  ora: 10, idx: 1,  medico: MEDICO_FABIO,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 7,  ora: 16, idx: 6,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 5,  ora: 10, idx: 8,  medico: MEDICO_FABIO,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniFA: 4,  ora: 9,  idx: 0,  medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 3,  ora: 15, idx: 9,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 2,  ora: 10, idx: 1,  medico: MEDICO_FABIO,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniFA: 1,  ora: 11, idx: 10, medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: MANT_ID,    tipo: 'Mantenimento', prezzo: 500 },
    { giorniFA: 1,  ora: 14, idx: 7,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
  ]

  for (const a of passati) {
    const inizio = new Date(now)
    inizio.setDate(inizio.getDate() - a.giorniFA)
    inizio.setHours(a.ora, 0, 0, 0)
    const fine = new Date(inizio.getTime() + 60 * 60 * 1000)
    await p.appuntamento.create({
      data: {
        studioId:        a.studioId,
        pazienteId:      pazientiCreati[a.idx].id,
        medicoId:        a.medico,
        salaId:          a.sala,
        prestazioneId:   a.prestId,
        tipoPrestazione: a.tipo,
        inizio, fine,
        stato:           'COMPLETATO',
        prezzoBase:      a.prezzo,
        prezzoApplicato: a.prezzo,
        eseguita:        true,
        dataEsecuzione:  fine,
      },
    })
  }
  console.log(`✓ ${passati.length} appuntamenti passati inseriti`)

  // ── Appuntamenti futuri (CONFERMATO) ───────────────────────────────────────
  const futuri = [
    { giorniDA: 1,  ora: 9,  idx: 2,  medico: MEDICO_FABIO,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 1,  ora: 11, idx: 4,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 1,  ora: 15, idx: 8,  medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 2,  ora: 10, idx: 7,  medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 2,  ora: 15, idx: 5,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 3,  ora: 9,  idx: 11, medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniDA: 3,  ora: 11, idx: 8,  medico: MEDICO_FABIO,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 3,  ora: 14, idx: 6,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 5,  ora: 10, idx: 0,  medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 5,  ora: 14, idx: 3,  medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 5,  ora: 16, idx: 9,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 7,  ora: 9,  idx: 6,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniDA: 7,  ora: 11, idx: 1,  medico: MEDICO_FABIO,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: MANT_ID,    tipo: 'Mantenimento', prezzo: 500 },
    { giorniDA: 8,  ora: 10, idx: 9,  medico: MEDICO_ROBERTA, sala: SALA1_RO, studioId: STUDIO_RO, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 9,  ora: 9,  idx: 10, medico: MEDICO_FABIO,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 10, ora: 11, idx: 2,  medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 10, ora: 14, idx: 7,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: FITO_ID,    tipo: 'Fitoterapia',  prezzo: 450 },
    { giorniDA: 12, ora: 9,  idx: 4,  medico: MEDICO_FABIO,   sala: SALA3_MI, studioId: STUDIO_MI, prestId: BIOSCAN_ID, tipo: 'Bioscan',      prezzo: 300 },
    { giorniDA: 14, ora: 10, idx: 11, medico: MEDICO_MAURI,   sala: SALA1_MI, studioId: STUDIO_MI, prestId: CURA_ID,    tipo: 'Cura',         prezzo: 500 },
    { giorniDA: 14, ora: 16, idx: 3,  medico: MEDICO_MAURI,   sala: SALA2_MI, studioId: STUDIO_MI, prestId: MANT_ID,    tipo: 'Mantenimento', prezzo: 500 },
  ]

  for (const a of futuri) {
    const inizio = new Date(now)
    inizio.setDate(inizio.getDate() + a.giorniDA)
    inizio.setHours(a.ora, 0, 0, 0)
    const fine = new Date(inizio.getTime() + 60 * 60 * 1000)
    await p.appuntamento.create({
      data: {
        studioId:        a.studioId,
        pazienteId:      pazientiCreati[a.idx].id,
        medicoId:        a.medico,
        salaId:          a.sala,
        prestazioneId:   a.prestId,
        tipoPrestazione: a.tipo,
        inizio, fine,
        stato:           'CONFERMATO',
        prezzoBase:      a.prezzo,
        prezzoApplicato: a.prezzo,
      },
    })
  }
  console.log(`✓ ${futuri.length} appuntamenti futuri inseriti`)

  await p.$disconnect()
  console.log('\nSeed completato.')
}

seed().catch(e => {
  console.error('Errore:', e.message)
  p.$disconnect()
  process.exit(1)
})
