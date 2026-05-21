'use strict';

const VERSION = 'v3';
const SHELL_CACHE = `otamga-shell-${VERSION}`;
const STATIC_CACHE = `otamga-static-${VERSION}`;
const FONTS_CACHE = `otamga-fonts-${VERSION}`;
const API_CACHE = `otamga-api-${VERSION}`;
const AUDIO_CACHE = `otamga-audio-${VERSION}`;

const KNOWN_CACHES = new Set([
    SHELL_CACHE, STATIC_CACHE, FONTS_CACHE, API_CACHE, AUDIO_CACHE,
]);

const SHELL_URLS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon.svg',
    './favicon-32.png',
    './apple-touch-icon.png',
    './icon-192.png',
    './icon-512.png',
];

const AUDIO_MAX_ENTRIES = 60;

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(SHELL_URLS);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter((n) => n.startsWith('otamga-') && !KNOWN_CACHES.has(n))
                .map((n) => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    if (req.mode === 'navigate' || isHtmlRequest(req)) {
        event.respondWith(networkFirstHtml(req));
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(req, STATIC_CACHE));
        return;
    }

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(req, FONTS_CACHE));
        return;
    }

    if (url.hostname === 'api.alquran.cloud') {
        event.respondWith(staleWhileRevalidate(req, API_CACHE));
        return;
    }

    if (isAudioRequest(url)) {
        if (req.headers.has('range')) return;
        event.respondWith(audioCacheFirst(req));
        return;
    }
});

function isHtmlRequest(req) {
    const accept = req.headers.get('Accept') || '';
    return accept.includes('text/html');
}

function isAudioRequest(url) {
    if (/\.mp3($|\?)/i.test(url.pathname)) return true;
    return url.hostname.endsWith('everyayah.com');
}

async function networkFirstHtml(req) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
            cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch (err) {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        const shell = await cache.match('./index.html');
        if (shell) return shell;
        throw err;
    }
}

async function cacheFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.status === 200) {
            cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch (err) {
        if (cached) return cached;
        throw err;
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    const fetching = fetch(req)
        .then((res) => {
            if (res && res.ok) {
                cache.put(req, res.clone()).catch(() => {});
            }
            return res;
        })
        .catch(() => null);
    return cached || (await fetching) || Response.error();
}

async function audioCacheFirst(req) {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    if (fresh && fresh.ok && (fresh.status === 200 || fresh.type === 'opaque')) {
        cache.put(req, fresh.clone()).then(() => trimCache(AUDIO_CACHE, AUDIO_MAX_ENTRIES)).catch(() => {});
    }
    return fresh;
}

async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const removeCount = keys.length - maxEntries;
    for (let i = 0; i < removeCount; i++) {
        await cache.delete(keys[i]);
    }
}
