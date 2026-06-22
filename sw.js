const CACHE_NAME = 'presentes-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login-style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Ignora Firebase e APIs externas — nunca coloca em cache
  if (
    url.includes('firebaseapp.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com')
  ) {
    return; // Deixa o navegador fazer a requisição normalmente
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});