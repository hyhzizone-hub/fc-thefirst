// 최소 서비스워커: 앱 설치 조건용 (캐시 없음, 항상 최신 화면을 불러옴)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
