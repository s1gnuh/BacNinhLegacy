// Điều khiển plan.html — trang Lịch tập toàn cục. Gộp buổi tập của mọi
// giáo án đang theo (hoặc lọc về một giáo án), hiện lịch tháng, chi tiết
// từng ngày và lịch tuần, đánh dấu buổi đã chạy ngay tại đây.
(function () {
  'use strict';
  var C = window.Core, B = window.Blocks, R = window.Races, RL = window.RunLog;
  var el = function (id) { return document.getElementById(id); };
  var on = function (id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); };
  var MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  var SEP = '::';

  var blocks = [], runs = [], sel = 'all', calMonth = null, calSel = '';
  // buổi đang sửa / đang chờ xác nhận xóa: "blockId::sessionId", hoặc "run:<id>" cho nhật ký
  var editKey = '', armedKey = '';
  var adaptItems = [], runsReady = false;
  var zones = null;   // vùng pace gợi ý từ kết quả thực tế (Predict), null khi chưa đủ dữ liệu

  /* ================= truy vấn ================= */
  function raceName(b) {
    var race = R.get(b.raceId);
    return race ? race.name : 'Giáo án chưa gắn giải';
  }
  function selected() {
    return sel === 'all' ? blocks : blocks.filter(function (b) { return b.id === sel; });
  }
  function singleBlock() {
    var s = selected();
    return s.length === 1 ? s[0] : null;
  }
  // Mọi buổi tập (trừ ngày nghỉ) của các giáo án đang xem, sắp theo ngày.
  function entries() {
    var out = [];
    selected().forEach(function (b) {
      B.sessionsOf(b).list.forEach(function (x) {
        if (x.s.type === 'rest') return;
        out.push({ b: b, x: x });
      });
    });
    out.sort(function (p, q) { return p.x.date - q.x.date || p.x.si - q.x.si; });
    return out;
  }
  function byDate() {
    var m = {};
    entries().forEach(function (e) { var k = C.iso(e.x.date); (m[k] = m[k] || []).push(e); });
    return m;
  }
  function photosOn(key) {
    return runs.filter(function (r) { return r.date === key; });
  }
  function bounds() {
    var list = entries();
    if (!list.length) return null;
    return { first: list[0].x.date, last: list[list.length - 1].x.date };
  }
  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

  /* ================= ô chọn giáo án ================= */
  function renderPick() {
    var pick = el('p-pick');
    var opts = [];
    if (blocks.length > 1) opts.push('<option value="all"' + (sel === 'all' ? ' selected' : '') + '>Tất cả giáo án (' + blocks.length + ')</option>');
    blocks.forEach(function (b) {
      opts.push('<option value="' + b.id + '"' + (sel === b.id ? ' selected' : '') + '>'
        + C.esc(raceName(b)) + (B.isActive(b) ? ' · đang chạy' : '') + '</option>');
    });
    pick.innerHTML = opts.join('');
    el('p-pick-wrap').hidden = blocks.length < 2 && !singleBlock();

    var one = singleBlock(), txt = '';
    if (one) {
      var st = B.stats(one), race = R.get(one.raceId);
      txt = st.n + '/' + st.total + ' buổi đã chạy · ' + C.fmtKm(st.km) + ' km'
        + (race ? ' · thi ngày ' + C.fmt(C.fromIso(race.date)) + '/' + C.fromIso(race.date).getFullYear() : '');
    } else {
      var n = 0, tot = 0;
      blocks.forEach(function (b) { var s = B.stats(b); n += s.n; tot += s.total; });
      txt = blocks.length + ' giáo án · ' + n + '/' + tot + ' buổi đã chạy';
    }
    el('p-sum').textContent = txt;
  }

  /* ================= lịch tháng ================= */
  function renderCal() {
    var box = el('p-cal');
    if (!box) return;
    var b = bounds(), t0 = C.today0();
    if (!calMonth) {
      calMonth = b && t0 >= monthStart(b.first) && t0 <= b.last ? monthStart(t0) : monthStart(b ? b.first : t0);
    }
    el('p-cal-title').textContent = MONTHS[calMonth.getMonth()] + '/' + calMonth.getFullYear();
    if (b) {
      el('p-prev').disabled = calMonth <= monthStart(b.first);
      el('p-next').disabled = calMonth >= monthStart(b.last);
    }
    var map = byDate();
    var offset = (calMonth.getDay() + 6) % 7;
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1 - offset + i);
      var key = C.iso(d), list = map[key] || [];
      var cls = ['cday'];
      if (!sameMonth(d, calMonth)) cls.push('out');
      if (key === C.iso(t0)) cls.push('today');
      if (key === calSel) cls.push('sel');
      if (list.length && list.every(function (e) { return !!e.b.done[e.x.id]; })) cls.push('done');
      var dots = list.slice(0, 3).map(function (e) { return '<i class="cd-dot t-' + e.x.s.type + '"></i>'; }).join('');
      var names = list.map(function (e) { return e.x.s.title; }).join(', ');
      cells += '<button type="button" class="' + cls.join(' ') + '" data-day="' + key + '"'
        + ' aria-label="' + C.fmt(d) + (names ? ', ' + C.esc(names) : ', không có buổi chạy') + '">'
        + '<span class="cd-num num">' + d.getDate() + '</span>'
        + (dots ? '<span class="cd-dots">' + dots + '</span>' : '')
        + (photosOn(key).length ? '<i class="cd-pic"></i>' : '')
        + '</button>';
    }
    box.innerHTML = cells;
  }

  /* ================= sửa / xóa buổi tập ================= */
  var TYPES = [['easy', 'Nhẹ'], ['quality', 'Chất lượng'], ['long', 'Dài']];

  function isArmed(key) { return armedKey === key; }
  function delBtn(key, cls) {
    return '<button type="button" class="btn-sm"' + (isArmed(key) ? ' data-armed="1"' : '')
      + ' data-act="del" data-k="' + key + '">' + (isArmed(key) ? 'Chắc chắn xóa?' : 'Xóa') + '</button>';
  }
  function actsHtml(key, x) {
    return '<button type="button" class="btn-sm" data-act="edit" data-k="' + key + '">Sửa</button>'
      + (x.adj ? '<button type="button" class="btn-sm" data-act="reset-edit" data-k="' + key + '">Hoàn tác</button>' : '')
      + (x.s.type === 'race' ? '' : delBtn(key));
  }

  function editorHtml(key, x) {
    var s = x.s, race = s.type === 'race';
    return '<div class="sess-edit" data-ed="' + key + '">'
      + '<label class="fld"><span>Loại</span><select data-sf="type"' + (race ? ' disabled' : '') + '>'
      + (race ? '<option selected>Thi đấu</option>'
              : TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (s.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join(''))
      + '</select></label>'
      + '<label class="fld"><span>Km</span><input type="text" inputmode="decimal" data-sf="km" value="' + C.esc(String(s.km || 0)) + '"></label>'
      + '<label class="fld wide"><span>Tên buổi</span><input type="text" data-sf="title" value="' + C.esc(s.title) + '"></label>'
      + '<label class="fld wide"><span>Mô tả</span><textarea data-sf="d">' + C.esc(s.d || '') + '</textarea></label>'
      + '<div class="lg-actions">'
      + '<button type="button" class="btn-sm primary" data-act="save-edit" data-k="' + key + '">Lưu</button>'
      + '<button type="button" class="btn-sm" data-act="cancel-edit">Hủy</button>'
      + (x.edited ? '<button type="button" class="btn-sm" data-act="reset-edit" data-k="' + key + '">Về bản gốc</button>' : '')
      + '</div></div>';
  }

  function blockOf(key) { return B.get(key.split(SEP)[0]); }
  function sidOf(key) { return key.split(SEP)[1]; }
  function syncBlock(b) { for (var i = 0; i < blocks.length; i++) if (blocks[i].id === b.id) blocks[i] = b; }
  function entryOf(key) {
    var list = entries();
    for (var i = 0; i < list.length; i++) if (list[i].b.id + SEP + list[i].x.id === key) return list[i];
    return null;
  }

  function onAct(e) {
    var btn = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-act'), key = btn.getAttribute('data-k') || '';
    var b;

    if (act === 'adapt' || act === 'adapt-all') {
      applyAdapt(act === 'adapt' ? [adaptItems[Number(key)]] : adaptItems.slice());
    } else if (act === 'edit') {
      var en = entryOf(key);
      if (!en) return;
      armedKey = ''; editKey = key;
      // mở sửa từ lịch tuần thì nhảy sang đúng ngày để dùng chung một form
      calSel = C.iso(en.x.date); calMonth = monthStart(en.x.date);
      renderAll();
      var t = el('p-day'); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (act === 'cancel-edit') {
      editKey = ''; renderAll();
    } else if (act === 'save-edit') {
      b = blockOf(key);
      var box = btn.closest('[data-ed]');
      if (!b || !box) return;
      var patch = {};
      [].forEach.call(box.querySelectorAll('[data-sf]'), function (n) {
        if (!n.disabled) patch[n.getAttribute('data-sf')] = n.value;
      });
      if (patch.km !== undefined) patch.km = String(patch.km).replace(',', '.');
      if (patch.title !== undefined && !patch.title.trim()) { C.toast('Chưa lưu được', 'Tên buổi không được để trống'); return; }
      syncBlock(B.editSession(b, sidOf(key), patch));
      editKey = ''; renderAll(); C.toast('Đã sửa buổi tập', '');
    } else if (act === 'reset-edit') {
      b = blockOf(key);
      if (!b) return;
      syncBlock(B.resetSession(b, sidOf(key)));
      editKey = ''; renderAll(); C.toast('Đã về bản gốc', '');
    } else if (act === 'del') {
      if (armedKey !== key) { armedKey = key; renderAll(); return; }
      b = blockOf(key);
      if (!b) return;
      syncBlock(B.removeSession(b, sidOf(key)));
      armedKey = ''; editKey = ''; renderAll(); C.toast('Đã xóa buổi tập', 'Khôi phục ở mục "Buổi đã xóa"');
    } else if (act === 'restore') {
      b = blockOf(key);
      if (!b) return;
      syncBlock(B.restoreSession(b, sidOf(key)));
      renderAll(); C.toast('Đã khôi phục buổi tập', '');
    } else if (act === 'run-del') {
      if (armedKey !== 'run:' + key) { armedKey = 'run:' + key; renderDay(); return; }
      RL.removeRun(key).then(function () {
        runs = runs.filter(function (r) { return r.id !== key; });
        armedKey = ''; renderCal(); renderDay(); C.toast('Đã xóa nhật ký', '');
      });
    }
  }

  function renderRemoved() {
    var wrap = el('p-removed-wrap'), box = el('p-removed');
    if (!wrap || !box) return;
    var rows = [];
    selected().forEach(function (b) {
      B.sessionsOf(b, { includeRemoved: true }).list.forEach(function (x) {
        if (x.removed) rows.push({ b: b, x: x });
      });
    });
    wrap.hidden = !rows.length;
    box.innerHTML = rows.map(function (r) {
      return '<div class="removed-item"><span class="chip t-' + r.x.s.type + '">' + C.LABEL[r.x.s.type] + '</span>'
        + '<strong>' + C.esc(r.x.s.title) + '</strong>'
        + '<span class="hint">' + C.fmt(r.x.date) + '/' + r.x.date.getFullYear()
        + (sel === 'all' && blocks.length > 1 ? ' · ' + C.esc(raceName(r.b)) : '') + '</span>'
        + '<button type="button" class="btn-sm" data-act="restore" data-k="' + r.b.id + SEP + r.x.id + '">Khôi phục</button></div>';
    }).join('');
  }

  /* ================= chi tiết một ngày ================= */
  function renderDay() {
    var box = el('p-day');
    if (!box) return;
    if (!calSel) { box.innerHTML = '<p class="hint">Bấm vào một ngày trong lịch để xem buổi tập và ảnh của ngày đó.</p>'; return; }
    var d = C.fromIso(calSel);
    var list = byDate()[calSel] || [];
    var pics = photosOn(calSel);
    var html = '<div class="cdh"><strong>' + C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear() + '</strong></div>';

    if (!list.length) {
      html += '<p class="hint">Không có buổi nào trong giáo án vào ngày này.</p>';
    } else {
      html += list.map(function (e) {
        var dn = !!e.b.done[e.x.id];
        var multi = sel === 'all' && blocks.length > 1;
        var key = e.b.id + SEP + e.x.id;
        return '<div class="cdb">'
          + '<input type="checkbox" data-done="' + key + '"' + (dn ? ' checked' : '')
          + ' aria-label="Đã chạy ' + C.esc(e.x.s.title) + '">'
          + '<span class="chip t-' + e.x.s.type + '">' + C.LABEL[e.x.s.type] + '</span>'
          + '<span class="cdt">' + C.esc(e.x.s.title) + '</span>'
          + (e.x.edited ? '<span class="tag-edited">' + (e.x.adj ? 'tự điều chỉnh' : 'đã sửa') + '</span>' : '')
          + (multi ? '<span class="hint">' + C.esc(raceName(e.b)) + '</span>' : '')
          + '<span class="cdb-acts">' + actsHtml(key, e.x) + '</span>'
          + '<span class="kmv num">' + C.fmtKm(e.x.s.km) + ' km</span>'
          + '</div>'
          + (editKey === key ? editorHtml(key, e.x)
              : (e.x.s.d ? '<p class="cdn">' + C.esc(e.x.s.d) + '</p>' : '')
                + (e.x.adj ? '<p class="cdn adj-why">' + C.esc(e.x.adj.why) + '</p>' : '')
                + (dn || !window.Predict.hintFor(e.x.s.type, zones) ? ''
                    : '<p class="cdn pace-hint">' + C.esc(window.Predict.hintFor(e.x.s.type, zones)) + '</p>'));
      }).join('');
    }

    if (pics.length) {
      html += '<div class="cal-cards">' + pics.map(function (l) {
        var bits = [];
        if (l.km) bits.push(l.km + ' km');
        if (l.time) bits.push(l.time);
        if (l.pace) bits.push(l.pace + '/km');
        var armed = armedKey === 'run:' + l.id;
        return '<article class="lg lg-mini' + (l.cat === 'photo' ? ' photo' : '') + '">'
          + (l.url ? '<div class="lg-thumb"><img src="' + l.url + '" loading="lazy" alt=""></div>'
                   : '<div class="lg-thumb qe-nophoto" aria-hidden="true">' + (l.km ? C.esc(l.km) : '–') + '</div>')
          + '<div class="lg-mini-body">'
          + '<div class="lg-mini-top">' + (l.cat === 'photo' ? 'Ảnh chạy' : 'Nhật ký chạy') + '</div>'
          + '<div class="lg-mini-stats">' + (bits.length ? bits.join(' · ') : '—') + '</div>'
          + (l.note ? '<div class="hint">' + C.esc(l.note) + '</div>' : '')
          + '</div>'
          + '<div class="lg-acts">'
          + '<a class="btn-sm" href="log.html?edit=' + l.id + '">Sửa</a>'
          + '<button type="button" class="btn-sm"' + (armed ? ' data-armed="1"' : '') + ' data-act="run-del" data-k="' + l.id + '">'
          + (armed ? 'Chắc chắn?' : 'Xóa') + '</button>'
          + '</div></article>';
      }).join('') + '</div>';
    }
    html += '<a class="btn-sm" href="log.html?date=' + calSel + '">Nhập buổi chạy cho ngày này</a>';
    box.innerHTML = html;
  }

  /* ================= lịch tuần (chỉ khi chọn 1 giáo án) ================= */
  function renderWeeks() {
    var wrap = el('p-weeks-wrap'), box = el('p-weeks');
    var one = singleBlock();
    if (!one) { wrap.hidden = true; return; }
    var info = B.sessionsOf(one), tpl = info.tpl;
    if (!tpl) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var t0 = C.today0(), html = '';
    for (var wi = 0; wi < tpl.weeks.length; wi++) {
      var start = B.dayOf(one, wi, 0), end = B.dayOf(one, wi, 6);
      var cur = t0 >= start && t0 <= end;
      var items = info.list.filter(function (x) { return x.wi === wi; });
      var full = B.weekComplete(one, wi);
      var tot = 0, rows = '';
      items.forEach(function (x) {
        var dn = !!one.done[x.id];
        tot += Number(x.s.km) || 0;
        rows += '<div class="row' + (dn ? ' done' : '') + '">'
          + (x.s.type === 'rest'
              ? '<span class="spacer"></span>'
              : '<input type="checkbox" data-done="' + one.id + SEP + x.id + '"' + (dn ? ' checked' : '')
                + ' aria-label="Đã chạy ' + C.esc(x.s.title) + '">')
          + '<div class="day"><b>' + C.WD[(x.date.getDay() + 6) % 7] + '</b><span class="num">' + C.fmt(x.date) + '</span></div>'
          + '<div class="what"><strong>' + C.esc(x.s.title) + '</strong>'
          + (x.edited ? '<span class="tag-edited">' + (x.adj ? 'tự điều chỉnh' : 'đã sửa') + '</span>' : '')
          + (x.s.d ? '<p>' + C.esc(x.s.d) + '</p>' : '')
          + (x.s.type === 'rest' ? '' : '<div class="row-acts">' + actsHtml(one.id + SEP + x.id, x) + '</div>')
          + '<details class="note-box"><summary>Ghi chú</summary>'
          + '<textarea class="note-ta" data-note="' + one.id + SEP + x.id + '" rows="2">' + C.esc(one.notes[x.id] || '') + '</textarea>'
          + '</details></div>'
          + '<div class="kmv num">' + (x.s.km ? C.fmtKm(x.s.km) + ' km' : '—') + '</div>'
          + '</div>';
      });
      var wk = tpl.weeks[wi];
      html += '<article class="week' + (cur ? ' current' : '') + (full ? ' full' : '') + '" data-wi="' + wi + '">'
        + '<div class="wk-head"><h3>Tuần ' + (wi + 1) + '</h3>'
        + '<span class="dates num">' + C.fmt(start) + ' – ' + C.fmt(end) + '</span>'
        + '<span class="sp"></span>'
        + '<span class="km num">' + C.fmtKm(tot) + ' km</span></div>'
        + '<div class="wk-phase">'
        + (wk.ph ? '<span class="chip t-' + (wk.race ? 'race' : 'easy') + '">' + C.esc(wk.ph) + '</span>' : '')
        + (cur ? '<span class="chip tag-now">Tuần này</span>' : '')
        + (full ? '<span class="chip t-easy chip-full">Đủ tuần</span>' : '')
        + '</div>'
        + rows
        + (wk.nt ? '<div class="wk-note">' + C.esc(wk.nt) + '</div>' : '')
        + '</article>';
    }
    box.innerHTML = html;
  }

  /* ================= gợi ý chỉnh giáo án ================= */
  function renderAdapt() {
    var wrap = el('p-adapt');
    if (!wrap) return;
    var unfinished = selected();
    wrap.hidden = !runsReady || !unfinished.length;
    if (wrap.hidden) return;
    adaptItems = [];
    unfinished.forEach(function (b) {
      window.Adapt.propose(b, runs).forEach(function (it) { adaptItems.push(it); });
    });
    el('p-adapt-auto').checked = window.Adapt.isAuto();
    el('p-adapt-all').hidden = adaptItems.length < 2;
    el('p-adapt-sum').textContent = adaptItems.length
      ? adaptItems.length + ' gợi ý dựa trên nhịp tập gần đây của bạn.'
      : (runs.length ? 'Giáo án đang khớp với nhịp tập và khả năng hiện tại, chưa có gợi ý nào.'
                     : 'Nhập vài buổi chạy ở tab Nhập nhanh để app có cơ sở gợi ý.');
    el('p-adapt-list').innerHTML = adaptItems.map(function (it, i) {
      var b = B.get(it.blockId);
      return '<article class="adapt-item lv-' + it.level + '">'
        + '<div class="adapt-top"><strong>' + C.esc(it.title) + '</strong>'
        + '<span class="chip ' + (it.level === 'high' ? 'conf-lo' : it.level === 'info' ? 'conf-hi' : 'conf-mid') + '">' + it.changes.length + ' buổi</span></div>'
        + (blocks.length > 1 && b ? '<p class="hint">' + C.esc(raceName(b)) + '</p>' : '')
        + '<p class="adapt-why">' + C.esc(it.why) + '</p>'
        + '<ul class="adapt-diff">' + it.changes.map(function (c) { return '<li>' + C.esc(c.line) + '</li>'; }).join('') + '</ul>'
        + '<button type="button" class="btn-sm primary" data-act="adapt" data-k="' + i + '">' + (it.restore ? 'Khôi phục' : 'Áp dụng') + '</button>'
        + '</article>';
    }).join('');
  }

  function applyAdapt(items) {
    var n = 0;
    items.forEach(function (it) {
      if (!it) return;
      var r = window.Adapt.applyItem(B.get(it.blockId), it);
      syncBlock(r.block); n += r.n;
    });
    renderAll();
    C.toast(n ? 'Đã chỉnh ' + n + ' buổi' : 'Không có gì để chỉnh', n ? 'Bấm Hoàn tác ở từng buổi nếu muốn quay lại' : '');
  }

  /* ================= ăn mừng ================= */
  function celebrate(b, sid, anchor) {
    var x = B.findSession(b, sid);
    if (!x) return;
    var full = B.weekComplete(b, x.wi);
    var tier = x.s.type === 'race' ? 'race' : full ? 'week' : x.s.type === 'long' ? 'long'
             : x.s.type === 'quality' ? 'quality' : 'easy';
    C.FX.party(tier, anchor);
    var st = B.stats(b);
    C.toast(full ? 'Đủ tuần ' + (x.wi + 1) + '!' : 'Xong buổi này',
            st.n + '/' + st.total + ' buổi · ' + C.fmtKm(st.km) + ' km');
  }

  /* ================= render + sự kiện ================= */
  function renderAll() {
    renderPick();
    var has = blocks.length > 0;
    el('p-empty').hidden = has;
    el('p-cal-wrap').hidden = !has;
    if (!has) { el('p-weeks-wrap').hidden = true; el('p-removed-wrap').hidden = true; el('p-adapt').hidden = true; return; }
    renderCal(); renderDay(); renderWeeks(); renderRemoved(); renderAdapt();
  }

  function markDone(key, checked, anchor) {
    var parts = key.split(SEP);
    var b = B.get(parts[0]);
    if (!b) return;
    B.setDone(b, parts[1], checked);
    // đồng bộ lại bản trong mảng để render dùng dữ liệu mới
    for (var i = 0; i < blocks.length; i++) if (blocks[i].id === b.id) blocks[i] = b;
    if (checked) celebrate(b, parts[1], anchor);
    renderAll();
  }

  function bind() {
    on('p-pick', 'change', function (e) {
      sel = e.target.value; calMonth = null; calSel = ''; editKey = ''; armedKey = '';
      renderAll();
    });
    on('p-prev', 'click', function () {
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal();
    });
    on('p-next', 'click', function () {
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal();
    });
    on('p-cal', 'click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-day]') : null;
      if (!btn) return;
      var key = btn.getAttribute('data-day');
      calSel = calSel === key ? '' : key;
      editKey = ''; armedKey = '';
      renderCal(); renderDay();
    });
    on('p-jump', 'click', function () {
      var t = document.querySelector('#p-weeks .week.current') || document.querySelector('#p-weeks .week');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.addEventListener('click', onAct);
    on('p-adapt-auto', 'change', function (e) {
      window.Adapt.setAuto(e.target.checked);
      if (e.target.checked && runsReady) {
        if (window.Adapt.auto(runs)) blocks = B.list();
        renderAll();
      }
    });

    // đánh dấu đã chạy — dùng chung cho cả chi tiết ngày và lịch tuần
    document.addEventListener('change', function (e) {
      var node = e.target;
      if (!node) return;
      var dk = node.getAttribute && node.getAttribute('data-done');
      if (dk) { markDone(dk, node.checked, node); return; }
      var nk = node.getAttribute && node.getAttribute('data-note');
      if (nk) {
        var parts = nk.split(SEP), b = B.get(parts[0]);
        if (b) { B.setNote(b, parts[1], node.value); }
      }
    });
  }

  function boot() {
    var d = new Date();
    el('p-eyebrow').textContent = C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear();
    blocks = B.list();
    // mặc định: nếu đang có đúng một giáo án chạy thì mở sẵn nó
    var active = blocks.filter(B.isActive);
    sel = blocks.length === 1 ? blocks[0].id : (active.length === 1 ? active[0].id : 'all');
    calSel = C.iso(C.today0());
    bind();
    renderAll();
    RL.loadRuns().then(function (all) {
      runs = all;
      runsReady = true;
      zones = window.Predict.compute(all).zones;
      if (window.Adapt.auto(all)) blocks = B.list();
      renderAll();
    });
    C.registerSW();
  }

  boot();
})();
