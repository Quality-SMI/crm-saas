// Finds legacy data for clients that have no keywords in our DB
const axios = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const { Client: PgClient } = require('./node_modules/pg');

const BASE = 'http://www.qsmi.net.br';
const PASS = process.env.LEGACY_PASSWORD;
const http = axios.create({ baseURL: BASE, timeout: 25000, maxRedirects: 10 });
let cookie = '';
http.interceptors.request.use(cfg => { if (cookie) cfg.headers['Cookie'] = cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

function normalizeDomain(raw) {
  return (raw || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').split('/')[0].toLowerCase().trim();
}
function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/, '').slice(0, 60);
}

(async () => {
  const pg = new PgClient({ connectionString: 'postgresql://crm:crm_dev_pass@localhost:5432/crm_db' });
  await pg.connect();

  // Get clients with no keywords
  const { rows: missing } = await pg.query(`
    SELECT c.id, c.company_name, c.domain
    FROM crm.clients c
    LEFT JOIN crm.client_keywords k ON k.client_id = c.id AND k.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, c.company_name, c.domain
    HAVING COUNT(k.id) = 0
    ORDER BY c.company_name
  `);
  console.log(`Clients without keywords: ${missing.length}`);

  // Login
  const p = new URLSearchParams();
  p.append('dados[email_login]', 'matheus.silveira.qualitysmi@gmail.com');
  p.append('dados[senha_login]', PASS);
  const loginRes = await http.post('/login/setLogin/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
  });
  if (!loginRes.data?.status) throw new Error('Login failed: ' + loginRes.data?.mensagem);
  console.log('Login ok\n');

  // Get all legacy clients
  const r = await http.get('/paineis');
  const $ = cheerio.load(r.data);
  const legacyClients = [];
  $('table tbody tr').each((i, tr) => {
    const token = $(tr).find('[data-token]').attr('data-token') || '';
    const cells = $(tr).find('td').map((j, td) => $(td).text().trim().replace(/\s+/g,' ')).get();
    if (token) legacyClients.push({ token, name: (cells[1] || cells[0] || '').trim() });
  });

  // For each missing client, try to find it in legacy by domain or name
  for (const mc of missing) {
    const mcDomain = normalizeDomain(mc.domain);
    const mcName = mc.company_name.toLowerCase();

    // Try name-based match in legacy
    for (const lc of legacyClients) {
      const lcName = lc.name.toLowerCase();
      // Check if names share significant words
      const mcWords = mcName.replace(/[^a-zÀ-ɏ\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const hasMatch = mcWords.some(w => lcName.includes(w));
      if (!hasMatch) continue;

      // Fetch the client view to check domain and keywords
      try {
        const vp = new URLSearchParams({ tk: lc.token });
        const vr = await http.post('/clientes/view/', vp.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
        });
        const $v = cheerio.load(vr.data);

        // Get domain from view
        let legacyDomain = '';
        $v('#aba1 a[href]').each((i, el) => {
          const href = $v(el).attr('href') || '';
          if (href.startsWith('http') && !href.includes('qsmi.net.br')) { legacyDomain = href; return false; }
        });
        const normLegacyDomain = normalizeDomain(legacyDomain);

        // Extract keywords
        const keywords = [];
        $v('#aba3 table tbody tr').each((i, tr) => {
          const kw = $v(tr).find('td').first().text().trim().replace(/\s+/g, ' ');
          if (kw && kw.length > 1 && !kw.toLowerCase().includes('nenhuma')) keywords.push(kw);
        });

        const domainMatch = normLegacyDomain && (normLegacyDomain === mcDomain || normLegacyDomain === mcDomain.replace(/^www\./,''));

        if (keywords.length > 0 || domainMatch) {
          console.log(`\n[${mc.company_name}] ← legacy: "${lc.name}"`);
          console.log(`  CRM domain: ${mcDomain} | Legacy domain: ${normLegacyDomain} | Match: ${domainMatch}`);
          console.log(`  Keywords: ${keywords.length}`);
          if (keywords.length > 0) {
            console.log(`  Sample: ${keywords.slice(0,3).join(', ')}`);
            // Insert keywords
            let inserted = 0;
            for (const kw of keywords) {
              const res = await pg.query(
                `INSERT INTO crm.client_keywords (client_id, keyword, slug, is_active)
                 VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING`,
                [mc.id, kw, slugify(kw)]
              );
              if (res.rowCount > 0) inserted++;
            }
            console.log(`  → Inserted ${inserted} keywords`);
          }
          break;
        }
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log('\nDone.');
  await pg.end();
})().catch(e => console.error('FATAL:', e.message));
