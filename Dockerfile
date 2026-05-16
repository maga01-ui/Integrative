# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile per Next.js + Prisma su Google Cloud Run
#
# Strategia "multi-stage": ogni FROM è uno stage indipendente. Solo il contenuto
# dell'ultimo stage finisce nell'immagine finale, quindi tutto quello che serve
# solo per buildare (devDependencies, sorgenti, ecc.) NON viene incluso.
#
# Cloud Run: l'app deve ascoltare sulla porta indicata dalla env PORT (default 8080).
# Le variabili sensibili (DATABASE_URL, NEXTAUTH_SECRET, chiavi Twilio/Resend, ecc.)
# vanno impostate sul servizio Cloud Run, NON dentro questo file.
# ──────────────────────────────────────────────────────────────────────────────


# ── Stage 1: deps ────────────────────────────────────────────────────────────
# Installa solo le dipendenze npm. Stage separato così la cache di Docker
# rimane valida finché non cambiano package.json / package-lock.json.
FROM node:20-slim AS deps
WORKDIR /app

# openssl serve a Prisma a runtime e in fase di generate.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Copio anche lo schema Prisma: postinstall di @prisma/client lo cerca.
COPY prisma ./prisma

# `npm ci` = install pulito basato sul lock file.
RUN npm ci


# ── Stage 2: builder ─────────────────────────────────────────────────────────
# Genera il Prisma Client e compila l'app Next.js (output: 'standalone').
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Riusa node_modules dal primo stage.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera il Prisma Client (richiede ./prisma/schema.prisma)
RUN npx prisma generate

# Build di Next.js. Disabilito la telemetria per evitare richieste di rete in build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ── Stage 3: runner ──────────────────────────────────────────────────────────
# Immagine finale: solo i file necessari per eseguire l'app in produzione.
FROM node:20-slim AS runner
WORKDIR /app

# openssl serve al runtime di Prisma per connessioni TLS (es. Cloud SQL).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run inietta PORT; impostiamo un default sensato.
ENV PORT=8080
# Necessario per ascoltare su tutte le interfacce dentro al container.
ENV HOSTNAME=0.0.0.0

# Eseguiamo l'app come utente non-root, buona pratica di sicurezza.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Copia il bundle "standalone" prodotto da next build.
# Questo include server.js + le node_modules strettamente necessarie.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Gli asset statici di Next NON sono dentro standalone, vanno copiati a parte.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Il client Prisma generato (binari nativi inclusi). standalone a volte non
# li include automaticamente, quindi li copiamo esplicitamente per sicurezza.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
# Copio tutto @prisma (include sia "client" usato a runtime, sia "engines"
# che serve alla CLI per applicare le migration allo startup).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# La CLI di Prisma (serve per eseguire "prisma migrate deploy" all'avvio).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# Schema + cartella migrations: "migrate deploy" li legge da ./prisma.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 8080

# Avvio in due passi:
#  1) "prisma migrate deploy" applica TUTTE le migration non ancora presenti
#     sul database di produzione. Se non ce ne sono, non fa nulla (idempotente).
#  2) "node server.js" avvia l'app Next.js (server generato da output: standalone).
#
# Stampo dei marker (>>> ...) prima e dopo ogni passo: così nei log di Cloud
# Run è facile capire a quale punto si è arrivati. "set -e" fa uscire lo
# script al primo errore (con codice di uscita ≠ 0). "exec" sostituisce il
# processo della shell con node, così Node riceve direttamente i segnali di
# stop di Cloud Run (graceful shutdown).
CMD ["sh", "-c", "set -e; echo '>>> [boot] node version:' $(node -v); echo '>>> [boot] running prisma migrate deploy'; node node_modules/prisma/build/index.js migrate deploy; echo '>>> [boot] migrations OK, starting next server'; exec node server.js"]
