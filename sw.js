// 오프라인 캐시: 앱 파일은 저장해 두고, 인터넷이 되면 새 버전을 받아 둔다.
const VERSION = "d2effc5da60b";
const APP = "scanner-app-" + VERSION, FONTS = "scanner-fonts";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("scanner-app-") && k !== APP).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") { // 화면: 인터넷이 되면 최신, 안 되면 저장본
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(APP).then((c) => c.put("./index.html", copy)); return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  if (url.origin === location.origin) { // 아이콘 등: 저장본 먼저
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { // 글꼴: 저장본을 쓰고 뒤에서 새로 받기
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
