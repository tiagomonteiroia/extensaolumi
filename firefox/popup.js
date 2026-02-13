/**
 * Pushly Cookie Sync - Popup Logic (Firefox)
 * © Agência Taruga (www.agenciataruga.com)
 * Autor: Leandro Oliveira Nunes (leandro@agenciataruga.com)
 */

const api = (typeof browser !== 'undefined') ? browser : chrome;

// ─── DOM refs ──────────────────────────────────────────────────

const loginScreen = document.getElementById('login-screen');
const statusScreen = document.getElementById('status-screen');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const apiUrlInput = document.getElementById('api-url');

const userName = document.getElementById('user-name');
const credentialId = document.getElementById('credential-id');
const syncStatus = document.getElementById('sync-status');
const lastSync = document.getElementById('last-sync');
const cookieCount = document.getElementById('cookie-count');
const syncErrorRow = document.getElementById('sync-error-row');
const syncError = document.getElementById('sync-error');
const syncBtn = document.getElementById('sync-btn');
const logoutBtn = document.getElementById('logout-btn');

// ─── Screen switching ──────────────────────────────────────────

function showLogin() {
  loginScreen.classList.remove('hidden');
  statusScreen.classList.add('hidden');
}

function showStatus() {
  loginScreen.classList.add('hidden');
  statusScreen.classList.remove('hidden');
}

// ─── Status display ────────────────────────────────────────────

const STATUS_LABELS = {
  success: { text: 'Sincronizado', cls: 'badge-success' },
  error: { text: 'Erro', cls: 'badge-error' },
  no_cookies: { text: 'Sem cookies', cls: 'badge-warn' },
  no_credential: { text: 'Sem credencial', cls: 'badge-error' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadStatus() {
  const data = await api.storage.local.get(
    ['accessToken', 'userEmail', 'userName', 'credentialId', 'lastSyncAt', 'lastSyncStatus', 'lastSyncError', 'lastCookieCount', 'apiUrl']
  );

  if (!data.accessToken) {
    showLogin();
    if (data.apiUrl) apiUrlInput.value = data.apiUrl;
    return;
  }

  userName.textContent = data.userName || data.userEmail || '—';
  credentialId.textContent = data.credentialId || '—';
  cookieCount.textContent = data.lastCookieCount || '—';
  lastSync.textContent = formatDate(data.lastSyncAt);

  const st = STATUS_LABELS[data.lastSyncStatus] || { text: data.lastSyncStatus || '—', cls: '' };
  syncStatus.textContent = st.text;
  syncStatus.className = 'value badge ' + st.cls;

  if (data.lastSyncStatus === 'error' && data.lastSyncError) {
    syncErrorRow.classList.remove('hidden');
    syncError.textContent = data.lastSyncError;
  } else {
    syncErrorRow.classList.add('hidden');
  }

  showStatus();
}

// ─── Login ─────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = 'Entrando...';
  loginError.classList.add('hidden');

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const apiUrl = apiUrlInput.value.trim() || null;

  const res = await api.runtime.sendMessage({ action: 'login', email, password, apiUrl });
  loginBtn.disabled = false;
  loginBtn.textContent = 'Entrar';

  if (res && res.success) {
    loadStatus();
  } else {
    loginError.textContent = res?.error || 'Erro ao fazer login';
    loginError.classList.remove('hidden');
  }
});

// ─── Sync Now ──────────────────────────────────────────────────

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Sincronizando...';

  await api.runtime.sendMessage({ action: 'syncNow' });
  syncBtn.disabled = false;
  syncBtn.textContent = '🔄 Sincronizar Agora';
  loadStatus();
});

// ─── Logout ────────────────────────────────────────────────────

logoutBtn.addEventListener('click', async () => {
  await api.runtime.sendMessage({ action: 'logout' });
  showLogin();
});

// ─── Init ──────────────────────────────────────────────────────

loadStatus();
