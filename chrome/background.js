/**
 * Lumi Ofertas Sync - Background Service Worker
 * (Antigo Pushly Cookie Sync)
 *
 * Compatível com Chrome, Edge, Opera (Manifest V3 service_worker)
 * e Firefox (Manifest V3 background scripts) via wrapper.
 */

const api = (typeof browser !== 'undefined') ? browser : chrome;

// Configs Supabase
const SUPABASE_URL = 'https://pvsnmibmagkdyqewzwdg.supabase.co/functions/v1';
const SYNC_INTERVAL_MINUTES = 30;
// Supabase tokens usually last longer, but we check/renew often to be safe
const TOKEN_REFRESH_INTERVAL_MINUTES = 45;

const DOMAINS = {
  ml: { domain: '.mercadolivre.com.br' },
  amazon: { domain: '.amazon.com.br' } // Primary Amazon domain, logic can be expanded
};

// ─── Storage helpers ───────────────────────────────────────────

async function getStorage(keys) {
  return new Promise((resolve) => {
    api.storage.local.get(keys, resolve);
  });
}

async function setStorage(data) {
  return new Promise((resolve) => {
    api.storage.local.set(data, resolve);
  });
}

// ─── API helpers ───────────────────────────────────────────────

async function apiRequest(endpoint, body = null, method = 'POST') {
  const { accessToken } = await getStorage(['accessToken']);

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SUPABASE_URL}${endpoint}`, opts);

  // Auto-refresh on 401
  if (res.status === 401 && endpoint !== '/external-auth') {
    const refreshed = await refreshToken();
    if (refreshed) return apiRequest(endpoint, body, method);
    throw new Error('AUTH_EXPIRED');
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
  return json;
}

// ─── Token refresh ─────────────────────────────────────────────

async function refreshToken() {
  try {
    const { refreshTokenValue } = await getStorage(['refreshTokenValue']);
    if (!refreshTokenValue) return false;

    const res = await fetch(`${SUPABASE_URL}/external-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refreshTokenValue }),
    });

    if (!res.ok) {
      await setStorage({ accessToken: '', refreshTokenValue: '' });
      setBadge('!', '#EF4444');
      return false;
    }

    const data = await res.json();
    // Supabase auth response structure might vary slightly depending on wrapper, 
    // but based on Postman it returns standard session data
    const session = data.session || data;

    if (session?.access_token) {
      await setStorage({
        accessToken: session.access_token,
        refreshTokenValue: session.refresh_token || refreshTokenValue,
      });
      console.log('[Lumi] Token refreshed');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Lumi] Token refresh failed:', err);
    return false;
  }
}

// ─── Cookie capture ────────────────────────────────────────────

async function getCookies(domain) {
  return new Promise((resolve) => {
    api.cookies.getAll({ domain }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

function formatCookies(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

// ─── Sync Logic ────────────────────────────────────────────────

async function syncAll() {
  try {
    const { accessToken, userEmail } = await getStorage(['accessToken', 'userEmail']);
    if (!accessToken) {
      console.log('[Lumi] Not logged in');
      return { success: false, error: 'Not logged in' };
    }

    // 1. Capture cookies
    const [mlCookies, amzCookies] = await Promise.all([
      getCookies(DOMAINS.ml.domain),
      getCookies(DOMAINS.amazon.domain)
    ]);

    const countMl = mlCookies.length;
    const countAmz = amzCookies.length;

    if (countMl === 0 && countAmz === 0) {
      console.warn('[Lumi] No cookies found');
      setBadge(' ', '#F59E0B'); // Orange dot
      await setStorage({
        lastSyncStatus: 'no_cookies',
        lastSyncAt: new Date().toISOString(),
        lastCookieCountML: 0,
        lastCookieCountAmz: 0
      });
      return { success: false, error: 'Nenhum cookie encontrado' };
    }

    // 2. Prepare payload for 'external-data-receiver'
    const payload = {
      email: userEmail,
      cookie_ml: countMl > 0 ? formatCookies(mlCookies) : null,
      cookie_amazon: countAmz > 0 ? formatCookies(amzCookies) : null,
      logged_at: new Date().toISOString()
    };

    // 3. Send
    await apiRequest('/external-data-receiver', payload);

    const now = new Date().toISOString();
    await setStorage({
      lastSyncAt: now,
      lastSyncStatus: 'success',
      lastCookieCountML: countMl,
      lastCookieCountAmz: countAmz
    });

    setBadge('✓', '#10B981'); // Green checkmark
    console.log(`[Lumi] Synced! ML: ${countMl}, Amz: ${countAmz}`);
    return { success: true };

  } catch (err) {
    console.error('[Lumi] Sync failed:', err);
    setBadge(' ', '#EF4444'); // Red dot
    await setStorage({
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'error',
      lastSyncError: err.message
    });
    return { success: false, error: err.message };
  }
}

// ─── Badge helpers ─────────────────────────────────────────────

function setBadge(text, color) {
  api.action.setBadgeText({ text });
  api.action.setBadgeBackgroundColor({ color });
}

// ─── Alarm listeners ───────────────────────────────────────────

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cookie-sync') syncAll();
  if (alarm.name === 'token-refresh') refreshToken();
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

api.runtime.onInstalled.addListener(() => {
  console.log('[Lumi] Installed');
  api.alarms.create('cookie-sync', { periodInMinutes: SYNC_INTERVAL_MINUTES });
  api.alarms.create('token-refresh', { periodInMinutes: TOKEN_REFRESH_INTERVAL_MINUTES });
});

api.runtime.onStartup.addListener(async () => {
  console.log('[Lumi] Startup Check');
  const data = await getStorage(['accessToken', 'refreshTokenValue']); // Changed to refreshTokenValue
  if (data.accessToken) {
    // Try to refresh immediately on startup to ensure validity
    console.log('[Lumi] Refreshing token on startup...');
    await refreshToken();
    await syncAll();
  }
});

// ─── Message listener ──────────────────────────────────────────

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'syncNow') {
    syncAll().then((res) => sendResponse(res));
    return true; // async
  }
  if (msg.action === 'login') {
    handleLogin(msg.email, msg.password).then(sendResponse);
    return true;
  }
  if (msg.action === 'logout') {
    handleLogout().then(() => sendResponse({ success: true }));
    return true;
  }
});

// ─── Login / Logout ────────────────────────────────────────────

async function handleLogin(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/external-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || data.error || 'Login falhou' };
    }

    // Adapt based on Supabase return (sometimes data.user, sometimes separate)
    const session = data.session || data;
    const user = data.user || session.user;

    await setStorage({
      accessToken: session.access_token,
      refreshTokenValue: session.refresh_token,
      userEmail: email,
      userName: user?.user_metadata?.display_name || email,
    });

    // Run first sync immediately
    await syncAll();

    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleLogout() {
  await setStorage({
    accessToken: '',
    refreshTokenValue: '',
    userEmail: '',
    userName: '',
    lastSyncAt: '',
    lastSyncStatus: '',
    lastSyncError: '',
    lastCookieCountML: 0,
    lastCookieCountAmz: 0
  });
  setBadge('', '#999');
}
