// Endpaper service worker: makes the app shell open with no network.
// Data never comes from here. It lives in IndexedDB and syncs separately.
//  - navigations: network first (2.5s timeout), cached shell if offline
//  - /_next/static, fonts, covers, OCR models: cache first (immutable or content-addressed)
//  - Supabase and everything else: straight to network

const SHELL = "shell-v1";
const ASSETS = "assets-v1";
const ROUTES = [
  "/", "/library", "/inbox", "/search", "/add", "/book", "/capture", "/passage",
  "/share", "/preview", "/essay", "/settings", "/settings/profile", "/settings/import",
  "/settings/export", "/settings/delete", "/username", "/check-email",
];

async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  await Promise.all(
    ROUTES.map(async (path) => {
      try {
        const res = await fetch(path, { credentials: "same-origin" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await shell.put(path, res);
        // Pull in the JS/CSS the page needs so a cold offline load can hydrate.
        const urls = [...html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)].map((m) => m[0]);
        await Promise.all([...new Set(urls)].map((u) => assets.match(u).then((hit) => hit || assets.add(u).catch(() => {}))));
      } catch {
        /* offline during install; try again next time */
      }
    }),
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = async (req) => {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
};

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

async function navigate(req) {
  const url = new URL(req.url);
  const key = url.pathname;
  const shell = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(req), timeout(2500)]);
    if (res.ok && !url.pathname.startsWith("/auth")) shell.put(key, res.clone());
    return res;
  } catch {
    return (await shell.match(key)) || (await shell.match("/library")) || (await shell.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate" && url.origin === self.location.origin) {
    e.respondWith(navigate(req));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    e.respondWith(cacheFirst(req));
    return;
  }
  if (
    url.hostname === "covers.openlibrary.org" ||
    url.hostname === "books.google.com" ||
    url.hostname === "cdn.jsdelivr.net" || // tesseract.js worker, core and language data
    url.hostname === "tessdata.projectnaptha.com" ||
    (url.origin === self.location.origin && /\.(svg|png|ico)$/.test(url.pathname))
  ) {
    e.respondWith(cacheFirst(req));
  }
});
