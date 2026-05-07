-- CreateEnum
CREATE TYPE "Ruolo" AS ENUM ('SUPERADMIN', 'ADMIN', 'MARKETING', 'MEDICO', 'STAFF');

-- CreateEnum
CREATE TYPE "LivelloPermesso" AS ENUM ('NONE', 'READ', 'WRITE');

-- CreateEnum
CREATE TYPE "TipoPaziente" AS ENUM ('PRIVATO', 'AZIENDA');

-- CreateEnum
CREATE TYPE "StatoLead" AS ENUM ('NUOVO', 'DA_RICHIAMARE', 'FOLLOW_UP', 'FISSATO', 'IN_ATTESA_CENTRO', 'APPUNTAMENTO', 'CONVERTITO', 'NON_INTERESSATO');

-- CreateEnum
CREATE TYPE "FasePercorso" AS ENUM ('BIOSCAN_INIZIALE', 'LETTURA_REFERTO', 'IN_CURA', 'MANTENIMENTO', 'CONCLUSO');

-- CreateEnum
CREATE TYPE "TipoCura" AS ENUM ('TRATTAMENTI', 'FITOTERAPIA', 'ENTRAMBI');

-- CreateEnum
CREATE TYPE "TipoPrestazione" AS ENUM ('BIOSCAN', 'LETTURA_REFERTO', 'TRATTAMENTO', 'FITOTERAPIA', 'MANTENIMENTO');

