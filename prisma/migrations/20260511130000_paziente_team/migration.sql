-- Aggiunge il campo teamId al Paziente: identifica il team di riferimento
-- del paziente, impostato in fase di creazione e modificabile solo dalla
-- scheda paziente (box in alto). Nullable per i pazienti esistenti.
ALTER TABLE "Paziente" ADD COLUMN "teamId" TEXT;
CREATE INDEX "Paziente_teamId_idx" ON "Paziente"("teamId");
