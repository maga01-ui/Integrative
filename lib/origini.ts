// Helper per le "Origini di acquisizione" pazienti.
//
// Le origini di un paziente possono provenire da DUE fonti diverse:
//
//   1. Origini "manuali" → righe nella tabella OrigineAcquisizione (Diretto,
//      Marketing, Passaparola, voci personalizzate, ecc.). Sono gestite dalla
//      pagina /impostazioni/origini.
//
//   2. Origini "referral" → operatori (Utente) che sono stati segnati come
//      `isReferral = true` in almeno un team dello studio. Il loro nome
//      cognome compare automaticamente nella lista, così è possibile
//      selezionarli quando si registra un paziente che è arrivato grazie
//      a quel referral.
//
// Questo helper unisce le due fonti e restituisce un unico array, in modo
// che i form (nuovo paziente, nuovo lead, anagrafica…) non si debbano
// preoccupare di gestire la differenza.

import { prisma } from '@/lib/prisma'

export type OrigineItem = {
  id:         string   // id univoco — per i referral è "ref:<utenteId>"
  nome:       string   // testo da mostrare nella select (e da salvare in canale)
  isReferral: boolean  // true se è un operatore referral, false se voce manuale
}

// ── Origini per UNO studio specifico ──────────────────────────────────────────
// Usata per gli utenti normali (non SUPERADMIN), che vedono solo le origini
// del proprio studio. Restituisce solo origini ATTIVE (quelle disattivate
// dalla pagina impostazioni vengono nascoste).
export async function getOriginiPerStudio(studioId: string): Promise<OrigineItem[]> {
  // 1) Origini manuali configurate per lo studio (solo attive)
  const manuali = await prisma.$queryRaw<{ id: string; nome: string; ordine: number }[]>`
    SELECT id, nome, ordine
      FROM "OrigineAcquisizione"
     WHERE "studioId" = ${studioId}
       AND attivo = true
     ORDER BY ordine ASC`

  // 2) Operatori referral dello studio: prendiamo i CollaboratoreTeam con
  //    isReferral = true e team appartenente allo studio richiesto.
  //    DISTINCT su utenteId perché un operatore può essere in più team.
  const referral = await prisma.$queryRaw<{ utenteId: string; nome: string; cognome: string }[]>`
    SELECT DISTINCT u.id   AS "utenteId",
           u.nome          AS "nome",
           u.cognome       AS "cognome"
      FROM "CollaboratoreTeam" ct
      JOIN "Team"   t ON t.id = ct."teamId"
      JOIN "Utente" u ON u.id = ct."utenteId"
     WHERE ct."isReferral" = true
       AND ct."dataFine"   IS NULL
       AND t."studioId"    = ${studioId}
       AND u.attivo        = true
     ORDER BY u.cognome ASC, u.nome ASC`

  return [
    ...manuali.map(m => ({ id: m.id, nome: m.nome, isReferral: false })),
    ...referral.map(r => ({
      id:         `ref:${r.utenteId}`,
      nome:       `${r.cognome} ${r.nome} (referral)`,
      isReferral: true,
    })),
  ]
}

// ── Origini di TUTTI gli studi ────────────────────────────────────────────────
// Usata per i SUPERADMIN, che non hanno uno studioId proprio e vedono tutto.
// Restituisce solo origini ATTIVE.
export async function getOriginiTutteAttive(): Promise<OrigineItem[]> {
  const manuali = await prisma.$queryRaw<{ id: string; nome: string; ordine: number }[]>`
    SELECT id, nome, ordine
      FROM "OrigineAcquisizione"
     WHERE attivo = true
     ORDER BY ordine ASC`

  const referral = await prisma.$queryRaw<{ utenteId: string; nome: string; cognome: string }[]>`
    SELECT DISTINCT u.id   AS "utenteId",
           u.nome          AS "nome",
           u.cognome       AS "cognome"
      FROM "CollaboratoreTeam" ct
      JOIN "Utente" u ON u.id = ct."utenteId"
     WHERE ct."isReferral" = true
       AND ct."dataFine"   IS NULL
       AND u.attivo        = true
     ORDER BY u.cognome ASC, u.nome ASC`

  return [
    ...manuali.map(m => ({ id: m.id, nome: m.nome, isReferral: false })),
    ...referral.map(r => ({
      id:         `ref:${r.utenteId}`,
      nome:       `${r.cognome} ${r.nome} (referral)`,
      isReferral: true,
    })),
  ]
}

// ── Origini per la pagina /impostazioni/origini ───────────────────────────────
// Mostra anche le origini disattivate (per poterle riattivare) e include i
// referral come voci di sola lettura. Restituisce un singolo studio o tutti
// (per SUPERADMIN). Usata SOLO dalla pagina di gestione, non dai form.
export type OrigineRiga = {
  id:         string
  nome:       string
  ordine:     number
  attivo:     boolean
  isReferral: boolean
  utenteId:   string | null  // popolato solo per i referral
}

export async function getOriginiPerImpostazioni(
  studioId: string | null,
): Promise<OrigineRiga[]> {
  // 1) Origini manuali — anche disattive
  const manuali = studioId
    ? await prisma.$queryRaw<{ id: string; nome: string; ordine: number; attivo: boolean }[]>`
        SELECT id, nome, ordine, attivo
          FROM "OrigineAcquisizione"
         WHERE "studioId" = ${studioId}
         ORDER BY ordine ASC`
    : await prisma.$queryRaw<{ id: string; nome: string; ordine: number; attivo: boolean }[]>`
        SELECT id, nome, ordine, attivo
          FROM "OrigineAcquisizione"
         ORDER BY ordine ASC`

  // 2) Operatori referral attivi (escludiamo i CollaboratoreTeam disattivati,
  //    cioè quelli con dataFine valorizzata).
  const referral = studioId
    ? await prisma.$queryRaw<{ utenteId: string; nome: string; cognome: string }[]>`
        SELECT DISTINCT u.id   AS "utenteId",
               u.nome          AS "nome",
               u.cognome       AS "cognome"
          FROM "CollaboratoreTeam" ct
          JOIN "Team"   t ON t.id = ct."teamId"
          JOIN "Utente" u ON u.id = ct."utenteId"
         WHERE ct."isReferral" = true
           AND ct."dataFine"   IS NULL
           AND t."studioId"    = ${studioId}
           AND u.attivo        = true
         ORDER BY u.cognome ASC, u.nome ASC`
    : await prisma.$queryRaw<{ utenteId: string; nome: string; cognome: string }[]>`
        SELECT DISTINCT u.id   AS "utenteId",
               u.nome          AS "nome",
               u.cognome       AS "cognome"
          FROM "CollaboratoreTeam" ct
          JOIN "Utente" u ON u.id = ct."utenteId"
         WHERE ct."isReferral" = true
           AND ct."dataFine"   IS NULL
           AND u.attivo        = true
         ORDER BY u.cognome ASC, u.nome ASC`

  // I referral vengono accodati in fondo alla lista delle voci manuali
  const ultimoOrdine = manuali.length > 0 ? Math.max(...manuali.map(m => m.ordine)) : -1
  return [
    ...manuali.map(m => ({
      id:         m.id,
      nome:       m.nome,
      ordine:     m.ordine,
      attivo:     m.attivo,
      isReferral: false,
      utenteId:   null,
    })),
    ...referral.map((r, idx) => ({
      id:         `ref:${r.utenteId}`,
      nome:       `${r.cognome} ${r.nome}`,
      ordine:     ultimoOrdine + 1 + idx,
      attivo:     true,
      isReferral: true,
      utenteId:   r.utenteId,
    })),
  ]
}
