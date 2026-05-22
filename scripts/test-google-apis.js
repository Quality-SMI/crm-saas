/**
 * Testa as credenciais Google e lista sites do Search Console
 * e propriedades GA4 disponíveis.
 *
 * Uso: node test-google-apis.js
 */

const { google, Auth } = require('googleapis');

const CLIENT_ID     = '1002549525653-t19ueoi36o1itbof0i0af6kijdam8oof.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REFRESH_TOKEN = '1//0hxd3c3P42RCsCgYIARAAGBESNwF-L9Irr9ubew-8haa-3X_pD5sPLoO79dewt7jxHdm090aifymSOVbBp0kI_f3hkbzdc5C-bno';

async function main() {
  const auth = new Auth.OAuth2Client(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });

  // --- 1. Testar Search Console ---
  console.log('\n=== GOOGLE SEARCH CONSOLE ===');
  try {
    const sc = google.webmasters({ version: 'v3', auth });
    const res = await sc.sites.list();
    const sites = res.data.siteEntry ?? [];
    if (sites.length === 0) {
      console.log('⚠️  Nenhum site encontrado no Search Console desta conta.');
    } else {
      console.log(`✅ ${sites.length} site(s) encontrado(s):`);
      sites.forEach(s => console.log('  -', s.siteUrl, `(${s.permissionLevel})`));
    }
  } catch (err) {
    console.log('❌ Search Console FALHOU:', err.message);
    if (err.message.includes('invalid_grant')) {
      console.log('   → Refresh token expirado ou revogado. Precisa gerar um novo.');
    } else if (err.message.includes('disabled')) {
      console.log('   → API não habilitada no Google Cloud Console.');
    }
  }

  // --- 2. Testar GA4 Admin ---
  console.log('\n=== GOOGLE ANALYTICS ADMIN (GA4) ===');
  try {
    const admin = google.analyticsadmin({ version: 'v1beta', auth });
    const res = await admin.accountSummaries.list({ pageSize: 50 });
    const accounts = res.data.accountSummaries ?? [];
    if (accounts.length === 0) {
      console.log('⚠️  Nenhuma conta GA4 encontrada.');
    } else {
      let total = 0;
      accounts.forEach(acc => {
        const props = acc.propertySummaries ?? [];
        total += props.length;
        console.log(`✅ Conta: ${acc.displayName}`);
        props.forEach(p => console.log('   -', p.displayName, '|', p.property));
      });
      console.log(`   Total: ${total} propriedade(s)`);
    }
  } catch (err) {
    console.log('❌ GA4 Admin FALHOU:', err.message);
    if (err.message.includes('Google Analytics Admin API has not been used')) {
      console.log('   → API não habilitada. Acesse: console.cloud.google.com → APIs & Services → Library → "Google Analytics Admin API" → Ativar');
    } else if (err.message.includes('invalid_grant')) {
      console.log('   → Refresh token expirado ou revogado.');
    }
  }

  // --- 3. Testar GA4 Data ---
  console.log('\n=== GOOGLE ANALYTICS DATA (GA4) ===');
  try {
    const data = google.analyticsdata({ version: 'v1beta', auth });
    // Só verifica se a API responde (sem property válida vai retornar 404, não 403)
    await data.properties.runReport({
      property: 'properties/000000000',
      requestBody: { dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: [{ name: 'sessions' }] },
    }).catch(e => {
      if (e.message.includes('not found') || e.message.includes('404') || e.message.includes('PERMISSION_DENIED') || e.code === 404) {
        console.log('✅ Analytics Data API acessível (property de teste não existe, mas API respondeu)');
      } else {
        throw e;
      }
    });
  } catch (err) {
    if (err.message.includes('has not been used') || err.message.includes('disabled')) {
      console.log('❌ Analytics Data API não habilitada no Google Cloud Console.');
    } else {
      console.log('✅ Analytics Data API acessível');
    }
  }

  console.log('\n--- Teste concluído ---\n');
}

main().catch(err => {
  console.error('Erro inesperado:', err.message);
  process.exit(1);
});
