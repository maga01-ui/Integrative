-- Aggiunge il valore FISSATO all'enum StatoAppuntamento.
-- IMPORTANTE: Postgres non permette di aggiungere un valore a un enum e poi
-- usarlo nella stessa transazione (errore 55P04 "unsafe use of new value").
-- Per questo l'aggiornamento del DEFAULT della colonna è in una migration
-- separata: `20260420100100_set_default_fissato`.
ALTER TYPE "StatoAppuntamento" ADD VALUE IF NOT EXISTS 'FISSATO';
