-- Aggiunge il valore FISSATO all'enum StatoAppuntamento
-- Gli appuntamenti nuovi vengono creati come FISSATO invece di CONFERMATO
ALTER TYPE "StatoAppuntamento" ADD VALUE IF NOT EXISTS 'FISSATO';

-- Cambia il default della colonna stato
ALTER TABLE "Appuntamento" ALTER COLUMN "stato" SET DEFAULT 'FISSATO'::"StatoAppuntamento";
