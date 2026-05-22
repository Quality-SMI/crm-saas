/**
 * Backfill de websites nos leads.
 *
 * Estratégia:
 *  1. Lê TODAS as páginas da lista de leads do sistema legado (35 por pág)
 *     — a coluna "site" já aparece na listagem, sem precisar abrir cada modal.
 *  2. Para leads que já têm legacy_id no banco mas website NULL → atualiza.
 *  3. Para leads SEM legacy_id (criados manualmente), tenta casar por nome
 *     e preenche legacy_id + website.
 *  4. Leads que a lista não traz website → tenta fallback no modal de detalhe.
 *
 * Idempotente: não sobrescreve leads que já têm website preenchido.
 *
 * Uso: LEGACY_PASSWORD=xxx node backfill-lead-websites.js
 *      LEGACY_PASSWORD=xxx DRY_RUN=1 node backfill-lead-websites.js
 */

const axios   = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const { Client: PgClient } = require('./node_modules/pg');
require('./node_modules/dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const LEGACY_BASE  = 'http://www.qsmi.net.br';
const LEGACY_EMAIL = 'matheus.silveira.qualitysmi@gmail.com';
const LEGACY_PASS  = process.env.LEGACY_PASSWORD;
const DRY_RUN      = process.env.DRY_RUN === '1';

if (!LEGACY_PASS) { console.error('LEGACY_PASSWORD env var required'); process.exit(1); }

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5430/postgres';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanWebsite(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s || s === '-' || s === '—') return null;
  return s;
}

function normalize(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

const http = axios.create({ baseURL: LEGACY_BASE, timeout: 25000, maxRedirects: 5 });
let sessionCookie = '';
http.interceptors.request.use(cfg => { if (sessionCookie) cfg.headers['Cookie'] = sessionCookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) sessionCookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

async function legacyLogin() {
  const params = new URLSearchParams();
  params.append('dados[email_login]', LEGACY_EMAIL);
  params.append('dados[senha_login]', LEGACY_PASS);
  await http.post('/login/setLogin/', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!sessionCookie) throw new Error('Login falhou — cookie não recebido');
  console.log('✓ Login no sistema legado');
}

// ─── Coleta todos os leads da lista ──────────────────────────────────────────

async function fetchAllLeadsFromList() {
  const leads = [];
  let offset = 0;

  while (true) {
    const url = offset === 0 ? '/leads' : `/leads/index/${offset}`;
    const res = await http.get(url);
    const $   = cheerio.load(res.data);

    let count = 0;
    $('table tbody tr').each((_, tr) => {
      const ocLink  = $(tr).find('a[href*="/ocorrencias/index/"]').attr('href');
      const token   = ocLink ? ocLink.split('/').pop() : null;
      const cells   = [];
      $(tr).find('td').each((_, td) => cells.push($(td).text().trim().replace(/\s+/g, ' ')));

      if (token && cells[0]) {
        leads.push({
          token,
          empresa: cells[0]?.trim() || null,
          website: cleanWebsite(cells[1]),  // coluna "site" na listagem
        });
        count++;
      }
    });

    process.stdout.write(`  pág. offset=${offset}: ${count} leads (total até agora: ${leads.length})\n`);
    if (count < 35) break;
    offset += 35;
    await sleep(350);

    // Re-login preventivo a cada 500 leads
    if (leads.length % 500 < 35 && leads.length > 0) {
      await legacyLogin().catch(() => {});
    }

    if (offset > 80000) break;
  }

  return leads;
}

// ─── Fallback: busca website no modal de detalhe ─────────────────────────────

async function fetchWebsiteFromModal(token) {
  try {
    const res = await http.post('/leads/view/', `tk=${token}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    });
    const $v = cheerio.load(res.data);
    const fieldMap = {};
    $v('#aba-1 p').each((_, p) => {
      const text = $v(p).text().replace(/\s+/g, ' ').trim();
      const sep  = text.indexOf(':');
      if (sep > -1) {
        fieldMap[text.substring(0, sep).trim().toLowerCase()] = text.substring(sep + 1).trim() || null;
      }
    });
    return cleanWebsite(fieldMap['website'] || fieldMap['site'] || fieldMap['url']);
  } catch {
    return null;
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

(async () => {
  if (DRY_RUN) console.log('⚠️  DRY RUN — nenhuma alteração será salva\n');

  await legacyLogin();

  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();
  console.log('✓ Conectado ao PostgreSQL\n');

  // Garante que a coluna existe
  await pg.query(`ALTER TABLE crm.leads ADD COLUMN IF NOT EXISTS website TEXT`);

  console.log('📋 Buscando todos os leads do sistema legado...');
  const legacyLeads = await fetchAllLeadsFromList();
  console.log(`\n✓ ${legacyLeads.length} leads no sistema legado\n`);

  // Monta índices para lookup rápido
  const byToken = new Map();  // token → { token, empresa, website }
  const byName  = new Map();  // normalize(empresa) → [...]
  for (const l of legacyLeads) {
    if (l.token) byToken.set(l.token, l);
    const key = normalize(l.empresa);
    if (key) {
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(l);
    }
  }

  // Carrega leads do banco que precisam de website
  const { rows: dbLeads } = await pg.query(`
    SELECT id, name, legacy_id, website FROM crm.leads
    WHERE website IS NULL OR website = ''
    ORDER BY created_at
  `);

  console.log(`Leads no banco sem website: ${dbLeads.length}\n`);

  let updated = 0, skipped = 0, fallback = 0, failed = 0;

  for (const [idx, dbLead] of dbLeads.entries()) {
    process.stdout.write(`  [${idx + 1}/${dbLeads.length}] ${(dbLead.name || '').substring(0, 35).padEnd(35)} `);

    let website = null;
    let legacyId = dbLead.legacy_id;

    // 1. Casar por legacy_id
    if (legacyId) {
      const match = byToken.get(legacyId);
      if (match) website = match.website;
    }

    // 2. Casar por nome (para leads sem legacy_id)
    if (!website && !legacyId) {
      const key     = normalize(dbLead.name);
      const matches = byName.get(key) || [];
      if (matches.length === 1) {
        website  = matches[0].website;
        legacyId = matches[0].token;
      } else if (matches.length > 1) {
        // Múltiplos matches — usa o primeiro, registra ambiguidade
        website  = matches[0].website;
        legacyId = matches[0].token;
        process.stdout.write(`(${matches.length} matches, usando primeiro) `);
      }
    }

    // 3. Fallback: modal de detalhe (se tiver token mas website vazio na lista)
    if (!website && legacyId) {
      process.stdout.write(`[modal] `);
      website = await fetchWebsiteFromModal(legacyId);
      if (website) fallback++;
      await sleep(200);
    }

    if (!website) {
      process.stdout.write(`sem website — skip\n`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      process.stdout.write(`[dry] ${website.substring(0, 50)}\n`);
      updated++;
      continue;
    }

    try {
      await pg.query(
        `UPDATE crm.leads SET website = $1, legacy_id = COALESCE(legacy_id, $2), updated_at = NOW() WHERE id = $3`,
        [website, legacyId, dbLead.id]
      );
      process.stdout.write(`✓ ${website.substring(0, 50)}\n`);
      updated++;
    } catch (err) {
      process.stdout.write(`✗ ${err.message.substring(0, 60)}\n`);
      failed++;
    }
  }

  await pg.end();
  console.log(`
Concluído:
  ${updated} atualizados (${fallback} via modal fallback)
  ${skipped} sem website no legado
  ${failed} erros
`);
})().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
