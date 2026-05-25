const axios   = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');
const BASE = 'http://www.qsmi.net.br';
const PASS = process.env.LEGACY_PASSWORD;
const http = axios.create({ baseURL: BASE, timeout: 30000, maxRedirects: 5 });
let cookie = '';
http.interceptors.request.use(cfg => { if (cookie) cfg.headers['Cookie'] = cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

(async () => {
  const p = new URLSearchParams();
  p.append('dados[email_login]', 'matheus.silveira.qualitysmi@gmail.com');
  p.append('dados[senha_login]', PASS);
  await http.post('/login/setLogin/', p.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  console.log('logged in, cookie:', !!cookie);

  // Explore the main keywords listing page
  const res = await http.get('/clientesPalavrasChave');
  console.log('page size:', res.data.length, 'final url:', res.request?.res?.responseUrl);
  const $ = cheerio.load(res.data);

  console.log('h1:', $('h1, h2').first().text().trim().substring(0, 100));
  const hdrs = $('table thead th').map((i, el) => $(el).text().trim()).get();
  console.log('table headers:', hdrs);

  let n = 0;
  $('table tbody tr').each((i, tr) => {
    if (n++ > 2) return;
    const cells = $(tr).find('td').map((j, td) => $(td).text().trim().replace(/\s+/g, ' ').substring(0, 50)).get();
    const links = $(tr).find('a').map((j, a) => $(a).attr('href')).get();
    console.log('row', i, ':', JSON.stringify(cells));
    console.log('  links:', JSON.stringify(links));
  });

  // Also try fetching a specific client keyword page
  // Try the first client's keyword page
  const firstLink = $('table tbody tr').first().find('a').first().attr('href');
  if (firstLink) {
    console.log('\nFetching first link:', firstLink);
    const res2 = await http.get(firstLink);
    const $2 = cheerio.load(res2.data);
    console.log('h1:', $2('h1, h2').first().text().trim().substring(0, 100));
    const hdrs2 = $2('table thead th').map((i, el) => $2(el).text().trim()).get();
    console.log('table headers:', hdrs2);
    let m = 0;
    $2('table tbody tr').each((i, tr) => {
      if (m++ > 4) return;
      const cells = $2(tr).find('td').map((j, td) => $2(td).text().trim().replace(/\s+/g, ' ').substring(0, 60)).get();
      console.log('  kw row', i, ':', JSON.stringify(cells));
    });
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
