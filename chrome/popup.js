/**
 * Lumi Ofertas Sync - Popup Logic
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

const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const syncStatus = document.getElementById('sync-status'); // removed from UI
const lastSync = document.getElementById('last-sync');

const statusMl = document.getElementById('status-ml');
const countMl = document.getElementById('count-ml');

const statusAmz = document.getElementById('status-amz');
const countAmz = document.getElementById('count-amz');

const syncErrorRow = document.getElementById('sync-error-row');
const syncError = document.getElementById('sync-error');
const syncBtn = document.getElementById('sync-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');

// ─── Theme Management ──────────────────────────────────────────

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.className = savedTheme;
  }
}

function toggleTheme() {
  const current = document.body.classList.contains('dark') ? 'dark' :
    document.body.classList.contains('light') ? 'light' : 'system';

  let next = 'system';
  if (current === 'system') {
    // If system is dark, go light. If system is light, go dark.
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    next = systemDark ? 'light' : 'dark';
  } else if (current === 'dark') {
    next = 'light';
  } else {
    next = 'dark';
  }

  document.body.className = next;
  localStorage.setItem('theme', next);
}

themeToggle.addEventListener('click', toggleTheme);

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
  success: { text: 'Conectado', cls: 'badge-success' },
  error: { text: 'Erro', cls: 'badge-error' },
  no_cookies: { text: 'Desconectado', cls: 'badge-warning' },
  waiting: { text: '...', cls: 'badge-neutral' }
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderBadge(element, statusKey) {
  const st = STATUS_LABELS[statusKey] || STATUS_LABELS.waiting;
  element.textContent = st.text;
  element.className = 'badge ' + st.cls;
}

async function loadStatus() {
  const data = await new Promise((r) =>
    api.storage.local.get(
      [
        'accessToken', 'userEmail', 'userName',
        'lastSyncAt', 'lastSyncStatus', 'lastSyncError',
        'statusML', 'statusAmz',
        'lastCookieCountML', 'lastCookieCountAmz'
      ],
      r
    )
  );

  if (!data.accessToken) {
    showLogin();
    return;
  }

  // Populate status
  userName.textContent = data.userName || 'Usuário';
  userEmail.textContent = data.userEmail || '—';

  countMl.textContent = data.lastCookieCountML || '0';
  countAmz.textContent = data.lastCookieCountAmz || '0';

  renderBadge(statusMl, data.statusML || 'waiting');
  renderBadge(statusAmz, data.statusAmz || 'waiting');

  lastSync.textContent = formatDate(data.lastSyncAt);

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

  api.runtime.sendMessage({ action: 'login', email, password }, (res) => {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Entrar';

    if (res && res.success) {
      loadStatus();
    } else {
      loginError.textContent = res?.error || 'Erro ao fazer login';
      loginError.classList.remove('hidden');
    }
  });
});

// ─── Sync Now ──────────────────────────────────────────────────

syncBtn.addEventListener('click', () => {
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Sincronizando...';
  syncErrorRow.classList.add('hidden');

  api.runtime.sendMessage({ action: 'syncNow' }, (res) => {
    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 Sincronizar Agora';
    loadStatus();
  });
});

// ─── Logout ────────────────────────────────────────────────────

logoutBtn.addEventListener('click', () => {
  api.runtime.sendMessage({ action: 'logout' }, () => {
    showLogin();
  });
});

// ─── Init ──────────────────────────────────────────────────────

loadStatus();
