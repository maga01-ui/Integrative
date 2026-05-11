-- Rinomina il valore dell'enum MetodoPagamento da 'TOKEN' a 'OMAGGIO'.
-- ALTER TYPE ... RENAME VALUE mantiene tutti i record esistenti senza perdita di dati.
ALTER TYPE "MetodoPagamento" RENAME VALUE 'TOKEN' TO 'OMAGGIO';
