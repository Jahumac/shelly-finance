/**
 * Shelly — Service Worker
 *
 * Single cache, never renamed so cached pages are never wiped.
 * Static files (CSS/JS) are cache-busted via ?v=mtime in their URLs.
 *
 * Strategies:
 *  Static assets      → cache-first (served instantly, revalidated in background)
 *  Page navigations   → network-first, fall back to cache, then offline HTML
 *  API /ping          → network-only (used for online/offline detection)
 *  Other API calls    → network-first, cache for offline reads
 */

const CACHE = 'shelly-cache';

const APP_SHELL = [
  '/static/css/styles.css',
  '/static/js/charts.js',
  '/static/manifest.json',
  '/static/icons/icon-180.png',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
];

/* ── Install ──────────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* ── Activate ─────────────────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  /* Remove any old differently-named caches left from previous versions */
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch ────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  /* Static assets: cache-first */
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Ping: network only — used by the banner to detect connectivity */
  if (url.pathname === '/api/ping') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  /* Everything else: network-first, cache on success */
  event.respondWith(networkFirst(request));
});

/* ── Strategies ───────────────────────────────────────────────────────── */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then((r) => {
      if (r.ok) caches.open(CACHE).then((c) => c.put(request, r));
    }).catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    return new Response(offlineHTML(), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/* ── Offline fallback ─────────────────────────────────────────────────── */
function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0f172a">
  <title>Offline · Shelly</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; background: #0f172a; color: #e2e8f0;
           min-height: 100vh; display: flex; align-items: center; justify-content: center;
           text-align: center; padding: 2rem; }
    .card { max-width: 380px; }
    .icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #38bdf8; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem; }
    button { background: #38bdf8; color: #0f172a; border: none; padding: 0.75rem 2rem;
             border-radius: 999px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🐢</div>
    <h1>You're offline</h1>
    <p>This page hasn't been cached yet. Connect to the internet, open the app and visit this page, then it will work offline next time.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>`;
}
