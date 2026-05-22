# Handoff — CRM Quality SMI

Documento de transição entre máquinas / sessões. Estado em **2026-05-22**.

Para retomar em outra máquina:

```bash
git clone <repo>
cd crm-saas
# Ler na ordem: este arquivo → SECURITY.md → DEPLOY.md
```

---

## 1. Visão geral

Rebuild de CRM legado (PHP/MySQL — `back-dev.geocited.com.br/api/docs/`) para SaaS moderno.

**Stack:**
- Backend: NestJS 11 (TypeScript), TypeORM, PostgreSQL (schemas `iam`, `crm`, `analytics`), Redis
- Frontend: Next.js 16 (App Router, Turbopack), TanStack Query, Zustand, Tailwind 4
- Auth: JWT RS256 access (15min) + refresh (7d) com rotation, ambos em **cookie HttpOnly**
- Deploy: Docker Compose + NGINX (TLS + Basic Auth)

**Diretórios principais:**

```
/Users/matheusbatista/Documents/crm-saas/
├── backend/                  NestJS
│   ├── src/iam/              auth, users, sessions, audit, permissions
│   ├── src/crm/              clients, leads, appointments, geo, blog, keywords, …
│   ├── src/common/           audit, health, mail, filters, decorators
│   └── src/database/migrations/   fonte da verdade do schema
├── frontend/                 Next.js
│   ├── src/app/(auth)/       login, forgot-password, reset-password
│   ├── src/app/(internal)/   dashboard, clients, leads, agenda, blog, geo, settings
│   ├── src/proxy.ts          server-side route guard (Next 16)
│   └── src/lib/api/client.ts axios + cookie-based auth
├── infrastructure/
│   ├── docker/               docker-compose dev + prod
│   ├── nginx/                nginx.conf + templates + snippets
│   └── keys/                 JWT RS256 keys (gitignored)
├── scripts/                  migração de dados legados (uso pontual)
├── DEPLOY.md                 runbook VPS
├── SECURITY.md               checklist + rotação de senha exposta
└── HANDOFF.md                este arquivo
```

---

## 2. Sprints concluídas (anteriores a esta sessão)

| Sprint | Commit | Conteúdo |
|--------|--------|----------|
| 0 | f7f356d | Estrutura base, auth, IAM |
| 1 | b7e4dec | Módulo Clientes |
| 2 | f7e6760 | Módulo Usuários |
| 3 | 1dab00f | Módulo Leads (funil, interações, soft delete) |
| 4 | f1d1bd9 | Módulo Agenda, website/legacy_id em leads, SALES scoping |
| — | cfea326 | "subindo projeto" — push inicial pra origem |

**Esta sessão (2026-05-22):** hardening de segurança + pacote de deploy + recuperação de senha + auditoria.

---

## 3. O que esta sessão entregou

### 3.1 Validação contra a documentação legada

Comparação 1-a-1 com a OpenAPI do sistema antigo (`Maicon Willi - Backend System v2.0.0`, 98 paths, 99 ops). Veja seção 1 do histórico de conversa em [SECURITY.md] não — esse comparativo ficou no chat. Resumo:

- **Implementado no novo CRM**: auth, users (+ roles + my-permissions), clients, leads, blog (artigos, autores, taxonomias), keywords (+ categorias), api-keys, lookup, appointments, geo, positioning, scores, notifications
- **Ausente vs legado** (decidido como MVP atual, sem paridade): `enterprises` (multi-tenant), `portfolios`, `teams`, `marketing/utm`, `maps/regions`, `leads/fields` (form fields dinâmicos)
- **Divergências de design**:
  - Prefixo `/api` (sem `v1`)
  - Auth: legado usa só cookie HttpOnly; novo usa cookie HttpOnly **+** refresh rotation + JWT RS256
  - Modelo single-tenant (vs multi-tenant do legado)

### 3.2 Segurança aplicada

