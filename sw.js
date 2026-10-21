// Service worker: app-shell cache so the training plan still opens offline.
// Bump CACHE when index.html/style.css/script.js change meaningfully.
var CACHE = 'bn27-cache-v3';
var CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './sections/overview.html',
  './sections/schedule.html',
  './sections/strava.html',
  './sections/reference.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Mã nguồn (html/css/js) lấy mạng trước, để bản vừa deploy không bị kẹt sau
// bản cache cũ; chỉ dùng cache khi offline. Ảnh và icon thì cache trước cho nhanh.
function isCode(req) {
  if (req.mode === 'navigate') return true;
  var p = new URL(req.url).pathname;
  return /\.(html|css|js|json)$/.test(p);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.url.indexOf(self.location.origin) !== 0) return;

  if (isCode(req)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) {
          return r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
