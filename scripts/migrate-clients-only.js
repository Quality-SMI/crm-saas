/**
 * Migração SOMENTE de Clientes: QSMI legado → CRM SaaS.
 * Idempotente via legacy_id. Reconecta e re-loga em caso de erro de rede.
 * Uso: LEGACY_PASSWORD='xxx' node migrate-clients-only.js
 */

const axios   = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const { Client: PgClient } = require('./node_modules/pg');
const path    = require('path');
require('./node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const LEGACY_BASE  = 'http://www.qsmi.net.br';
const LEGACY_EMAIL = 'matheus.silveira.qualitysmi@gmail.com';
const LEGACY_PASS  = process.env.LEGACY_PASSWORD;
const DB_URL       = process.env.DATABASE_URL;

if (!LEGACY_PASS) { console.error('LEGACY_PASSWORD required'); process.exit(1); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseDate(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function cleanDomain(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase().trim() || null;
}

function cleanText(str) {
  if (str == null) return null;
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s || null;
}

const STATE_ABR = {
  'acre':'AC','alagoas':'AL','amapá':'AP','amazonas':'AM','bahia':'BA',
  'ceará':'CE','distrito federal':'DF','espírito santo':'ES','goiás':'GO',
  'maranhão':'MA','mato grosso do sul':'MS','mato grosso':'MT','minas gerais':'MG',
  'pará':'PA','paraíba':'PB','paraná':'PR','pernambuco':'PE','piauí':'PI',
  'rio de janeiro':'RJ','rio grande do norte':'RN','rio grande do sul':'RS',
  'rondônia':'RO','roraima':'RR','santa catarina':'SC','são paulo':'SP',
  'sergipe':'SE','tocantins':'TO',
};
function cleanState(s) {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= 2) return t.toUpperCase();
  return STATE_ABR[t.toLowerCase()] || t.substring(0, 2).toUpperCase();
}

// Mapeamento para o enum crm.client_status do novo sistema
function mapClientStatus(projetoCol) {
  const s = (projetoCol || '').trim().toLowerCase();
  if (s.includes('andamento') || s.includes('ativo')) return 'ACTIVE';
  if (s.includes('parado') || s.includes('pausado')) return 'PAUSED';
  if (s.includes('finalizado') || s.includes('encerrado') || s.includes('churned')) return 'FINISHED';
  if (s.includes('cancelado')) return 'CANCELLED';
  if (s.includes('renovado')) return 'RENEWED';
  return 'ACTIVE';
}

function fuzzyMatchUser(name, users) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  let match = users.find(u => u.name.toLowerCase() === n);
  if (match) return match.id;
  const firstName = n.split(/\s/)[0];
  match = users.find(u =>
    u.name.toLowerCase().startsWith(firstName) ||
    (firstName.length > 3 && u.name.toLowerCase().includes(firstName))
  );
  return match ? match.id : null;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

let sessionCookie = '';
const http = axios.create({ baseURL: LEGACY_BASE, timeout: 30000, maxRedirects: 5 });
http.interceptors.request.use(cfg => { if (sessionCookie) cfg.headers['Cookie'] = sessionCookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) sessionCookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

async function legacyLogin() {
  sessionCookie = '';
  const params = new URLSearchParams();
  params.append('dados[email_login]', LEGACY_EMAIL);
  params.append('dados[senha_login]', LEGACY_PASS);
  await http.post('/login/setLogin/', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!sessionCookie) throw new Error('Login falhou — cookie não recebido');
  console.log('✓ Login no sistema legado');
}

async function fetchWithRetry(fn, label = '', maxRetries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      const isNet = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' ||
                    err.message.includes('socket hang up') || err.message.includes('ECONNREFUSED');
      console.warn(`  ⚠ [${label}] tentativa ${attempt}/${maxRetries}: ${err.message.substring(0, 60)}`);
      if (isNet && attempt < maxRetries) {
        await sleep(Math.min(2000 * attempt, 8000));
        if (attempt >= 2) await legacyLogin().catch(() => {});
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── DB ───────────────────────────────────────────────────────────────────────

let pg;
async function dbConnect() {
  if (pg) { try { await pg.end(); } catch (_) {} }
  pg = new PgClient({ connectionString: DB_URL, keepAlive: true });
  await pg.connect();
  console.log('✓ Conectado ao PostgreSQL');
}

async function ensureByName(table, name, cache) {
  if (!name) return null;
  const n = name.trim().substring(0, 99); // trunca para VARCHAR(100)
  let row = cache.find(r => r.name.toLowerCase() === n.toLowerCase());
  if (row) return row.id;
  // Sem UNIQUE constraint — faz SELECT antes de INSERT
  const sel = await pg.query(`SELECT id FROM crm.${table} WHERE lower(name)=lower($1) LIMIT 1`, [n]);
  if (sel.rows.length) {
    const id = sel.rows[0].id;
    cache.push({ id, name: n });
    return id;
  }
  const ins = await pg.query(
    `INSERT INTO crm.${table} (id, name) VALUES (uuid_generate_v4(), $1) RETURNING id`, [n]
  );
  const id = ins.rows[0].id;
  cache.push({ id, name: n });
  return id;
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

async function getClientLinks() {
  const res = await fetchWithRetry(() => http.get('/clientes'), 'listagem clientes');
  const $ = cheerio.load(res.data);
  const links = [], statusMap = {};
  $('table tbody tr').each((_, tr) => {
    const link = $(tr).find('a[href*="/clientes/edit/"]').attr('href');
    if (!link) return;
    const hash = link.split('/').pop();
    if (!links.includes(link)) links.push(link);
    const cells = [];
    $(tr).find('td').each((_, td) => cells.push($(td).text().trim().replace(/\s+/g, ' ')));
    statusMap[hash] = mapClientStatus(cells[6] || '');
  });
  return { links, statusMap };
}

async function parseClientDetail(editUrl) {
  const res = await fetchWithRetry(() => http.get(editUrl), editUrl.split('/').pop());
  const $ = cheerio.load(res.data);
  const v  = n => cleanText($(`input[name="${n}"]`).attr('value') || $(`textarea[name="${n}"]`).text());
  const tk = v('tk');

  const emails = [], phones = [];
  for (let i = 0; $(`input[name="data[ClienteEmail][${i}][email]"]`).length; i++) {
    const email = v(`data[ClienteEmail][${i}][email]`);
    if (email) emails.push({ email, label: v(`data[ClienteEmail][${i}][nome]`), is_primary: i === 0 });
  }
  for (let i = 0; $(`input[name="data[ClienteTelefone][${i}][telefone]"]`).length; i++) {
    const phone = v(`data[ClienteTelefone][${i}][telefone]`);
    if (phone) phones.push({ phone, label: v(`data[ClienteTelefone][${i}][nome]`), is_primary: i === 0 });
  }
  const svcSel = $('select[name="data[ClienteServicosContratados][0][tipo_servico_id]"] option:selected').text().trim() || null;

  return {
    legacy_id:             tk,
    company_name:          v('data[Cliente][empresa]'),
    legal_name:            v('data[Cliente][razao_social]'),
    cnpj:                  v('data[Cliente][cnpj]'),
    domain:                cleanDomain(v('data[Cliente][dominio]')),
    contact_name:          v('data[Cliente][responsavel]'),
    segment_name:          v('data[Cliente][segmento]'),
    seller_name:           v('data[Cliente][vendedor]'),
    monthly_value:         v('data[Cliente][valor_mensalidade]'),
    first_payment_date:    parseDate(v('data[Cliente][data_pag_primeira_parcela]')),
    due_day:               parseInt(v('data[Cliente][dia_vencimento]') || '0') || null,
    installments_qty:      parseInt(v('data[Cliente][quantidade_parcelas]') || '0') || null,
    contracted_at:         parseDate(v('data[Cliente][data_contratacao]')),
    contract_keywords_qty: parseInt(v('data[Cliente][quantidade_palavras_venda]') || '0') || null,
    zip_code:     v('data[Cliente][cep]'),
    street:       v('data[Cliente][logradouro]'),
    street_number: v('data[Cliente][numero]'),
    neighborhood: v('data[Cliente][bairro]'),
    city:         v('data[Cliente][cidade]'),
    state:        cleanState(v('data[Cliente][estado]')),
    notes:        v('data[Cliente][observacoes]'),
    service_type_name: svcSel,
    emails,
    phones,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log('🚀 Iniciando migração de clientes...\n');

  await legacyLogin();
  await dbConnect();

  const users    = await pg.query('SELECT id, name FROM iam.users WHERE deleted_at IS NULL').then(r => r.rows);
  const segments = await pg.query('SELECT id, name FROM crm.segments').then(r => r.rows);
  const svcTypes = await pg.query('SELECT id, name FROM crm.service_types').then(r => r.rows);
  console.log(`✓ Lookup: ${users.length} users, ${segments.length} segmentos, ${svcTypes.length} serviços\n`);

  const { links, statusMap } = await getClientLinks();
  console.log(`📋 ${links.length} clientes encontrados no legado\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const [idx, link] of links.entries()) {
    const hash = link.split('/').pop();
    process.stdout.write(`  [${String(idx + 1).padStart(3)}/${links.length}] `);

    try {
      const exists = await pg.query('SELECT id FROM crm.clients WHERE legacy_id=$1', [hash]);
      if (exists.rows.length) { process.stdout.write(`skip (já existe)\n`); skipped++; continue; }

      const d = await parseClientDetail(link);
      if (!d.company_name) { process.stdout.write(`skip (sem nome)\n`); skipped++; continue; }
      process.stdout.write(`${d.company_name.substring(0, 40).padEnd(40)} `);

      const segmentId     = await ensureByName('segments', d.segment_name, segments);
      const serviceTypeId = await ensureByName('service_types', d.service_type_name, svcTypes);
      const sellerId      = fuzzyMatchUser(d.seller_name, users);
      const clientStatus  = statusMap[hash] || 'ACTIVE';
      const domain        = d.domain || (d.company_name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com.br');

      const cr = await pg.query(`
        INSERT INTO crm.clients (
          id, company_name, legal_name, cnpj, domain, contact_name, status,
          segment_id, seller_id, service_type_id, monthly_value,
          first_payment_date, due_day, installments_qty, contracted_at,
          contract_keywords_qty, zip_code, street, street_number,
          neighborhood, city, state, notes, legacy_id, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(),$1,$2,$3,$4,$5,$6::crm.client_status,
          $7,$8,$9,$10,
          $11,$12,$13,$14,
          $15,$16,$17,$18,
          $19,$20,$21,$22,$23,NOW(),NOW()
        ) RETURNING id`,
        [
          d.company_name, d.legal_name, d.cnpj, domain, d.contact_name, clientStatus,
          segmentId, sellerId, serviceTypeId, d.monthly_value,
          d.first_payment_date, d.due_day, d.installments_qty, d.contracted_at,
          d.contract_keywords_qty, d.zip_code, d.street, d.street_number,
          d.neighborhood, d.city, d.state, d.notes, hash,
        ]
      );
      const clientId = cr.rows[0].id;

      for (const e of d.emails) {
        await pg.query(
          `INSERT INTO crm.client_emails (id,client_id,email,label,is_primary) VALUES (uuid_generate_v4(),$1,$2,$3,$4)`,
          [clientId, e.email, e.label, e.is_primary]
        ).catch(() => {});
      }
      for (const p of d.phones) {
        await pg.query(
          `INSERT INTO crm.client_phones (id,client_id,phone,label,is_primary) VALUES (uuid_generate_v4(),$1,$2,$3,$4)`,
          [clientId, p.phone, p.label, p.is_primary]
        ).catch(() => {});
      }

      process.stdout.write(`✓ [${clientStatus}]\n`);
      ok++;
    } catch (err) {
      process.stdout.write(`✗ ${err.message.substring(0, 70)}\n`);
      failed++;
    }

    await sleep(300);
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Clientes: ${ok} importados, ${skipped} já existiam, ${failed} falhas — ${secs}s`);
  await pg.end().catch(() => {});
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
