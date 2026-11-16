/* باربي Barbii — Service Worker: عمل بدون إنترنت + تحديث فوري */
const CACHE = "barbii-v2";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/data.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // كل ملف على حدة: فشل ملف واحد لا يمنع تثبيت الـ SW بالكامل.
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (!res || res.status !== 200 || res.type === "opaque") return res;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // الصفحات: الشبكة أولاً حتى لا تعلق نسخة قديمة في المعاينة، ثم الكاش عند انقطاع الإنترنت.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => put(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // الأيقونات والصور: الكاش أولاً (لا تتغير غالباً).
  if (req.destination === "image" || /\.(png|jpe?g|webp|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res)).catch(() => hit))
    );
    return;
  }

  // CSS/JS/المانيفست: الشبكة أولاً مع تحديث الكاش، ثم الكاش.
  e.respondWith(
    fetch(req)
      .then((res) => put(req, res))
      .catch(() => caches.match(req))
  );
});
