/**
 * Migração dos leads RESTANTES do sistema legado (offset 0 → 72065).
 * Idempotente via legacy_id — pula leads já migrados.
 * Pipeline: coleta 1 página (35 tokens) → migra imediatamente → próxima página.
 * Reconecta e re-loga automaticamente em caso de socket hang up.
 *
 * Uso: LEGACY_PASSWORD='Qu@li100$' node migrate-leads-remaining.js
 * Progresso: tail -f migrate-leads.log
 */

const axios   = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const { Client: PgClient } = require('./node_modules/pg');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
require('./node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const LEGACY_BASE  = 'http://www.qsmi.net.br';
const LEGACY_EMAIL = process.env.LEGACY_EMAIL || 'matheus.silveira.qualitysmi@gmail.com';
const LEGACY_PASS  = process.env.LEGACY_PASSWORD;
const DB_URL       = process.env.DATABASE_URL;
const LOG_FILE     = path.join(__dirname, 'migrate-leads.log');

if (!LEGACY_PASS) { console.error('LEGACY_PASSWORD required'); process.exit(1); }

// ─── Logging ─────────────────────────────────────────────────────────────────

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(msg);
  logStream.write(msg + '\n');
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

const cookieJar = {};
const httpAgent = new http.Agent({ keepAlive: false });
const httpClient = axios.create({ baseURL: LEGACY_BASE, timeout: 30000, maxRedirects: 5, httpAgent });
httpClient.interceptors.request.use(cfg => {
  const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookieStr) cfg.headers['Cookie'] = cookieStr;
  return cfg;
});
httpClient.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) {
    for (const raw of sc) {
      const pair = raw.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.substring(0, eq).trim();
      const val  = pair.substring(eq + 1).trim();
      // Ignore deletion cookies (value "deleted" or empty after expiry)
      if (val && val !== 'deleted') cookieJar[name] = val;
    }
  }
  return res;
});

