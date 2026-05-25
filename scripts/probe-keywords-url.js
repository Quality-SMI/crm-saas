/**
 * Proba diferentes URL patterns para encontrar onde ficam as palavras-chave por cliente.
 */
const axios = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const BASE = 'http://www.qsmi.net.br';
const PASS = process.env.LEGACY_PASSWORD;
const http = axios.create({ baseURL: BASE, timeout: 20000, maxRedirects: 5 });
let cookie = '';
http.interceptors.request.use(cfg => { if (cookie) cfg.headers['Cookie'] = cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

const SAMPLE_HASH = 'c6d64e1d760b881fe086927dbc7ada50'; // @grugases

async function probe(url) {
  try {
    const r = await http.get(url);
    const $ = cheerio.load(r.data);
    const h1 = $('h1, h2, .page-title, title').first().text().trim().substring(0, 80);
    const tables = $('table').length;
    const rows = $('table tbody tr').length;
    const links = $('a[href]').length;
    console.log(`✓ ${url} → ${r.data.length}b | h1: "${h1}" | tables:${tables} rows:${rows} links:${links}`);

    // Show first row of any table
    if (rows > 0) {
      const cells = $('table tbody tr').first().find('td').map((i,td) => $(td).text().trim().replace(/\s+/g,' ').substring(0, 40)).get();
      console.log('  first row:', JSON.stringify(cells));
    }
    return { ok: true, size: r.data.length, rows, h1 };
  } catch (e) {
    console.log(`✗ ${url} → ${e.code || e.message.substring(0,40)}`);
    return { ok: false };
  }
}

(async () => {
  const p = new URLSearchParams();
  p.append('dados[email_login]', 'matheus.silveira.qualitysmi@gmail.com');
  p.append('dados[senha_login]', PASS);
  await http.post('/login/setLogin/', p.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  console.log('Logged in\n');

  const urls = [
    `/clientesPalavrasChave/view/${SAMPLE_HASH}`,
    `/clientesPalavrasChave/index/${SAMPLE_HASH}`,
    `/clientesPalavrasChave/edit/${SAMPLE_HASH}`,
    `/clientesPalavrasChave/add/${SAMPLE_HASH}`,
    `/clientes/palavrasChave/${SAMPLE_HASH}`,
    `/clientes/view/${SAMPLE_HASH}`,
    `/paineis/view/${SAMPLE_HASH}`,
    `/paineis/informacoes/${SAMPLE_HASH}`,
    `/clientes/informacoes/${SAMPLE_HASH}`,
    `/ferramentas/selecaoPalavrasChave`,
    `/clientesBuscasPosicionamentos`,
  ];

  for (const url of urls) {
    await probe(url);
    await new Promise(r => setTimeout(r, 400));
  }
})().catch(e => console.error('FATAL:', e.message));
