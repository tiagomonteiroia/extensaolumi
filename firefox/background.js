/**
 * Pushly Cookie Sync - Background Script (Firefox)
 * © Agência Taruga (www.agenciataruga.com)
 * Autor: Leandro Oliveira Nunes (leandro@agenciataruga.com)
 *
 * Código idêntico ao Chrome, usa wrapper para compatibilidade.
 */

const api = (typeof browser !== 'undefined') ? browser : chrome;

const DEFAULT_API_URL = 'https://pushly.tarugahost.com/api';
const SYNC_INTERVAL_MINUTES = 30;
const TOKEN_REFRESH_INTERVAL_MINUTES = 50;
const COOKIE_DOMAIN = '.mercadolivre.com.br';

// ─── Storage helpers ───────────────────────────────────────────

async function getStorage(keys) {
  return api.storage.local.get(keys);
}

async function setStorage(data) {
  return api.storage.local.set(data);
}

// ─── API helpers ───────────────────────────────────────────────

async function getApiUrl() {
  const { apiUrl } = await getStorage(['apiUrl']);
  return apiUrl || DEFAULT_API_URL;
}

async function apiRequest(method, path, body = null) {
  const baseUrl = await getApiUrl();
  const { accessToken } = await getStorage(['accessToken']);

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${baseUrl}${path}`, opts);

  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await refreshToken();
    if (refreshed) return apiRequest(method, path, body);
    throw new Error('AUTH_EXPIRED');
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

// ─── Token refresh ─────────────────────────────────────────────

async function refreshToken() {
  try {
    const baseUrl = await getApiUrl();
    const { refreshTokenValue } = await getStorage(['refreshTokenValue']);
    if (!refreshTokenValue) return false;

    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refreshTokenValue }),
    });

    if (!res.ok) {
      await setStorage({ accessToken: '', refreshTokenValue: '', userEmail: '', credentialId: '' });
      setBadge('!', '#F44336');
      return false;
    }

    const json = await res.json();
    const data = json.data || json;

    await setStorage({
      accessToken: data.access_token,
      refreshTokenValue: data.refresh_token,
    });

    console.log('[Pushly] Token refreshed successfully');
    return true;
  } catch (err) {
    console.error('[Pushly] Token refresh failed:', err.message);
    return false;
  }
}

// ─── Cookie capture ────────────────────────────────────────────

async function getCookies() {
  return api.cookies.getAll({ domain: COOKIE_DOMAIN });
}

function formatCookies(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

// ─── Credential discovery ──────────────────────────────────────

async function findCredentialId() {
  try {
    const json = await apiRequest('GET', '/platforms/mercadolivre/credentials');
    const items = json.data || [];
    if (Array.isArray(items) && items.length > 0) {
      const active = items.find((i) => i.is_active) || items[0];
      const id = active.id;
      await setStorage({ credentialId: String(id) });
      return String(id);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Sync cookies ──────────────────────────────────────────────

async function syncCookies() {
  try {
    const { accessToken } = await getStorage(['accessToken']);
    if (!accessToken) {
      console.log('[Pushly] Not logged in, skipping sync');
      return false;
    }

    const cookies = await getCookies();
    if (cookies.length === 0) {
      console.warn('[Pushly] No cookies found for', COOKIE_DOMAIN);
      setBadge('0', '#FF9800');
      await setStorage({ lastSyncStatus: 'no_cookies', lastSyncAt: new Date().toISOString() });
      return false;
    }

    const cookieString = formatCookies(cookies);

    let { credentialId } = await getStorage(['credentialId']);
    if (!credentialId) {
      credentialId = await findCredentialId();
      if (!credentialId) {
        console.error('[Pushly] No credential found for mercadolivre');
        setBadge('!', '#F44336');
        await setStorage({ lastSyncStatus: 'no_credential', lastSyncAt: new Date().toISOString() });
        return false;
      }
    }

    await apiRequest('PATCH', `/platforms/mercadolivre/credentials/${credentialId}`, {
      credentials: { cookies: cookieString },
    });

    const now = new Date().toISOString();
    await setStorage({
      lastSyncAt: now,
      lastSyncStatus: 'success',
      lastCookieCount: cookies.length,
    });

    setBadge('✓', '#4CAF50');
    console.log(`[Pushly] Synced ${cookies.length} cookies successfully`);
    return true;
  } catch (err) {
    console.error('[Pushly] Sync failed:', err.message);
    setBadge('✗', '#F44336');
    await setStorage({
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'error',
      lastSyncError: err.message,
    });
    return false;
  }
}

// ─── Badge helpers ─────────────────────────────────────────────

function setBadge(text, color) {
  api.action.setBadgeText({ text });
  api.action.setBadgeBackgroundColor({ color });
}

// ─── Alarm listeners ───────────────────────────────────────────

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cookie-sync') syncCookies();
  if (alarm.name === 'token-refresh') refreshToken();
});

// ─── Install / startup ────────────────────────────────────────

api.runtime.onInstalled.addListener(() => {
  api.alarms.create('cookie-sync', { periodInMinutes: SYNC_INTERVAL_MINUTES });
  api.alarms.create('token-refresh', { periodInMinutes: TOKEN_REFRESH_INTERVAL_MINUTES });
  console.log('[Pushly] Extension installed, alarms created');
});

api.runtime.onStartup.addListener(() => {
  api.alarms.create('cookie-sync', { periodInMinutes: SYNC_INTERVAL_MINUTES });
  api.alarms.create('token-refresh', { periodInMinutes: TOKEN_REFRESH_INTERVAL_MINUTES });
  console.log('[Pushly] Browser started, alarms re-created');
});

// ─── Message listener (popup -> background) ────────────────────

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handle = async () => {
    if (msg.action === 'syncNow') {
      const ok = await syncCookies();
      return { success: ok };
    }
    if (msg.action === 'login') {
      return handleLogin(msg.email, msg.password, msg.apiUrl);
    }
    if (msg.action === 'logout') {
      await handleLogout();
      return { success: true };
    }
  };
  handle().then(sendResponse);
  return true;
});

// ─── Login / Logout ────────────────────────────────────────────

async function handleLogin(email, password, apiUrl) {
  try {
    if (apiUrl) await setStorage({ apiUrl });

    const baseUrl = apiUrl || await getApiUrl();
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.message || 'Login falhou' };
    }

    const data = json.data || json;

    await setStorage({
      accessToken: data.access_token,
      refreshTokenValue: data.refresh_token,
      userEmail: email,
      userName: data.user?.name || email,
      credentialId: '',
    });

    await findCredentialId();
    await syncCookies();

    setBadge('✓', '#4CAF50');
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleLogout() {
  try {
    const { accessToken, refreshTokenValue } = await getStorage(['accessToken', 'refreshTokenValue']);
    if (accessToken) {
      const baseUrl = await getApiUrl();
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue || '' }),
      }).catch(() => {});
    }
  } finally {
    await setStorage({
      accessToken: '',
      refreshTokenValue: '',
      userEmail: '',
      userName: '',
      credentialId: '',
      lastSyncAt: '',
      lastSyncStatus: '',
      lastSyncError: '',
      lastCookieCount: 0,
    });
    setBadge('', '#999');
  }
}