async function legacyLogin() {
  // Clear session before re-logging
  for (const key of Object.keys(cookieJar)) delete cookieJar[key];
  const p = new URLSearchParams();
  p.append('dados[email_login]', LEGACY_EMAIL);
  p.append('dados[senha_login]', LEGACY_PASS);
  const res = await httpClient.post('/login/setLogin/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  // The login endpoint returns JSON: {"status":true} on success
  if (res.data && typeof res.data === 'object' && res.data.status === false) {
    throw new Error(`Login falhou: ${res.data.mensagem || 'resposta negativa'}`);
  }
  if (Object.keys(cookieJar).length === 0) throw new Error('Login falhou — cookie não recebido');
  log('✓ Login no sistema legado');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(fn, maxRetries = 5, label = '') {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isNetwork = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' ||
                        err.code === 'EADDRNOTAVAIL' || err.code === 'ECONNREFUSED' ||
                        err.message.includes('socket hang up') || err.message.includes('timeout');
      log(`  ⚠ tentativa ${attempt}/${maxRetries} falhou [${label}]: ${err.message.substring(0, 60)}`);
      if (isNetwork && attempt < maxRetries) {
        const delay = err.code === 'EADDRNOTAVAIL' ? 15000 : Math.min(2000 * attempt, 10000);
        await sleep(delay);
        if (attempt >= 2) { await legacyLogin().catch(() => {}); }
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── DB ──────────────────────────────────────────────────────────────────────

let pg;
async function dbConnect() {
  if (pg) { try { await pg.end(); } catch (_) {} }
  pg = new PgClient({ connectionString: DB_URL, keepAlive: true, keepAliveInitialDelayMillis: 10000 });
  pg.on('error', (err) => {
    log('⚠ pg connection error (will reconnect):', err.message);
    pg = null;
  });
  await pg.connect();
  log('✓ Conectado ao PostgreSQL');
}

async function dbQuery(sql, params) {
  if (!pg) await dbConnect();
  try {
    return await pg.query(sql, params);
  } catch (err) {
    if (err.message.includes('terminated') || err.message.includes('ECONNRESET') || err.code === 'ECONNRESET') {
      log('⚠ Query falhou, reconectando...');
      await dbConnect();
      return await pg.query(sql, params);
    }
    throw err;
  }
}

// ─── helpers (iguais ao migrate-data.js) ─────────────────────────────────────

function sleep2(ms) { return new Promise(r => setTimeout(r, ms)); }
function parseDateTime(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2}):(\d{2})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`) : null;
}
function cleanText(str) { if (str == null) return null; const s = String(str).replace(/\s+/g, ' ').trim(); return s || null; }
function mapLeadStage(status) {
  const s = (status || '').trim().toLowerCase();
  if (s.includes('fechado') || s.includes('contratado') || s.includes('ganho')) return 'WON';
  if (s.includes('perdido')) return 'LOST';
  if (s.includes('negocia')) return 'NEGOTIATION';
  if (s.includes('proposta')) return 'PROPOSAL';
  if (s.includes('delega') || s.includes('qualifi') || s.includes('agendamento') || s.includes('apresenta')) return 'QUALIFIED';
  return 'NEW';
}
function mapLeadOrigin(origin) {
  const o = (origin || '').trim().toLowerCase();
  if (o.includes('indica')) return 'REFERRAL';
  if (o.includes('site') || o.includes('pesquis')) return 'WEBSITE';
  if (o.includes('social') || o.includes('facebook') || o.includes('instagram')) return 'SOCIAL_MEDIA';
  if (o.includes('evento')) return 'EVENT';
  if (o.includes('ativo') || o.includes('prospec') || o.includes('ligan')) return 'COLD_CALL';
  if (o && o !== '') return 'OTHER';
  return null;
}
function mapInteractionType(status) {
  const s = (status || '').trim().toLowerCase();
  if (s.includes('liga') || s.includes('call') || s.includes('telef')) return 'CALL';
  if (s.includes('email') || s.includes('e-mail')) return 'EMAIL';
  if (s.includes('reuni') || s.includes('meeting')) return 'MEETING';
  if (s.includes('lead') || s.includes('delega') || s.includes('proposta') ||
      s.includes('negocia') || s.includes('fechado') || s.includes('perdido') ||
      s.includes('contratado') || s.includes('apresenta') || s.includes('agendamento')) return 'STATUS_CHANGE';
  return 'NOTE';
}
function fuzzyMatchUser(name, users) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  let match = users.find(u => u.name.toLowerCase() === n);
  if (match) return match.id;
  const firstName = n.split(/\s/)[0];
  match = users.find(u => u.name.toLowerCase().startsWith(firstName) || (firstName.length > 3 && u.name.toLowerCase().includes(firstName)));
  return match ? match.id : null;
}

// ─── Lead detail ─────────────────────────────────────────────────────────────

async function getLeadFullData(token) {
  const viewRes = await fetchWithRetry(() =>
    httpClient.post('/leads/view/', `tk=${token}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    }), 4, `view/${token}`
  );
  const $v = cheerio.load(viewRes.data);
  const fieldMap = {};
  $v('#aba-1 p').each((_, p) => {
    const text = $v(p).text().replace(/\s+/g, ' ').trim();
    const sep = text.indexOf(':');
    if (sep > -1) {
      fieldMap[text.substring(0, sep).trim().toLowerCase()] = text.substring(sep + 1).trim() || null;
    }
  });
  const interactions = [];
  $v('#aba-2 .panel').each((_, panel) => {
    const heading = $v(panel).find('.panel-heading a').text().trim().replace(/\s+/g, ' ');
    const hm = heading.match(/^(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}:\d{2})\s*[-–]\s*(.+)$/);
    if (!hm) return;
    const body = $v(panel).find('.panel-body');
    const createdBy = cleanText(body.find('p strong').first().text());
    const descP = body.find('p:contains("Descricao")');
    const desc = cleanText(descP.text().replace(/Descricao\s*:?/i, '').trim());
    interactions.push({
      date: parseDateTime(`${hm[1]} - ${hm[2]}`),
      statusLabel: hm[3].trim(),
      createdBy,
      description: desc || hm[3].trim(),
      type: mapInteractionType(hm[3].trim()),
    });
  });

  const editRes = await fetchWithRetry(() =>
    httpClient.post('/leads/edit/', `tk=${token}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    }), 4, `edit/${token}`
  );
  const $e = cheerio.load(editRes.data);
  const originText = $e('select[name="data[Lead][origem_id]"] option:selected').text().trim() || null;
  const telefone2  = cleanText($e('input[name="data[Lead][telefone_2]"]').attr('value'));
  const createdAtStr = fieldMap['criado por'] || null;
  const createdAt = createdAtStr ? parseDateTime(createdAtStr.replace(/.*em\s+/i, '')) : null;
  const parts = [];
  if (telefone2) parts.push(`Tel. 2: ${telefone2}`);
  const obs = fieldMap['observações'] || fieldMap['observacoes'];
  if (obs) parts.push(`Obs.: ${obs}`);

  return {
    name:          fieldMap['empresa'] || null,
    contact_name:  fieldMap['responsável'] || fieldMap['responsavel'] || null,
    contact_email: fieldMap['email'] || null,
    contact_phone: fieldMap['telefone 1'] || fieldMap['telefone1'] || null,
    website:       cleanText(fieldMap['website']),
    owner_name:    fieldMap['usuário responsável'] || fieldMap['usuario responsavel'] || null,
    status_label:  fieldMap['último status'] || fieldMap['ultimo status'] || null,
    origin_text:   originText,
    notes:         parts.length ? parts.join('\n') : null,
    created_at:    createdAt,
    interactions,
  };
}

// ─── Page collector ───────────────────────────────────────────────────────────

function parseLeadRows($) {
  const rows = [];
  $('table tbody tr').each((_, tr) => {
    const ocLink = $(tr).find('a[href*="/ocorrencias/index/"]').attr('href');
    const token  = ocLink ? ocLink.split('/').pop() : null;
    const cells  = [];
    $(tr).find('td').each((_, td) => cells.push($(td).text().trim().replace(/\s+/g, ' ')));
    if (token && cells[0]) {
      rows.push({ token, empresa: cells[0], listWebsite: cells[1], listStatus: cells[2], listOwner: cells[3], listCreator: cells[4] });
    }
  });
  return rows;
}

async function fetchPage(offset) {
  const url = offset === 0 ? '/leads' : `/leads/index/${offset}`;
  return fetchWithRetry(async () => {
    const res = await httpClient.get(url);
    // Check if redirected to login
    if (res.request?.res?.responseUrl?.includes('/login')) {
      await legacyLogin();
      throw new Error('session expired, re-logged');
    }
    return parseLeadRows(cheerio.load(res.data));
  }, 5, `page/${offset}`);
}

// ─── Migrate single lead ──────────────────────────────────────────────────────

async function migrateLead(row, users) {
  const exists = await dbQuery('SELECT id FROM crm.leads WHERE legacy_id=$1', [row.token]);
  if (exists.rows.length) return 'skip';

  const d = await getLeadFullData(row.token);
  const name    = d.name || row.empresa.trim();
  const stage   = mapLeadStage(d.status_label || row.listStatus);
  const origin  = mapLeadOrigin(d.origin_text);
  const ownerId = fuzzyMatchUser(d.owner_name || row.listOwner, users);
  const createdBy = fuzzyMatchUser(row.listCreator, users);
  const createdAt = d.created_at || new Date();

  const lr = await dbQuery(`
    INSERT INTO crm.leads (
      id, name, contact_name, contact_email, contact_phone, website,
      stage, origin, notes, owner_id, created_by, legacy_id,
      created_at, updated_at
    ) VALUES (
      uuid_generate_v4(),$1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,$11,
      $12,NOW()
    ) RETURNING id`,
    [name, d.contact_name, d.contact_email, d.contact_phone, d.website,
     stage, origin, d.notes, ownerId, createdBy, row.token, createdAt]
  );

  for (const inter of d.interactions) {
    const userId = fuzzyMatchUser(inter.createdBy, users);
    await dbQuery(
      `INSERT INTO crm.lead_interactions (id,lead_id,user_id,type,description,created_at)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5)`,
      [lr.rows[0].id, userId, inter.type, inter.description, inter.date || createdAt]
    ).catch(() => {});
  }

  return 'ok';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const LAST_OFFSET = 72065;
// Migração completa — começa do 0, idempotente (pula legacy_id já existentes)
const START_OFFSET = 0;

(async () => {
  const start = Date.now();
  log('='.repeat(60));
  log(`Iniciando migração dos leads restantes (offset ${START_OFFSET} → ${LAST_OFFSET})`);
  log('Leads já migrados serão ignorados (idempotente via legacy_id)');
  log('='.repeat(60));

  await legacyLogin();
  await dbConnect();

  const users = await dbQuery('SELECT id, name FROM iam.users WHERE deleted_at IS NULL AND client_id IS NULL').then(r => r.rows);
  log(`✓ ${users.length} usuários carregados`);

  // Count already migrated
  const alreadyCount = await dbQuery('SELECT COUNT(*) FROM crm.leads WHERE legacy_id IS NOT NULL').then(r => parseInt(r.rows[0].count));
  log(`✓ Leads já no banco: ${alreadyCount}`);

  let offset   = START_OFFSET;
  let ok       = 0;
  let skipped  = 0;
  let failed   = 0;
  let pageErrors = 0;

  while (offset <= LAST_OFFSET) {
    // Periodically reconnect DB to avoid idle timeout (every 100 pages)
    if ((offset / 35) % 100 === 0 && offset > 0) {
      await dbConnect().catch(e => log('DB reconnect error:', e.message));
    }

    let rows;
    try {
      rows = await fetchPage(offset);
    } catch (err) {
      log(`✗ Página offset=${offset} falhou permanentemente: ${err.message}`);
      pageErrors++;
      offset += 35;
      await sleep(3000);
      continue;
    }

    if (rows.length === 0) {
      log(`  offset=${offset}: 0 rows — fim`);
      break;
    }

    for (const row of rows) {
      let result = 'error';
      try {
        result = await migrateLead(row, users);
        if (result === 'skip') {
          skipped++;
        } else {
          ok++;
          if (ok % 100 === 0) {
            const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
            const total = ok + skipped + failed;
            log(`  → ${total} processados | ${ok} novos | ${skipped} skip | ${failed} err | ${elapsed}min`);
          }
        }
      } catch (err) {
        failed++;
        result = 'error';
        log(`  ✗ lead ${row.token}: ${err.message.substring(0, 80)}`);
        await sleep(300);
      }
      if (result !== 'skip') await sleep(200);
    }

    offset += 35;
    await sleep(150);
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  log('='.repeat(60));
  log(`Concluído em ${elapsed} min`);
  log(`Novos leads inseridos: ${ok}`);
  log(`Já existiam (skip):    ${skipped}`);
  log(`Falhas:                ${failed}`);
  log(`Erros de página:       ${pageErrors}`);

  await pg.end().catch(() => {});
  logStream.end();
  process.exit(failed > 1000 ? 1 : 0);
})().catch(err => {
  log('ERRO FATAL:', err.message);
  process.exit(1);
});
