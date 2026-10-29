// Điều khiển log.html — trang Nhập nhanh: điền km / pace / thời gian cho một
// buổi chạy (hoặc chọn ảnh Strava để Gemini tự điền), lưu vào nhật ký, và
// sửa/xoá các buổi đã nhập. Hai trong ba số km / pace / thời gian suy ra được
// số còn lại nên chỉ cần nhập hai.
(function () {
  'use strict';
  var C = window.Core, RL = window.RunLog, B = window.Blocks, V = window.Vision;
  var el = function (id) { return document.getElementById(id); };
  var on = function (id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); };
  var NUM = ['km', 'pace', 'time'];
  var PAGE = 15;

  var runs = [];
  var editing = null;        // run đang sửa, null khi nhập mới
  var photo = null;          // { url, blobP, changed, own } — ảnh đang gắn vào form
  var auto = {};             // trường nào đang là số tự tính (không phải người dùng gõ)
  var seq = 0, aiBusy = false, shown = PAGE, armed = '', linkTarget = null;
  var dateTouched = false;   // đã tự chọn ngày thì AI không đè ngày đọc từ ảnh lên

  /* ================= trường nhập ================= */
  function field(f) { return el('qe-' + f); }
  function val(f) { var n = field(f); return n ? n.value.trim() : ''; }
  function setVal(f, v) { var n = field(f); if (n) n.value = v == null ? '' : v; }

  function paceFrom(km, sec) { return km > 0 && sec > 0 ? RL.formatTime(sec / km) : ''; }

  // Có đúng hai trường do người dùng (hoặc AI) điền thì tính trường còn lại.
  // Trường đang là "tự tính" luôn được tính lại khi hai trường kia đổi.
  function recalc() {
    var user = NUM.filter(function (f) { return val(f) && !auto[f]; });
    if (user.length < 2) {
      NUM.forEach(function (f) { if (auto[f]) setVal(f, ''); });
      auto = {};
    } else if (user.length === 2) {
      var miss = NUM.filter(function (f) { return user.indexOf(f) < 0; })[0];
      var km = Number(val('km').replace(',', '.')), p = RL.parseTime(val('pace')), t = RL.parseTime(val('time'));
      var out = '';
      if (miss === 'pace') out = paceFrom(km, t);
      else if (miss === 'time') out = km > 0 && p > 0 ? RL.formatTime(km * p) : '';
      else out = t > 0 && p > 0 ? String(Math.round(t / p * 100) / 100) : '';
      setVal(miss, out);
      if (out) auto[miss] = true; else delete auto[miss];
    }
    var names = { km: 'khoảng cách', pace: 'pace', time: 'thời gian' };
    var hint = NUM.filter(function (f) { return auto[f]; }).map(function (f) { return names[f]; });
    el('qe-calc').textContent = hint.length ? 'Tự tính ' + hint.join(', ') + ' từ hai số còn lại.' : '';
  }

  /* ================= API key Gemini ================= */
  function renderKey() { el('qe-key').hidden = V.hasKey(); }
  function saveKey() {
    var v = el('qe-key-in').value.trim();
    if (!v) { C.toast('Chưa lưu được', 'Dán API key vào ô trước'); return; }
    V.setKey(v);
    el('qe-key-in').value = '';
    renderKey();
    C.toast('Đã lưu API key', 'Chọn ảnh Strava để tự điền');
    // đã chọn ảnh trước khi có key thì đọc luôn, khỏi chọn lại
    if (photo && photo.file) pickFile(photo.file);
  }

  /* ================= ảnh + Gemini ================= */
  function setAi(html, cls) {
    var n = el('qe-ai');
    n.innerHTML = html;
    n.className = 'hint' + (cls ? ' ' + cls : '');
  }
  function showPhoto() {
    el('qe-photo').hidden = !photo;
    el('qe-drop').hidden = !!photo;
    if (photo) el('qe-img').src = photo.url;
  }
  function dropPhoto() {
    if (photo && photo.own) { try { URL.revokeObjectURL(photo.url); } catch (e) {} }
    photo = null; seq++; aiBusy = false;
    el('qe').classList.remove('reading');
    setAi('');
    showPhoto();
    updateSave();
  }

  function fillFromAi(d) {
    NUM.forEach(function (f) {
      var v = d[f];
      if (!v) return;
      // đừng đè lên số người dùng đã gõ tay trong lúc chờ
      if (!val(f) || auto[f]) { setVal(f, v); delete auto[f]; }
    });
    recalc();
  }

  function pickFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    if (photo && photo.own) { try { URL.revokeObjectURL(photo.url); } catch (e) {} }
    var mine = ++seq, t0 = Date.now();
    var url = URL.createObjectURL(file);
    var read = V.hasKey();
    var a = V.analyze(file, read);
    photo = { url: url, blobP: a.blob, changed: true, own: true, file: file };
    showPhoto();
    if (!read) {
      setAi('Chưa có API key Gemini nên chưa tự điền được. Dán key vào ô phía trên, hoặc nhập tay bên dưới.');
      updateSave();
      return;
    }
    aiBusy = true;
    el('qe').classList.add('reading');
    setAi('Đang đọc ảnh...', 'busy');
    updateSave();
    a.data.then(function (d) {
      if (mine !== seq) return;
      var got = NUM.filter(function (f) { return d[f]; }).length;
      fillFromAi(d);
      if (d.date && !dateTouched && d.date !== val('date')) { setVal('date', d.date); refreshLink(); }
      var s = Math.round((Date.now() - t0) / 100) / 10;
      setAi(got ? 'Đã tự điền trong ' + String(s).replace('.', ',') + ' giây. Kiểm tra lại số liệu trước khi lưu.'
                : 'Không đọc được số liệu nào trong ảnh. Nhập tay bên dưới.', got ? 'ok' : 'err');
    }).catch(function (e) {
      if (mine !== seq) return;
      setAi(C.esc(e.message || 'Không đọc được ảnh.'), 'err');
    }).then(function () {
      if (mine !== seq) return;
      aiBusy = false;
      el('qe').classList.remove('reading');
      updateSave();
    });
  }

  /* ================= liên kết với buổi trong Lịch tập ================= */
  // Buổi chưa đánh dấu của ngày `date`, ưu tiên giáo án đang chạy.
  function candidateFor(date) {
    var blocks = B.list().sort(function (a, b) { return (B.isActive(b) ? 1 : 0) - (B.isActive(a) ? 1 : 0); });
    for (var i = 0; i < blocks.length; i++) {
      var list = B.sessionsOf(blocks[i]).list;
      for (var j = 0; j < list.length; j++) {
        var x = list[j];
        if (x.s.type !== 'rest' && C.iso(x.date) === date && !blocks[i].done[x.id]) return { b: blocks[i], x: x };
      }
    }
    return null;
  }

  function refreshLink() {
    var box = el('qe-link');
    var date = val('date');
    linkTarget = !editing && date && el('qe-kind').value === 'run' ? candidateFor(date) : null;
    box.hidden = !linkTarget;
    if (linkTarget) el('qe-link-t').textContent = 'Đánh dấu xong buổi "' + linkTarget.x.s.title + '" trong Lịch tập';
  }

  /* ================= form ================= */
  function updateSave() {
    var b = el('qe-save');
    b.disabled = aiBusy;
    b.textContent = aiBusy ? 'Đang đọc ảnh...' : (editing ? 'Cập nhật' : 'Lưu buổi chạy');
  }

  function resetForm(keepDate) {
    var d = keepDate ? val('date') : '';
    editing = null;
    auto = {};
    dateTouched = false;
    ['km', 'pace', 'time', 'note'].forEach(function (f) { setVal(f, ''); });
    el('qe-kind').value = 'run';
    setVal('date', d || C.iso(C.today0()));
    el('qe-file').value = '';
    dropPhoto();
    el('qe-title').textContent = 'Buổi chạy mới';
    el('qe-cancel').hidden = true;
    el('qe-calc').textContent = '';
    refreshLink();
    updateSave();
  }

  function startEdit(r) {
    resetForm(false);
    editing = r;
    dateTouched = true;
    setVal('date', r.date);
    el('qe-kind').value = r.kind || 'run';
    setVal('km', r.km); setVal('pace', r.pace); setVal('time', r.time); setVal('note', r.note);
    if (r.url) {
      photo = { url: r.url, blobP: Promise.resolve(r.blob), changed: false, own: false };
      showPhoto();
    }
    el('qe-title').textContent = 'Sửa buổi chạy';
    el('qe-cancel').hidden = false;
    refreshLink();
    updateSave();
    el('qe').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ================= lưu ================= */
  function validate(km, pace, time, hasPhoto) {
    if (km && !(Number(km) > 0)) return 'Khoảng cách phải là số, ví dụ 5,2';
    if (pace && !/^\d{1,2}:\d{2}$/.test(pace)) return 'Pace nhập dạng phút:giây, ví dụ 6:30';
    if (time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) return 'Thời gian nhập dạng 32:30 hoặc 1:05:30';
    if (!km && !time && !photo && !hasPhoto) return 'Nhập khoảng cách hoặc thời gian, hoặc chọn một ảnh';
    return '';
  }

  function celebrate(t, anchor) {
    var full = B.weekComplete(t.b, t.x.wi);
    var tier = t.x.s.type === 'race' ? 'race' : full ? 'week' : t.x.s.type === 'long' ? 'long'
             : t.x.s.type === 'quality' ? 'quality' : 'easy';
    C.FX.party(tier, anchor);
  }

  function save() {
    if (aiBusy) return;
    var km = val('km').replace(',', '.'), pace = val('pace'), time = val('time');
    var err = validate(km, pace, time);
    if (err) { C.toast('Chưa lưu được', err); return; }
    if (!val('date')) { C.toast('Chưa lưu được', 'Chọn ngày chạy'); return; }

    var btn = el('qe-save');
    btn.disabled = true;
    var wasNew = !editing;
    var blobP = photo ? photo.blobP : Promise.resolve(null);
    blobP.then(function (blob) {
      var r = editing || RL.newRun({ blob: blob });
      r.date = val('date');
      r.kind = el('qe-kind').value;
      r.km = km; r.pace = pace; r.time = time;
      r.note = val('note');
      r.cat = (km || pace || time) ? 'strava' : 'photo';
      if (!photo) {
        if (r.url && editing) { try { URL.revokeObjectURL(r.url); } catch (e) {} }
        r.blob = null; r.url = '';
      } else if (photo.changed) {
        if (editing && r.url) { try { URL.revokeObjectURL(r.url); } catch (e) {} }
        r.blob = blob; r.url = URL.createObjectURL(blob);
      }
      var t = wasNew && el('qe-link-cb').checked ? linkTarget : null;
      if (t) { r.sessionId = t.x.id; r.blockId = t.b.id; }
      return RL.saveRun(r).then(function (ok) {
        if (ok === null) { C.toast('Không lưu được', 'Kiểm tra dung lượng trình duyệt'); return; }
        if (wasNew) runs.unshift(r);
        if (t) { B.setDone(t.b, t.x.id, true); celebrate(t, btn); }
        C.toast(wasNew ? 'Đã lưu buổi chạy' : 'Đã cập nhật',
                (r.km ? r.km + ' km' : '') + (r.km && r.time ? ' · ' : '') + (r.time || ''));
        resetForm(true);
        renderRecent();
        showStorage();
      });
    }).then(function () { updateSave(); }, function () {
      C.toast('Không lưu được', 'Thử lại'); updateSave();
    });
  }

  /* ================= danh sách gần đây ================= */
  function sorted() {
    return runs.slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '') || (b.added || 0) - (a.added || 0);
    });
  }

  function cardHtml(l) {
    var d = l.date ? C.fromIso(l.date) : null;
    var top = d ? C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear() : 'Không rõ ngày';
    var tags = RL.KIND[l.kind] && l.kind !== 'run' ? ' · ' + RL.KIND[l.kind] : '';
    var bits = [];
    if (l.km) bits.push(l.km + ' km');
    if (l.time) bits.push(l.time);
    if (l.pace) bits.push(l.pace + '/km');
    var thumb = l.url ? '<div class="lg-thumb"><img src="' + l.url + '" loading="lazy" alt=""></div>'
                      : '<div class="lg-thumb qe-nophoto" aria-hidden="true">' + (l.km ? C.esc(l.km) : '–') + '</div>';
    return '<article class="lg lg-mini' + (l.cat === 'photo' ? ' photo' : '') + '" data-id="' + l.id + '">'
      + thumb
      + '<div class="lg-mini-body">'
      + '<div class="lg-mini-top">' + top + tags + (l.cat === 'photo' ? ' · Ảnh chạy' : '') + '</div>'
      + '<div class="lg-mini-stats">' + (bits.length ? bits.join(' · ') : '—') + '</div>'
      + (l.note ? '<div class="hint">' + C.esc(l.note) + '</div>' : '')
      + '</div>'
      + '<div class="lg-acts">'
      + '<button type="button" class="btn-sm" data-act="edit">Sửa</button>'
      + '<button type="button" class="btn-sm"' + (armed === l.id ? ' data-armed="1"' : '') + ' data-act="del">'
      + (armed === l.id ? 'Chắc chắn?' : 'Xóa') + '</button>'
      + '</div></article>';
  }

  function renderRecent() {
    var all = sorted();
    el('qe-recent-wrap').hidden = !all.length;
    el('qe-recent').innerHTML = all.slice(0, shown).map(cardHtml).join('');
    el('qe-more').hidden = all.length <= shown;
  }

  function findRun(id) {
    for (var i = 0; i < runs.length; i++) if (runs[i].id === id) return runs[i];
    return null;
  }

  function onRecentClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-act]') : null;
    var art = btn && btn.closest('[data-id]');
    var r = art && findRun(art.getAttribute('data-id'));
    if (!r) return;
    if (btn.getAttribute('data-act') === 'edit') { armed = ''; startEdit(r); renderRecent(); return; }
    if (armed !== r.id) { armed = r.id; renderRecent(); return; }
    RL.removeRun(r.id).then(function () {
      if (r.url) { try { URL.revokeObjectURL(r.url); } catch (x) {} }
      runs = runs.filter(function (q) { return q.id !== r.id; });
      armed = '';
      if (editing && editing.id === r.id) resetForm(true);
      renderRecent();
      showStorage();
      C.toast('Đã xóa', '');
    });
  }

  /* ================= lưu bền + dung lượng ================= */
  function askPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (p) {
          if (!p) navigator.storage.persist().catch(function () {});
        });
      }
    } catch (e) {}
  }
  function showStorage() {
    var node = el('log-storage');
    if (!node) return;
    try {
      if (!navigator.storage || !navigator.storage.estimate) { node.textContent = ''; return; }
      navigator.storage.estimate().then(function (est) {
        var mb = (est.usage || 0) / 1048576;
        node.textContent = runs.length + ' buổi đã ghi · đang dùng ' + (Math.round(mb * 10) / 10) + ' MB';
      }).catch(function () { node.textContent = ''; });
    } catch (e) { node.textContent = ''; }
  }

  /* ================= nhập hàng loạt ================= */
  // Mỗi ảnh là một dòng với số liệu Gemini đọc được; người dùng soát lại rồi
  // lưu tất cả một lần. Chỉ đọc song song vài ảnh một lúc để khỏi dính giới
  // hạn tốc độ của Gemini và khỏi giải mã hàng chục ảnh lớn cùng lúc.
  var BULK_PAR = 3;
  var rows = [], queue = [], active = 0;

  function rowEl(id) { return el('qb-list').querySelector('[data-row="' + id + '"]'); }
  function rowIn(id, f) { var r = rowEl(id); return r ? r.querySelector('[data-f="' + f + '"]') : null; }
  function rowVal(id, f) { var n = rowIn(id, f); return n ? n.value.trim() : ''; }
  function rowSet(id, f, v) { var n = rowIn(id, f); if (n) n.value = v == null ? '' : v; }
  function rowStatus(row, text, cls) {
    var n = rowEl(row.id) && rowEl(row.id).querySelector('[data-st]');
    if (!n) return;
    n.textContent = text;
    n.className = 'qb-st' + (cls ? ' ' + cls : '');
  }
  function findRow(id) { for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i]; return null; }
  function bulkOn() { return !el('qb').hidden; }

  function isoOf(ms) {
    var d = ms ? new Date(ms) : new Date();
    return isNaN(d) ? C.iso(C.today0()) : C.iso(d);
  }

  // Có đúng hai trong ba số thì tính số còn lại (cùng công thức như form đơn).
  function deriveRow(id) {
    var km = rowVal(id, 'km').replace(',', '.'), pace = rowVal(id, 'pace'), time = rowVal(id, 'time');
    var have = (km ? 1 : 0) + (pace ? 1 : 0) + (time ? 1 : 0);
    if (have !== 2) return;
    var k = Number(km), p = RL.parseTime(pace), t = RL.parseTime(time);
    if (!km) { if (t > 0 && p > 0) rowSet(id, 'km', String(Math.round(t / p * 100) / 100)); }
    else if (!pace) { if (k > 0 && t > 0) rowSet(id, 'pace', RL.formatTime(t / k)); }
    else if (k > 0 && p > 0) rowSet(id, 'time', RL.formatTime(k * p));
  }

  function dupOf(id) {
    var date = rowVal(id, 'date'), km = Number(rowVal(id, 'km').replace(',', '.'));
    if (!date || !(km > 0)) return false;
    return runs.some(function (r) { return r.date === date && Math.abs((Number(r.km) || 0) - km) <= 0.05; });
  }

  function rowHtml(row) {
    return '<article class="qb-row" data-row="' + row.id + '">'
      + '<div class="qb-thumb"><img src="' + row.url + '" alt=""></div>'
      + '<div class="qb-main">'
      + '<div class="qb-st busy" data-st>Chờ đọc...</div>'
      + '<div class="qb-fields">'
      + '<label class="fld"><span>Ngày</span><input type="date" data-f="date" value="' + row.date + '"></label>'
      + '<label class="fld"><span>Km</span><input type="text" inputmode="decimal" data-f="km" autocomplete="off"></label>'
      + '<label class="fld"><span>Pace</span><input type="text" inputmode="numeric" data-f="pace" autocomplete="off"></label>'
      + '<label class="fld"><span>Thời gian</span><input type="text" inputmode="numeric" data-f="time" autocomplete="off"></label>'
      + '</div></div>'
      + '<div class="qb-side">'
      + '<label class="qb-use"><input type="checkbox" data-f="use" checked> Lưu</label>'
      + '<button type="button" class="btn-sm" data-act="rm">Bỏ</button>'
      + '</div></article>';
  }

  function bulkRefresh() {
    var pending = rows.filter(function (r) { return r.state === 'wait' || r.state === 'read'; }).length;
    var use = rows.filter(function (r) { return rowIn(r.id, 'use') && rowIn(r.id, 'use').checked; }).length;
    el('qb-sum').textContent = rows.length + ' ảnh' + (pending ? ' · đang đọc ' + pending : '') + ' · sẽ lưu ' + use;
    var b = el('qb-save');
    b.disabled = pending > 0 || !use;
    b.textContent = pending ? 'Đang đọc ảnh...' : 'Lưu ' + use + ' buổi';
  }

  function pump() {
    while (active < BULK_PAR && queue.length) {
      var row = queue.shift();
      if (!findRow(row.id)) continue;          // đã bị bỏ khi còn chờ
      active++;
      readRow(row).then(function () { active--; pump(); bulkRefresh(); });
    }
  }

  function readRow(row) {
    var read = V.hasKey();
    row.state = 'read';
    rowStatus(row, read ? 'Đang đọc ảnh...' : 'Chưa có API key, nhập tay', 'busy');
    var a = V.analyze(row.file, read);
    row.blobP = a.blob;
    if (!read) { row.state = 'ok'; rowStatus(row, 'Nhập tay số liệu', ''); return Promise.resolve(); }
    return a.data.then(function (d) {
      if (!findRow(row.id)) return;
      var got = NUM.filter(function (f) { return d[f]; }).length;
      NUM.forEach(function (f) { if (d[f]) rowSet(row.id, f, d[f]); });
      if (d.date) rowSet(row.id, 'date', d.date);
      deriveRow(row.id);
      row.state = 'ok';
      var dup = dupOf(row.id);
      if (dup && rowIn(row.id, 'use')) rowIn(row.id, 'use').checked = false;
      rowStatus(row, dup ? 'Có vẻ trùng với buổi đã lưu (cùng ngày, cùng km), đã bỏ tick'
                   : got ? (d.date ? 'Đã đọc xong' : 'Đã đọc, ngày lấy theo thời điểm chụp ảnh') : 'Không đọc được số liệu, nhập tay',
                got ? (dup ? 'err' : 'ok') : 'err');
    }).catch(function (e) {
      if (!findRow(row.id)) return;
      row.state = 'ok';
      rowStatus(row, e.message || 'Không đọc được ảnh', 'err');
    });
  }

  function addBulk(files) {
    if (!files.length) return;
    if (!bulkOn()) {
      if (photo || val('km') || val('time') || val('pace')) {
        // đang dở một form đơn: giữ nguyên, người dùng tự lưu hoặc hủy trước
        C.toast('Đang nhập dở một buổi', 'Lưu hoặc hủy buổi đó trước khi nhập hàng loạt');
        return;
      }
      el('qe').hidden = true;
      el('qb').hidden = false;
      el('qb-note').textContent = V.hasKey() ? 'Gemini đọc từng ảnh. Soát lại số liệu rồi bấm lưu.'
        : 'Chưa có API key Gemini nên không tự đọc được. Thêm ở Cài đặt, hoặc nhập tay từng dòng.';
    }
    files.forEach(function (f) {
      var row = { id: C.uid('b'), file: f, url: URL.createObjectURL(f), date: isoOf(f.lastModified),
                  state: 'wait', blobP: null };
      rows.push(row);
      el('qb-list').insertAdjacentHTML('beforeend', rowHtml(row));
      queue.push(row);
    });
    bulkRefresh();
    pump();
  }

  function closeBulk() {
    rows.forEach(function (r) { try { URL.revokeObjectURL(r.url); } catch (e) {} });
    rows = []; queue = [];
    el('qb-list').innerHTML = '';
    el('qb').hidden = true;
    el('qe').hidden = false;
    el('qe-file').value = ''; el('qb-file').value = '';
  }

  function removeRow(id) {
    var row = findRow(id);
    if (!row) return;
    try { URL.revokeObjectURL(row.url); } catch (e) {}
    rows = rows.filter(function (r) { return r.id !== id; });
    var n = rowEl(id); if (n && n.parentNode) n.parentNode.removeChild(n);
    if (!rows.length) closeBulk(); else bulkRefresh();
  }

  function saveBulk() {
    var btn = el('qb-save');
    var link = el('qb-link').checked;
    var todo = rows.filter(function (r) { return rowIn(r.id, 'use') && rowIn(r.id, 'use').checked; });
    var saved = 0, linked = 0, failed = 0;
    btn.disabled = true;
    todo.reduce(function (p, row) {
      return p.then(function () {
        var date = rowVal(row.id, 'date'), km = rowVal(row.id, 'km').replace(',', '.');
        var pace = rowVal(row.id, 'pace'), time = rowVal(row.id, 'time');
        var err = !date ? 'Thiếu ngày' : validate(km, pace, time, true);
        if (err) { failed++; rowStatus(row, err, 'err'); return null; }
        return row.blobP.then(function (blob) {
          var r = RL.newRun({ blob: blob });
          r.date = date; r.kind = 'run'; r.km = km; r.pace = pace; r.time = time;
          r.cat = (km || pace || time) ? 'strava' : 'photo';
          var t = link && r.cat === 'strava' ? candidateFor(date) : null;
          if (t) { r.sessionId = t.x.id; r.blockId = t.b.id; }
          return RL.saveRun(r).then(function (ok) {
            if (ok === null) { failed++; rowStatus(row, 'Không lưu được', 'err'); return; }
            runs.unshift(r); saved++;
            if (t) { B.setDone(t.b, t.x.id, true); linked++; }
            removeRowSilently(row.id);
          });
        });
      });
    }, Promise.resolve()).then(function () {
      if (saved) {
        C.toast('Đã lưu ' + saved + ' buổi chạy', (linked ? linked + ' buổi được đánh dấu trong Lịch tập' : '') + (failed ? (linked ? ' · ' : '') + failed + ' dòng lỗi' : ''));
        if (linked) C.FX.party(linked > 1 ? 'week' : 'easy', btn);
      }
      renderRecent(); showStorage();
      if (!rows.length) closeBulk(); else bulkRefresh();
    });
  }
  function removeRowSilently(id) {
    var row = findRow(id);
    if (row) { try { URL.revokeObjectURL(row.url); } catch (e) {} }
    rows = rows.filter(function (r) { return r.id !== id; });
    var n = rowEl(id); if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  function pickFiles(list) {
    var arr = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!arr.length) return;
    if (arr.length > 1 || bulkOn()) addBulk(arr); else pickFile(arr[0]);
  }

  /* ================= boot ================= */
  function bind() {
    on('qe-file', 'change', function (e) { pickFiles(e.target.files); e.target.value = ''; });
    on('qb-file', 'change', function (e) { pickFiles(e.target.files); e.target.value = ''; });
    on('qb-save', 'click', saveBulk);
    on('qb-cancel', 'click', closeBulk);
    on('qb-list', 'click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act="rm"]') : null;
      var art = b && b.closest('[data-row]');
      if (art) removeRow(art.getAttribute('data-row'));
    });
    on('qb-list', 'change', function (e) {
      var art = e.target.closest ? e.target.closest('[data-row]') : null;
      if (!art) return;
      var f = e.target.getAttribute('data-f');
      if (f === 'km' || f === 'pace' || f === 'time') deriveRow(art.getAttribute('data-row'));
      bulkRefresh();
    });
    on('qe-key-save', 'click', saveKey);
    on('qe-key-in', 'keydown', function (e) { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); saveKey(); } });
    on('qe-clear', 'click', function () { el('qe-file').value = ''; dropPhoto(); });
    var drop = el('qe-drop');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('over');
      pickFiles(e.dataTransfer && e.dataTransfer.files);
    });
    document.addEventListener('paste', function (e) {
      var fs = e.clipboardData && e.clipboardData.files;
      if (fs && fs.length && /^image\//.test(fs[0].type)) { e.preventDefault(); pickFiles(fs); }
    });

    NUM.forEach(function (f) {
      field(f).addEventListener('input', function () { delete auto[f]; recalc(); });
    });
    on('qe-date', 'change', function () { dateTouched = true; refreshLink(); });
    on('qe-kind', 'change', refreshLink);
    on('qe-save', 'click', save);
    on('qe-cancel', 'click', function () { resetForm(true); });
    on('qe-recent', 'click', onRecentClick);
    on('qe-more', 'click', function () { shown += PAGE; renderRecent(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'file') {
        e.preventDefault(); save();
      }
    });
  }

  function boot() {
    C.registerSW();
    var now = new Date();
    el('log-eyebrow').textContent = C.WD[(now.getDay() + 6) % 7] + ', ' + C.fmt(now) + '/' + now.getFullYear();
    askPersist();
    bind();
    renderKey();
    var want = C.qs('date');
    resetForm(false);
    if (want && /^\d{4}-\d{2}-\d{2}$/.test(want)) { setVal('date', want); dateTouched = true; refreshLink(); }

    RL.openDB().then(function () { return RL.loadRuns(); }).then(function (all) {
      runs = all;
      renderRecent();
      showStorage();
      var id = C.qs('edit'), r = id && findRun(id);
      if (r) startEdit(r);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
