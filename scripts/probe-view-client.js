// Confirms the /clientes/view/ endpoint and shows the HTML structure
const axios = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const BASE = 'http://www.qsmi.net.br';
const PASS = process.env.LEGACY_PASSWORD;
const http = axios.create({ baseURL: BASE, timeout: 30000, maxRedirects: 10 });
let cookie = '';
http.interceptors.request.use(cfg => { if (cookie) cfg.headers['Cookie'] = cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

async function login() {
  const p = new URLSearchParams();
  p.append('dados[email_login]', 'matheus.silveira.qualitysmi@gmail.com');
  p.append('dados[senha_login]', PASS);
  const r = await http.post('/login/setLogin/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
  });
  if (!r.data?.status) throw new Error('Login failed: ' + r.data?.mensagem);
  console.log('Login ok');
}

(async () => {
  await login();

  // Get first 5 rows from paineis to find tokens
  console.log('\n=== Fetching /paineis to extract tokens ===');
  const r = await http.get('/paineis');
  const $ = cheerio.load(r.data);

  // Show all rows with tokens
  const rows = [];
  $('table tbody tr').each((i, tr) => {
    const cells = $(tr).find('td').map((j, td) => $(td).text().trim().replace(/\s+/g,' ').substring(0,40)).get();
    const token = $(tr).find('[data-token]').attr('data-token') || '';
    if (token && i < 10) {
      rows.push({ i, token, name: cells[1] || cells[0] || '?', cells: cells.slice(0,4) });
      console.log(`Row ${i}: token=${token.substring(0,20)}... name="${cells[1]||cells[0]}"`);
    }
  });
  console.log(`Total rows with tokens: ${$('[data-token]').length}`);

  // Use Cotiglas token
  const COTIGLAS_TOKEN = '9ec7421595e292f78bb84a7ce33d5859';
  console.log('\n=== POST /clientes/view/ with Cotiglas token ===');
  const p = new URLSearchParams({ tk: COTIGLAS_TOKEN });
  const r2 = await http.post('/clientes/view/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
  });
  console.log('Status:', r2.status, 'Size:', r2.data.length);

  const $2 = cheerio.load(r2.data);

  // Show tabs / sections
  console.log('\n--- Tabs / Nav ---');
  $2('ul.nav a, .tab-pane, [role="tab"]').each((i, el) => {
    console.log(`  ${$2(el).attr('href')||''} | ${$2(el).text().trim().substring(0,50)}`);
  });

  // Look for keywords / palavras-chave section
  console.log('\n--- Searching for keyword/palavras patterns ---');
  const html = r2.data;
  const patterns = ['palavras', 'keyword', 'palavra-chave', 'informac', 'mapa'];
  for (const pat of patterns) {
    const idx = html.toLowerCase().indexOf(pat.toLowerCase());
    if (idx >= 0) {
      console.log(`\nFound "${pat}" at ${idx}:`);
      console.log(html.substring(Math.max(0,idx-50), idx+300));
    }
  }

  // Show first 2000 chars of response
  console.log('\n--- First 2000 chars ---');
  console.log(html.substring(0, 2000));
})().catch(e => console.error('FATAL:', e.message));