1. **Credencial PG removida** de `scripts/setup-database.js` (lê de env agora) — **mas o segredo continua no commit `cfea326`**. Plano: rotacionar senha + limpar history (não feito nesta sessão; ver [SECURITY.md](SECURITY.md)).
2. **Access token migrado pra cookie HttpOnly** — `JwtStrategy` lê de cookie OU Bearer (fallback). `auth.controller` seta `access_token` + `refresh_token` como `HttpOnly + Secure (prod) + SameSite=Lax + Path=/`. Corrigiu bug pré-existente: logout não revogava refresh porque cookie path estava restrito a `/api/auth/refresh`.
3. **`proxy.ts` (Next 16)** — guard server-side que redireciona rotas internas pra `/login?next=...` quando não há cookie. Em dev usa rewrites `/api/* → http://localhost:3000` pra manter same-origin.
4. **Headers de segurança** — em `next.config.ts` (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Robots-Tag) e replicados no NGINX (defesa em camadas).
5. **`output: standalone`** no Next + Dockerfiles multi-stage com user não-root.
6. **NGINX em produção** — TLS Let's Encrypt + **HTTP Basic Auth global** + rate-limit (`/api/auth/*` em 10r/m, `/api/*` em 30r/s) + `X-Robots-Tag noindex,...` + gzip.
7. **`robots.txt`** via `app/robots.ts` (`Disallow: /`) + meta `noindex,nofollow` no layout.
8. **Audit log** — tabela `iam.audit_log` + `AuditInterceptor` global captura POST/PATCH/PUT/DELETE com user/IP/UA/path/status/duração. Redaction automática em keys sensíveis. Skip em `/health`, `/docs`, `/auth/refresh`.
9. **Recuperação de senha** — backend: tabela `iam.password_reset_tokens` (TTL 30min, hash sha256, single-use, revoga sessões). Endpoints `/auth/forgot-password` e `/auth/reset-password` rate-limited. Frontend: páginas `(auth)/forgot-password` e `(auth)/reset-password` + link no login. `MailService` usa SendGrid se configurado, senão **loga o conteúdo** (dev-friendly).
10. **Health endpoint** `/api/health` com SELECT 1 + uptime.
11. **`compression` middleware** ativado no backend + `trust proxy` pra `req.ip` real atrás do NGINX.
12. **CI GitHub Actions** — `.github/workflows/ci.yml`: lint + build do backend, lint + build do frontend, smoke build das duas imagens Docker.
13. **Specs do AuthService** — 7 testes (senha errada, conta bloqueada, login válido, refresh reuse, refresh ok, forgot silencioso, forgot dispara email). **7/7 pass.**
14. **Migrations TypeORM = fonte da verdade** documentado. `setup-database.js` marcado como legado. Adicionadas migrations `CreateAuditLog` e `CreatePasswordResetTokens`.

### 3.3 Pacote de deploy

- `backend/Dockerfile` + `frontend/Dockerfile` (multi-stage, alpine, non-root, healthcheck TCP)
- `infrastructure/docker/docker-compose.prod.yml` (postgres + redis + backend + frontend + nginx, redes `internal`/`web`, restart=unless-stopped)
- `infrastructure/nginx/{nginx.conf,templates/crm.conf.template,snippets/_proxy_params.conf}` — templates processados por envsubst com `APP_DOMAIN`
- `infrastructure/.env.prod.example` — template completo de env de produção
- `DEPLOY.md` — runbook passo a passo (certbot, htpasswd, JWT keys, primeiro boot, migrations, backup cron diário)
- `SECURITY.md` — instruções de rotação da senha PG comprometida + hardening checklist

---

## 4. Estado atual e thread aberta

**Último teste do usuário:** rodou local, tentou login e viu URL `localhost:3001/login?next=%2Fdashboard`.

**Diagnóstico:** comportamento correto do `proxy.ts` — se você acessa `/dashboard` sem cookie, ele redireciona pra `/login?next=/dashboard`. Após login, o form lê `next` e redireciona ([login/page.tsx:31](frontend/src/app/(auth)/login/page.tsx:31)).

