const VERSION='1.7.4';
const CACHE='fit4us-v1.7.4';
const CORE=[
 './',
 './index.html?v=1.7.4',
 './style.css?v=1.7.4',
 './app.js?v=1.7.4',
 './config.js?v=1.7.4',
 './manifest.webmanifest?v=1.7.4',
 './version.json?v=1.7.4',
 './assets/fit4us-logo.png',
 './assets/fit4us-icon.png',
 './assets/fit4us-icon-192.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>Promise.all(CORE.map(url=>fetch(url,{cache:'reload'})
        .then(response=>response.ok?cache.put(url,response.clone()):null)
        .catch(()=>null))))
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('fit4us-')&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  // version + app shell: network first, NEVER trust stale browser HTTP cache.
  const critical =
    event.request.mode==='navigate' ||
    /\/(index\.html|app\.js|style\.css|config\.js|version\.json|manifest\.webmanifest)$/.test(url.pathname);

  if(critical){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
          return response;
        })
        .catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html?v=1.7.4')))
    );
    return;
  }

  // Static images etc.: cache first, then network.
  event.respondWith(
    caches.match(event.request)
      .then(cached=>cached||fetch(event.request).then(response=>{
        if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
        return response;
      }))
  );
});
