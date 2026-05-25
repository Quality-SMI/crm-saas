// Run this script AFTER unblocking the account
// It finds the exact AJAX endpoint used by btn-load-item buttons
// and maps all available panels for keyword extraction

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
  if (!r.data?.status) {
    throw new Error('Login failed: ' + r.data?.mensagem);
  }
  console.log('Login ok');
}

async function findBtnLoadItemEndpoint() {
  // Fetch /paineis to get all external JS files loaded on that page
  const r = await http.get('/paineis');
  if (!r.data || r.data.length === 0) throw new Error('/paineis returned empty - session invalid?');
  console.log('/paineis size:', r.data.length);

  const $ = cheerio.load(r.data);

  // Get ALL external JS files
  const scripts = $('script[src]').map((i, el) => $(el).attr('src')).get();
  console.log('External scripts:', scripts);

  // Also grab first row token
  const firstToken = $('button[data-token]').first().attr('data-token');
  const firstRow = $('table tbody tr').first();
  const firstCells = firstRow.find('td').map((i, td) => $(td).text().trim().replace(/\s+/g,' ').substring(0,30)).get();
  console.log('First token:', firstToken);
  console.log('First row cells:', firstCells.slice(0,4));

  // Fetch each non-CDN JS file and search for btn-load-item
  for (const src of scripts) {
    if (!src) continue;
    try {
      const jsUrl = src.startsWith('http') ? src : BASE + src;
      const jsRes = await http.get(jsUrl.includes('?') ? jsUrl : jsUrl);
      const code = jsRes.data;
      if (code.includes('load-item') || code.includes('loadItem') || code.includes('btn-load')) {
        console.log('\n=== FOUND btn-load-item in:', src, '===');
        // Find the relevant section
        const idx = code.indexOf('load-item');
        const idx2 = code.indexOf('loadItem');
        const pos = Math.min(idx >= 0 ? idx : Infinity, idx2 >= 0 ? idx2 : Infinity);
        if (pos !== Infinity) {
          console.log(code.substring(Math.max(0, pos - 200), pos + 500));
        }
        return { found: true, script: src, code };
      }
    } catch (e) {
      console.log('Could not fetch:', src, e.message.substring(0, 50));
    }
  }

  // If not found in external scripts, search inline scripts
  console.log('\nSearching inline scripts...');
  $('script:not([src])').each((i, el) => {
    const code = $(el).html() || '';
    if (code.includes('load-item') || code.includes('loadItem') || code.includes('btn-load')) {
      console.log('Found in inline script', i, ':', code.substring(0, 500));
    }
  });

  return { found: false };
}

(async () => {
  await login();
  const result = await findBtnLoadItemEndpoint();
  if (!result.found) {
    console.log('\nNot found in any script. Trying direct URL patterns with token...');
    const TOKEN = '9ec7421595e292f78bb84a7ce33d5859'; // Cotiglas
    const patterns = [
      `/paineis/view/${TOKEN}`,
      `/paineis/informacoes/${TOKEN}`,
      `/paineis/siteMap/${TOKEN}`,
      `/paineis/palavrasChave/${TOKEN}`,
      `/clientesPalavrasChave/view/${TOKEN}`,
      `/clientesPalavrasChave/index/${TOKEN}`,
    ];
    for (const url of patterns) {
      try {
        const r = await http.get(url);
        const $ = cheerio.load(r.data);
        const h = $('h1,h2,title').first().text().trim().substring(0, 60);
        console.log(`✓ ${url}: ${r.data.length}b h="${h}"`);
        if (r.data.length > 500) {
          const tabs = $('ul.nav a, .tab-content').map((i, el) => $(el).text().trim().substring(0, 40)).get();
          console.log('  tabs:', tabs.join(' | ').substring(0, 200));
        }
      } catch (e) {
        console.log(`✗ ${url}: ${e.response?.status || e.code}`);
      }
    }
  }
})().catch(e => console.error('FATAL:', e.message));
