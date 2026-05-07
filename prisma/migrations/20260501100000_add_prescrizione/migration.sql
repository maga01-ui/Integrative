-- Aggiunge tabella Prescrizione: documento medico generico emesso per un paziente
CREATE TABLE "Prescrizione" (
  "id"          TEXT NOT NULL,
  "studioId"    TEXT NOT NULL,
  "pazienteId"  TEXT NOT NULL,
  "medicoId"    TEXT NOT NULL,
  "data"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contenuto"   TEXT NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prescrizione_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prescrizione_studioId_pazienteId_idx" ON "Prescrizione"("studioId", "pazienteId");

ALTER TABLE "Prescrizione" ADD CONSTRAINT "Prescrizione_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Prescrizione" ADD CONSTRAINT "Prescrizione_pazienteId_fkey"
  FOREIGN KEY ("pazienteId") REFERENCES "Paziente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Prescrizione" ADD CONSTRAINT "Prescrizione_medicoId_fkey"
  FOREIGN KEY ("medicoId") REFERENCES "Utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
