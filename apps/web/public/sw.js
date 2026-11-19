/* global self, caches, fetch */
/*
 * Service worker do TIMControl (Lote 3, PWA). De propósito, NÃO guarda páginas nem dados dos cards no aparelho
 * (podem ter dados de clientes): só a página "sem conexão" e o ícone. Tudo o mais vai sempre à rede.
 */
const CACHE = "timcontrol-offline-v1";
const OFFLINE = ["/offline.html", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});
