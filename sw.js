/* Service Worker — Nopol csv&xlsx */
const VERSION = 'nopol-v1.0.2';
const SHELL_CACHE = `nopol-shell-${VERSION}`;
const CDN_CACHE   = `nopol-cdn-${VERSION}`;

/* App shell */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

/* Asset eksternal yang di-cache runtime */
const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== CDN_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 1) Navigasi HTML → network-first, fallback cache */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* 2) CDN (XLSX, font) → cache-first + revalidate */
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CDN_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const fetchP = fetch(req)
            .then((res) => {
              if (res && (res.ok || res.type === 'opaque')) {
                cache.put(req, res.clone());
              }
              return res;
            })
            .catch(() => hit);
          return hit || fetchP;
        })
      )
    );
    return;
  }

  /* 3) Same-origin aset lain → stale-while-revalidate */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(SHELL_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const network = fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || network;
        })
      )
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
