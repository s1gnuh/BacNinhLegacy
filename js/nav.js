// Menu bar dùng chung cho mọi trang, đặt cố định ở đáy màn hình kiểu app di
// động: mỗi mục là 1 icon + nhãn ngắn. Mỗi trang chỉ cần có <nav id="navbar">
// rỗng, phần còn lại do file này dựng để không phải sửa nhiều chỗ mỗi lần
// đổi mục menu.
window.Nav = (function () {
  'use strict';
  var ICON = {
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
    plan: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    log: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
    stats: '<path d="M4 20V11M11 20V4M18 20v-6"/><path d="M3 20h18"/>',
    settings: '<circle cx="7" cy="8" r="2"/><path d="M3 8h2.3M8.7 8H21"/><circle cx="16" cy="15" r="2"/><path d="M3 15h11.3M18.7 15H21"/>'
  };
  var ITEMS = [
    { page: 'home', href: 'index.html', label: 'Trang chủ', icon: ICON.home },
    { page: 'plan', href: 'plan.html', label: 'Lịch tập', icon: ICON.plan },
    { page: 'log', href: 'log.html', label: 'Nhập nhanh', icon: ICON.log },
    { page: 'stats', href: 'stats.html', label: 'Thống kê', icon: ICON.stats },
    { page: 'settings', href: 'settings.html', label: 'Cài đặt', icon: ICON.settings }
  ];

  function current() {
    var f = (location.pathname.split('/').pop() || '').toLowerCase();
    if (f === 'plan.html') return 'plan';
    if (f === 'log.html') return 'log';
    if (f === 'stats.html') return 'stats';
    if (f === 'settings.html') return 'settings';
    return 'home'; // index.html, race.html và đường dẫn gốc đều thuộc nhánh trang chủ
  }

  function render() {
    var host = document.getElementById('navbar');
    if (!host) return;
    var cur = current();
    host.innerHTML = ITEMS.map(function (it) {
      var on = it.page === cur;
      return '<a class="navbar-item' + (on ? ' on' : '') + '" href="' + it.href + '"'
        + (on ? ' aria-current="page"' : '') + '>'
        + '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it.icon + '</svg>'
        + '<span class="nav-label">' + it.label + '</span></a>';
    }).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  return { render: render };
})();
