-- Aggiunge alla tabella CollaboratoreTeam la colonna "isReferral":
--   true  → l'operatore è un "referral" per lo studio del team:
--           il suo nome appare automaticamente come voce
--           nelle Origini di acquisizione di quello studio.
--   false → operatore normale (default).
--
-- Non serve un backfill: tutti i collaboratori esistenti partono come non-referral.

ALTER TABLE "CollaboratoreTeam"
  ADD COLUMN "isReferral" BOOLEAN NOT NULL DEFAULT false;