-- CreateEnum
CREATE TYPE "StatoAppuntamento" AS ENUM ('CONFERMATO', 'COMPLETATO', 'CANCELLATO', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "StatoFattura" AS ENUM ('EMESSA', 'PAGATA', 'ANNULLATA');

-- CreateEnum
CREATE TYPE "TipoFattura" AS ENUM ('BIOSCAN', 'TRATTAMENTO', 'FITOTERAPIA', 'MANTENIMENTO');

-- CreateEnum
CREATE TYPE "StatoPrescrizioneFito" AS ENUM ('ATTIVA', 'SOSPESA', 'CONCLUSA');

-- CreateEnum
CREATE TYPE "TipoBioscan" AS ENUM ('INIZIALE', 'CONTROLLO');

-- CreateEnum
CREATE TYPE "RispostaPaziente" AS ENUM ('OTTIMA', 'BUONA', 'SCARSA');

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "indirizzo" TEXT,
    "citta" TEXT,
    "provincia" TEXT,
    "partitaIva" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utente" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "telefono" TEXT,
    "telefonoWa" TEXT,
    "emailContatto" TEXT,
    "partitaIva" TEXT,
    "indirizzo" TEXT,
    "ruolo" "Ruolo" NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permesso" (
    "id" TEXT NOT NULL,
    "utenteId" TEXT NOT NULL,
    "sezione" TEXT NOT NULL,
    "livello" "LivelloPermesso" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "Permesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sala" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "colore" TEXT NOT NULL DEFAULT '#7F77DD',
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaboratoreTeam" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "utenteId" TEXT NOT NULL,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "compensoOra" DECIMAL(10,2) NOT NULL,
    "percentualeTeam" DECIMAL(5,2),
    "isPrimario" BOOLEAN NOT NULL DEFAULT true,
    "dataInizio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFine" TIMESTAMP(3),

    CONSTRAINT "CollaboratoreTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensoPeriodo" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "utenteId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "anno" INTEGER NOT NULL,
    "mese" INTEGER NOT NULL,
    "oreLavorate" DECIMAL(6,2) NOT NULL,
    "compensoOraStorico" DECIMAL(10,2) NOT NULL,
    "subtotaleOre" DECIMAL(10,2) NOT NULL,
    "fattutatoTeam" DECIMAL(10,2),
    "percentualeStorica" DECIMAL(5,2),
    "bonusTeam" DECIMAL(10,2),
    "totale" DECIMAL(10,2) NOT NULL,
    "calcolatoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT NOT NULL,
    "citta" TEXT,
    "provincia" TEXT,
    "canale" TEXT NOT NULL,
    "campagna" TEXT,
    "dataLead" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stato" "StatoLead" NOT NULL DEFAULT 'NUOVO',
    "operatoreId" TEXT,
    "dataRichiamata" TIMESTAMP(3),
    "dataFollowup" TIMESTAMP(3),
    "noteOperatore" TEXT,
    "nascosto" BOOLEAN NOT NULL DEFAULT false,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "convertitoPazienteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paziente" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tipo" "TipoPaziente" NOT NULL DEFAULT 'PRIVATO',
    "nome" TEXT NOT NULL,
    "cognome" TEXT,
    "dataNascita" TIMESTAMP(3),
    "codiceFiscale" TEXT,
    "ragioneSociale" TEXT,
    "partitaIva" TEXT,
    "codiceSDI" TEXT,
    "pec" TEXT,
    "referente" TEXT,
    "indirizzoLegale" TEXT,
    "telefono" TEXT,
    "telefonoWa" TEXT,
    "email" TEXT,
    "indirizzo" TEXT,
    "cap" TEXT,
    "citta" TEXT,
    "provincia" TEXT,
    "operatoreId" TEXT,
    "leadId" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paziente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Percorso" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "pazienteId" TEXT NOT NULL,
    "fase" "FasePercorso" NOT NULL DEFAULT 'BIOSCAN_INIZIALE',
    "tipoCura" "TipoCura",
    "sessioniCompletate" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "dataInizio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFine" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Percorso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bioscan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "pazienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "percorsoId" TEXT NOT NULL,
    "tipo" "TipoBioscan" NOT NULL DEFAULT 'INIZIALE',
    "dataEsecuzione" TIMESTAMP(3) NOT NULL,
    "sistemiAnalizzati" JSONB NOT NULL DEFAULT '[]',
    "livelliStress" JSONB NOT NULL DEFAULT '{}',
    "frequenze" JSONB NOT NULL DEFAULT '{}',
    "interpretazione" TEXT,
    "raccomandazioni" TEXT,
    "refertoConsegnato" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bioscan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appuntamento" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "pazienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "percorsoId" TEXT,
    "teamId" TEXT,
    "tipoPrestazione" "TipoPrestazione" NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "stato" "StatoAppuntamento" NOT NULL DEFAULT 'CONFERMATO',
    "prezzoBase" DECIMAL(10,2) NOT NULL,
    "prezzoApplicato" DECIMAL(10,2) NOT NULL,
    "notePrezzo" TEXT,
    "eseguita" BOOLEAN NOT NULL DEFAULT false,
    "dataEsecuzione" TIMESTAMP(3),
    "eseguitaDa" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appuntamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrattamentoSessione" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "appuntamentoId" TEXT NOT NULL,
    "percorsoId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "numeroSessione" INTEGER NOT NULL,
    "noteCliniche" TEXT,
    "rispostaPaziente" "RispostaPaziente",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrattamentoSessione_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdottoFito" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "produttore" TEXT,
    "principioAttivo" TEXT,
    "dosaggio" TEXT,
    "prezzoMese" DECIMAL(10,2) NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProdottoFito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescrizioneFito" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "percorsoId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "pazienteId" TEXT NOT NULL,
    "dataInizio" TIMESTAMP(3) NOT NULL,
    "dataFine" TIMESTAMP(3),
    "stato" "StatoPrescrizioneFito" NOT NULL DEFAULT 'ATTIVA',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescrizioneFito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescrizioneProdotto" (
    "id" TEXT NOT NULL,
    "prescrizioneId" TEXT NOT NULL,
    "prodottoId" TEXT NOT NULL,
    "posologia" TEXT,
    "durataM" INTEGER NOT NULL,

    CONSTRAINT "PrescrizioneProdotto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fattura" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "pazienteId" TEXT NOT NULL,
    "percorsoId" TEXT,
    "appuntamentoId" TEXT,
    "prescrizioneId" TEXT,
    "tipo" "TipoFattura" NOT NULL,
    "numero" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL,
    "importo" DECIMAL(10,2) NOT NULL,
    "stato" "StatoFattura" NOT NULL DEFAULT 'EMESSA',
    "dataEmissione" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataScadenza" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "notePdf" TEXT,
    "codiceSDI" TEXT,
    "pec" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fattura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "entita" TEXT NOT NULL,
    "entitaId" TEXT NOT NULL,
    "azione" TEXT NOT NULL,
    "utenteId" TEXT,
    "dettagli" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Studio_ordine_idx" ON "Studio"("ordine");

-- CreateIndex
CREATE UNIQUE INDEX "Utente_email_key" ON "Utente"("email");

-- CreateIndex
CREATE INDEX "Utente_studioId_ordine_idx" ON "Utente"("studioId", "ordine");

-- CreateIndex
CREATE UNIQUE INDEX "Permesso_utenteId_sezione_key" ON "Permesso"("utenteId", "sezione");

-- CreateIndex
CREATE INDEX "Sala_studioId_ordine_idx" ON "Sala"("studioId", "ordine");

-- CreateIndex
CREATE INDEX "Team_studioId_ordine_idx" ON "Team"("studioId", "ordine");

-- CreateIndex
CREATE INDEX "CollaboratoreTeam_utenteId_idx" ON "CollaboratoreTeam"("utenteId");

-- CreateIndex
CREATE INDEX "CollaboratoreTeam_teamId_idx" ON "CollaboratoreTeam"("teamId");

-- CreateIndex
CREATE INDEX "CompensoPeriodo_studioId_anno_mese_idx" ON "CompensoPeriodo"("studioId", "anno", "mese");

-- CreateIndex
CREATE UNIQUE INDEX "CompensoPeriodo_utenteId_teamId_anno_mese_key" ON "CompensoPeriodo"("utenteId", "teamId", "anno", "mese");

-- CreateIndex
CREATE INDEX "Lead_studioId_stato_idx" ON "Lead"("studioId", "stato");

-- CreateIndex
CREATE INDEX "Lead_dataRichiamata_idx" ON "Lead"("dataRichiamata");

-- CreateIndex
CREATE INDEX "Paziente_studioId_attivo_idx" ON "Paziente"("studioId", "attivo");

-- CreateIndex
CREATE INDEX "Paziente_studioId_tipo_idx" ON "Paziente"("studioId", "tipo");

-- CreateIndex
CREATE INDEX "Percorso_studioId_attivo_idx" ON "Percorso"("studioId", "attivo");

-- CreateIndex
CREATE INDEX "Percorso_pazienteId_attivo_idx" ON "Percorso"("pazienteId", "attivo");

-- CreateIndex
CREATE INDEX "Bioscan_studioId_pazienteId_idx" ON "Bioscan"("studioId", "pazienteId");

-- CreateIndex
CREATE INDEX "Appuntamento_studioId_medicoId_inizio_fine_idx" ON "Appuntamento"("studioId", "medicoId", "inizio", "fine");

-- CreateIndex
CREATE INDEX "Appuntamento_studioId_salaId_inizio_fine_idx" ON "Appuntamento"("studioId", "salaId", "inizio", "fine");

-- CreateIndex
CREATE INDEX "Appuntamento_studioId_pazienteId_idx" ON "Appuntamento"("studioId", "pazienteId");

-- CreateIndex
CREATE INDEX "Appuntamento_studioId_stato_idx" ON "Appuntamento"("studioId", "stato");

-- CreateIndex
CREATE INDEX "Appuntamento_teamId_idx" ON "Appuntamento"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TrattamentoSessione_appuntamentoId_key" ON "TrattamentoSessione"("appuntamentoId");

-- CreateIndex
CREATE INDEX "TrattamentoSessione_percorsoId_idx" ON "TrattamentoSessione"("percorsoId");

-- CreateIndex
CREATE INDEX "ProdottoFito_studioId_ordine_idx" ON "ProdottoFito"("studioId", "ordine");

-- CreateIndex
CREATE INDEX "PrescrizioneFito_studioId_stato_idx" ON "PrescrizioneFito"("studioId", "stato");

-- CreateIndex
CREATE UNIQUE INDEX "Fattura_appuntamentoId_key" ON "Fattura"("appuntamentoId");

-- CreateIndex
CREATE INDEX "Fattura_studioId_stato_idx" ON "Fattura"("studioId", "stato");

-- CreateIndex
CREATE INDEX "Fattura_studioId_pazienteId_idx" ON "Fattura"("studioId", "pazienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Fattura_studioId_anno_numero_key" ON "Fattura"("studioId", "anno", "numero");

-- CreateIndex
CREATE INDEX "AuditLog_studioId_entita_entitaId_idx" ON "AuditLog"("studioId", "entita", "entitaId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Utente" ADD CONSTRAINT "Utente_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permesso" ADD CONSTRAINT "Permesso_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sala" ADD CONSTRAINT "Sala_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratoreTeam" ADD CONSTRAINT "CollaboratoreTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratoreTeam" ADD CONSTRAINT "CollaboratoreTeam_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paziente" ADD CONSTRAINT "Paziente_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Percorso" ADD CONSTRAINT "Percorso_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Percorso" ADD CONSTRAINT "Percorso_pazienteId_fkey" FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_pazienteId_fkey" FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_percorsoId_fkey" FOREIGN KEY ("percorsoId") REFERENCES "Percorso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_pazienteId_fkey" FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_percorsoId_fkey" FOREIGN KEY ("percorsoId") REFERENCES "Percorso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrattamentoSessione" ADD CONSTRAINT "TrattamentoSessione_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "Appuntamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdottoFito" ADD CONSTRAINT "ProdottoFito_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescrizioneFito" ADD CONSTRAINT "PrescrizioneFito_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescrizioneFito" ADD CONSTRAINT "PrescrizioneFito_percorsoId_fkey" FOREIGN KEY ("percorsoId") REFERENCES "Percorso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescrizioneFito" ADD CONSTRAINT "PrescrizioneFito_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescrizioneFito" ADD CONSTRAINT "PrescrizioneFito_pazienteId_fkey" FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescrizioneProdotto" ADD CONSTRAINT "PrescrizioneProdotto_prescrizioneId_fkey" FOREIGN KEY ("prescrizioneId") REFERENCES "PrescrizioneFito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescrizioneProdotto" ADD CONSTRAINT "PrescrizioneProdotto_prodottoId_fkey" FOREIGN KEY ("prodottoId") REFERENCES "ProdottoFito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_pazienteId_fkey" FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_percorsoId_fkey" FOREIGN KEY ("percorsoId") REFERENCES "Percorso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "Appuntamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_prescrizioneId_fkey" FOREIGN KEY ("prescrizioneId") REFERENCES "PrescrizioneFito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
