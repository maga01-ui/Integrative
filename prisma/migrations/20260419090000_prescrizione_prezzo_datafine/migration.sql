-- Aggiunge prezzo override per riga prodotto prescrizione
ALTER TABLE "PrescrizioneProdotto"
  ADD COLUMN IF NOT EXISTS "prezzoMese" DECIMAL(10,2);
