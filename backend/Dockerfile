# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Força development para que npm ci instale devDependencies (nest CLI etc.)
ENV NODE_ENV=development

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
# Invoca nest diretamente via node para evitar dependência de PATH
RUN NODE_OPTIONS="--max-old-space-size=512" node node_modules/@nestjs/cli/bin/nest.js build
RUN npm prune --omit=dev

# ─── Stage 2: runtime ───────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').createConnection(3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main"]
