# syntax=docker/dockerfile:1

FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches patches
COPY apps/helper/package.json apps/helper/package.json
COPY packages/helper-protocol/package.json packages/helper-protocol/package.json
COPY packages/mikan/package.json packages/mikan/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @torrent-vibe/helper...
COPY apps/helper apps/helper
COPY packages/helper-protocol packages/helper-protocol
COPY packages/mikan packages/mikan

ENV PORT=17890 \
  DATA_DIR=/data \
  LIBRARY_ROOT=/library \
  QBIT_URL=http://127.0.0.1:8080

EXPOSE 17890
VOLUME ["/data", "/library"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||17890)+'/discover').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/helper
CMD ["pnpm", "start"]
