-- Aggiunge alla tabella Sala due colonne per tracciare il periodo di attività:
--   dataAttivazione    = inizio del periodo di attività corrente (default: ora)
--   dataDisattivazione = quando la sala è stata "eliminata"/disattivata (NULL se ancora attiva)
-- Permette al calendario di mostrare la sala solo nei giorni in cui era attiva.

ALTER TABLE "Sala" ADD COLUMN "dataAttivazione"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Sala" ADD COLUMN "dataDisattivazione" TIMESTAMP(3);

-- Per le sale già disattivate al momento della migrazione, considera la
-- disattivazione avvenuta "ora" — è il dato migliore disponibile dato
-- che non avevamo questo campo prima.
UPDATE "Sala"
   SET "dataDisattivazione" = CURRENT_TIMESTAMP
 WHERE "attiva" = false;
