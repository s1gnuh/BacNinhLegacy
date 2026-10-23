// Điều khiển settings.html — chỉ còn phần nhắc chạy/push, tách khỏi trang
// chủ để menu dưới có đúng 1 mục "Cài đặt".
(function () {
  'use strict';
  var C = window.Core;
  var el = function (id) { return document.getElementById(id); };
  var on = function (id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); };

  function boot() {
    var d = new Date();
    el('se-eyebrow').textContent = C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear();

    on('nt-toggle', 'click', function () { window.Notify.toggle(); });
    on('nt-time', 'change', function (e) { window.Notify.setTime(e.target.value); });
    on('nt-test', 'click', function () { window.Notify.test(); });
    on('nt-health', 'click', function () { window.Notify.health(); });

    window.Notify.init();
    C.registerSW();
  }

  boot();
})();
