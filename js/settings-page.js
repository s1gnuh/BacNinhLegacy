// Điều khiển settings.html — nhắc chạy/push và sao lưu/khôi phục dữ liệu.
(function () {
  'use strict';
  var C = window.Core, B = window.Backup;
  var el = function (id) { return document.getElementById(id); };
  var on = function (id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); };

  var pending = null;   // dữ liệu đã đọc từ file, đang chờ bấm xác nhận

  function status(msg) { var n = el('bk-status'); if (n) n.textContent = msg || ''; }
  function busy(v) {
    ['bk-export', 'bk-import', 'bk-confirm'].forEach(function (id) {
      var n = el(id); if (n) n.disabled = !!v;
    });
  }
  function fmtSize(bytes) {
    if (bytes < 1024 * 1024) return (Math.round(bytes / 1024 * 10) / 10).toString().replace('.', ',') + ' KB';
    return (Math.round(bytes / 1048576 * 10) / 10).toString().replace('.', ',') + ' MB';
  }
  function clearPending() {
    pending = null;
    var n = el('bk-confirm'); if (n) n.hidden = true;
    var f = el('bk-file'); if (f) f.value = '';
  }

  /* ---------- xuất ---------- */
  function doExport() {
    busy(true);
    status('Đang gói dữ liệu...');
    B.exportAll(function (done, total) {
      if (total) status('Đang gói ảnh ' + done + '/' + total + '...');
    }).then(function (r) {
      busy(false);
      if (r.how === 'cancelled') { status('Đã huỷ.'); return; }
      status('Xong: ' + r.name + ' · ' + r.runs + ' bản ghi · ' + fmtSize(r.bytes)
        + (r.how === 'shared' ? '. Chọn "Lưu vào Tệp" để giữ lại.' : '.'));
      C.toast('Đã xuất dữ liệu', fmtSize(r.bytes));
    }).catch(function () {
      busy(false);
      status('Không xuất được dữ liệu. Thử lại hoặc kiểm tra dung lượng máy.');
    });
  }

  /* ---------- nhập ---------- */
  function readFile(file) {
    if (!file) return;
    busy(true);
    status('Đang đọc file...');
    var fr = new FileReader();
    fr.onload = function () {
      busy(false);
      try {
        pending = B.parse(String(fr.result));
      } catch (e) {
        clearPending();
        status('File không đúng định dạng sao lưu của app.');
        return;
      }
      var s = B.summary(pending);
      var when = '';
      try { when = new Date(s.exportedAt).toLocaleDateString('vi-VN'); } catch (e) {}
      status('File' + (when ? ' ngày ' + when : '') + ': ' + s.races + ' giải · ' + s.blocks
        + ' giáo án · ' + s.done + ' buổi đã đánh dấu · ' + s.goals + ' mục tiêu · '
        + s.photos + ' ảnh. Bấm "Xác nhận khôi phục" để gộp vào dữ liệu hiện có.');
      el('bk-confirm').hidden = false;
    };
    fr.onerror = function () { busy(false); clearPending(); status('Không đọc được file.'); };
    fr.readAsText(file);
  }

  function doImport() {
    if (!pending) return;
    busy(true);
    status('Đang khôi phục...');
    B.apply(pending).then(function () {
      status('Đã khôi phục xong. Đang tải lại app...');
      C.toast('Đã khôi phục dữ liệu', 'App sẽ tải lại');
      setTimeout(function () { window.location.reload(); }, 1200);
    }).catch(function () {
      busy(false);
      clearPending();
      status('Khôi phục thất bại. Dữ liệu cũ vẫn còn nguyên.');
    });
  }

  function boot() {
    var d = new Date();
    el('se-eyebrow').textContent = C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear();

    on('nt-toggle', 'click', function () { window.Notify.toggle(); });
    on('nt-time', 'change', function (e) { window.Notify.setTime(e.target.value); });
    on('nt-test', 'click', function () { window.Notify.test(); });
    on('nt-health', 'click', function () { window.Notify.health(); });

    on('bk-export', 'click', doExport);
    on('bk-import', 'click', function () { clearPending(); status(''); el('bk-file').click(); });
    on('bk-file', 'change', function (e) { readFile(e.target.files && e.target.files[0]); });
    on('bk-confirm', 'click', doImport);

    window.Notify.init();
    C.registerSW();
  }

  boot();
})();
