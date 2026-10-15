/* ChatSave — background service worker.
 * Owns everything that needs a privileged context: the Fylo OAuth flow and
 * token storage, calls to the Fylo API, the print tab for PDF, and a fallback
 * download path. Exports themselves never come through here.
 */

import { notion } from './notion.js';

const FYLO = 'https://fylo.host';
const REDIRECT = chrome.identity.getRedirectURL(); // https://<ext-id>.chromiumapp.org/
const CLIENT_NAME = 'ChatSave (browser extension)';

/* ---------- storage ---------- */
const store = {
  async get(k, d) { const v = (await chrome.storage.local.get(k))[k]; return v === undefined ? d : v; },
  set(obj) { return chrome.storage.local.set(obj); },
  remove(k) { return chrome.storage.local.remove(k); }
};

/* ---------- OAuth 2.1 against Fylo ---------- */
async function metadata() {
  const cached = await store.get('fylo.meta');
  if (cached && cached.fetchedAt > Date.now() - 86_400_000) return cached;
  let meta;
  try {
    const r = await fetch(`${FYLO}/.well-known/oauth-authorization-server`);
    if (r.ok) meta = await r.json();
  } catch (_) {}
  meta = meta || {};
  meta.authorization_endpoint ||= `${FYLO}/oauth/authorize`;
  meta.token_endpoint ||= `${FYLO}/oauth/token`;
  meta.registration_endpoint ||= `${FYLO}/oauth/register`;
  meta.revocation_endpoint ||= `${FYLO}/oauth/revoke`;
  meta.fetchedAt = Date.now();
  await store.set({ 'fylo.meta': meta });
  return meta;
}

async function clientId(meta) {
  const existing = await store.get('fylo.client');
  if (existing?.client_id && existing.redirect === REDIRECT) return existing.client_id;
  const r = await fetch(meta.registration_endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [REDIRECT],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_uri: 'https://fylo.host',
      software_id: 'chatsave'
    })
  });
  if (!r.ok) throw new Error(`Fylo did not accept the app registration (${r.status})`);
  const j = await r.json();
  await store.set({ 'fylo.client': { client_id: j.client_id, redirect: REDIRECT } });
  return j.client_id;
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

async function connect() {
  const meta = await metadata();
  const cid = await clientId(meta);
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const u = new URL(meta.authorization_endpoint);
  u.search = new URLSearchParams({
    response_type: 'code', client_id: cid, redirect_uri: REDIRECT, state,
    code_challenge: challenge, code_challenge_method: 'S256', scope: 'sites:write'
  }).toString();
  const back = await chrome.identity.launchWebAuthFlow({ url: u.toString(), interactive: true });
  const q = new URL(back).searchParams;
  if (q.get('state') !== state) throw new Error('Sign-in was interrupted. Try again.');
  if (q.get('error')) throw new Error(q.get('error_description') || q.get('error'));
  const code = q.get('code');
  const r = await fetch(meta.token_endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: cid, code_verifier: verifier })
  });
  if (!r.ok) throw new Error(`Could not finish sign-in (${r.status})`);
  await saveTokens(await r.json());
  const me = await api('GET', '/api/v1/me').catch(() => null);
  await store.set({ 'fylo.me': me });
  return me;
}

async function saveTokens(t) {
  await store.set({ 'fylo.tokens': { access: t.access_token, refresh: t.refresh_token || null, exp: Date.now() + ((t.expires_in || 3600) - 60) * 1000 } });
}

async function accessToken() {
  const t = await store.get('fylo.tokens');
  if (!t) return null;
  if (t.exp > Date.now()) return t.access;
  if (!t.refresh) return null;
  const meta = await metadata();
  const cid = (await store.get('fylo.client'))?.client_id;
  const r = await fetch(meta.token_endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: cid })
  });
  if (!r.ok) { await disconnect(false); return null; }
  const j = await r.json();
  await saveTokens(j);
  return j.access_token;
}

async function disconnect(revoke = true) {
  if (revoke) {
    try {
      const t = await store.get('fylo.tokens'); const meta = await metadata(); const cid = (await store.get('fylo.client'))?.client_id;
      if (t?.refresh) await fetch(meta.revocation_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t.refresh, client_id: cid }) });
    } catch (_) {}
  }
  await store.remove(['fylo.tokens', 'fylo.me']);
}

/* ---------- Fylo API ---------- */
class ApiError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }

