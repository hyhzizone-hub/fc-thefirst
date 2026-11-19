// 껍데기 페이지의 푸시 알림 담당: 앱 화면(iframe)과 postMessage로 대화합니다.
(function () {
  var C = self.FC_PUSH || {};
  var okCfg = !!(C.firebase && C.firebase.projectId && C.firebase.projectId !== '여기에' && C.vapidKey && C.vapidKey !== '여기에');
  var ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/;
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var messaging = null, loading = null;

  function supported() {
    return okCfg && 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function sdk() {
    if (messaging) return Promise.resolve(messaging);
    if (!loading) {
      loading = loadScript(SDK + 'firebase-app-compat.js')
        .then(function () { return loadScript(SDK + 'firebase-messaging-compat.js'); })
        .then(function () {
          if (!firebase.apps.length) firebase.initializeApp(C.firebase);
          messaging = firebase.messaging();
          return messaging;
        });
    }
    return loading;
  }
  function getToken() {
    return sdk().then(function (m) {
      return navigator.serviceWorker.ready.then(function (reg) {
        return m.getToken({ vapidKey: C.vapidKey, serviceWorkerRegistration: reg });
      });
    });
  }
  function status() {
    var s = { fcType: 'push-status', supported: supported(), permission: 'default', token: null, standalone: false };
    try { s.standalone = (window.navigator.standalone === true) || window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    if (!s.supported) return Promise.resolve(s);
    s.permission = Notification.permission;
    if (s.permission !== 'granted') return Promise.resolve(s);
    return getToken().then(function (t) { s.token = t || null; return s; }, function () { return s; });
  }

  // 사용자가 직접 누르는 버튼(제스처)이 있어야 권한 요청이 되므로 껍데기 화면에 버튼을 띄움
  function askPermission(reply) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,"Segoe UI",sans-serif';
    box.innerHTML =
      '<div style="background:#fff;border-radius:18px;padding:22px;max-width:320px;width:100%;text-align:center;color:#111">' +
      '<div style="font-size:34px">🔔</div>' +
      '<div style="font-weight:800;margin:8px 0 4px">FC 더퍼스트 알림</div>' +
      '<div style="font-size:13px;color:#555;line-height:1.5;margin-bottom:16px">공지·경기 일정·경기 결과·팀 의견이<br>생기면 폰으로 알려드려요.</div>' +
      '<button id="fc-push-go" style="width:100%;padding:12px;border:0;border-radius:12px;background:#dc2626;color:#fff;font-weight:800;font-size:15px">알림 허용하기</button>' +
      '<button id="fc-push-no" style="width:100%;padding:10px;border:0;background:none;color:#888;font-size:13px;margin-top:6px">나중에</button>' +
      '</div>';
    document.body.appendChild(box);
    function done(msg) { try { document.body.removeChild(box); } catch (e) {} reply(msg); }
    box.querySelector('#fc-push-no').onclick = function () { done({ fcType: 'push-token', ok: false, error: 'cancel' }); };
    box.querySelector('#fc-push-go').onclick = function () {
      var p;
      try { p = Notification.requestPermission(); } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(function (perm) {
        if (perm !== 'granted') return done({ fcType: 'push-token', ok: false, error: 'denied' });
        return getToken().then(function (t) {
          done({ fcType: 'push-token', ok: !!t, token: t || null, error: t ? '' : 'notoken' });
        });
      }).catch(function (e) {
        done({ fcType: 'push-token', ok: false, error: String((e && e.message) || e).slice(0, 120) });
      });
    };
  }

  window.addEventListener('message', function (e) {
    if (!ORIGIN_RE.test(e.origin)) return;
    var d = e.data || {};
    function reply(m) { try { e.source.postMessage(m, e.origin); } catch (x) {} }
    if (d.fcType === 'push-status') {
      status().then(reply);
    } else if (d.fcType === 'push-enable') {
      if (!supported()) return reply({ fcType: 'push-token', ok: false, error: 'unsupported' });
      askPermission(reply);
    } else if (d.fcType === 'push-disable') {
      if (!supported()) return reply({ fcType: 'push-status', supported: false });
      sdk().then(function (m) { return m.deleteToken(); }).catch(function () {}).then(function () { reply({ fcType: 'push-status', supported: true, permission: Notification.permission, token: null, standalone: true }); });
    }
  });
})();

// ===== 뒤로 가기: 앱 안에서 한 단계 이전 화면으로, 첫 화면에서만 종료 =====
(function () {
  var appWin = null;
  var ORIGIN_OK = /^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|google\.com)$/;

  window.addEventListener('message', function (e) {
    if (!ORIGIN_OK.test(e.origin)) return;
    var d = e.data || {};
    if (d.fcType === 'back-hello') appWin = e.source;
    else if (d.fcType === 'back-result' && pending) pending(!!d.handled);
  });

  var pending = null;
  var inited = false;
  // 앱 화면(iframe)이 다 불러와진 뒤에 기록 칸을 쌓아야, iframe이 만드는 이동 기록에 밀리지 않음
  function init() {
    if (inited) return;
    inited = true;
    try { history.replaceState({ fcb: 0 }, ''); history.pushState({ fcb: 1 }, ''); } catch (e) {}
  }
  var fr = document.getElementById('app');
  if (fr) fr.addEventListener('load', function () { setTimeout(init, 1500); });
  window.addEventListener('load', function () { setTimeout(init, 6000); });   // 안전장치
  if (document.readyState === 'complete') setTimeout(init, 1500);

  window.addEventListener('popstate', function () {
    if (!inited) return;
    if (history.state && history.state.fcb === 1) return;   // 앞으로 가기는 무시
    var done = false;
    function finish(handled) {
      if (done) return;
      done = true; pending = null; clearTimeout(timer);
      if (handled) { try { history.pushState({ fcb: 1 }, ''); } catch (e) {} }
      else { history.back(); }                                // 첫 화면: 실제로 종료
    }
    var timer = setTimeout(function () { finish(false); }, 500);
    pending = finish;
    try { appWin.postMessage({ fcType: 'back' }, '*'); } catch (e) { finish(false); }
  });
})();
