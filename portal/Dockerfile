# syntax=docker/dockerfile:1

# --- Build stage ---
FROM oven/bun:1.2 AS builder
WORKDIR /app

# Install deps (no lockfile committed yet; bun will generate bun.lockb)
COPY package.json ./
RUN bun install

# Build TS → dist
COPY tsconfig.json ./
COPY src ./src

ARG SIGNING_ED25519_PRIVATE_KEY
ARG DATABASE_URL

RUN bun run build


# --- Runtime stage ---
FROM oven/bun:1.2 AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=15000

# Install production deps
COPY package.json ./package.json
RUN bun install --production
ARG SIGNING_ED25519_PRIVATE_KEY
ARG DATABASE_URL
# Copy compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 15000
# Simple healthcheck using Bun (no curl needed)
HEALTHCHECK CMD bun -e "const p=process.env.PORT||'15000';let ok=false;await fetch('http://127.0.0.1:'+p+'/api/health').then(r=>ok=r.ok).catch(()=>{});process.exit(ok?0:1)"

# Run the server
CMD ["bun", "run", "dist/index.js"]


