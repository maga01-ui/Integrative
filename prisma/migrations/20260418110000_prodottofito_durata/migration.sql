-- Aggiunge durata di default (in mesi) ai prodotti fitoterapici
ALTER TABLE "ProdottoFito"
  ADD COLUMN IF NOT EXISTS "durataDefaultMesi" INTEGER NOT NULL DEFAULT 1;
