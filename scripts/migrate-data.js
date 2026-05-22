/**
 * Migração de dados: QSMI v2.0 (PHP/MySQL) → CRM SaaS (NestJS/PostgreSQL)
 *
 * Migra Clientes e Leads com TODO o histórico (ocorrências → interações).
 * Idempotente via legacy_id — pode ser re-executado sem duplicar registros.
 *
 * Uso: LEGACY_PASSWORD=xxx node migrate-data.js
 */

const axios   = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const { Client: PgClient } = require('./node_modules/pg');
const path    = require('path');
require('./node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const LEGACY_BASE  = 'http://www.qsmi.net.br';
const LEGACY_EMAIL = 'matheus.silveira.qualitysmi@gmail.com';
const LEGACY_PASS  = process.env.LEGACY_PASSWORD;

if (!LEGACY_PASS) { console.error('LEGACY_PASSWORD env var required'); process.exit(1); }

const DB_URL = process.env.DATABASE_URL;

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseDate(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseDateTime(str) {
  // "05/11/2025 - 16:15" or "05/11/2025 - 13:15"
  if (!str) return null;
  const m = str.trim().match(/(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2}):(\d{2})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00-03:00`) : null;
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

function mapLeadStage(status) {
  const s = (status || '').trim().toLowerCase();
  if (s.includes('fechado') || s.includes('contratado') || s.includes('ganho')) return 'WON';
  if (s.includes('perdido')) return 'LOST';
  if (s.includes('negocia')) return 'NEGOTIATION';
  if (s.includes('proposta')) return 'PROPOSAL';
  if (s.includes('delega') || s.includes('qualifi')) return 'QUALIFIED';
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
      s.includes('contratado')) return 'STATUS_CHANGE';
  return 'NOTE';
}

function mapClientStatus(projetoCol) {
  const s = (projetoCol || '').trim().toLowerCase();
  if (s.includes('andamento')) return 'ACTIVE';
  if (s.includes('parado')) return 'INACTIVE';
  if (s.includes('finalizado') || s.includes('encerrado')) return 'CHURNED';
  return 'ACTIVE';
}

function fuzzyMatchUser(name, users) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  let match = users.find(u => u.name.toLowerCase() === n);
  if (match) return match.id;
  const firstName = n.split(/\s/)[0];
  match = users.find(u => u.name.toLowerCase().startsWith(firstName) || firstName.length > 3 && u.name.toLowerCase().includes(firstName));
  return match ? match.id : null;
}

// ─── HTTP client ─────────────────────────────────────────────────────────────

const http = axios.create({ baseURL: LEGACY_BASE, timeout: 30000, maxRedirects: 5 });
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

// ─── DB ──────────────────────────────────────────────────────────────────────

let pg;

async function dbConnect() {
  if (pg) { try { await pg.end(); } catch (_) {} }
  pg = new PgClient({ connectionString: DB_URL, keepAlive: true, keepAliveInitialDelayMillis: 10000 });
  await pg.connect();
  console.log('✓ Conectado ao PostgreSQL');
}

async function prepareSchema() {
  await pg.query(`ALTER TABLE crm.leads ADD COLUMN IF NOT EXISTS legacy_id TEXT`);
  await pg.query(`ALTER TABLE crm.leads ADD COLUMN IF NOT EXISTS website  TEXT`);
  await pg.query(`
    DO $$ BEGIN
      ALTER TABLE crm.leads ADD CONSTRAINT uq_leads_legacy_id UNIQUE (legacy_id);
    EXCEPTION WHEN duplicate_table THEN null;
             WHEN duplicate_object THEN null; END $$
  `);
  console.log('✓ Schema ok');
}

async function loadLookups() {
  const users    = await pg.query('SELECT id, name FROM iam.users WHERE deleted_at IS NULL AND client_id IS NULL').then(r => r.rows);
  const segments = await pg.query('SELECT id, name FROM crm.segments').then(r => r.rows);
  const svcTypes = await pg.query('SELECT id, name FROM crm.service_types').then(r => r.rows);
  const hosting  = await pg.query('SELECT id, name FROM crm.hosting_types').then(r => r.rows);
  console.log(`✓ Lookup: ${users.length} users, ${segments.length} segs, ${svcTypes.length} svcs, ${hosting.length} hospedagens`);
  return { users, segments, svcTypes, hosting };
}

// Insere lookup sem ON CONFLICT (tabelas não têm UNIQUE em name)
async function ensureByName(table, name, cache) {
  if (!name) return null;
  const n = name.trim();
  let row = cache.find(r => r.name.toLowerCase() === n.toLowerCase());
  if (row) return row.id;
  const res = await pg.query(
    `INSERT INTO crm.${table} (id, name) VALUES (uuid_generate_v4(), $1) RETURNING id, name`, [n]
  );
  cache.push(res.rows[0]);
  return res.rows[0].id;
}

// ─── CLIENT PARSING ──────────────────────────────────────────────────────────

async function getClientLinks() {
  const res = await http.get('/clientes');
  const $ = cheerio.load(res.data);
  const links = [];
  const statusMap = {};
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
  const res = await http.get(editUrl);
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
    legacy_id: tk,
    company_name: v('data[Cliente][empresa]'),
    legal_name:   v('data[Cliente][razao_social]'),
    cnpj:         v('data[Cliente][cnpj]'),
    domain:       cleanDomain(v('data[Cliente][dominio]')),
    contact_name: v('data[Cliente][responsavel]'),
    segment_name: v('data[Cliente][segmento]'),
    seller_name:  v('data[Cliente][vendedor]'),
    monthly_value:        v('data[Cliente][valor_mensalidade]'),
    first_payment_date:   parseDate(v('data[Cliente][data_pag_primeira_parcela]')),
    due_day:              parseInt(v('data[Cliente][dia_vencimento]') || '0') || null,
    installments_qty:     parseInt(v('data[Cliente][quantidade_parcelas]') || '0') || null,
    contracted_at:        parseDate(v('data[Cliente][data_contratacao]')),
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

// ─── LEAD PARSING ─────────────────────────────────────────────────────────────

async function getLeadFullData(token) {
  // View modal — Tab 1: lead fields, Tab 2: ocorrências
  const viewRes = await http.post('/leads/view/', `tk=${token}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
  });
  const $v = cheerio.load(viewRes.data);

  // Parse "Label: valor" from tab 1 paragraphs
  const fieldMap = {};
  $v('#aba-1 p').each((_, p) => {
    const text = $v(p).text().replace(/\s+/g, ' ').trim();
    const sep = text.indexOf(':');
    if (sep > -1) {
      const key = text.substring(0, sep).trim().toLowerCase();
      const val = text.substring(sep + 1).trim() || null;
      fieldMap[key] = val;
    }
  });

  // Interactions from accordion in tab 2
  const interactions = [];
  $v('#aba-2 .panel').each((_, panel) => {
    const heading = $v(panel).find('.panel-heading a').text().trim().replace(/\s+/g, ' ');
    // "05/05/2026 - 10:03 - Delegação"
    const hm = heading.match(/^(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}:\d{2})\s*[-–]\s*(.+)$/);
    if (!hm) return;
    const dateStr = `${hm[1]} - ${hm[2]}`;
    const statusLabel = hm[3].trim();
    const body = $v(panel).find('.panel-body');
    const createdBy = cleanText(body.find('p strong').first().text());
    const descP = body.find('p:contains("Descricao")');
    const desc = cleanText(descP.text().replace(/Descricao\s*:?/i, '').trim());
    interactions.push({
      date: parseDateTime(dateStr),
      statusLabel,
      createdBy,
      description: desc || statusLabel,
      type: mapInteractionType(statusLabel),
    });
  });

  // Origin from edit modal (has the select with value)
  const editRes = await http.post('/leads/edit/', `tk=${token}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
  });
  const $e = cheerio.load(editRes.data);
  const originText = $e('select[name="data[Lead][origem_id]"] option:selected').text().trim() || null;
  const telefone2  = cleanText($e('input[name="data[Lead][telefone_2]"]').attr('value'));
  const createdAtStr = fieldMap['criado por'] || null;
  const createdAt = createdAtStr ? parseDateTime(createdAtStr.replace(/.*em\s+/i, '')) : null;

  // Build notes (website fica no campo próprio, não aqui)
  const parts = [];
  if (telefone2) parts.push(`Tel. 2: ${telefone2}`);
  const obs = fieldMap['observações'] || fieldMap['observacoes'];
  if (obs) parts.push(`Obs.: ${obs}`);
  const notes = parts.length ? parts.join('\n') : null;

  const website = cleanText(fieldMap['website']);

  return {
    name:          fieldMap['empresa'] || null,
    contact_name:  fieldMap['responsável'] || fieldMap['responsavel'] || null,
    contact_email: fieldMap['email'] || null,
    contact_phone: fieldMap['telefone 1'] || fieldMap['telefone1'] || null,
    website,
    owner_name:    fieldMap['usuário responsável'] || fieldMap['usuario responsavel'] || null,
    status_label:  fieldMap['último status'] || fieldMap['ultimo status'] || null,
    origin_text:   originText,
    notes,
    created_at:    createdAt,
    interactions,
  };
}

// ─── MIGRATE CLIENTS ─────────────────────────────────────────────────────────

async function migrateClients(lookups) {
  console.log('\n📋 Migrando Clientes...');
  const { links, statusMap } = await getClientLinks();
  console.log(`  → ${links.length} clientes na lista`);

  let ok = 0, skipped = 0, failed = 0;

  for (const [idx, link] of links.entries()) {
    const hash = link.split('/').pop();
    process.stdout.write(`  [${idx + 1}/${links.length}] `);

    try {
      const exists = await pg.query('SELECT id FROM crm.clients WHERE legacy_id=$1', [hash]);
      if (exists.rows.length) { process.stdout.write(`já existe — skip\n`); skipped++; continue; }

      const d = await parseClientDetail(link);
      if (!d.company_name) { process.stdout.write(`sem nome — skip\n`); skipped++; continue; }
      process.stdout.write(`${d.company_name.substring(0, 35)} `);

      const segmentId      = await ensureByName('segments', d.segment_name, lookups.segments);
      const serviceTypeId  = await ensureByName('service_types', d.service_type_name, lookups.svcTypes);
      const sellerId       = fuzzyMatchUser(d.seller_name, lookups.users);
      const clientStatus   = statusMap[hash] || 'ACTIVE';
      const domain         = d.domain || cleanDomain(d.company_name.toLowerCase().replace(/[^a-z0-9]/g, '-')) + '.com.br';

      const cr = await pg.query(`
        INSERT INTO crm.clients (
          id, company_name, legal_name, cnpj, domain, contact_name, status,
          segment_id, seller_id, service_type_id, monthly_value,
          first_payment_date, due_day, installments_qty, contracted_at,
          contract_keywords_qty, zip_code, street, street_number,
          neighborhood, city, state, notes, legacy_id, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(),$1,$2,$3,$4,$5,$6,
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
    await sleep(250);
  }

  console.log(`  Resultado: ${ok} importados, ${skipped} já existiam, ${failed} falhas`);
}

