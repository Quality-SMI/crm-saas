/**
 * Diagnóstico de paginação do sistema legado.
 * Descobre quantos leads existem em cada modo de listagem
 * para calibrar o migrate-data.js.
 *
 * Uso: LEGACY_PASSWORD=xxx node probe-leads-pagination.js
 */

const axios   = require('./node_modules/axios').default;
const cheerio = require('./node_modules/cheerio');

const BASE  = 'http://www.qsmi.net.br';
const EMAIL = 'matheus.silveira.qualitysmi@gmail.com';
const PASS  = process.env.LEGACY_PASSWORD;

if (!PASS) { console.error('LEGACY_PASSWORD env var required'); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const http = axios.create({ baseURL: BASE, timeout: 20000, maxRedirects: 5 });
let cookie = '';
http.interceptors.request.use(cfg => { if (cookie) cfg.headers['Cookie'] = cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers['set-cookie'];
  if (sc) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return res;
});

async function login() {
  const p = new URLSearchParams();
  p.append('dados[email_login]', EMAIL);
  p.append('dados[senha_login]', PASS);
  await http.post('/login/setLogin/', p.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!cookie) throw new Error('Login falhou');
  console.log('✓ Login ok\n');
}

function countLeads($) {
  let n = 0;
  $('table tbody tr').each((_, tr) => {
    if ($(tr).find('a[href*="/ocorrencias/index/"]').length) n++;
  });
  return n;
}

async function probePage(url, label) {
  try {
    const res = await http.get(url);
    const $ = cheerio.load(res.data);
    const n = countLeads($);

    // Captura filtros/selects disponíveis na página
    const selects = [];
    $('select').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('id') || '?';
      const opts = [];
      $(el).find('option').each((__, o) => opts.push(`${$(o).attr('value')}="${$(o).text().trim()}"`));
      selects.push({ name, opts: opts.slice(0, 8) });
    });

    // Detecta se há indicador de total (ex: "Mostrando 1-35 de 1234")
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const totalMatch = bodyText.match(/(?:total|de)\s+(\d[\d.,]+)\s+(?:leads?|registros?)/i)
      || bodyText.match(/(\d[\d.,]+)\s+(?:leads?|registros?\s+encontrados?)/i);

    console.log(`[${label}] ${n} tokens na página | total detectado: ${totalMatch ? totalMatch[1] : 'não informado'}`);
    if (selects.length) {
      console.log('  Filtros/selects disponíveis:');
      selects.forEach(s => console.log(`    ${s.name}: [${s.opts.join(' | ')}]`));
    }
    return { n, selects, html: res.data };
  } catch (e) {
    console.log(`[${label}] ERRO: ${e.message}`);
    return { n: 0, selects: [] };
  }
}

async function countAllPages(baseUrl, label, maxOffset = 200000) {
  let total = 0;
  let offset = 0;
  let lastBatch = 35;
  process.stdout.write(`\nContando ${label} (offset += 35):\n`);
  while (offset <= maxOffset) {
    const url = offset === 0 ? baseUrl : `${baseUrl}/${offset}`;
    try {
      const res = await http.get(url);
      const $ = cheerio.load(res.data);
      const n = countLeads($);
      total += n;
      lastBatch = n;
      if (offset % 3500 === 0) process.stdout.write(`  offset=${offset}: ${n} leads (acumulado: ${total})\n`);
      if (n < 35) {
        process.stdout.write(`  offset=${offset}: ${n} leads — fim da paginação\n`);
        break;
      }
    } catch (e) {
      process.stdout.write(`  offset=${offset}: ERRO ${e.message.substring(0, 50)}\n`);
      break;
    }
    offset += 35;
    await sleep(200);
  }
  console.log(`  TOTAL em "${label}": ${total} leads\n`);
  return total;
}

async function probePostSearch(status, label) {
  // Tenta POST com filtro de status para ver se retorna leads adicionais
  try {
    const params = new URLSearchParams();
    params.append('busca[status]', status);
    params.append('busca[todos]', '1');
    const res = await http.post('/leads/busca/', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const $ = cheerio.load(res.data);
    const n = countLeads($);
    console.log(`[POST busca status="${status}"] ${n} tokens`);
    return n;
  } catch (e) {
    console.log(`[POST busca status="${status}"] ERRO: ${e.message}`);
    return 0;
  }
}

(async () => {
  await login();

  // 1. Página principal — quantos por página e quais filtros existem
  console.log('=== Análise da página /leads ===');
  const { selects } = await probePage('/leads', 'GET /leads');
  await sleep(400);

  // 2. Tenta /leads/todos se existir
  await probePage('/leads/todos', 'GET /leads/todos');
  await sleep(400);
  await probePage('/leads/index/status:todos', 'GET /leads/index/status:todos');
  await sleep(400);
  await probePage('/leads/historico', 'GET /leads/historico');
  await sleep(400);
  await probePage('/leads/arquivo', 'GET /leads/arquivo');
  await sleep(400);
  await probePage('/leads/finalizados', 'GET /leads/finalizados');
  await sleep(400);

  // 3. Se há selects de filtro na página, tenta POST para cada opção
  console.log('\n=== Testes POST de busca ===');
  await probePostSearch('todos', 'todos');
  await sleep(300);
  await probePostSearch('', 'vazio (sem filtro)');
  await sleep(300);
  await probePostSearch('finalizado', 'finalizado');
  await sleep(300);
  await probePostSearch('Finalizado', 'Finalizado (maiúsculo)');
  await sleep(300);

  // 4. Conta paginação completa do /leads padrão
  console.log('\n=== Paginação completa /leads/index ===');
  const total = await countAllPages('/leads/index', '/leads/index offset');

  console.log('\n=== Resumo ===');
  console.log(`Leads encontrados via paginação padrão: ${total}`);
  console.log('Se o total estiver abaixo de 72.000, verifique os filtros acima.');
  console.log('Passe LEGACY_PASSWORD=xxx para rodar: node probe-leads-pagination.js');
})().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
