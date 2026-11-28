const CACHE_NAME = "alexis-cache-v5";
const AUDIO_CACHE_NAME = "alexis-sanskrit-audio-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./alexis_logo.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

async function serveAudioFromCache(request, cachedResponse) {
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return cachedResponse;
  }

  const bytes = await cachedResponse.arrayBuffer();
  const total = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          cachedResponse.headers.get("Content-Type") || "audio/mp4",
        "Content-Length": String(total),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const [, rawStart, rawEnd] = match;
  let start = 0;
  let end = total - 1;
  if (rawStart === "" && rawEnd !== "") {
    const suffix = Number.parseInt(rawEnd, 10);
    start = Math.max(0, total - suffix);
  } else {
    start = rawStart ? Number.parseInt(rawStart, 10) : 0;
    end = rawEnd ? Math.min(total - 1, Number.parseInt(rawEnd, 10)) : total - 1;
  }

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start > end ||
    start >= total
  ) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${total}`,
      },
    });
  }

  const slice = bytes.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": cachedResponse.headers.get("Content-Type") || "audio/mp4",
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (
              IS_LOCALHOST ||
              (key !== CACHE_NAME && key !== AUDIO_CACHE_NAME)
            ) {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST || event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.includes("/audio/sa/") && url.pathname.endsWith(".m4a")) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(url.href, { ignoreSearch: true });
        if (cached) {
          return serveAudioFromCache(event.request, cached);
        }
        return fetch(event.request);
      }),
    );
    return;
  }

  // Network-first so new releases appear immediately when online, with offline cache fallback
  const networkRequest =
    event.request.mode === "navigate"
      ? fetch(event.request.url, { cache: "no-cache" })
      : fetch(event.request);

  event.respondWith(
    networkRequest
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseToCache = networkResponse.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        }),
      ),
  );
});
