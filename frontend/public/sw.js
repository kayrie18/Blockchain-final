const CACHE_VERSION = 'chainverify-v1';
const CACHE_NAME = `chainverify-assets-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
const ASSETS = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/maskable_icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

const fetchFromCache = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  return cachedResponse || null;
};

const cacheAndReturn = async (request) => {
  const response = await fetch(request);
  if (response && response.status === 200 && request.method === 'GET') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const acceptHeader = event.request.headers.get('Accept') || '';

  if (isNavigation || acceptHeader.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await fetchFromCache(event.request)) || (await fetchFromCache(OFFLINE_URL));
        })
    );
    return;
  }

  if (['style', 'script', 'image', 'font', 'manifest'].some((type) => event.request.destination === type)) {
    event.respondWith(
      fetchFromCache(event.request).then((cached) => cached || cacheAndReturn(event.request)).catch(() => fetch(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(async () => fetchFromCache(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
