/* Text Runs offline helper. The page comes from the network first, so each update shows up the next time
   the app opens; when there's no signal, the saved copy opens instead. Everything else is served from the
   saved copy and refreshed in the background. */
const V = "tr-2026-11-23a";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
const LATER = ["pdfjs/pdf.min.mjs", "pdfjs/pdf.worker.min.mjs"];
const OUTSIDE = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).then(() => c.addAll(LATER).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k.startsWith("tr-")).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  const page = r.mode === "navigate" || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname));
  if (page) {
    const net = fetch(r).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(V).then(x => x.put("index.html", c)); } return res; });
    const slow = new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000));
    e.respondWith(Promise.race([net, slow]).catch(() => caches.match("index.html").then(m => m || caches.match("./")).then(m => m || net)));
    return;
  }
  if (u.origin === location.origin || OUTSIDE.test(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(m => {
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()); return res; }).catch(() => m);
      return m || net;
    })));
  }
});
