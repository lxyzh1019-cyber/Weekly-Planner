/* Weekly-Planner — service worker.

   The shell (this page, its stylesheet, the 41 scripts, the icons) is kept in
   one cache so the installed app opens without signal: the planner's data is
   already on the device, and a browser error page was the one thing standing
   between a child and it.

   NETWORK FIRST, cache as the fallback. GitHub Pages caches aggressively and
   there is no build step to stamp script tags, so a cache-first worker would
   serve stale JS for as long as the worker lived. Going to the network first
   means being online always gets the deployed code; the cache is only what
   answers when the network cannot.

   BUMP SW_VERSION on every deploy that changes a shell file. Old caches are
   dropped on activate. This is the manual step the repo's no-build rule costs.

   Firebase, gstatic, Google Fonts and anything else cross-origin are never
   touched: Firestore keeps its own offline story (js/03-sync.js) and a worker
   in the middle of it would be a second cache disagreeing with the first. */

const SW_VERSION = '2026-09-14a';
const CACHE = 'wp-shell-' + SW_VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/01-config.js',
  './js/02-state.js',
  './js/03-sync.js',
  './js/04-merge.js',
  './js/05-helpers.js',
  './js/06-quests.js',
  './js/07-week-view.js',
  './js/08-day-view.js',
  './js/09-sheets.js',
  './js/10-social.js',
  './js/11-parent.js',
  './js/12-goals.js',
  './js/13-chores.js',
  './js/14-money.js',
  './js/15-meeting.js',
  './js/16-print.js',
  './js/17-ui-misc.js',
  './js/18-rules.js',
  './js/19-pocket.js',
  './js/20-loan.js',
  './js/21-money-data.js',
  './js/22-money-page1.js',
  './js/23-money-meeting.js',
  './js/24-money-parent.js',
  './js/25-money-school.js',
  './js/26-chore-kid.js',
  './js/27-chore-parent.js',
  './js/28-chore-trends.js',
  './js/29-chore-options.js',
  './js/30-backup.js',
  './js/31-today.js',
  './js/32-parent-now.js',
  './js/33-parent-app.js',
  './js/34-parent-copyweek.js',
  './js/35-school-calendar.js',
  './js/36-status.js',
  './js/37-reflection.js',
  './js/38-conflicts.js',
  './js/39-block-drag.js',
  './js/99-main.js',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-16.png',
  './assets/icons/favicon-32.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wp-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, fonts, CDNs: not ours
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => {
        if (hit) return hit;
        // A navigation with nothing cached for that exact URL still gets the shell.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
