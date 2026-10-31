// CaliCoach service worker: makes the app open and log workouts offline.
//
// - Static build assets (/_next/static, icons): cache-first (they're immutable).
// - Page navigations: network-first; offline, fall back to the last cached copy.
//   A workout started offline has a new id that was never cached, so
//   /workout/<id> falls back to a cached "shell" workout page — the page reads
//   the real id from the URL and loads the workout from IndexedDB.
// - Pages are cached by a "warm" message the app sends while online, and
//   removed by a "clear" message on sign-out (they contain personal data).
// - API and Supabase requests are never cached.
//
// The version comes from the registration URL (/sw.js?v=<build id>), so each
// deploy installs a fresh worker and old caches are deleted.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const SHELL_ID = "00000000-0000-4000-8000-000000000000";
const APP_PAGES = ["/today", "/plan", "/progress", "/settings", `/workout/${SHELL_ID}`, `/workout/${SHELL_ID}/summary`];
const PRECACHE = ["/~offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
  }
  // Everything else (RSC payloads, API routes) goes straight to the network.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function navigate(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && APP_PAGES.includes(url.pathname)) {
      (await caches.open(PAGES_CACHE)).put(url.pathname, response.clone());
    }
    return response;
  } catch {
    return offlinePage(url.pathname);
  }
}

async function offlinePage(pathname) {
  const pages = await caches.open(PAGES_CACHE);
  const workout = pathname.match(/^\/workout\/[0-9a-f-]{36}(\/summary)?$/);
  const key = workout ? `/workout/${SHELL_ID}${workout[1] ?? ""}` : pathname;
  return (await pages.match(key)) || (await caches.match("/~offline")) || Response.error();
}

/** Fetches the app pages (with the user's cookies) and the scripts they need. */
async function warm() {
  const pages = await caches.open(PAGES_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  for (const path of APP_PAGES) {
    try {
      const response = await fetch(path, { credentials: "same-origin" });
      // Signed out → redirected to /login: don't cache.
      if (!response.ok || response.redirected) continue;
      const html = await response.clone().text();
      await pages.put(path, response);
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
      for (const asset of assets) {
        if (!(await statics.match(asset))) {
          const res = await fetch(asset);
          if (res.ok) await statics.put(asset, res);
        }
      }
    } catch {
      // Offline or a page failed: try again on the next warm.
    }
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "warm") event.waitUntil(warm());
  if (event.data?.type === "clear") event.waitUntil(caches.delete(PAGES_CACHE));
});
