/* RESTORED v9 FULL STABLE
   Network-first for code, safe cache for static assets, and automatic cleanup of every older shell. */
const CACHE='arpan-learning-suite-v12-1-finish';
const CORE=['./','./index.html','./student.html','./student_test.html','./admin.html','./teacher_dashboard.html','./style.css','./effects.js','./community.html','./community.js','./community.css','./finish.css','./learning-plus.js','./learning-plus.css','./premium.css','./premium-shell.js','./refresh.css','./study-desk.js','./study-art.svg','./config.js','./manifest.webmanifest','./app-icon-192.png','./app-icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('arpan-learning-suite-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  const clean=new Request(url.origin+url.pathname,{method:'GET',headers:req.headers,credentials:'same-origin'});
  const codeAsset=req.mode==='navigate'||['style','script','worker'].includes(req.destination)||/\.(css|js|html)$/.test(url.pathname);
  if(codeAsset){event.respondWith(fetch(req).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(clean,cp));}return res;}).catch(()=>caches.match(clean).then(r=>r||caches.match(req).then(hit=>hit||(req.mode==='navigate'?caches.match('./index.html'):Response.error())))));return;}
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return res;})));
});
