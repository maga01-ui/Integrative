-- Aggiunge campo effettuato (bioscan eseguito) e appuntamentoId (link al calendario)
ALTER TABLE "Bioscan" ADD COLUMN IF NOT EXISTS "effettuato" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bioscan" ADD COLUMN IF NOT EXISTS "appuntamentoId" TEXT;
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_appuntamentoId_key" UNIQUE ("appuntamentoId");
