// Secondo batch di dati demo — 20 lead, 20 pazienti, 20 app passati, 20 app futuri
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const STUDIO_MI      = 'b9c5a095-b5c0-49ac-8eb9-4cfead959c0d'
const STUDIO_RO      = '70f777c9-90ae-4e39-a030-00b8e94398a8'
const MEDICO_FABIO   = 'a3cc0880-80be-429c-a914-49c18c816a31'
const MEDICO_MAURI   = 'a3da6280-0795-4322-adab-977671e10e47'
const MEDICO_ROBERTA = '1eb63e5c-b7b8-4f7b-b3d6-a43cb09b1fc2'
const SALA1_MI = '99a4cff8-ff2c-400c-8764-57596188c4fe'
const SALA2_MI = 'd57eef90-f020-4e89-b4ed-7dba1480e074'
const SALA3_MI = '2c59df85-a967-4499-8ebb-2cab6a85086a'
const SALA1_RO = 'fc12747a-a363-45cd-afce-5add03f91f97'
const BIOSCAN_ID = 'c3344621-6f11-496b-adb8-2e804d5d7879'
const CURA_ID    = '28ca8b69-8ce4-4f05-84bc-9dc0e93a090e'
const MANT_ID    = '8f4c6694-d892-4eaf-8594-43e43548bf88'
const FITO_ID    = '0064c2e7-0d70-45ef-afd3-c5eb8f83d7e0'

const nuoviLead = [
  { nome:'Irene',     cognome:'Barbieri',   telefono:'3481234601', email:'irene.barbieri@gmail.com',     citta:'Milano',           provincia:'MI', canale:'Facebook',    studioId:STUDIO_MI, stato:'NUOVO'            },
  { nome:'Tommaso',   cognome:'Pellegrini', telefono:'3291234602', email:'tommaso.pellegrini@libero.it', citta:'Padova',           provincia:'PD', canale:'Google',      studioId:STUDIO_MI, stato:'DA_RICHIAMARE'    },
  { nome:'Beatrice',  cognome:'Gatti',      telefono:'3661234603', email:'beatrice.gatti@gmail.com',     citta:'Bergamo',          provincia:'BG', canale:'Instagram',   studioId:STUDIO_MI, stato:'FOLLOW_UP'        },
  { nome:'Nicola',    cognome:'Santoro',    telefono:'3471234604', email:'nicola.santoro@gmail.com',     citta:'Brescia',          provincia:'BS', canale:'Passaparola', studioId:STUDIO_MI, stato:'FISSATO'          },
  { nome:'Serena',    cognome:'Amato',      telefono:'3801234605', email:'serena.amato@yahoo.it',        citta:'Como',             provincia:'CO', canale:'Facebook',    studioId:STUDIO_MI, stato:'NUOVO'            },
  { nome:'Gianluca',  cognome:'Rizzi',      telefono:'3461234606', email:'gianluca.rizzi@gmail.com',     citta:'Varese',           provincia:'VA', canale:'Google',      studioId:STUDIO_MI, stato:'IN_ATTESA_CENTRO' },
  { nome:'Monica',    cognome:'Vitale',     telefono:'3491234607', email:'monica.vitale@libero.it',      citta:'Roma',             provincia:'RM', canale:'Instagram',   studioId:STUDIO_RO, stato:'NUOVO'            },
  { nome:'Emanuele',  cognome:'Orlando',    telefono:'3751234608', email:'emanuele.orlando@gmail.com',   citta:'Roma',             provincia:'RM', canale:'Passaparola', studioId:STUDIO_RO, stato:'DA_RICHIAMARE'    },
  { nome:'Sabrina',   cognome:'Longo',      telefono:'3451234609', email:'sabrina.longo@gmail.com',      citta:'Napoli',           provincia:'NA', canale:'Facebook',    studioId:STUDIO_RO, stato:'FOLLOW_UP'        },
  { nome:'Claudio',   cognome:'Basile',     telefono:'3331234610', email:'claudio.basile@gmail.com',     citta:'Roma',             provincia:'RM', canale:'Google',      studioId:STUDIO_RO, stato:'APPUNTAMENTO'     },
  { nome:'Noemi',     cognome:'Cattaneo',   telefono:'3591234611', email:'noemi.cattaneo@gmail.com',     citta:'Milano',           provincia:'MI', canale:'Instagram',   studioId:STUDIO_MI, stato:'NUOVO'            },
  { nome:'Enrico',    cognome:'Giordano',   telefono:'3471234612', email:'enrico.giordano@libero.it',    citta:'Lecco',            provincia:'LC', canale:'Passaparola', studioId:STUDIO_MI, stato:'NUOVO'            },
  { nome:'Francesca', cognome:'Colombo',    telefono:'3481234613', email:'francesca.colombo@gmail.com',  citta:'Milano',           provincia:'MI', canale:'Facebook',    studioId:STUDIO_MI, stato:'DA_RICHIAMARE'    },
  { nome:'Massimo',   cognome:'Fiore',      telefono:'3291234614', email:'massimo.fiore@gmail.com',      citta:'Pavia',            provincia:'PV', canale:'Google',      studioId:STUDIO_MI, stato:'FOLLOW_UP'        },
  { nome:'Giovanna',  cognome:'Palumbo',    telefono:'3661234615', email:'giovanna.palumbo@libero.it',   citta:'Roma',             provincia:'RM', canale:'Passaparola', studioId:STUDIO_RO, stato:'NUOVO'            },
  { nome:'Simone',    cognome:'Marchetti',  telefono:'3471234616', email:'simone.marchetti@gmail.com',   citta:'Firenze',          provincia:'FI', canale:'Instagram',   studioId:STUDIO_RO, stato:'FISSATO'          },
  { nome:'Alessia',   cognome:'Silvestri',  telefono:'3801234617', email:'alessia.silvestri@gmail.com',  citta:'Milano',           provincia:'MI', canale:'Facebook',    studioId:STUDIO_MI, stato:'NUOVO'            },
  { nome:'Fabio',     cognome:'De Rosa',    telefono:'3461234618', email:'fabio.derosa@gmail.com',       citta:'Monza',            provincia:'MB', canale:'Google',      studioId:STUDIO_MI, stato:'IN_ATTESA_CENTRO' },
  { nome:'Cinzia',    cognome:'Rinaldi',    telefono:'3491234619', email:'cinzia.rinaldi@yahoo.it',      citta:'Roma',             provincia:'RM', canale:'Passaparola', studioId:STUDIO_RO, stato:'DA_RICHIAMARE'    },
  { nome:'Lorenzo',   cognome:'Poli',       telefono:'3751234620', email:'lorenzo.poli@gmail.com',       citta:'Milano',           provincia:'MI', canale:'Instagram',   studioId:STUDIO_MI, stato:'NUOVO'            },
]

