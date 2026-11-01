/* =========================================================
   صلوات شمار - Service Worker
   Compatible with App Version: 1.5.0
   ========================================================= */

const APP_VERSION = '1.5.0';
const CACHE_NAME = `salavat-shomar-v${APP_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});


/* =========================================================
   ACTIVATE
   حذف Cache نسخه‌های قدیمی
   ========================================================= */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name =>
              name.startsWith('salavat-shomar-v') &&
              name !== CACHE_NAME
            )
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener('fetch', event => {

  const request = event.request;

  /* فقط GET */
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  /*
    درخواست‌های خارج از دامنه برنامه
    مثل Google Fonts
    مستقیماً از شبکه دریافت می‌شوند.
  */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
    برای index.html:
    Network First
    یعنی ابتدا نسخه جدید را از اینترنت می‌گیریم،
    در صورت نبود اینترنت نسخه Cache استفاده می‌شود.
  */

  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/'
  ) {

    event.respondWith(

      fetch(request)
        .then(response => {

          if (response && response.ok) {

            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put('./index.html', copy);
              });

          }

          return response;
        })
        .catch(() => {
          return caches.match('./index.html');
        })

    );

    return;
  }


  /*
    سایر فایل‌های داخلی:
    Cache First
    اگر Cache وجود داشت همان را نمایش می‌دهیم.
  */

  event.respondWith(

    caches.match(request)
      .then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {

            if (!response || !response.ok) {
              return response;
            }

            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, copy);
              });

            return response;
          })
          .catch(() => {

            /*
              اگر فایل پیدا نشد و اینترنت هم قطع بود،
              برای صفحات HTML نسخه اصلی برنامه برگردانده شود.
            */

            if (request.destination === 'document') {
              return caches.match('./index.html');
            }

            return new Response('', {
              status: 503,
              statusText: 'Offline'
            });

          });

      })

  );

});


/* =========================================================
   پیام از JavaScript اصلی
   برای بررسی / اعمال نسخه جدید
   ========================================================= */

self.addEventListener('message', event => {

  if (!event.data) {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});


/* =========================================================
   اطلاعات نسخه
   ========================================================= */

self.APP_VERSION = APP_VERSION;
