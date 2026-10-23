import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';

// Service worker template. Navigations are network-first (deploys show up immediately, cached shell when offline);
// everything else same-origin (hashed assets) and Google Fonts is cache-first.
const SW = `const CACHE = 'aether-__HASH__';
const PRECACHE = __PRECACHE__;
const SCOPE = self.registration.scope;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(PRECACHE.map((p) => c.add(new URL(p, SCOPE).href).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r)
      .then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(SCOPE, cp)); } return res; })
      .catch(() => caches.match(SCOPE)));
    return;
  }
  if (u.origin === location.origin || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); }
      return res;
    })));
  }
});
`;

/** Emits dist/sw.js with the list of built assets; the cache name changes whenever the bundle does. */
function swPlugin(): Plugin {
  return {
    name: 'aether-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter((f) => f.startsWith('assets/'));
      const precache = ['./', ...assets, 'favicon.png', 'manifest.webmanifest'];
      const hash = createHash('sha1').update(assets.join()).digest('hex').slice(0, 10);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW.replace('__HASH__', hash).replace('__PRECACHE__', JSON.stringify(precache)) });
    },
  };
}

export default defineConfig({
  plugins: [react(), swPlugin()],
  base: '/Aether/',
});
