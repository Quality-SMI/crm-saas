#!/usr/bin/env node
// Extracts ALL keywords from legacy system and imports into crm.client_keywords
// Matches clients by domain (strips protocol/www)
// Run: LEGACY_PASSWORD='...' node migrate-keywords.js
// Progress is logged to /tmp/migrate-keywords.log

const axios = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const { Client: PgClient } = require('./node_modules/pg');
const fs = require('fs');

const BASE = 'http://www.qsmi.net.br';
const PASS = process.env.LEGACY_PASSWORD;
const LOG_FILE = '/tmp/migrate-keywords.log';
const DELAY_MS = 300; // between requests

const http = axios.create({ baseURL: BASE, timeout: 30000, maxRedirects: 10 });
let cookie = '';
http.interceptors.request.use(cfg => { if (cookie) cfg.headers['Cookie'] = cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-')
    .replace(/^-+|-+$/, '').slice(0, 60);
}

function normalizeDomain(raw) {
  return (raw || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .toLowerCase()
    .trim();
}

async function login() {
  const p = new URLSearchParams();
  p.append('dados[email_login]', 'matheus.silveira.qualitysmi@gmail.com');
  p.append('dados[senha_login]', PASS);
  const r = await http.post('/login/setLogin/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
  });
  if (!r.data?.status) throw new Error('Login failed: ' + r.data?.mensagem);
  log('Login ok');
}

async function getAllLegacyClients() {
  const r = await http.get('/paineis');
  const $ = cheerio.load(r.data);
  const clients = [];
  $('table tbody tr').each((i, tr) => {
    const token = $(tr).find('[data-token]').attr('data-token') || '';
    const cells = $(tr).find('td').map((j, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
    if (token) clients.push({ token, name: cells[1] || cells[0] || '' });
  });
  log(`Found ${clients.length} clients in legacy /paineis`);
  return clients;
}

async function getClientKeywords(token) {
  const p = new URLSearchParams({ tk: token });
  const r = await http.post('/clientes/view/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
  });
  const $ = cheerio.load(r.data);

  // Extract domain from aba1
  let domain = '';
  $('#aba1 a[href]').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('http') && !href.includes('qsmi.net.br')) {
      domain = href;
      return false; // break
    }
  });

  // Extract keywords from aba3 table
  const keywords = [];
  $('#aba3 table tbody tr').each((i, tr) => {
    const kw = $(tr).find('td').first().text().trim().replace(/\s+/g, ' ');
    if (kw && kw.length > 1 && !kw.toLowerCase().includes('nenhuma')) {
      keywords.push(kw);
    }
  });

  return { domain: normalizeDomain(domain), keywords };
}

async function insertKeywords(pg, clientId, keywords) {
  let inserted = 0;
  let skipped = 0;
  for (const keyword of keywords) {
    const slug = slugify(keyword);
    try {
      const res = await pg.query(
        `INSERT INTO crm.client_keywords (client_id, keyword, slug, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT DO NOTHING`,
        [clientId, keyword, slug]
      );
      if (res.rowCount > 0) inserted++;
      else skipped++;
    } catch (e) {
      log(`  DB error for keyword "${keyword.substring(0, 30)}": ${e.message}`);
    }
  }
  return { inserted, skipped };
}

(async () => {
  if (!PASS) { log('ERROR: LEGACY_PASSWORD not set'); process.exit(1); }

  // Init log
  fs.writeFileSync(LOG_FILE, `=== Keywords migration started at ${new Date().toISOString()} ===\n`);

  // Connect to DB
  const pg = new PgClient({ connectionString: 'postgresql://crm:crm_dev_pass@localhost:5432/crm_db' });
  await pg.connect();
  log('DB connected');

  // Load all our CRM clients
  const { rows: crmClients } = await pg.query(
    `SELECT id, company_name, domain FROM crm.clients WHERE deleted_at IS NULL`
  );
  log(`CRM clients in DB: ${crmClients.length}`);

  // Build domain index for fast lookup
  const domainIndex = new Map();
  for (const c of crmClients) {
    const norm = normalizeDomain(c.domain);
    if (norm) domainIndex.set(norm, c);
    // Also without www
    const noWww = norm.replace(/^www\./, '');
    if (noWww !== norm) domainIndex.set(noWww, c);
  }
  log(`Domain index built: ${domainIndex.size} entries`);

  // Login to legacy
  await login();
  const legacyClients = await getAllLegacyClients();

  let stats = { matched: 0, unmatched: 0, totalKw: 0, inserted: 0, skipped: 0, errors: 0 };
  const unmatchedList = [];

  for (let i = 0; i < legacyClients.length; i++) {
    const lc = legacyClients[i];
    try {
      const { domain, keywords } = await getClientKeywords(lc.token);

      if (!domain) {
        log(`[${i+1}/${legacyClients.length}] ${lc.name} — no domain, skip`);
        stats.unmatched++;
        unmatchedList.push(lc.name + ' (no domain)');
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      // Find matching CRM client
      const crmClient = domainIndex.get(domain) || domainIndex.get(domain.replace(/^www\./, ''));

      if (!crmClient) {
        if (keywords.length > 0) {
          log(`[${i+1}/${legacyClients.length}] ${lc.name} — domain "${domain}" not in CRM (${keywords.length} kws lost)`);
          unmatchedList.push(`${lc.name} (${domain})`);
        }
        stats.unmatched++;
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      if (keywords.length === 0) {
        log(`[${i+1}/${legacyClients.length}] ${lc.name} — matched "${crmClient.company_name}" — 0 keywords`);
        stats.matched++;
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }

      const { inserted, skipped } = await insertKeywords(pg, crmClient.id, keywords);
      stats.matched++;
      stats.totalKw += keywords.length;
      stats.inserted += inserted;
      stats.skipped += skipped;
      log(`[${i+1}/${legacyClients.length}] ${lc.name} → "${crmClient.company_name}" — ${keywords.length} kws (${inserted} new, ${skipped} dup)`);

    } catch (e) {
      log(`[${i+1}/${legacyClients.length}] ERROR ${lc.name}: ${e.message.substring(0, 80)}`);
      stats.errors++;
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  log('\n=== MIGRATION COMPLETE ===');
  log(`Matched: ${stats.matched} | Unmatched: ${stats.unmatched} | Errors: ${stats.errors}`);
  log(`Keywords: ${stats.totalKw} total | ${stats.inserted} inserted | ${stats.skipped} duplicates`);
  if (unmatchedList.length > 0) {
    log(`\nUnmatched clients (${unmatchedList.length}):`);
    unmatchedList.forEach(n => log('  - ' + n));
  }

  await pg.end();
})().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
