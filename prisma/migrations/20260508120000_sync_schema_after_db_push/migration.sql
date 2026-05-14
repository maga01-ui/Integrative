-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('CASH', 'BONIFICO', 'CARTA', 'TOKEN');

-- DropForeignKey
ALTER TABLE "Bioscan" DROP CONSTRAINT "Bioscan_percorsoId_fkey";

-- DropIndex
DROP INDEX "Programma_ordine_idx";

-- DropIndex
DROP INDEX "ProgrammaCura_programmaId_idx";

-- DropIndex
DROP INDEX "ProgrammaPaziente_pazienteId_idx";

-- DropIndex
DROP INDEX "ProgrammaPaziente_percorsoId_idx";

-- AlterTable
ALTER TABLE "Bioscan" ADD COLUMN     "prezzo" DECIMAL(65,30),
ALTER COLUMN "percorsoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Fattura" ADD COLUMN     "bioscanId" TEXT,
ADD COLUMN     "metodoPagamento" "MetodoPagamento";

-- AlterTable
ALTER TABLE "Paziente" ADD COLUMN     "note" TEXT,
ADD COLUMN     "perso" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "persoNota" TEXT,
ADD COLUMN     "sesso" TEXT,
ADD COLUMN     "stato" TEXT DEFAULT 'Italia';

-- AlterTable
ALTER TABLE "Percorso" ADD COLUMN     "sessioniTotali" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Programma" ALTER COLUMN "tipo" SET DEFAULT 'TRATTAMENTI',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProgrammaPaziente" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Utente" ADD COLUMN     "colore" TEXT NOT NULL DEFAULT '#6366f1';

-- CreateTable
CREATE TABLE "TipologiaBioscan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tipologia" TEXT NOT NULL,
    "colore" TEXT NOT NULL DEFAULT '#6366f1',
    "prezzo" DECIMAL(10,2) NOT NULL,
    "durataMinuti" INTEGER NOT NULL DEFAULT 60,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TipologiaBioscan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrigineAcquisizione" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrigineAcquisizione_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipologiaBioscan_studioId_ordine_idx" ON "TipologiaBioscan"("studioId", "ordine");

-- CreateIndex
CREATE INDEX "OrigineAcquisizione_studioId_ordine_idx" ON "OrigineAcquisizione"("studioId", "ordine");

-- CreateIndex
CREATE UNIQUE INDEX "Fattura_bioscanId_key" ON "Fattura"("bioscanId");

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_percorsoId_fkey" FOREIGN KEY ("percorsoId") REFERENCES "Percorso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_appuntamentoId_fkey" FOREIGN KEY ("appuntamentoId") REFERENCES "Appuntamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bioscan" ADD CONSTRAINT "Bioscan_letturaRefertoId_fkey" FOREIGN KEY ("letturaRefertoId") REFERENCES "Appuntamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipologiaBioscan" ADD CONSTRAINT "TipologiaBioscan_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fattura" ADD CONSTRAINT "Fattura_bioscanId_fkey" FOREIGN KEY ("bioscanId") REFERENCES "Bioscan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrigineAcquisizione" ADD CONSTRAINT "OrigineAcquisizione_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
