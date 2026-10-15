const CACHE='meteo-x-static-v1-3';
const ASSETS=['./','./index.html','./storage.js','./agua.html','./agua.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('meteo-x-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  // Never cache API responses (token-protected), any cross-origin request or non-GET methods.
  if(req.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
  // Static UI can open offline; actual readings are in IndexedDB and marked as cached.
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(resp=>{
    if(resp.ok){const copy=resp.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)))}
    return resp;
  })));
});
