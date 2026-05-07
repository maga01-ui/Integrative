-- Imposta FISSATO come default della colonna Appuntamento.stato.
-- Spezzata dalla migration `20260420100000_aggiungi_stato_fissato` perché
-- Postgres non permette di aggiungere un nuovo valore a un enum e usarlo
-- nella stessa transazione (errore 55P04). Qui la migration precedente è
-- già stata committata, quindi possiamo usare 'FISSATO' senza problemi.
ALTER TABLE "Appuntamento" ALTER COLUMN "stato" SET DEFAULT 'FISSATO'::"StatoAppuntamento";
