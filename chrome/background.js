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
  amazon: { domain: '.amazon.com.br' }, // Primary Amazon domain, logic can be expanded
  magalu: { domain: '.magazinevoce.com.br' },
  shein: { url: 'https://br.shein.com/' }, // By URL: avoids duplicates from m.shein.com
  tiktok: { url: 'https://affiliate.tiktok.com/' } // TikTok Shop affiliate center
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

// Cookies the browser would send to this URL (includes parent-domain cookies)
async function getCookiesByUrl(url) {
  return new Promise((resolve) => {
    api.cookies.getAll({ url }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

function formatCookies(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

function isLoggedML(cookies) {
  // Mercado Livre uses 'ssid' for authenticated sessions
  return cookies.some(c => c.name === 'ssid');
}

function isLoggedAmz(cookies) {
  // Amazon Brazil uses 'at-acbbr' (Access Token) or 'x-acbbr'
  return cookies.some(c => c.name === 'at-acbbr' || c.name === 'x-acbbr');
}

function isLoggedMagalu(cookies) {
  // Magazine Luiza (Magazine Você) uses ml_sid_*, _sads, toggle_shareurl_pmd_v2
  return cookies.some(c => c.name.startsWith('ml_sid_') || c.name === 'toggle_shareurl_pmd_v2');
}

function isLoggedShein(cookies) {
  // Shein uses 'AT' (Access Token) + 'memberId' for authenticated sessions
  return cookies.some(c => c.name === 'AT' && c.value) &&
    cookies.some(c => c.name === 'memberId' && c.value);
}

function isLoggedTiktok(cookies) {
  // TikTok uses 'sessionid' for authenticated sessions
  return cookies.some(c => c.name === 'sessionid' && c.value);
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
    const [mlCookies, amzCookies, magaluCookies, sheinCookies, tiktokCookies] = await Promise.all([
      getCookies(DOMAINS.ml.domain),
      getCookies(DOMAINS.amazon.domain),
      getCookies(DOMAINS.magalu.domain),
      getCookiesByUrl(DOMAINS.shein.url),
      getCookiesByUrl(DOMAINS.tiktok.url)
    ]);

    const countMl = mlCookies.length;
    const countAmz = amzCookies.length;
    const countMagalu = magaluCookies.length;
    const countShein = sheinCookies.length;
    const countTiktok = tiktokCookies.length;

    if (countMl === 0 && countAmz === 0 && countMagalu === 0 && countShein === 0 && countTiktok === 0) {
      console.warn('[Lumi] No cookies found');
      setBadge(' ', '#F59E0B'); // Orange dot
      await setStorage({
        lastSyncStatus: 'no_cookies',
        lastSyncAt: new Date().toISOString(),
        lastCookieCountML: 0,
        lastCookieCountAmz: 0,
        lastCookieCountMagalu: 0,
        lastCookieCountShein: 0,
        lastCookieCountTiktok: 0,
        statusML: 'no_cookies',
        statusAmz: 'no_cookies',
        statusMagalu: 'no_cookies',
        statusShein: 'no_cookies',
        statusTiktok: 'no_cookies'
      });
      return { success: false, error: 'Nenhum cookie encontrado' };
    }

    const mlLoggedIn = isLoggedML(mlCookies);
    const amzLoggedIn = isLoggedAmz(amzCookies);
    const magaluLoggedIn = isLoggedMagalu(magaluCookies);
    const sheinLoggedIn = isLoggedShein(sheinCookies);
    const tiktokLoggedIn = isLoggedTiktok(tiktokCookies);

    // 2. Prepare payload for 'external-data-receiver'
    // Only send cookies if actually logged in
    const payload = {
      email: userEmail,
      cookie_ml: mlLoggedIn ? formatCookies(mlCookies) : null,
      cookie_amazon: amzLoggedIn ? formatCookies(amzCookies) : null,
      cookie_magalu: magaluLoggedIn ? formatCookies(magaluCookies) : null,
      cookie_shein: sheinLoggedIn ? formatCookies(sheinCookies) : null,
      cookie_tiktok: tiktokLoggedIn ? formatCookies(tiktokCookies) : null,
      logged_at: new Date().toISOString()
    };

    // 3. Send
    await apiRequest('/external-data-receiver', payload);

    const now = new Date().toISOString();
    await setStorage({
      lastSyncAt: now,
      lastSyncStatus: 'success',
      lastCookieCountML: mlCookies.length,
      lastCookieCountAmz: amzCookies.length,
      lastCookieCountMagalu: magaluCookies.length,
      lastCookieCountShein: sheinCookies.length,
      lastCookieCountTiktok: tiktokCookies.length,
      statusML: mlLoggedIn ? 'success' : 'no_cookies',
      statusAmz: amzLoggedIn ? 'success' : 'no_cookies',
      statusMagalu: magaluLoggedIn ? 'success' : 'no_cookies',
      statusShein: sheinLoggedIn ? 'success' : 'no_cookies',
      statusTiktok: tiktokLoggedIn ? 'success' : 'no_cookies'
    });

    setBadge('✓', '#10B981'); // Green checkmark
    console.log(`[Lumi] Synced! ML: ${countMl}, Amz: ${countAmz}, Magalu: ${countMagalu}, Shein: ${countShein}, TikTok: ${countTiktok}`);
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
    lastCookieCountAmz: 0,
    lastCookieCountMagalu: 0,
    lastCookieCountShein: 0,
    lastCookieCountTiktok: 0,
    statusML: 'waiting',
    statusAmz: 'waiting',
    statusMagalu: 'waiting',
    statusShein: 'waiting',
    statusTiktok: 'waiting'
  });
  setBadge('', '#999');
}
