# Segurança — CRM Quality SMI

## Credencial PostgreSQL exposta no histórico Git

O arquivo `scripts/setup-database.js` continha uma credencial de produção (host, usuário e senha) hardcoded no commit `cfea326 "subindo projeto"`. O código foi corrigido para ler de variáveis de ambiente, mas **a senha continua acessível no histórico do repositório**.

### Ação obrigatória antes do deploy

1. **Rotacionar a senha** do usuário PostgreSQL `postgres` no host `145.79.7.208` (porta 5430). Conectar via psql/pgAdmin e executar:

   ```sql
   ALTER USER postgres WITH PASSWORD '<nova-senha-aleatória-32-chars>';
   ```

   Gere senha forte com `openssl rand -base64 32`.

2. **Atualizar a env** em todos os ambientes que consomem o banco (backend `.env`, scripts de migração, pipeline de deploy).

3. **(Opcional, recomendado)** Limpar o segredo do histórico Git com `git filter-repo` ou BFG Repo-Cleaner. Como o repo está em `origin`, será preciso `git push --force` e avisar todos os colaboradores. Mesmo com a limpeza, considere a credencial antiga como permanentemente comprometida — só a rotação resolve o risco real.

4. **Auditar acessos** ao Postgres entre a data do commit (2026-05-22) e a rotação: revisar `pg_stat_activity`, logs de conexão e tabelas sensíveis (`iam.users`, sessões).

## Variáveis de ambiente que carregam segredos

Nunca commitar (já cobertos pelo `.gitignore`):

- `backend/.env` — `DATABASE_URL`, `JWT_PRIVATE_KEY`/`PATH`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SENDGRID_API_KEY`, etc.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` (não-segredo) e qualquer outra variável.
- Chaves JWT (`*.key`, `*.pem`) — armazenar em `backend/keys/` (gitignored) ou ler de env.

## Checklist de hardening (a aplicar antes de produção)

- [ ] Rotacionar a senha PG comprometida (acima)
- [ ] Remover/rotacionar qualquer outro segredo que tenha circulado em chat/git
- [ ] Configurar `NODE_ENV=production` no container (desabilita Swagger e força cookies `secure`)
- [ ] Definir `JWT_PRIVATE_KEY_PATH` apontando para chave gerada com `openssl genrsa -out keys/private.key 2048` (e `openssl rsa -in keys/private.key -pubout -out keys/public.key`)
- [ ] Confirmar que `FRONTEND_URL` em backend `.env` está com a URL HTTPS de produção (libera CORS apenas para ela)
- [ ] Confirmar que o backend NÃO expõe `/api/docs` em produção (controlado por `NODE_ENV !== 'production'`)
- [ ] Adicionar HTTP Basic Auth no NGINX como camada anti-acesso-anônimo
- [ ] HSTS, TLS 1.2+, certificado Let's Encrypt válido
- [ ] Backup diário do PostgreSQL com retenção mínima de 14 dias
