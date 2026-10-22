// ATD QAG/LOA Status service worker: makes the site installable as an app and keeps the last device list
// for when the network is down. Always asks the network first, so changes show up right away.
// PDFs are not cached here (the browser's own cache handles them).
const CACHE = 'atd-status-1.1.0';
const SHELL = ['./', 'index.html', 'assets/app.css?v=1.1.0', 'assets/app.js?v=1.1.0', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('.pdf')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
  );
});
