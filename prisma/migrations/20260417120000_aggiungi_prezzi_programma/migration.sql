-- Crea l'enum StatoProgramma (ATTIVO, SOSPESO, COMPLETATO)
CREATE TYPE "StatoProgramma" AS ENUM ('ATTIVO', 'SOSPESO', 'COMPLETATO');

-- ── Crea tabella Programma ────────────────────────────────────────────────────
-- Rappresenta un tipo di programma di cure (es. "Programma Base", "Mantenimento")
-- È globale: non appartiene a un singolo studio
CREATE TABLE "Programma" (
    "id"                     TEXT NOT NULL,
    "nome"                   TEXT NOT NULL,
    "descrizione"            TEXT,
    "tipo"                   "TipoCura" NOT NULL,
    "defaultSessioni"        INTEGER NOT NULL DEFAULT 8,
    "prezzoSessione"         DECIMAL(10,2) NOT NULL DEFAULT 500,
    "prezzoBioscanIniziale"  DECIMAL(10,2) NOT NULL DEFAULT 300,
    "prezzoBioscanControllo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "attivo"                 BOOLEAN NOT NULL DEFAULT true,
    "ordine"                 INTEGER NOT NULL DEFAULT 0,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Programma_pkey" PRIMARY KEY ("id")
);

-- ── Crea tabella ProgrammaCura ────────────────────────────────────────────────
-- Rappresenta un singolo step/cura all'interno di un programma template
CREATE TABLE "ProgrammaCura" (
    "id"              TEXT NOT NULL,
    "programmaId"     TEXT NOT NULL,
    "nome"            TEXT NOT NULL,
    "tipoPrestazione" "TipoPrestazione" NOT NULL,
    "prestazioneId"   TEXT,
    "prezzo"          DECIMAL(10,2) NOT NULL,
    "durataMinuti"    INTEGER NOT NULL,
    "ordine"          INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgrammaCura_pkey" PRIMARY KEY ("id")
);

-- ── Crea tabella ProgrammaPaziente ────────────────────────────────────────────
-- Assegnazione di un programma a un paziente (istanza del programma)
CREATE TABLE "ProgrammaPaziente" (
    "id"                 TEXT NOT NULL,
    "programmaId"        TEXT NOT NULL,
    "pazienteId"         TEXT NOT NULL,
    "percorsoId"         TEXT NOT NULL,
    "sessioniTotali"     INTEGER NOT NULL DEFAULT 8,
    "sessioniCompletate" INTEGER NOT NULL DEFAULT 0,
    "stato"              "StatoProgramma" NOT NULL DEFAULT 'ATTIVO',
    "dataInizio"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFine"           TIMESTAMP(3),
    "note"               TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgrammaPaziente_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys ProgrammaCura ─────────────────────────────────────────────
ALTER TABLE "ProgrammaCura" ADD CONSTRAINT "ProgrammaCura_programmaId_fkey"
    FOREIGN KEY ("programmaId") REFERENCES "Programma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgrammaCura" ADD CONSTRAINT "ProgrammaCura_prestazioneId_fkey"
    FOREIGN KEY ("prestazioneId") REFERENCES "Prestazione"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Foreign keys ProgrammaPaziente ────────────────────────────────────────
ALTER TABLE "ProgrammaPaziente" ADD CONSTRAINT "ProgrammaPaziente_programmaId_fkey"
    FOREIGN KEY ("programmaId") REFERENCES "Programma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgrammaPaziente" ADD CONSTRAINT "ProgrammaPaziente_pazienteId_fkey"
    FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProgrammaPaziente" ADD CONSTRAINT "ProgrammaPaziente_percorsoId_fkey"
    FOREIGN KEY ("percorsoId") REFERENCES "Percorso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Aggiunge programmaPazienteId su Appuntamento ──────────────────────────
ALTER TABLE "Appuntamento" ADD COLUMN "programmaPazienteId" TEXT;

ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_programmaPazienteId_fkey"
    FOREIGN KEY ("programmaPazienteId") REFERENCES "ProgrammaPaziente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Indici per le query frequenti ─────────────────────────────────────────
CREATE INDEX "Programma_ordine_idx" ON "Programma"("ordine");
CREATE INDEX "ProgrammaCura_programmaId_idx" ON "ProgrammaCura"("programmaId");
CREATE INDEX "ProgrammaPaziente_pazienteId_idx" ON "ProgrammaPaziente"("pazienteId");
CREATE INDEX "ProgrammaPaziente_percorsoId_idx" ON "ProgrammaPaziente"("percorsoId");
CREATE INDEX "Appuntamento_programmaPazienteId_idx" ON "Appuntamento"("programmaPazienteId");