// ─── MIGRATE LEADS ───────────────────────────────────────────────────────────

async function getAllLeadTokens() {
  const rows = [];
  let offset = 0;
  while (true) {
    const url = offset === 0 ? '/leads' : `/leads/index/${offset}`;
    const res = await http.get(url);
    const $ = cheerio.load(res.data);
    let count = 0;
    $('table tbody tr').each((_, tr) => {
      const ocLink = $(tr).find('a[href*="/ocorrencias/index/"]').attr('href');
      const token  = ocLink ? ocLink.split('/').pop() : null;
      const cells  = [];
      $(tr).find('td').each((_, td) => cells.push($(td).text().trim().replace(/\s+/g, ' ')));
      if (token && cells[0]) {
        rows.push({ token, empresa: cells[0], listWebsite: cells[1], listStatus: cells[2], listOwner: cells[3], listCreator: cells[4] });
        count++;
      }
    });
    process.stdout.write(`  pág. offset=${offset}: ${count} leads\n`);
    if (count < 35) break;
    offset += 35;
    await sleep(400);
    if (offset > 80000) break;
  }
  return rows;
}

async function migrateLeads(lookups, rows) {
  console.log('\n🎯 Migrando Leads (com histórico completo)...');
  console.log(`  Total: ${rows.length} leads\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const [idx, row] of rows.entries()) {
    process.stdout.write(`  [${idx + 1}/${rows.length}] `);
    try {
      const exists = await pg.query('SELECT id FROM crm.leads WHERE legacy_id=$1', [row.token]);
      if (exists.rows.length) { process.stdout.write(`já existe — skip\n`); skipped++; continue; }

      const d = await getLeadFullData(row.token);
      const name = d.name || row.empresa.trim();
      process.stdout.write(`${name.substring(0, 30)} `);

      const stage     = mapLeadStage(d.status_label || row.listStatus);
      const origin    = mapLeadOrigin(d.origin_text);
      const ownerId   = fuzzyMatchUser(d.owner_name || row.listOwner, lookups.users);
      const createdBy = fuzzyMatchUser(row.listCreator, lookups.users);
      const createdAt = d.created_at || new Date();

      const lr = await pg.query(`
        INSERT INTO crm.leads (
          id, name, contact_name, contact_email, contact_phone, website,
          stage, origin, notes, owner_id, created_by, legacy_id,
          created_at, updated_at
        ) VALUES (
          uuid_generate_v4(),$1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10,$11,
          $12,NOW()
        ) RETURNING id`,
        [
          name, d.contact_name, d.contact_email, d.contact_phone, d.website,
          stage, origin, d.notes, ownerId, createdBy, row.token,
          createdAt,
        ]
      );
      const leadId = lr.rows[0].id;

      // Importar ocorrências como interações
      for (const inter of d.interactions) {
        const userId = fuzzyMatchUser(inter.createdBy, lookups.users);
        const ts = inter.date || createdAt;
        await pg.query(`
          INSERT INTO crm.lead_interactions (id, lead_id, user_id, type, description, created_at)
          VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5)`,
          [leadId, userId, inter.type, inter.description, ts]
        );
      }

      process.stdout.write(`✓ [${stage}] ${d.interactions.length} interações\n`);
      ok++;
    } catch (err) {
      process.stdout.write(`✗ ${err.message.substring(0, 70)}\n`);
      failed++;
    }
    await sleep(300);
  }

  console.log(`  Resultado: ${ok} importados, ${skipped} já existiam, ${failed} falhas`);
}

// ─── main ────────────────────────────────────────────────────────────────────

(async () => {
  const start = Date.now();
  try {
    // 1. Login in legacy system (HTTP only)
    await legacyLogin();

    // 2. Collect ALL lead tokens before touching the DB
    //    (this takes ~6 min and would idle-timeout an open DB connection)
    console.log('📋 Coletando tokens de leads do sistema legado...');
    const leadTokens = await getAllLeadTokens();
    console.log(`  ${leadTokens.length} leads encontrados`);

    // 3. Open DB connection NOW (right before any DB work)
    await dbConnect();
    await prepareSchema();
    const lookups = await loadLookups();

    await migrateClients(lookups);

    // 4. Reconnect before lead inserts to avoid any accumulated drift
    await dbConnect();
    await migrateLeads(lookups, leadTokens);

    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ Migração concluída em ${secs}s`);
  } catch (err) {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
  } finally {
    if (pg) await pg.end().catch(() => {});
  }
})();
