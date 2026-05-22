/**
 * Exploração do sistema legado QSMI v2.0
 * Login → inspeciona páginas de Clientes e Leads para mapear estrutura HTML
 */

const axios  = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');

const BASE   = 'http://www.qsmi.net.br';
const EMAIL  = 'matheus.silveira.qualitysmi@gmail.com';
const SENHA  = process.env.LEGACY_PASSWORD || process.argv[2];

if (!SENHA) {
  console.error('Uso: node explore-legacy.js <senha>');
  process.exit(1);
}

const http = axios.create({
  baseURL: BASE,
  timeout: 15000,
  maxRedirects: 5,
  withCredentials: true,
});

let cookie = '';

http.interceptors.request.use((cfg) => {
  if (cookie) cfg.headers['Cookie'] = cookie;
  return cfg;
});

http.interceptors.response.use((res) => {
  const sc = res.headers['set-cookie'];
  if (sc) {
    cookie = sc.map((c) => c.split(';')[0]).join('; ');
  }
  return res;
});

async function login() {
  const params = new URLSearchParams();
  params.append('dados[email_login]', EMAIL);
  params.append('dados[senha_login]', SENHA);

  const res = await http.post('/login/setLogin/', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  console.log('Login status:', res.status, '| URL final:', res.request?.res?.responseUrl ?? res.config?.url);
  console.log('Cookie obtido:', cookie ? 'sim' : 'NÃO');
  return res;
}

async function explorePage(path, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Explorando: ${label} → ${path}`);
  console.log('='.repeat(60));

  const res = await http.get(path);
  const $ = cheerio.load(res.data);

  // Detectar forms
  const forms = [];
  $('form').each((_, el) => {
    forms.push({ action: $(el).attr('action'), method: $(el).attr('method') });
  });
  if (forms.length) console.log('Forms:', JSON.stringify(forms, null, 2));

  // Detectar tabelas com dados
  $('table').each((i, tbl) => {
    const headers = [];
    $(tbl).find('thead th, thead td').each((_, th) => headers.push($(th).text().trim()));
    if (headers.length) {
      console.log(`\nTabela ${i + 1} — cabeçalhos:`, headers);
      // Primeira linha de dados
      const firstRow = [];
      $(tbl).find('tbody tr').first().find('td').each((_, td) => firstRow.push($(td).text().trim().replace(/\s+/g, ' ').substring(0, 50)));
      if (firstRow.length) console.log('  Primeira linha:', firstRow);
    }
  });

  // Links de paginação
  const pageLinks = [];
  $('a[href*="page"], a[href*="pagina"], .pagination a').each((_, a) => {
    pageLinks.push($(a).attr('href'));
  });
  if (pageLinks.length) console.log('\nLinks paginação:', [...new Set(pageLinks)].slice(0, 5));

  // Links de detalhe (ex: /clientes/ver/123)
  const detailLinks = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (href.includes('/ver/') || href.includes('/edit/') || href.includes('/show/')) {
      detailLinks.push(href);
    }
  });
  if (detailLinks.length) {
    console.log('\nLinks de detalhe (amostra):', detailLinks.slice(0, 3));
  }

  return { $, html: res.data };
}

async function exploreClientDetail($mainPage) {
  // Pega primeiro link de cliente
  const link = $mainPage('table a[href]').first().attr('href') ||
               $mainPage('a[href*="/clientes/"]').first().attr('href');
  if (!link) {
    console.log('\n[detalhe cliente] Nenhum link encontrado na tabela');
    return;
  }
  console.log('\n[detalhe cliente] acessando:', link);
  const res = await http.get(link.startsWith('http') ? link : link);
  const $ = cheerio.load(res.data);
  // Mostrar labels de todos os campos do form/detail
  const fields = [];
  $('label, .control-label, th').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt && txt.length < 60) fields.push(txt);
  });
  console.log('Campos encontrados:', [...new Set(fields)].slice(0, 40));
}

(async () => {
  try {
    await login();

    // Clientes
    const { $: $clientes } = await explorePage('/clientes', 'CLIENTES');
    await exploreClientDetail($clientes).catch((e) => console.log('[detalhe] erro:', e.message));

    // Leads
    await explorePage('/leads', 'LEADS');

    // Financeiro
    await explorePage('/financeiros', 'FINANCEIROS').catch(() =>
      explorePage('/financeiro', 'FINANCEIRO').catch((e) => console.log('[financeiro] não encontrado:', e.message))
    );

    console.log('\n✓ Exploração concluída');
  } catch (err) {
    console.error('Erro:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('URL:', err.config?.url);
    }
  }
})();
