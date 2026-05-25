// Shows full content of aba2 (Dados do Projeto) and aba3 (Palavras Chave) for first N clients
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
}

async function getClientData(token, name) {
  const p = new URLSearchParams({ tk: token });
  const r = await http.post('/clientes/view/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }
  });
  const $ = cheerio.load(r.data);

  // Extract aba2 - Dados do Projeto
  const aba2 = $('#aba2').text().replace(/\s+/g, ' ').trim().substring(0, 500);

  // Extract aba3 - Palavras Chave (try multiple selectors)
  const aba3Html = $('#aba3').html() || '';
  const $3 = cheerio.load(aba3Html);

  // Try to find keywords in tables or lists
  const tableRows = $3('table tbody tr').map((i, tr) => $3(tr).find('td').map((j, td) => $3(td).text().trim()).get().join(' | ')).get();
  const listItems = $3('li, .keyword, .palavra').map((i, el) => $3(el).text().trim().replace(/\s+/g,' ')).get();
  const aba3Text = $('#aba3').text().replace(/\s+/g, ' ').trim().substring(0, 500);

  // Domain from aba1
  const domain = $('a[href*="http://www."], a[href*="https://www."]').first().attr('href') || '';

  return { name, token: token.substring(0,8), domain, aba2, aba3Text, tableRows, listItems };
}

(async () => {
  await login();
  console.log('Login ok\n');

  // Get tokens from paineis
  const r = await http.get('/paineis');
  const $ = cheerio.load(r.data);
  const clients = [];
  $('table tbody tr').each((i, tr) => {
    const token = $(tr).find('[data-token]').attr('data-token') || '';
    const cells = $(tr).find('td').map((j, td) => $(td).text().trim().replace(/\s+/g,' ')).get();
    if (token) clients.push({ token, name: cells[1] || cells[0] });
  });
  console.log(`Total clients with tokens: ${clients.length}\n`);

  // Check first 20 clients for keywords
  let found = 0;
  for (let i = 0; i < Math.min(30, clients.length); i++) {
    const c = clients[i];
    try {
      const data = await getClientData(c.token, c.name);
      const hasKw = data.tableRows.length > 0 || data.listItems.filter(l => l.length > 1).length > 0 ||
        (data.aba3Text && !data.aba3Text.includes('Nenhuma palavra chave'));

      if (hasKw) {
        found++;
        console.log(`\n=== ${data.name} (token: ${data.token}...) ===`);
        console.log('Domain:', data.domain);
        console.log('Aba3 text:', data.aba3Text.substring(0, 300));
        console.log('Table rows:', data.tableRows.slice(0, 10));
        console.log('List items:', data.listItems.slice(0, 10));
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.log(`Error for ${c.name}: ${e.message.substring(0, 50)}`);
    }
  }
  console.log(`\n\nClients with keywords in first 30: ${found}`);
})().catch(e => console.error('FATAL:', e.message));
