# Deploy do CRM Quality SMI em VPS

Stack: Docker Compose (PostgreSQL + Redis + NestJS + Next.js + NGINX).
Acesso restrito via **HTTP Basic Auth** no NGINX + **noindex** para crawlers.

---

## 1. Pré-requisitos na VPS

- Ubuntu 22.04+ (ou similar)
- Docker Engine 24+ e plugin `docker compose v2`
- Portas 80/443 abertas no firewall
- DNS A apontando para o IP da VPS (ex.: `crm.exemplo.com.br → IP_DA_VPS`)
- Pacotes: `apache2-utils` (htpasswd), `certbot`

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin apache2-utils certbot
sudo usermod -aG docker $USER && newgrp docker
```

---

## 2. Clonar e configurar o projeto

```bash
cd /opt
sudo git clone <REMOTO> crm-saas && sudo chown -R $USER:$USER crm-saas
cd crm-saas
```

### 2.1 — `infrastructure/.env.prod`

```bash
cp infrastructure/.env.prod.example infrastructure/.env.prod
$EDITOR infrastructure/.env.prod
```

Preencher minimamente: `APP_DOMAIN`, `APP_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` (todos com o domínio real), `POSTGRES_PASSWORD` (gerar com `openssl rand -base64 24`).

### 2.2 — Chaves JWT (RS256)

```bash
mkdir -p infrastructure/keys
openssl genrsa -out infrastructure/keys/jwt_private.key 2048
openssl rsa -in infrastructure/keys/jwt_private.key -pubout -out infrastructure/keys/jwt_public.key
chmod 600 infrastructure/keys/jwt_*.key
```

### 2.3 — Basic Auth (htpasswd)

```bash
htpasswd -B -c infrastructure/nginx/htpasswd qualitysmi
# repita sem -c para adicionar usuários extras:
# htpasswd -B infrastructure/nginx/htpasswd outrousuario
```

A senha do Basic Auth é a barreira anti-acesso-anônimo. **Não é** a senha do usuário do CRM — quem passa pelo Basic Auth ainda precisa fazer login no app.

---

## 3. Certificado TLS (Let's Encrypt)

Primeiro boot precisa de cert válido para o NGINX subir. Estratégia: gerar o cert antes de subir o compose, usando `certbot --standalone` (porta 80 livre).

```bash
sudo certbot certonly --standalone -d crm.exemplo.com.br \
  --email seu-email@exemplo.com.br --agree-tos --no-eff-email
```

Isso cria `/etc/letsencrypt/live/crm.exemplo.com.br/{fullchain,privkey}.pem`, que o NGINX vai montar read-only.

### Renovação automática

```bash
# Crontab root — renova 2x/dia e reload do nginx no container
sudo crontab -e
```

Adicionar:

```cron
0 3,15 * * * certbot renew --quiet --deploy-hook "docker exec crm-nginx-prod nginx -s reload"
```

---

## 4. Primeiro boot

```bash
cd /opt/crm-saas
docker compose -f infrastructure/docker/docker-compose.prod.yml \
  --env-file infrastructure/.env.prod up -d --build
```

Aguardar healthchecks: `docker compose -f infrastructure/docker/docker-compose.prod.yml ps`.

### 4.1 — Migrations

**Fonte da verdade do schema: TypeORM migrations** em `backend/src/database/migrations/`.

O `postgres-init.sql` (montado no entrypoint do Postgres) cria apenas extensões e schemas (`iam`, `crm`, `analytics`) no primeiro boot. As tabelas são criadas pelas migrations:

```bash
docker exec -it crm-backend-prod npm run migration:run
```

> O script `scripts/setup-database.js` é legado — só use em ambientes de desenvolvimento ou quando rodar os scripts de migração de dados legados (`migrate-*.js`). Em produção, **sempre** use `migration:run`.

### 4.2 — Usuário admin inicial

Rodar o seed (uma vez):

```bash
docker exec -it crm-backend-prod node dist/database/seeds/seed.js
```

(Confirmar nome do arquivo de seed compilado em `dist/`.)

---

## 5. Verificação pós-deploy

```bash
# Containers de pé
docker compose -f infrastructure/docker/docker-compose.prod.yml ps

# Logs em tempo real
docker compose -f infrastructure/docker/docker-compose.prod.yml logs -f --tail=100 nginx backend frontend

# Headers de segurança (esperado: HSTS, X-Robots-Tag, X-Frame-Options)
curl -kI https://crm.exemplo.com.br -u qualitysmi:senha

# Robots.txt (esperado: Disallow: /)
curl -k https://crm.exemplo.com.br/robots.txt -u qualitysmi:senha

# Login API
curl -k -X POST https://crm.exemplo.com.br/api/auth/login \
  -u qualitysmi:senhabasicauth \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'
```

Checklist manual no browser:
- [ ] Browser pede Basic Auth ao abrir a URL
- [ ] Após Basic Auth, tela de login do CRM aparece
- [ ] Login com credencial do admin redireciona para `/dashboard`
- [ ] DevTools → Network mostra `Set-Cookie: refresh_token; HttpOnly; Secure`
- [ ] DevTools → Response Headers contém `X-Robots-Tag: noindex, nofollow, ...`
- [ ] `/api/docs` retorna 404 em produção (Swagger desabilitado)

---

## 6. Atualizações (deploy contínuo)

```bash
cd /opt/crm-saas
git pull
docker compose -f infrastructure/docker/docker-compose.prod.yml \
  --env-file infrastructure/.env.prod up -d --build backend frontend
# Se houver migrations novas:
docker exec -it crm-backend-prod npm run migration:run
```

Para fazer rollback rápido, mantenha tags git por release e use `git checkout <tag>` + rebuild.

---

## 7. Backups

### PostgreSQL — diário

`/etc/cron.daily/crm-pg-backup`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y%m%d-%H%M)
BACKUP_DIR=/var/backups/crm-pg
mkdir -p "$BACKUP_DIR"
docker exec crm-postgres-prod pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/crm-$DATE.sql.gz"
# Retenção 14 dias
find "$BACKUP_DIR" -name "crm-*.sql.gz" -mtime +14 -delete
```

```bash
sudo chmod +x /etc/cron.daily/crm-pg-backup
```

Considere ainda replicar para storage externo (S3, Backblaze).

---

## 8. Operação

| Tarefa | Comando |
|---|---|
| Restart NGINX (após mudar conf) | `docker compose -f .../docker-compose.prod.yml restart nginx` |
| Tail de logs específicos | `docker logs -f crm-backend-prod --tail 200` |
| Shell no container backend | `docker exec -it crm-backend-prod sh` |
| Conectar no Postgres | `docker exec -it crm-postgres-prod psql -U $POSTGRES_USER -d $POSTGRES_DB` |
| Restaurar backup | `gunzip -c backup.sql.gz \| docker exec -i crm-postgres-prod psql -U $POSTGRES_USER -d $POSTGRES_DB` |
| Reset Basic Auth | recriar `infrastructure/nginx/htpasswd` e `docker compose ... restart nginx` |

---

## 9. Hardening adicional (próximos passos)

Itens conhecidos não cobertos por este deploy inicial — ver [SECURITY.md](SECURITY.md):

- Rotacionar a senha PG comprometida no histórico git (`cfea326`)
- Migrar access token de `sessionStorage` para cookie HttpOnly
- Adicionar `proxy.ts` (Next 16) para proteção SSR de rotas internas
- Implementar recuperação de senha (forgot/reset)
- Auditoria centralizada de operações CRUD sensíveis
- Cobertura de testes (atualmente 1 spec, sem E2E)
