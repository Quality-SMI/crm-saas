# ─── Stage 1: build (Debian/glibc evita incompatibilidade de binários nativos no Alpine) ─
FROM node:22-slim AS build
WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .

# NEXT_PUBLIC_* precisa estar disponível no build pois é injetado no bundle
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ─── Stage 2: runtime (standalone, alpine mínimo) ─────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

# O standalone output é JS puro — roda em qualquer node sem binários nativos
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').createConnection(3001,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