**Pendência se login não funcionar local:**
- Reiniciar `next dev` após mudança em `next.config.ts` (rewrites não recarregam hot)
- `frontend/.env.local` antigo com `NEXT_PUBLIC_API_URL=http://localhost:3000/api` precisa ser **removido** — o novo padrão usa URL relativa `/api` + rewrite. Cross-origin quebra o cookie compartilhado.
- DevTools → Application → Cookies em `localhost:3001` deve mostrar `access_token` + `refresh_token` após login.

---

## 5. Como retomar em outra máquina

### 5.1 Bootstrap

```bash
git clone <repo>
cd crm-saas

# Postgres + Redis (dev)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Backend
cd backend
cp .env.example .env
mkdir -p keys
openssl genrsa -out keys/private.key 2048
openssl rsa -in keys/private.key -pubout -out keys/public.key
npm install
npm run migration:run     # cria todas as tabelas incluindo audit_log e password_reset_tokens
npm run seed              # admin inicial (se houver seed configurado)
npm run start:dev         # roda em http://localhost:3000

# Frontend (outro terminal)
cd ../frontend
# NÃO copie NEXT_PUBLIC_API_URL — deixe o default. Em dev, o rewrite do next.config.ts cuida.
npm install
npm run dev               # roda em http://localhost:3001
```

Abrir http://localhost:3001/login.

### 5.2 Tests

```bash
cd backend
npm test -- auth.service.spec   # 7/7 esperados
npx tsc --noEmit                # 0 errors
npm run build                   # nest build

cd ../frontend
npx tsc --noEmit                # 0 errors
NEXT_PUBLIC_API_URL=/api npm run build   # 25 rotas + middleware + robots.txt
```

### 5.3 Para subir em produção

Ler [DEPLOY.md](DEPLOY.md) integralmente. Resumo:

```bash
# Na VPS
sudo certbot certonly --standalone -d crm.exemplo.com.br ...
htpasswd -B -c infrastructure/nginx/htpasswd qualitysmi
cp infrastructure/.env.prod.example infrastructure/.env.prod && $EDITOR ...
mkdir -p infrastructure/keys
openssl genrsa -out infrastructure/keys/jwt_private.key 2048
openssl rsa -in infrastructure/keys/jwt_private.key -pubout -out infrastructure/keys/jwt_public.key

docker compose -f infrastructure/docker/docker-compose.prod.yml \
  --env-file infrastructure/.env.prod up -d --build
docker exec -it crm-backend-prod npm run migration:run
```

---

## 6. Decisões importantes desta sessão

| Decisão | Por quê | Onde |
|---|---|---|
| Cookie HttpOnly para access token (não sessionStorage) | XSS — sessionStorage é exfiltrável | `auth.controller.ts`, `jwt.strategy.ts`, `client.ts` |
| Cookie path = `/` (não restrito) | Necessário pra `proxy.ts` ver o cookie e pra logout revogar refresh | `auth.controller.ts:20-35` |
| `proxy.ts` checa só presença, não validade do JWT | Validação real ocorre em cada chamada /api; proxy é guard de shell SSR | `frontend/src/proxy.ts` |
| Next dev usa rewrites `/api/*` → backend | Garante same-origin pra cookies funcionarem em dev | `frontend/next.config.ts` |
| HTTP Basic Auth no NGINX (não IP allowlist) | Equipe acessa de qualquer lugar | `infrastructure/nginx/templates/crm.conf.template` |
| `output: standalone` no Next | Imagem Docker leve, sem `node_modules` no runtime | `frontend/next.config.ts` |
| TypeORM migrations = source of truth | Coexistência com SQL manual virou risco | banner em `setup-database.js`, nota em `DEPLOY.md` |
| Mail service com fallback que loga | Permite testar forgot-password sem SendGrid configurado | `backend/src/common/mail/mail.service.ts` |
| MVP atual em vez de paridade total | Decisão do usuário pra acelerar deploy | divergências documentadas em §3.1 |
| Senha PG comprometida fica pra depois | Decisão do usuário; ele limpa history depois | `SECURITY.md` |

---

## 7. Próximos passos sugeridos (não bloqueadores)

