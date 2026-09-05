const VERSION='1.23.1';
const CACHE='fit4us-v1.23.1';

const CORE=[
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './version.json',
  './assets/movo-logo.png',
 './assets/movo-icon-512.png',
 './assets/movo-mountain-bg.svg',
 './assets/movo-wordmark-white.svg',
 './assets/movo-wordmark-dark.svg',
  './assets/movo-icon.png',
  './assets/movo-icon-192.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      for(const url of CORE){
        try{
          const response=await fetch(url,{cache:'no-store'});
          if(response.ok)await cache.put(url,response.clone());
        }catch{}
      }
    })
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('fit4us-')&&k!==CACHE).map(k=>caches.delete(k))))
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

  const critical =
    event.request.mode==='navigate' ||
    /\/(index\.html|app\.js|style\.css|config\.js|version\.json|manifest\.webmanifest)$/.test(url.pathname);

  if(critical){
    // Network first and bypass HTTP cache. This makes GitHub Pages behave like a
    // normal frequently updated website while retaining offline fallback.
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
          return response;
        })
        .catch(async()=>{
          const direct=await caches.match(event.request);
          return direct || caches.match('./index.html');
        })
    );
    return;
  }

  // Static images can still be cached efficiently.
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
      return response;
    }))
  );
});


self.addEventListener('push',event=>{
 let d={};try{d=event.data?.json()||{}}catch{d={body:event.data?.text()||''}}
 event.waitUntil((async()=>{
  if('setAppBadge'in self.navigator){try{await self.navigator.setAppBadge(1)}catch{}}
  await self.registration.showNotification(d.title||'Movo',{
   body:d.body||'',icon:'./assets/movo-icon-192.png',badge:'./assets/movo-icon-192.png',
   data:{url:d.url||'./'},tag:d.tag||'fit4us',renotify:true
  })
 })())
})
self.addEventListener('notificationclick',event=>{
 event.notification.close()
 event.waitUntil((async()=>{
  if('clearAppBadge'in self.navigator){try{await self.navigator.clearAppBadge()}catch{}}
  const target=new URL(event.notification.data?.url||'./',self.location.origin).href
  const ws=await clients.matchAll({type:'window',includeUncontrolled:true})
  for(const w of ws){if('navigate'in w)await w.navigate(target);if('focus'in w)return w.focus()}
  return clients.openWindow(target)
 })())
})
