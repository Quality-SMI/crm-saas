#!/usr/bin/env node
// Google OAuth setup helper
// Usage: node setup-google-oauth.js
// Guides you through creating credentials and obtaining a refresh token

const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_PATH = path.join(__dirname, '../backend/.env');

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function readEnv() {
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function updateEnv(clientId, clientSecret, refreshToken) {
  let content = readEnv();
  content = content.replace(/^GOOGLE_CLIENT_ID=.*/m, `GOOGLE_CLIENT_ID=${clientId}`);
  content = content.replace(/^GOOGLE_CLIENT_SECRET=.*/m, `GOOGLE_CLIENT_SECRET=${clientSecret}`);
  content = content.replace(/^GOOGLE_REFRESH_TOKEN=.*/m, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
  fs.writeFileSync(ENV_PATH, content, 'utf8');
  console.log('\n✓ .env atualizado com sucesso!');
}

function exchangeCode(clientId, clientSecret, code, redirectUri) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function startLocalServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname === '/oauth/callback') {
        const code = parsed.query.code;
        const error = parsed.query.error;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (code) {
          res.end('<h2>✓ Autorização concluída!</h2><p>Pode fechar esta aba e voltar ao terminal.</p>');
          server.close();
          resolve({ code, error: null });
        } else {
          res.end(`<h2>✗ Erro: ${error}</h2><p>Feche esta aba e tente novamente.</p>`);
          server.close();
          resolve({ code: null, error });
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, () => resolve(null));
    server._resolve = resolve;
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n=== Configuração Google OAuth para Search Console + Analytics ===\n');
  console.log('Para configurar, você precisa de um projeto no Google Cloud Console.');
  console.log('Siga as instruções:\n');
  console.log('1. Acesse: https://console.cloud.google.com/');
  console.log('2. Crie ou selecione um projeto');
  console.log('3. Ative as APIs:');
  console.log('   - Google Search Console API');
  console.log('   - Google Analytics Data API');
  console.log('   - Google Analytics Admin API');
  console.log('4. Vá em "APIs e Serviços" > "Credenciais" > "Criar credenciais" > "ID do cliente OAuth 2.0"');
  console.log('5. Tipo: "Aplicativo da web"');
  console.log('6. Adicione URI de redirecionamento autorizado: http://localhost:8085/oauth/callback');
  console.log('7. Copie o Client ID e Client Secret\n');

  const clientId = (await ask(rl, 'Cole seu GOOGLE_CLIENT_ID: ')).trim();
  if (!clientId) { console.log('Abortado.'); rl.close(); return; }

  const clientSecret = (await ask(rl, 'Cole seu GOOGLE_CLIENT_SECRET: ')).trim();
  if (!clientSecret) { console.log('Abortado.'); rl.close(); return; }

  const redirectUri = 'http://localhost:8085/oauth/callback';
  const REDIRECT_PORT = 8085;

  // Build OAuth URL
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  console.log('\n=== Passo 2: Autorização ===\n');
  console.log('Iniciando servidor local para receber o callback OAuth...');

  // Start local server
  const serverPromise = new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname === '/oauth/callback') {
        const code = parsed.query.code;
        const error = parsed.query.error;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (code) {
          res.end('<h2 style="color:green">✓ Autorização concluída!</h2><p>Pode fechar esta aba e voltar ao terminal.</p>');
          setTimeout(() => { server.close(); resolve({ code, error: null }); }, 500);
        } else {
          res.end(`<h2 style="color:red">✗ Erro: ${error}</h2><p>Feche esta aba e tente novamente.</p>`);
          setTimeout(() => { server.close(); resolve({ code: null, error }); }, 500);
        }
      } else {
        res.writeHead(302, { Location: authUrl });
        res.end();
      }
    });
    server.listen(REDIRECT_PORT, () => {
      console.log(`✓ Servidor rodando em http://localhost:${REDIRECT_PORT}`);
    });
  });

  console.log('\nAbrindo no navegador: (se não abrir automaticamente, cole a URL manualmente)');
  console.log('\n' + authUrl + '\n');

  // Try to open in browser
  const { exec } = require('child_process');
  exec(`open "${authUrl}"`);

  console.log('Aguardando autorização...\n');
  const { code, error } = await serverPromise;

  if (!code) {
    console.error('Erro na autorização:', error);
    rl.close();
    return;
  }

  console.log('✓ Código recebido. Trocando pelo refresh token...');

  const tokens = await exchangeCode(clientId, clientSecret, code, redirectUri);

  if (tokens.error) {
    console.error('Erro ao trocar código:', tokens.error_description || tokens.error);
    rl.close();
    return;
  }

  if (!tokens.refresh_token) {
    console.error('Nenhum refresh_token recebido. Verifique se o prompt=consent foi incluído na URL.');
    console.log('Tokens recebidos:', JSON.stringify(tokens, null, 2));
    rl.close();
    return;
  }

  console.log('\n=== Credenciais obtidas ===');
  console.log('GOOGLE_CLIENT_ID:', clientId.substring(0, 20) + '...');
  console.log('GOOGLE_CLIENT_SECRET:', clientSecret.substring(0, 10) + '...');
  console.log('GOOGLE_REFRESH_TOKEN:', tokens.refresh_token.substring(0, 20) + '...');

  // Update .env
  updateEnv(clientId, clientSecret, tokens.refresh_token);

  console.log('\n=== Próximos passos ===');
  console.log('1. Reinicie o backend: cd backend && npm run start:dev');
  console.log('2. O sistema vai descobrir automaticamente as propriedades do Search Console e Analytics');
  console.log('3. Acesse qualquer cliente e clique na aba "Posicionamento"');

  rl.close();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
