/**
 * sw.js
 * ---------------------------------------------------------
 * Service worker mínimo: torna a aplicação instalável e
 * permite abrir a interface offline. Os ficheiros MP3 não
 * são pré-cacheados aqui (podem ser grandes) — são pedidos
 * à rede normalmente e ficam em cache do browser após a
 * primeira reprodução.
 * ---------------------------------------------------------
 */

const CACHE_NAME = "jukebox-nfc-v1";

const APP_SHELL = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./tracks.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Não intercetar pedidos de áudio: deixa o browser geri-los
  // diretamente (melhor para streaming/seek de ficheiros grandes).
  if (request.destination === "audio") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (request.method === "GET" && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      );
    })
  );
});
