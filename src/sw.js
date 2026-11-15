const CACHE = 'streaky-v10';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'streak.js', 'notifications.js', 'reminders.js', 'local-reminders.js', 'native.js',
  'fonts/rubik-hebrew-500-normal.woff2', 'fonts/rubik-hebrew-700-normal.woff2', 'fonts/rubik-hebrew-800-normal.woff2', 'fonts/rubik-hebrew-900-normal.woff2',
  'fonts/rubik-latin-500-normal.woff2', 'fonts/rubik-latin-700-normal.woff2', 'fonts/rubik-latin-800-normal.woff2', 'fonts/rubik-latin-900-normal.woff2', 'install.js', 'icons.js', 'icons/uworld.png', 'icons/sketchy.png', 'icons/anki.png', 'icons/firstaid.png', 'icons/nbme.png', 'mascot.js', 'vendor/qrcode.js', 'apple-touch-icon.png', 'icon-maskable-512.png', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates arrive quickly, cache as offline fallback.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});

self.addEventListener('push', (e) => {
  let msg = { title: 'Dr Bellini 🩺', body: 'המטלות של היום מחכות לך!' };
  try { msg = { ...msg, ...e.data.json() }; } catch { /* use default text */ }
  e.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'streaky-reminder',
    renotify: true,
    lang: 'he',
    dir: 'rtl',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow('./');
  }));
});
