/**
 * Vincula cada cliente do banco ao seu site no Search Console e propriedade GA4,
 * fazendo match por domínio. Depois sincroniza os dados de posicionamento.
 *
 * Uso: node run-discovery.js
 */

const { google, Auth } = require('googleapis');
const { Client } = require('pg');

const CLIENT_ID     = '1002549525653-t19ueoi36o1itbof0i0af6kijdam8oof.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REFRESH_TOKEN = '1//0hxd3c3P42RCsCgYIARAAGBESNwF-L9Irr9ubew-8haa-3X_pD5sPLoO79dewt7jxHdm090aifymSOVbBp0kI_f3hkbzdc5C-bno';
const DATABASE_URL  = 'postgresql://postgres:HJ2sYplU3G2FvPvVct7u2saWKNkEjb0yrGsLz9am5v6d1w062OmulMkOgqaAz0H8@145.79.7.208:5430/postgres';

function extractDomain(url) {
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .toLowerCase();
}

async function main() {
  const auth = new Auth.OAuth2Client(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  console.log('Buscando sites do Search Console...');
  const sc = google.webmasters({ version: 'v3', auth });
  const sitesRes = await sc.sites.list();
  const gscSites = (sitesRes.data.siteEntry ?? []).map(s => ({
    siteUrl: s.siteUrl,
    domain: extractDomain(s.siteUrl),
  }));
  console.log(`  ${gscSites.length} sites encontrados no GSC`);

  console.log('Buscando propriedades GA4...');
  const admin = google.analyticsadmin({ version: 'v1beta', auth });
  const ga4Props = [];
  try {
    const summaries = await admin.accountSummaries.list({ pageSize: 200 });
    for (const account of summaries.data.accountSummaries ?? []) {
      for (const prop of account.propertySummaries ?? []) {
        const propId = prop.property?.replace('properties/', '') ?? '';
        try {
          const streams = await admin.properties.dataStreams.list({ parent: prop.property });
          for (const stream of streams.data.dataStreams ?? []) {
            const streamUrl = stream.webStreamData?.defaultUri ?? '';
            if (streamUrl) {
              ga4Props.push({ propertyId: propId, domain: extractDomain(streamUrl), displayName: prop.displayName ?? '' });
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    console.warn('  Aviso GA4 Admin:', e.message);
  }
  console.log(`  ${ga4Props.length} propriedades GA4 encontradas`);

  console.log('\nBuscando clientes do banco...');
  const { rows: clients } = await db.query(`SELECT id, domain FROM crm.clients WHERE deleted_at IS NULL AND domain IS NOT NULL`);
  console.log(`  ${clients.length} clientes encontrados`);

  let gscLinked = 0, ga4Linked = 0, unmatched = [];

  for (const client of clients) {
    const cd = client.domain.toLowerCase().replace(/^www\./, '');

    const gscMatch = gscSites.find(s => s.domain === cd || s.domain.endsWith(`.${cd}`));
    const ga4Match = ga4Props.find(p => p.domain === cd || p.domain.endsWith(`.${cd}`));

    if (gscMatch || ga4Match) {
      await db.query(
        `UPDATE crm.clients SET
           gsc_site_url = COALESCE($2, gsc_site_url),
           ga4_property_id = COALESCE($3, ga4_property_id)
         WHERE id = $1`,
        [client.id, gscMatch?.siteUrl ?? null, ga4Match?.propertyId ?? null],
      );
      if (gscMatch) { gscLinked++; console.log(`  ✅ GSC: ${client.domain} → ${gscMatch.siteUrl}`); }
      if (ga4Match) { ga4Linked++; console.log(`  ✅ GA4: ${client.domain} → properties/${ga4Match.propertyId}`); }
    } else {
      unmatched.push(client.domain);
    }
  }

  console.log(`\n=== DISCOVERY CONCLUÍDO ===`);
  console.log(`GSC vinculados: ${gscLinked}/${clients.length}`);
  console.log(`GA4 vinculados: ${ga4Linked}/${clients.length}`);
  if (unmatched.length) {
    console.log(`\nSem match (${unmatched.length}):`);
    unmatched.forEach(d => console.log(`  - ${d}`));
  }

  await db.end();
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
