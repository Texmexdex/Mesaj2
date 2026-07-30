/**
 * sw.js — service worker
 *
 * Fixed from v1:
 *  - Paths are RELATIVE. v1 cached "/", "/index.html" etc., which 404s on a
 *    GitHub Pages project site (username.github.io/mesaj/) and made the
 *    install step fail silently, so nothing ever worked offline.
 *  - The API bypass matched api-inference.huggingface.co, which the app no
 *    longer calls. Now it bypasses every cross-origin request, so translation
 *    responses are never served stale from cache.
 *  - cache.addAll() is atomic: one missing file aborted the whole install.
 *    Files are cached individually instead.
 *
 * Bump CACHE_NAME on every deploy or clients keep the old shell.
 */

const CACHE_NAME = "mesaj-v8";

const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./lexicon.js",
  "./translate.js",
  "./pipeline.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
