/* ============================================================
   Service Worker — صلوات شمار
   ------------------------------------------------------------
   ویژگی‌ها:
   • نسخه‌بندی خودکار کش از روی <meta name="app-version"> در index.html
   • SW_BUILD به‌عنوان «علامت نسخه» برای فعال‌سازی چرخهٔ بروزرسانی
   • network-first برای ناوبری (index.html) → HTML همیشه تازه
   • cache-first برای دارایی‌های هم‌origin و فونت‌های گوگل
   • پاک‌سازی خودکار کش‌های قدیمی در activate
   • پشتیبانی از پیام SKIP_WAITING برای بروزرسانی کنترل‌شده
   • تایم‌اوت شبکه برای جلوگیری از انتظار بی‌پایان
   ============================================================ */

/* ⬇⬇⬇  با هر انتشار این عدد را با app-version در index.html هم‌گام کنید  ⬇⬇⬇ */
const SW_BUILD = '1.5.0';
/* ⬆⬆⬆ ------------------------------------------------------------------ ⬆⬆⬆ */

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

// دامنه‌های فونت گوگل — cache-first چون URLها immutable هستند
const FONT_HOST_RE = /(^|\.)fonts\.(googleapis|gstatic)\.com$/i;

const CACHE_PREFIX = 'salavat-shomar-';
let CACHE_NAME = CACHE_PREFIX + SW_BUILD; // مقدار اولیه؛ در install با app-version overwrite می‌شود

/* ---------- خواندن نسخهٔ اپ از index.html ---------- */
async function readAppVersion() {
  try {
    const res = await fetch('./index.html', { cache: 'reload' });
    if (!res.ok) return SW_BUILD;
    const html = await res.text();
    const m = html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
    return (m && m[1]) ? m[1].replace(/[^0-9A-Za-z._-]/g, '') : SW_BUILD;
  } catch (_) {
    return SW_BUILD;
  }
}

/* ---------- نصب ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const version = await readAppVersion();
    CACHE_NAME = CACHE_PREFIX + version;
    const cache = await caches.open(CACHE_NAME);

    // هر آیتم جداگانه fetch می‌شود تا یک 404 کل نصب را خراب نکند.
    // {cache:'reload'} از HTTP cache مرورگر عبور می‌کند تا کش SW مسموم نشود.
    await Promise.allSettled(STATIC_ASSETS.map(async url => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res);
      } catch (_) { /* نادیده */ }
    }));

    // skipWaiting عمداً اینجا صدا زده نمی‌شود؛
    // اپ با postMessage({type:'SKIP_WAITING'}) زمان بروزرسانی را کنترل می‌کند.
  })());
});

/* ---------- فعال‌سازی ---------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // پاک‌سازی کش‌های قدیمی همین اپ
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );

    // کنترل clients فعلی برای تریگر controllerchange در اپ
    await self.clients.claim();
  })());
});

/* ---------- پیام از اپ (بروزرسانی کنترل‌شده) ---------- */
self.addEventListener('message', event => {
  const data = event.data;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- کمکی: fetch با تایم‌اوت ---------- */
function fetchWithTimeout(request, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/* ---------- fetch ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // فقط GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* ۱) ناوبری (index.html) — network-first با fallback به کش */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetchWithTimeout(req, 5000);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (_) {
        const cached =
          (await caches.match('./index.html', { cacheName: CACHE_NAME })) ||
          (await caches.match('./index.html'));
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>آفلاین</title>' +
          '<body style="font-family:Tahoma;text-align:center;padding:40px;direction:rtl">' +
          '<h2>اتصال اینترنت برقرار نیست</h2>' +
          '<p>برای بارگذاری اولیهٔ برنامه به اینترنت نیاز است.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  /* ۲) فونت‌های گوگل — cache-first */
  if (FONT_HOST_RE.test(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { cacheName: CACHE_NAME });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (_) {
        return Response.error();
      }
    })());
    return;
  }

  /* ۳) دارایی‌های هم‌origin — cache-first با پرکردن تنبل */
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { cacheName: CACHE_NAME });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (_) {
        return Response.error();
      }
    })());
    return;
  }

  /* ۴) سایر منابع (Supabase، API اوقات شرعی، ...) — عبور از SW */
  // هیچ respondWith ای صدا زده نمی‌شود تا رفتار پیش‌فرض مرورگر حفظ شود.
});
