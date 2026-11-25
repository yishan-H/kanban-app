var CACHE_NAME = "accounting-app-shell-v10";
var APP_BASE_URL = new URL("./", self.location.href);
var SHELL_PATHS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/penguin-login.svg",
  "./images/penguin-coins.svg",
  "./images/penguin-pencil.svg",
  "./images/penguin-ledger.svg",
  "./images/penguin.jpg"
];
var SHELL_URLS = SHELL_PATHS.map(function (path) {
  return new URL(path, APP_BASE_URL).href;
});

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(SHELL_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(cacheNames.map(function (cacheName) {
          if (cacheName.indexOf("accounting-app-shell-") === 0 && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") {
    return;
  }

  var requestUrl = new URL(request.url);
  if (requestUrl.origin !== APP_BASE_URL.origin || SHELL_URLS.indexOf(requestUrl.href) === -1) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(function (cachedResponse) {
        return cachedResponse || fetch(request);
      })
  );
});
