-- Aggiunge durata sessione al Programma e imposta default bioscan iniziale a 0

ALTER TABLE "Programma"
  ADD COLUMN IF NOT EXISTS "durataSessioneMinuti" INTEGER NOT NULL DEFAULT 60;

-- Aggiorna il default del bioscan iniziale a 0 per i nuovi programmi
-- (i record esistenti mantengono il loro valore)
ALTER TABLE "Programma"
  ALTER COLUMN "prezzoBioscanIniziale" SET DEFAULT 0;
