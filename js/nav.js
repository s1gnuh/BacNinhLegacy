// Menu bar dùng chung cho mọi trang. Mỗi trang chỉ cần có <nav id="navbar">
// rỗng ở đầu .wrap, phần còn lại do file này dựng để không phải sửa 4 chỗ
// mỗi lần đổi mục menu.
window.Nav = (function () {
  'use strict';
  var ITEMS = [
    { page: 'home', href: 'index.html', label: 'Trang chủ' },
    { page: 'plan', href: 'plan.html', label: 'Lịch tập' },
    { page: 'log', href: 'log.html', label: 'Nhật ký' }
  ];

  function current() {
    var f = (location.pathname.split('/').pop() || '').toLowerCase();
    if (f === 'plan.html') return 'plan';
    if (f === 'log.html') return 'log';
    return 'home'; // index.html, race.html và đường dẫn gốc đều thuộc nhánh trang chủ
  }

  function render() {
    var host = document.getElementById('navbar');
    if (!host) return;
    var cur = current();
    host.innerHTML = ITEMS.map(function (it) {
      var on = it.page === cur;
      return '<a class="navbar-item' + (on ? ' on' : '') + '" href="' + it.href + '"'
        + (on ? ' aria-current="page"' : '') + '>' + it.label + '</a>';
    }).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  return { render: render };
})();
