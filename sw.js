// 오프라인 캐시: 앱 파일을 저장해 두고, 인터넷이 되면 새 버전을 받아 둔다.
const VERSION = "3d859cf42700";
const APP = "scanner-app-" + VERSION, FONTS = "scanner-fonts";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"];
// 제대로 된 응답만 저장한다 (404·와이파이 로그인 화면 같은 건 저장하지 않는다)
const good = (res) => res && res.ok && res.type === "basic" && !res.redirected;

self.addEventListener("install", (e) => {
  // 브라우저 HTTP 캐시에 남은 옛 파일이 아니라 서버의 최신 파일을 받아 둔다
  e.waitUntil(caches.open(APP).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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
  if (req.mode === "navigate") {
    // 화면: 인터넷이 3초 안에 제대로 답하면 최신, 아니면 저장본 (응답 없는 와이파이에서도 바로 열린다)
    e.respondWith((async () => {
      const cached = await caches.match("./index.html");
      // 우리 앱 화면인지 확인한다 (와이파이 로그인 화면처럼 200으로 오는 엉뚱한 화면은 쓰지도 저장하지도 않는다)
      const net = fetch(req).then(async (res) => {
        if (!good(res) || !(await res.clone().text()).includes('name="scanner-app"')) return null;
        const copy = res.clone(); caches.open(APP).then((c) => c.put("./index.html", copy));
        return res;
      });
      if (!cached) return net.then((res) => res || fetch(req)).catch(() => fetch(req));
      const timeout = new Promise((r) => setTimeout(() => r(null), 3000));
      try {
        const res = await Promise.race([net, timeout]);
        return res || cached;
      } catch { return cached; }
    })());
    return;
  }
  if (url.origin === location.origin) { // 아이콘 등: 저장본을 바로 쓰고, 뒤에서 새로 받아 둔다
    e.respondWith(caches.open(APP).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (good(res)) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { // 글꼴: 저장본을 쓰고 뒤에서 새로 받기
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