const nuoviPazienti = [
  { nome:'Irene',     cognome:'Barbieri',   dataNascita:new Date('1991-04-12'), telefono:'3481100601', email:'irene.barbieri.paz@gmail.com',     citta:'Milano',    provincia:'MI', sesso:'F', studioId:STUDIO_MI, canale:'Facebook'    },
  { nome:'Tommaso',   cognome:'Pellegrini', dataNascita:new Date('1979-08-25'), telefono:'3291100602', email:'tommaso.pellegrini.paz@libero.it', citta:'Padova',    provincia:'PD', sesso:'M', studioId:STUDIO_MI, canale:'Google'      },
  { nome:'Beatrice',  cognome:'Gatti',      dataNascita:new Date('1987-11-03'), telefono:'3661100603', email:'beatrice.gatti.paz@gmail.com',     citta:'Bergamo',   provincia:'BG', sesso:'F', studioId:STUDIO_MI, canale:'Instagram'   },
  { nome:'Nicola',    cognome:'Santoro',    dataNascita:new Date('1973-02-18'), telefono:'3471100604', email:'nicola.santoro.paz@gmail.com',     citta:'Brescia',   provincia:'BS', sesso:'M', studioId:STUDIO_MI, canale:'Passaparola' },
  { nome:'Serena',    cognome:'Amato',      dataNascita:new Date('1995-06-30'), telefono:'3801100605', email:'serena.amato.paz@yahoo.it',        citta:'Como',      provincia:'CO', sesso:'F', studioId:STUDIO_MI, canale:'Facebook'    },
  { nome:'Gianluca',  cognome:'Rizzi',      dataNascita:new Date('1969-09-07'), telefono:'3461100606', email:'gianluca.rizzi.paz@gmail.com',     citta:'Varese',    provincia:'VA', sesso:'M', studioId:STUDIO_MI, canale:'Google'      },
  { nome:'Monica',    cognome:'Vitale',     dataNascita:new Date('1984-01-22'), telefono:'3491100607', email:'monica.vitale.paz@libero.it',      citta:'Roma',      provincia:'RM', sesso:'F', studioId:STUDIO_RO, canale:'Instagram'   },
  { nome:'Emanuele',  cognome:'Orlando',    dataNascita:new Date('1977-05-14'), telefono:'3751100608', email:'emanuele.orlando.paz@gmail.com',   citta:'Roma',      provincia:'RM', sesso:'M', studioId:STUDIO_RO, canale:'Passaparola' },
  { nome:'Sabrina',   cognome:'Longo',      dataNascita:new Date('1992-10-28'), telefono:'3451100609', email:'sabrina.longo.paz@gmail.com',      citta:'Napoli',    provincia:'NA', sesso:'F', studioId:STUDIO_RO, canale:'Facebook'    },
  { nome:'Claudio',   cognome:'Basile',     dataNascita:new Date('1966-03-05'), telefono:'3331100610', email:'claudio.basile.paz@gmail.com',     citta:'Roma',      provincia:'RM', sesso:'M', studioId:STUDIO_RO, canale:'Google'      },
  { nome:'Noemi',     cognome:'Cattaneo',   dataNascita:new Date('1998-07-19'), telefono:'3591100611', email:'noemi.cattaneo.paz@gmail.com',     citta:'Milano',    provincia:'MI', sesso:'F', studioId:STUDIO_MI, canale:'Instagram'   },
  { nome:'Enrico',    cognome:'Giordano',   dataNascita:new Date('1981-12-11'), telefono:'3471100612', email:'enrico.giordano.paz@libero.it',    citta:'Lecco',     provincia:'LC', sesso:'M', studioId:STUDIO_MI, canale:'Passaparola' },
  { nome:'Francesca', cognome:'Colombo',    dataNascita:new Date('1989-04-03'), telefono:'3481100613', email:'francesca.colombo.paz@gmail.com',  citta:'Milano',    provincia:'MI', sesso:'F', studioId:STUDIO_MI, canale:'Facebook'    },
  { nome:'Massimo',   cognome:'Fiore',      dataNascita:new Date('1971-09-16'), telefono:'3291100614', email:'massimo.fiore.paz@gmail.com',      citta:'Pavia',     provincia:'PV', sesso:'M', studioId:STUDIO_MI, canale:'Google'      },
  { nome:'Giovanna',  cognome:'Palumbo',    dataNascita:new Date('1963-06-08'), telefono:'3661100615', email:'giovanna.palumbo.paz@libero.it',   citta:'Roma',      provincia:'RM', sesso:'F', studioId:STUDIO_RO, canale:'Passaparola' },
  { nome:'Simone',    cognome:'Marchetti',  dataNascita:new Date('1986-11-27'), telefono:'3471100616', email:'simone.marchetti.paz@gmail.com',   citta:'Firenze',   provincia:'FI', sesso:'M', studioId:STUDIO_RO, canale:'Instagram'   },
  { nome:'Alessia',   cognome:'Silvestri',  dataNascita:new Date('1994-02-09'), telefono:'3801100617', email:'alessia.silvestri.paz@gmail.com',  citta:'Milano',    provincia:'MI', sesso:'F', studioId:STUDIO_MI, canale:'Facebook'    },
  { nome:'Fabio',     cognome:'De Rosa',    dataNascita:new Date('1976-08-21'), telefono:'3461100618', email:'fabio.derosa.paz@gmail.com',       citta:'Monza',     provincia:'MB', sesso:'M', studioId:STUDIO_MI, canale:'Google'      },
  { nome:'Cinzia',    cognome:'Rinaldi',    dataNascita:new Date('1983-03-14'), telefono:'3491100619', email:'cinzia.rinaldi.paz@yahoo.it',      citta:'Roma',      provincia:'RM', sesso:'F', studioId:STUDIO_RO, canale:'Passaparola' },
  { nome:'Lorenzo',   cognome:'Poli',       dataNascita:new Date('1990-07-02'), telefono:'3751100620', email:'lorenzo.poli.paz@gmail.com',       citta:'Milano',    provincia:'MI', sesso:'M', studioId:STUDIO_MI, canale:'Instagram'   },
]