async function api(method, path, body) {
  const token = await accessToken();
  if (!token) throw new ApiError('Not connected to Fylo', 401, 'not_connected');
  const r = await fetch(FYLO + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Fylo-Source': 'extension:chatsave' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let j = {}; try { j = JSON.parse(text); } catch (_) {}
  if (!r.ok) {
    /* Fylo may return {error:"..."}, {error:{code,message}}, {message}, or {code,message}. */
    const e = j.error && typeof j.error === 'object' ? j.error : j;
    const code = e.code || j.code || (r.status === 402 ? 'plan_limit' : r.status === 429 ? 'rate_limit' : r.status === 401 ? 'not_connected' : 'error');
    let msg = (typeof j.error === 'string' && j.error) || e.message || e.detail || j.message || '';
    if (!msg || typeof msg !== 'string') msg = code === 'plan_limit' ? 'Your Fylo plan limit was reached.' : code === 'rate_limit' ? 'Too many requests — try again in a minute.' : `Fylo returned ${r.status}`;
    throw new ApiError(msg, r.status, code);
  }
  return j;
}

/* Publish (or update) a site. `key` maps a chat to its site so re-publishing keeps the URL. */
async function publish({ key, title, files }) {
  const map = await store.get('fylo.sites', {});
  const existing = map[key];
  let res, updated = false;
  if (existing?.id) {
    try { res = await api('PUT', `/api/v1/sites/${existing.id}`, { files }); updated = true; }
    catch (e) { if (e.status !== 404) throw e; } // site deleted on Fylo → create a fresh one
  }
  if (!res) res = await api('POST', '/api/v1/sites', { name: title, files });
  const site = res.site || res.project || res;
  const id = site.id || site.project_id || site.site_id;
  const sub = site.subdomain || site.slug;
  const url = site.url || site.public_url || (sub ? `https://${sub}.fylo.dev` : null);
  if (!url) throw new ApiError('Published, but Fylo did not return a URL', 500, 'no_url');
  map[key] = { id, url, title, at: Date.now() };
  await store.set({ 'fylo.sites': map });
  return { ok: true, url, id, updated };
}

/* ---------- print tab (PDF) ---------- */
async function openPrint(html, title) {
  const id = `print-${Date.now()}`;
  await chrome.storage.session.set({ [id]: { html, title } });
  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/print/print.html?id=${id}`), active: true });
  return { ok: true };
}

/* ---------- messages ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'print': return reply(await openPrint(msg.html, msg.title));
        case 'download': { await chrome.downloads.download({ url: msg.dataUrl, filename: msg.filename, saveAs: false }); return reply({ ok: true }); }
        case 'fylo.status': {
          const t = await store.get('fylo.tokens'); const me = await store.get('fylo.me');
          return reply({ connected: !!t, email: me?.email || me?.user?.email || null, plan: me?.plan || me?.user?.plan || null });
        }
        case 'fylo.connect': { const me = await connect(); return reply({ ok: true, email: me?.email || me?.user?.email || null }); }
        case 'fylo.disconnect': { await disconnect(); return reply({ ok: true }); }
        case 'fylo.publish': return reply(await publish(msg));
        case 'fylo.sites': return reply({ ok: true, sites: await store.get('fylo.sites', {}) });
        case 'notion.status': { const n = await store.get('notion', null); return reply({ connected: !!n?.token, parent: n?.parent || null, name: n?.name || null }); }
        case 'notion.connect': { const v = await notion.verify(msg.token); const pages = await notion.pages(msg.token); await store.set({ notion: { token: msg.token, name: v.name, parent: null } }); return reply({ ok: true, name: v.name, pages }); }
        case 'notion.pages': { const n = await store.get('notion'); if (!n?.token) throw new ApiError('Not connected to Notion', 401, 'not_connected'); return reply({ ok: true, pages: await notion.pages(n.token) }); }
        case 'notion.parent': { const n = await store.get('notion'); await store.set({ notion: { ...n, parent: msg.parent } }); return reply({ ok: true }); }
        case 'notion.disconnect': { await store.remove('notion'); return reply({ ok: true }); }
        case 'notion.export': {
          const n = await store.get('notion');
          if (!n?.token) return reply({ ok: false, code: 'not_connected', error: 'Add your Notion token in the extension popup first.' });
          if (!n.parent?.id) return reply({ ok: false, code: 'no_parent', error: 'Pick a parent page for Notion exports in the extension popup.' });
          const r = await notion.exportConversation(n.token, n.parent.id, msg.conv, msg.opts || {});
          return reply({ ok: true, ...r });
        }
        default: return reply({ ok: false, error: 'Unknown message' });
      }
    } catch (e) {
      reply({ ok: false, error: e.message, code: e.code || 'error' });
    }
  })();
  return true;
});
