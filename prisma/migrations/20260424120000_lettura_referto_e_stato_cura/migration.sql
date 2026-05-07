-- Aggiunge il link all'appuntamento di lettura referto sul bioscan
ALTER TABLE "Bioscan" ADD COLUMN "letturaRefertoId" TEXT;
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_letturaRefertoId_key" UNIQUE ("letturaRefertoId");

-- Aggiunge lo stato cura sul paziente (DA_RICHIAMARE, NON_INTERESSATO, null)
ALTER TABLE "Paziente" ADD COLUMN "statoCura" TEXT;
