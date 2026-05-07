/*
  Warnings:

  - Changed the type of `tipoPrestazione` on the `Appuntamento` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable: aggiunge prestazioneId e converte tipoPrestazione da enum a TEXT
-- (il cast enum→text in PostgreSQL è implicito e preserva i valori esistenti)
ALTER TABLE "Appuntamento" ADD COLUMN "prestazioneId" TEXT;
ALTER TABLE "Appuntamento" ALTER COLUMN "tipoPrestazione" TYPE TEXT;

-- CreateTable
CREATE TABLE "Prestazione" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "colore" TEXT NOT NULL DEFAULT '#64748b',
    "prezzoBase" DECIMAL(10,2) NOT NULL,
    "durataMinuti" INTEGER NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attiva" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Prestazione_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prestazione_studioId_ordine_idx" ON "Prestazione"("studioId", "ordine");

-- AddForeignKey
ALTER TABLE "Prestazione" ADD CONSTRAINT "Prestazione_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appuntamento" ADD CONSTRAINT "Appuntamento_prestazioneId_fkey" FOREIGN KEY ("prestazioneId") REFERENCES "Prestazione"("id") ON DELETE SET NULL ON UPDATE CASCADE;
