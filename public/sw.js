const CACHE = 'syncy-audio-v1';
self.addEventListener('message', async ({ data, source }) => {
  if (data?.type === 'CACHE') {
    try {
      const c = await caches.open(CACHE);
      await c.add(new Request(data.url, { mode: 'no-cors' }));
      source?.postMessage({ type: 'CACHED', id: data.id });
    } catch (e) { source?.postMessage({ type: 'CACHE_ERR', id: data.id }); }
  }
  if (data?.type === 'UNCACHE') {
    const c = await caches.open(CACHE); await c.delete(data.url);
  }
});
self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (u.includes('aac.saavncdn') || u.includes('jiosaavn') || u.includes('jamendo')) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request))));
  }
});
