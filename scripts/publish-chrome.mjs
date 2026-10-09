#!/usr/bin/env node
/**
 * Lumi Ofertas Sync - Publica a pasta chrome/ na Chrome Web Store (API V2)
 *
 * Uso:
 *   node scripts/publish-chrome.mjs              # empacota, envia e publica
 *   node scripts/publish-chrome.mjs --check      # só valida credenciais e mostra o status do item
 *   node scripts/publish-chrome.mjs --upload-only  # envia sem enviar para análise/publicação
 *   node scripts/publish-chrome.mjs --staged     # após aprovado, aguarda publicação manual
 *
 * Configuração (.env na raiz, fora do git):
 *   CWS_PUBLISHER_ID=...                 # Developer Dashboard > Conta/Publisher > Settings
 *   CWS_EXTENSION_ID=ipboalnjndkmigfgpjhlhohiainnkhei
 *   CWS_SERVICE_ACCOUNT_KEY=.secrets/cws-service-account.json
 */

import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

const args = new Set(process.argv.slice(2));

// ─── Config ────────────────────────────────────────────────────

function loadEnv() {
  const file = resolve(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Variável ${name} não definida. Veja .env.example.`);
  return value;
}

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

// ─── Auth (service account JWT -> access token) ───────────────

const b64url = (data) => Buffer.from(data).toString('base64url');

async function getAccessToken(keyPath) {
  const key = JSON.parse(readFileSync(resolve(ROOT, keyPath), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');

  const res = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`
    })
  });
  const json = await res.json();
  if (!res.ok) fail(`Falha ao obter token: ${json.error_description || json.error || res.status}`);
  return { token: json.access_token, email: key.client_email };
}

// ─── API calls ─────────────────────────────────────────────────

async function call(method, path, token, body, contentType = 'application/json') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': contentType } : {}) },
    body
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) fail(`${method} ${path} → HTTP ${res.status}\n${JSON.stringify(json, null, 2)}`);
  return json;
}

// ─── Package ───────────────────────────────────────────────────

function buildZip() {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'chrome/manifest.json'), 'utf8'));
  const distDir = resolve(ROOT, 'dist');
  mkdirSync(distDir, { recursive: true });
  const zipPath = resolve(distDir, `lumi-chrome-v${manifest.version}.zip`);
  rmSync(zipPath, { force: true });
  // manifest.json precisa ficar na raiz do ZIP
  execFileSync('zip', ['-r', '-X', '-q', zipPath, '.', '-x', '*.DS_Store'], { cwd: resolve(ROOT, 'chrome') });
  return { zipPath, version: manifest.version };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Main ──────────────────────────────────────────────────────

loadEnv();
const publisherId = requireEnv('CWS_PUBLISHER_ID');
const extensionId = requireEnv('CWS_EXTENSION_ID');
const keyPath = requireEnv('CWS_SERVICE_ACCOUNT_KEY');
const itemPath = `/v2/publishers/${publisherId}/items/${extensionId}`;

const { token, email } = await getAccessToken(keyPath);
console.log(`✔ Autenticado como ${email}`);

if (args.has('--check')) {
  const status = await call('GET', `${itemPath}:fetchStatus`, token);
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

const { zipPath, version } = buildZip();
console.log(`✔ Pacote gerado: dist/lumi-chrome-v${version}.zip`);

let upload = await call('POST', `/upload${itemPath}:upload`, token, readFileSync(zipPath), 'application/zip');
const inProgress = (state) => /IN_PROGRESS/.test(state || '');
for (let i = 0; inProgress(upload.uploadState); i++) {
  if (i >= 20) fail('Upload ainda em processamento. Rode com --check mais tarde.');
  await sleep(3000);
  const status = await call('GET', `${itemPath}:fetchStatus`, token);
  upload = { ...upload, uploadState: status.lastAsyncUploadState || status.uploadState };
}
if (/FAIL|NOT_FOUND/.test(upload.uploadState || '')) {
  fail(`Upload não concluído (${upload.uploadState}):\n${JSON.stringify(upload, null, 2)}`);
}
console.log(`✔ Upload da v${version} concluído`);

if (args.has('--upload-only')) {
  console.log('ℹ --upload-only: rascunho enviado. Envie para análise pelo Developer Dashboard.');
  process.exit(0);
}

const publishBody = args.has('--staged') ? JSON.stringify({ publishType: 'STAGED_PUBLISH' }) : undefined;
const published = await call('POST', `${itemPath}:publish`, token, publishBody);
console.log(`✔ Enviado para análise: ${JSON.stringify(published)}`);
console.log(args.has('--staged')
  ? 'ℹ Após aprovação, publique pelo Developer Dashboard.'
  : 'ℹ Será publicado automaticamente após a aprovação do Google.');
