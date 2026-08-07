/* =========================================================
   CONFERE ROTA — Service Worker
   Estratégia: cache-first para o "app shell", com atualização
   em segundo plano quando há rede disponível. Isso garante que
   o app funcione offline após o primeiro carregamento.
   ========================================================= */

const CACHE_VERSION = "confere-rota-v1";

// Caminhos relativos ao local do sw.js — funcionam tanto na raiz
// quanto em um subcaminho de projeto no GitHub Pages
// (ex: https://usuario.github.io/nome-do-repo/).
const ARQUIVOS_APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

// Biblioteca externa de leitura de código de barras. É cacheada
// no primeiro carregamento (que precisa de internet) para que o
// scanner por câmera continue funcionando offline depois disso.
const ARQUIVOS_EXTERNOS = [
  "https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // app shell local — deve funcionar mesmo se algo falhar
      await cache.addAll(ARQUIVOS_APP_SHELL).catch((e) => {
        console.warn("[sw] falha ao cachear parte do app shell:", e);
      });
      // biblioteca externa — best effort (não bloqueia a instalação)
      await Promise.all(
        ARQUIVOS_EXTERNOS.map((url) =>
          fetch(url, { mode: "cors" })
            .then((resp) => {
              if (resp && resp.ok) return cache.put(url, resp);
            })
            .catch((e) => console.warn("[sw] falha ao cachear recurso externo:", url, e))
        )
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_VERSION)
          .map((nome) => caches.delete(nome))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // apenas GET é cacheado
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const emCache = await cache.match(req, { ignoreSearch: false });

      // dispara a busca na rede em paralelo para atualizar o cache
      const buscaRede = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            cache.put(req, resp.clone());
          }
          return resp;
        })
        .catch(() => null);

      // cache-first: responde rápido se já tiver, atualiza em segundo plano
      if (emCache) {
        buscaRede; // atualização silenciosa, sem aguardar
        return emCache;
      }

      // sem cache ainda: tenta rede, e cai para o index.html em navegações offline
      const respostaRede = await buscaRede;
      if (respostaRede) return respostaRede;

      if (req.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }

      return new Response("Offline e recurso não disponível em cache.", {
        status: 503,
        statusText: "Offline",
      });
    })()
  );
});