async function seed() {
  const now = new Date()

  for (const l of nuoviLead) {
    await p.lead.create({ data: { ...l, dataLead: new Date() } })
  }
  console.log(`✓ ${nuoviLead.length} lead inseriti`)

  const paz = []
  for (const pa of nuoviPazienti) {
    const c = await p.paziente.create({ data: { ...pa, tipo:'PRIVATO', dataDiventaPaziente:new Date() } })
    paz.push(c)
  }
  console.log(`✓ ${paz.length} pazienti inseriti`)

  // 20 appuntamenti passati
  const passati = [
    { g:30, ora:9,  i:0,  m:MEDICO_FABIO,   s:SALA1_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:29, ora:10, i:1,  m:MEDICO_MAURI,   s:SALA2_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:27, ora:14, i:2,  m:MEDICO_FABIO,   s:SALA3_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:26, ora:9,  i:3,  m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:24, ora:11, i:4,  m:MEDICO_MAURI,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:22, ora:15, i:5,  m:MEDICO_FABIO,   s:SALA2_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:21, ora:9,  i:6,  m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:19, ora:10, i:7,  m:MEDICO_MAURI,   s:SALA3_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:18, ora:14, i:8,  m:MEDICO_FABIO,   s:SALA1_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:16, ora:11, i:9,  m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:15, ora:9,  i:10, m:MEDICO_FABIO,   s:SALA2_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:13, ora:15, i:11, m:MEDICO_MAURI,   s:SALA1_MI, st:STUDIO_MI, pr:MANT_ID,    t:'Mantenimento', p:500 },
    { g:12, ora:9,  i:12, m:MEDICO_FABIO,   s:SALA3_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:10, ora:10, i:13, m:MEDICO_MAURI,   s:SALA2_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:9,  ora:14, i:14, m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:7,  ora:11, i:15, m:MEDICO_FABIO,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:6,  ora:9,  i:16, m:MEDICO_MAURI,   s:SALA3_MI, st:STUDIO_MI, pr:FITO_ID,    t:'Fitoterapia',  p:450 },
    { g:4,  ora:15, i:17, m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:2,  ora:10, i:18, m:MEDICO_FABIO,   s:SALA2_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:1,  ora:14, i:19, m:MEDICO_MAURI,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
  ]

  for (const a of passati) {
    const inizio = new Date(now); inizio.setDate(inizio.getDate()-a.g); inizio.setHours(a.ora,0,0,0)
    const fine = new Date(inizio.getTime()+3600000)
    await p.appuntamento.create({ data: {
      studioId:a.st, pazienteId:paz[a.i].id, medicoId:a.m, salaId:a.s,
      prestazioneId:a.pr, tipoPrestazione:a.t,
      inizio, fine, stato:'COMPLETATO', prezzoBase:a.p, prezzoApplicato:a.p,
      eseguita:true, dataEsecuzione:fine,
    }})
  }
  console.log(`✓ ${passati.length} appuntamenti passati inseriti`)

  // 20 appuntamenti futuri
  const futuri = [
    { g:1,  ora:9,  i:0,  m:MEDICO_FABIO,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:1,  ora:14, i:1,  m:MEDICO_MAURI,   s:SALA2_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:2,  ora:10, i:2,  m:MEDICO_FABIO,   s:SALA3_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:2,  ora:16, i:3,  m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:3,  ora:9,  i:4,  m:MEDICO_MAURI,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:3,  ora:11, i:5,  m:MEDICO_FABIO,   s:SALA2_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:4,  ora:14, i:6,  m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:4,  ora:9,  i:7,  m:MEDICO_MAURI,   s:SALA3_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:5,  ora:10, i:8,  m:MEDICO_FABIO,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:5,  ora:15, i:9,  m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:MANT_ID,    t:'Mantenimento', p:500 },
    { g:6,  ora:9,  i:10, m:MEDICO_FABIO,   s:SALA2_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:7,  ora:11, i:11, m:MEDICO_MAURI,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:8,  ora:10, i:12, m:MEDICO_FABIO,   s:SALA3_MI, st:STUDIO_MI, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:9,  ora:14, i:13, m:MEDICO_MAURI,   s:SALA2_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:10, ora:9,  i:14, m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:11, ora:11, i:15, m:MEDICO_FABIO,   s:SALA1_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:12, ora:15, i:16, m:MEDICO_MAURI,   s:SALA3_MI, st:STUDIO_MI, pr:FITO_ID,    t:'Fitoterapia',  p:450 },
    { g:13, ora:10, i:17, m:MEDICO_ROBERTA, s:SALA1_RO, st:STUDIO_RO, pr:BIOSCAN_ID, t:'Bioscan',      p:300 },
    { g:14, ora:9,  i:18, m:MEDICO_FABIO,   s:SALA2_MI, st:STUDIO_MI, pr:CURA_ID,    t:'Cura',         p:500 },
    { g:15, ora:14, i:19, m:MEDICO_MAURI,   s:SALA1_MI, st:STUDIO_MI, pr:MANT_ID,    t:'Mantenimento', p:500 },
  ]

  for (const a of futuri) {
    const inizio = new Date(now); inizio.setDate(inizio.getDate()+a.g); inizio.setHours(a.ora,0,0,0)
    const fine = new Date(inizio.getTime()+3600000)
    await p.appuntamento.create({ data: {
      studioId:a.st, pazienteId:paz[a.i].id, medicoId:a.m, salaId:a.s,
      prestazioneId:a.pr, tipoPrestazione:a.t,
      inizio, fine, stato:'CONFERMATO', prezzoBase:a.p, prezzoApplicato:a.p,
    }})
  }
  console.log(`✓ ${futuri.length} appuntamenti futuri inseriti`)

  await p.$disconnect()
  console.log('\nSeed completato.')
}

seed().catch(e => { console.error('Errore:', e.message); p.$disconnect(); process.exit(1) })
