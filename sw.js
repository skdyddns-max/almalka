/* 알려줄까말까 서비스워커 — 오프라인 캐시 (앱 셸 cache-first + 백그라운드 갱신) */
const VERSION = 'almalka-v16';
const SHELL = [
  './',
  './index.html',
  './guide.html',
  './css/style.css?v=16',
  './js/config.js',
  './js/exercise-library.js?v=7',
  './js/data.js?v=16',
  './js/app.js?v=16',
  './js/features.js?v=16',
  './js/sync.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache:'reload'로 HTTP 캐시를 우회해 항상 최신 셸을 받음 (VERSION 올리면 확실히 갱신)
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase 등 API·외부 요청은 캐시하지 않음
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res && res.status === 200) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
