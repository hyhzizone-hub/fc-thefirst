// 서비스워커: 앱 설치 조건 + 푸시 알림 수신 (캐시 없음, 항상 최신 화면)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});

try {
  importScripts('push-config.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  var C = self.FC_PUSH;
  if (C && C.firebase && C.firebase.projectId && C.firebase.projectId !== '여기에') {
    firebase.initializeApp(C.firebase);
    var messaging = firebase.messaging();
    // 서버가 보낸 데이터(title/body/tag)로 알림을 직접 표시
    messaging.onBackgroundMessage(function (payload) {
      var d = (payload && payload.data) || {};
      return self.registration.showNotification(d.title || 'FC 더퍼스트', {
        body: d.body || '',
        tag: d.tag || 'fc-thefirst',
        renotify: true,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        data: { url: './' }
      });
    });
  }
} catch (e) {}

// 알림을 누르면 앱 열기
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
