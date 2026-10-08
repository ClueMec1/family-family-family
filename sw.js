/* HTML Runner service worker
   - Serves your code preview at ./preview/ as a real page on this site, so Firebase sign-in, fetch and storage behave normally.
   - Keeps the app and the editor files cached so HTML Runner opens offline. */
const VERSION = 'hr-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'ai.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [VERSION, VERSION + '-cdn', 'hr-preview'];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const previewBase = new URL('preview/', self.registration.scope).href;

  // 1. Your code preview
  if (url.href.startsWith(previewBase)) {
    e.respondWith((async () => {
      const cache = await caches.open('hr-preview');
      let path = url.href.slice(previewBase.length).split(/[?#]/)[0];
      if (path === '' || path.endsWith('/')) path += 'index.html';
      const hit = await cache.match(previewBase + path, { ignoreSearch: true });
      if (hit) return hit;
      if (path === 'index.html') {
        return new Response('<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:24px">Open HTML Runner and press Run to create this preview.</body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return fetch(req).catch(() => new Response('Not found: ' + path, { status: 404 }));
    })());
    return;
  }

  // 2. Editor, fonts and libraries from CDNs: cache first
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION + '-cdn');
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // 3. The app itself: network first so updates arrive, cache when offline
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        throw err;
      }
    })());
  }
  // Everything else (APIs, Firebase, websites in the browser tab) goes straight to the network.
});