1. **Rotacionar senha PG** + limpar history (ver `SECURITY.md`) **antes do primeiro deploy real**
2. **Subir SendGrid** (ou outro provedor SMTP) e validar `SENDGRID_API_KEY` no `.env.prod` pra emails de recuperação funcionarem
3. **Implementar módulos faltantes** (financial, briefings, content, positioning, reports, portal-do-cliente) — diretórios já existem vazios em `backend/src/` e `frontend/src/app/(internal)/`
4. **CI/CD com deploy** — hoje o workflow só builda; adicionar passo de SSH deploy pra VPS após merge em `main`
5. **Cobertura de testes ampliada** — só `AuthService` tem specs; estender pra `ClientsService`, `LeadsService`, e E2E de login completo via Supertest
6. **Logs centralizados** — atualmente os logs vão pro stdout do container. Considerar Loki/Promtail ou Better Stack pra agregação
7. **Backup off-site** — backup automatizado em `DEPLOY.md` é local; replicar pra S3/Backblaze
8. **Migrar pra `output: standalone` consciente** — confirmar que o build não vaza arquivos `public/` ausentes

---

## 8. Inventário de arquivos criados/modificados nesta sessão

### Novos arquivos

```
HANDOFF.md
DEPLOY.md
SECURITY.md
.github/workflows/ci.yml

backend/Dockerfile
backend/.dockerignore
backend/src/common/audit/audit-log.entity.ts
backend/src/common/audit/audit.interceptor.ts
backend/src/common/audit/audit.module.ts
backend/src/common/audit/audit.service.ts
backend/src/common/health/health.controller.ts
backend/src/common/health/health.module.ts
backend/src/common/mail/mail.module.ts
backend/src/common/mail/mail.service.ts
backend/src/database/migrations/1748000008000-CreateAuditLog.ts
backend/src/database/migrations/1748000009000-CreatePasswordResetTokens.ts
backend/src/iam/auth/auth.service.spec.ts
backend/src/iam/auth/dto/forgot-password.dto.ts
backend/src/iam/auth/dto/reset-password.dto.ts
backend/src/iam/auth/entities/password-reset-token.entity.ts

frontend/Dockerfile
frontend/.dockerignore
frontend/.env.example
frontend/src/app/robots.ts
frontend/src/app/(auth)/forgot-password/page.tsx
frontend/src/app/(auth)/reset-password/page.tsx
frontend/src/proxy.ts

infrastructure/.env.prod.example
infrastructure/keys/.gitkeep
infrastructure/docker/docker-compose.prod.yml
infrastructure/nginx/nginx.conf
infrastructure/nginx/templates/crm.conf.template
infrastructure/nginx/snippets/_proxy_params.conf
```

### Modificados

```
.gitignore                            # cobre .env.prod, keys/, htpasswd
backend/src/app.module.ts             # registra HealthModule, AuditModule, AuditInterceptor
backend/src/main.ts                   # compression, trust proxy, listen 0.0.0.0, swagger só em dev
backend/src/iam/auth/auth.controller.ts   # cookie HttpOnly p/ access+refresh, fix logout, forgot/reset endpoints
backend/src/iam/auth/auth.service.ts  # métodos requestPasswordReset/resetPassword
backend/src/iam/auth/auth.module.ts   # importa PasswordResetToken + MailModule
backend/src/iam/auth/strategies/jwt.strategy.ts   # extrator de cookie OR Bearer
scripts/setup-database.js             # remove senha hardcoded, lê de env

frontend/next.config.ts               # output standalone, headers, rewrites dev
frontend/.gitignore                   # !.env.example
frontend/src/app/layout.tsx           # metadata robots noindex
frontend/src/app/(auth)/login/page.tsx   # Suspense, ?next= support, link "esqueci senha"
frontend/src/lib/api/client.ts        # remove sessionStorage, URL relativa
frontend/src/stores/auth.store.ts     # remove sessionStorage
```

---

Fim do handoff. Continuar pelo item 4 (debug do login local) ou pelo item 7 (próximos passos).
