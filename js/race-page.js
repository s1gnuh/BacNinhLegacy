// Điều khiển race.html — đọc ?id=<raceId>, dựng toàn bộ UI của MỘT giải:
// buổi tiếp theo, biểu đồ km/tuần, lịch tháng, lịch 12 tuần, ảnh & nhật ký,
// tham khảo. Phần lớn logic chuyển từ bản script.js một-giải-duy-nhất cũ,
// chỉ khác là mọi thứ đọc qua tham số `block`/`race` thay vì biến toàn cục.
(function () {
  'use strict';
  var C = window.Core, T = window.Templates, B = window.Blocks, R = window.Races, RL = window.RunLog;
  var el = function (id) { return document.getElementById(id); };

  var raceId = C.qs('id');
  var race = null, block = null, tpl = null;
  var logs = [], sampleFn = null, persist = true;
  var calMonth = null, calSel = '';

  /* ================= buổi tập (nếu có block) ================= */
  function sessions() { return block ? B.sessionsOf(block).list : []; }
  function findSession(sid) { return block ? B.findSession(block, sid) : null; }

  function noteHtml(key) {
    var v = block.notes[key] || '';
    return '<details class="note-box"' + (v ? ' open' : '') + '><summary>Ghi chú</summary><textarea class="note-ta" data-note="' + key + '" placeholder="Cảm nhận, đau mỏi, thời tiết...">' + C.esc(v) + '</textarea></details>';
  }
  function actualHtml(key) {
    var shot = null, photo = null, n = 0;
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].sessionId !== key) continue;
      if (logs[i].cat === 'photo') { n++; if (!photo) photo = logs[i]; }
      else if (!shot) shot = logs[i];
    }
    var out = '';
    if (shot) {
      var bits = [];
      if (Number(shot.km) > 0) bits.push(C.fmtKm(Number(shot.km)) + ' km');
      if (shot.pace) bits.push(shot.pace + '/km');
      if (shot.time) bits.push(shot.time);
      out += '<p class="actual"><span class="chip t-easy">Strava</span><span class="num">' + C.esc(bits.join(' · ') || 'đã gắn ảnh') + '</span></p>';
    }
    if (photo) out += '<p class="actual"><span class="chip t-long">Ảnh chạy' + (n > 1 ? ' ×' + n : '') + '</span><span>' + C.esc(photo.note || 'đã gắn ảnh') + '</span></p>';
    return out;
  }

  /* ================= render tổng quan ================= */
  function renderHeader() {
    document.title = race.name;
    el('r-eyebrow').textContent = block
      ? (C.fmt(B.dayOf(block, 0, 0)) + ' đến ' + C.fmt(C.fromIso(race.date)))
      : 'Chạy tự do · không theo giáo án cố định';
    el('r-title').textContent = race.name;
    var d = R.daysUntil(race);
    el('days').textContent = Math.abs(d);
    el('r-days-label').textContent = d >= 0 ? 'ngày nữa đến ngày thi, ' + C.WD[C.fromIso(race.date).getDay() === 0 ? 6 : C.fromIso(race.date).getDay() - 1] : 'ngày sau ngày thi';
    el('r-mode').hidden = !block;
    el('r-progress-wrap').hidden = !block;
    el('r-noblock').hidden = !!block;
  }

  function renderSched() {
    var box = el('sched-fields');
    if (!box || !block) return;
    var html = '';
    tpl.days.forEach(function (dy, i) {
      if (!B.visible(block, tpl, dy)) return;
      html += '<div class="sf"><label for="def-' + dy.k + '">' + dy.name + '</label><select id="def-' + dy.k + '" data-def="' + i + '">' + dayOptions(block.schedDef[i]) + '</select></div>';
    });
    box.innerHTML = html;
  }
  function dayOptions(sel) {
    return C.WD.map(function (n, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + n + '</option>'; }).join('');
  }

  function renderWeeks() {
    var box = el('weeks');
    if (!box || !block) return;
    var t0 = C.today0(), html = '', list = sessions();
    tpl.weeks.forEach(function (_w, wi) {
      var start = B.dayOf(block, wi, 0), end = B.dayOf(block, wi, 6);
      var cur = t0 >= start && t0 <= end;
      var items = list.filter(function (x) { return x.wi === wi; });
      var tot = 0, rows = '', seen = {}, dup = false, full = B.weekComplete(block, wi);
      items.forEach(function (x) {
        tot += x.s.km;
        if (seen[x.off]) dup = true;
        seen[x.off] = 1;
        var key = x.id, dn = !!block.done[key], dayCell;
        if (x.s.type === 'race') dayCell = '<b>' + C.WD[x.off] + '</b>';
        else dayCell = '<label class="sr" for="d-' + key + '">Ngày chạy: ' + C.esc(x.s.title) + '</label><select id="d-' + key + '" data-sel="' + wi + '|' + x.dy.k + '">' + dayOptions(x.off) + '</select>';
        rows += '<div class="row' + (dn ? ' done' : '') + '">' +
          (x.s.type === 'rest' ? '<span class="spacer"></span>' :
            '<input type="checkbox" id="c-' + key + '" data-id="' + key + '"' + (dn ? ' checked' : '') + ' aria-label="Đã chạy: ' + C.esc(x.s.title) + ' ngày ' + C.fmt(x.date) + '">') +
          '<div class="day">' + dayCell + '<span class="num">' + C.fmt(x.date) + '</span></div>' +
          '<div class="what"><div><span class="chip t-' + x.s.type + '">' + C.LABEL[x.s.type] + '</span></div><strong>' + C.esc(x.s.title) + '</strong><p>' + C.esc(x.s.d) + '</p>' + actualHtml(key) + noteHtml(key) + '</div>' +
          '<div class="kmv num">' + (x.s.km ? C.fmtKm(x.s.km) + ' km' : '') + '</div></div>';
      });
      var wNote = tpl.weeks[wi].nt;
      html += '<article class="week' + (cur ? ' current' : '') + (full ? ' full' : '') + '">' +
        '<div class="wk-head"><h3>Tuần ' + (wi + 1) + '</h3><span class="dates num">' + C.fmt(start) + ' – ' + C.fmt(end) + '</span>' +
        (cur ? '<span class="chip tag-now">Tuần này</span>' : '') +
        (full ? '<span class="chip t-easy chip-full">Xong cả tuần</span>' : '') +
        '<span class="sp"></span><span class="km num">' + C.fmtKm(tot) + ' km</span></div>' +
        '<div class="wk-phase"><span>Giai đoạn: ' + tpl.weeks[wi].ph + '</span>' +
        (dup ? '<span class="chip t-quality">Có 2 buổi trùng ngày</span>' : '') +
        (B.hasOverride(block, wi) ? '<button type="button" class="lnk" data-reset="' + wi + '">Đặt lại ngày tuần này</button>' : '') + '</div>' + rows +
        (wNote ? '<div class="wk-note">' + C.esc(wNote) + '</div>' : '') + '</article>';
    });
    box.innerHTML = html;
  }

  function syncWeekBadge(wi) {
    var card = document.querySelectorAll('#weeks .week')[wi];
    if (!card) return;
    var full = B.weekComplete(block, wi), head = card.querySelector('.wk-head');
    card.classList.toggle('full', full);
    if (!head) return;
    var chip = head.querySelector('.chip-full');
    if (full && !chip) {
      chip = document.createElement('span');
      chip.className = 'chip t-easy chip-full';
      chip.textContent = 'Xong cả tuần';
      head.insertBefore(chip, head.querySelector('.sp'));
    } else if (!full && chip) chip.parentNode.removeChild(chip);
  }

  var chartSeen = false;
  function renderChart() {
    var box = el('chart');
    if (!box || !block) return;
    var t0 = C.today0();
    var weeks = B.weeklyLoad(block);
    var max = Math.max.apply(null, weeks.map(function (w) { return w.planned; })) || 1;
    box.innerHTML = weeks.map(function (w) {
      var start = B.dayOf(block, w.wi, 0), end = B.dayOf(block, w.wi, 6);
      var cur = t0 >= start && t0 <= end;
      var ph = Math.max(2, Math.round(w.planned / max * 100));
      var af = w.planned ? Math.round(Math.min(w.actual, w.planned) / w.planned * 100) : 0;
      return '<div class="cweek' + (cur ? ' now' : '') + '" style="--i:' + w.wi + '">' +
        '<span class="cval num">' + C.fmtKm(w.planned) + '</span>' +
        '<div class="cbar" style="--h:' + ph + '%" title="Tuần ' + (w.wi + 1) + ': ' + C.fmtKm(w.actual) + ' / ' + C.fmtKm(w.planned) + ' km đã chạy">' +
        (af > 0 ? '<div class="cfill" style="--f:' + af + '%"></div>' : '') +
        '</div><span class="clabel num">T' + (w.wi + 1) + '</span></div>';
    }).join('');
    if (!chartSeen) { chartSeen = true; box.classList.add('in'); }
  }

  function renderProgress() {
    if (!block) return;
    var st = B.stats(block);
    el('pfill').style.width = st.pct + '%';
    el('pbar').setAttribute('aria-valuenow', st.pct);
    el('plabel').textContent = st.n + '/' + st.total + ' buổi đã chạy';
    el('pkm').textContent = C.fmtKm(st.km) + ' km';
  }

  function renderNext() {
    var box = el('next');
    if (!box) return;
    if (!block) {
      var d = R.daysUntil(race);
      box.innerHTML = '<div class="when"><span class="chip tag-now">' + (d >= 0 ? 'Còn ' + d + ' ngày' : 'Đã qua') + '</span></div>' +
        '<h2>' + C.esc(race.name) + '</h2><p class="detail">Chưa có giáo án cho giải này. Ghi nhật ký chạy tự do ở tab Ảnh &amp; nhật ký.</p>';
      return;
    }
    var t0 = C.today0();
    var nxt = sessions().filter(function (x) { return x.s.type !== 'rest' && !block.done[x.id] && x.date >= t0; })[0];
    if (!nxt) {
      box.innerHTML = '<div class="when"><span class="chip t-rest">Hết lịch</span></div><h2>Không còn buổi nào phía trước</h2><p class="detail">Mọi buổi từ hôm nay đã được đánh dấu hoặc đã qua.</p>';
      return;
    }
    var diff = Math.round((nxt.date - t0) / 864e5);
    var when = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : 'Còn ' + diff + ' ngày nữa';
    box.innerHTML =
      '<div class="when"><span class="chip tag-now">' + when + '</span><span class="num">' + C.WD[nxt.off] + ' ' + C.fmt(nxt.date) + ' · Tuần ' + (nxt.wi + 1) + '</span><span class="chip t-' + nxt.s.type + '">' + C.LABEL[nxt.s.type] + '</span></div>' +
      '<h2>' + C.esc(nxt.s.title) + '</h2><p class="detail">' + C.esc(nxt.s.d) + '</p>' +
      (nxt.s.type === 'race' ? '' : '<button type="button" class="btn" data-done="' + nxt.id + '">Đánh dấu đã chạy</button>');
  }

  /* ================= lịch tháng ================= */
  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
  function planBounds() {
    var ds = sessions().filter(function (x) { return x.s.type !== 'rest'; }).map(function (x) { return x.date; }).sort(function (a, b) { return a - b; });
    return ds.length ? { first: ds[0], last: ds[ds.length - 1] } : null;
  }
  function byDate() {
    var map = {};
    sessions().forEach(function (x) { if (x.s.type !== 'rest') map[C.iso(x.date)] = x; });
    return map;
  }
  function photosOn(key, sid) {
    return logs.filter(function (l) { return l.date === key || (sid && l.sessionId === sid); });
  }

  function renderCalendar() {
    var box = el('cal');
    if (!box || !block) return;
    var b = planBounds(), t0 = C.today0();
    if (!calMonth) calMonth = b && t0 >= monthStart(b.first) && t0 <= b.last ? monthStart(t0) : monthStart(b ? b.first : t0);
    el('cal-title').textContent = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'][calMonth.getMonth()] + '/' + calMonth.getFullYear();
    if (b) {
      el('cal-prev').disabled = calMonth <= monthStart(b.first);
      el('cal-next').disabled = calMonth >= monthStart(b.last);
    }
    var map = byDate();
    var offset = (calMonth.getDay() + 6) % 7;
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1 - offset + i);
      var key = C.iso(d), x = map[key];
      var cls = ['cday'];
      if (!sameMonth(d, calMonth)) cls.push('out');
      if (key === C.iso(t0)) cls.push('today');
      if (key === calSel) cls.push('sel');
      if (x && block.done[x.id]) cls.push('done');
      var pics = photosOn(key, x && x.id).length;
      cells += '<button type="button" class="' + cls.join(' ') + '" data-day="' + key + '"' +
        ' aria-label="' + C.fmt(d) + (x ? ', ' + C.esc(x.s.title) : ', không có buổi chạy') + '">' +
        '<span class="cd-num num">' + d.getDate() + '</span>' +
        (x ? '<i class="cd-dot t-' + x.s.type + '"></i>' : '') + (pics ? '<i class="cd-pic"></i>' : '') + '</button>';
    }
    box.innerHTML = cells;
  }

  function renderDay() {
    var box = el('cal-day');
    if (!box || !block) return;
    if (!calSel) { box.innerHTML = '<p class="hint">Bấm vào một ngày để xem buổi tập, số liệu và ảnh của ngày đó.</p>'; return; }
    var d = C.fromIso(calSel);
    var x = byDate()[calSel];
    var b = planBounds();
    var head = '<div class="cdh"><strong>' + C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear() + '</strong></div>';
    if (!x) {
      var outside = !b || d < b.first || d > b.last;
      box.innerHTML = head + '<p class="hint">' + (outside ? 'Ngày này nằm ngoài kỳ giáo án.' : 'Không có buổi chạy.') + '</p>' + photoStrip(calSel, null);
      return;
    }
    var dn = !!block.done[x.id];
    var bits = [], shot = logs.filter(function (l) { return l.cat !== 'photo' && l.sessionId === x.id; })[0];
    if (shot) {
      if (Number(shot.km) > 0) bits.push(C.fmtKm(Number(shot.km)) + ' km');
      if (shot.pace) bits.push(shot.pace + '/km');
      if (shot.time) bits.push(shot.time);
    }
    box.innerHTML = head +
      '<div class="cdb"><span class="chip t-' + x.s.type + '">' + C.LABEL[x.s.type] + '</span>' +
      '<span class="chip ' + (dn ? 't-easy' : 't-rest') + '">' + (dn ? 'Đã chạy' : 'Chưa chạy') + '</span>' +
      '<span class="kmv num">' + (x.s.km ? C.fmtKm(x.s.km) + ' km' : '') + '</span></div>' +
      '<strong class="cdt">' + C.esc(x.s.title) + '</strong><p class="hint">' + C.esc(x.s.d) + '</p>' +
      (bits.length ? '<p class="actual"><span class="chip t-easy">Strava</span><span class="num">' + C.esc(bits.join(' · ')) + '</span></p>' : '') +
      (block.notes[x.id] ? '<p class="cdn">' + C.esc(block.notes[x.id]) + '</p>' : '') +
      photoStrip(calSel, x.id) +
      (x.s.type === 'race' ? '' : '<button type="button" class="btn-sm' + (dn ? '' : ' primary') + '" data-cal-done="' + x.id + '">' + (dn ? 'Bỏ đánh dấu đã chạy' : 'Đánh dấu đã chạy') + '</button>');
  }
  function photoStrip(key, sid) {
    var pics = photosOn(key, sid);
    if (!pics.length) return '';
    return '<div class="cal-pics">' + pics.map(function (l) { return '<img src="' + l.url + '" alt="' + C.esc(l.note || 'Ảnh ngày ' + key) + '" loading="lazy">'; }).join('') + '</div>';
  }

  /* ================= tham khảo ================= */
  function renderReference() {
    var zEl = el('ref-paces'), rdEl = el('ref-raceday'), ruEl = el('ref-rules');
    if (zEl) {
      var zones = race.paceZones || [];
      zEl.innerHTML = zones.length ? '<h2 class="sec-title">Các mức pace</h2><div class="zones">' + zones.map(function (z) {
        return '<div class="zone"><span class="chip t-' + z.type + '">' + C.esc(z.label) + '</span><span class="pace num">' + C.esc(z.pace) + '</span><p>' + C.esc(z.note || '') + '</p></div>';
      }).join('') + '</div>' : '';
    }
    if (rdEl) {
      rdEl.innerHTML = '<h2>Ngày thi ' + C.fmt(C.fromIso(race.date)) + '/' + C.fromIso(race.date).getFullYear() + '</h2>' +
        (race.raceDayPlan ? '<p>' + C.esc(race.raceDayPlan) + '</p>' : '') +
        '<ul class="rules">' +
        (race.targetA ? '<li>Mục tiêu A: ' + C.esc(race.targetA) + '.' + (race.targetB ? ' Mục tiêu B: ' + C.esc(race.targetB) + '.' : '') + (race.targetC ? ' Mục tiêu C: ' + C.esc(race.targetC) + '.' : '') + '</li>' : '') +
        '</ul>';
    }
    if (ruEl) ruEl.innerHTML = C.TRAINING_RULES.map(function (r) { return '<li>' + C.esc(r) + '</li>'; }).join('');
  }

  /* ================= chúc mừng ================= */
  var CHEER = {
    easy: ['Xong buổi nhẹ!', 'Nhẹ nhàng mà chắc!', 'Thêm một buổi vào sổ!', 'Đều đặn là thắng!'],
    quality: ['Buổi chất lượng xong!', 'Ngưỡng vừa được đẩy lên!', 'Đó mới là tốc độ!'],
    long: ['Chạy dài xong!', 'Nền sức bền dày thêm một lớp!', 'Đường dài không làm khó được bạn!'],
    week: ['Trọn vẹn một tuần!', 'Không sót buổi nào cả tuần!', 'Tuần hoàn hảo!'],
    milestone: ['Cột mốc mới!', 'Giáo án đã đi được một đoạn dài!']
  };
  // "race" đọc race.name, chỉ biết được lúc chạy (sau boot), nên tách khỏi
  // bảng tĩnh ở trên — bảng đó được tạo ngay lúc nạp file, trước khi boot().
  function cheerFor(tier) {
    if (tier === 'race') return pick(['VỀ ĐÍCH!', race.name + ' — hoàn thành!', 'Bạn đã làm được!']);
    return pick(CHEER[tier]);
  }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function crossed(prev, now) {
    var marks = [25, 50, 75, 100];
    for (var i = marks.length - 1; i >= 0; i--) if (prev < marks[i] && now >= marks[i]) return marks[i];
    return 0;
  }
  function celebrate(sid, anchor, prevPct) {
    var x = findSession(sid);
    if (!x) return;
    var st = B.stats(block);
    var ms = crossed(prevPct, st.pct);
    var full = B.weekComplete(block, x.wi);
    var tier = x.s.type === 'race' ? 'race' : full ? 'week' : x.s.type === 'long' ? 'long' : x.s.type === 'quality' ? 'quality' : 'easy';
    if (ms === 100) tier = 'race'; else if (ms) tier = 'milestone';
    var sub;
    if (ms) sub = 'Đã xong ' + ms + '% giáo án · ' + st.n + '/' + st.total + ' buổi · ' + C.fmtKm(st.km) + ' km';
    else if (tier === 'week') sub = 'Tuần ' + (x.wi + 1) + ' trọn vẹn';
    else sub = x.s.title + (x.s.km ? ' · ' + C.fmtKm(x.s.km) + ' km' : '');
    C.FX.party(tier, anchor);
    C.toast(cheerFor(tier), sub);
  }

  /* ================= tổng hợp render ================= */
  function renderAll(focusId) {
    renderHeader();
    if (block) {
      el('panel-chart-wrap').hidden = false;
      el('panel-sched-wrap').hidden = false;
      el('panel-cal-wrap').hidden = false;
      el('panel-weeks-wrap').hidden = false;
      renderSched(); renderChart(); renderWeeks(); renderCalendar(); renderDay(); renderProgress();
    }
    renderNext(); renderStrava();
    if (focusId) { var f = el(focusId); if (f) f.focus(); }
  }

  /* ================= tab ================= */
  var TAB_IDS = ['overview', 'schedule', 'strava', 'ref'];
  function setTab(name, scroll) {
    if (TAB_IDS.indexOf(name) < 0) name = 'overview';
    TAB_IDS.forEach(function (n) {
      var btn = el('tab-' + n), pane = el('panel-' + n);
      if (!btn || !pane) return;
      var on = n === name;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      pane.hidden = !on;
      if (on) { pane.classList.remove('in'); void pane.offsetWidth; pane.classList.add('in'); }
    });
    if (scroll) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }
  }
  function jumpNow() {
    var target = document.querySelector('#weeks .week.current') || document.querySelector('#weeks .week');
    if (!target) return;
    try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { target.scrollIntoView(); }
  }

  /* ================= ảnh & nhật ký ================= */
  function findLog(lid) { for (var i = 0; i < logs.length; i++) if (logs[i].id === lid) return logs[i]; return null; }

  function readCard(art, l) {
    Array.prototype.forEach.call(art.querySelectorAll('[data-f]'), function (node) {
      var f = node.getAttribute('data-f');
      var v = String(node.value).trim();
      l[f] = f === 'km' ? v.replace(',', '.') : v;
    });
    linkRun(l);
  }
  function linkRun(l) {
    if (!block || l.sessionId) return;
    var cand = sessions().map(function (x) { return { id: x.id, blockId: block.id, date: x.date, type: x.s.type }; });
    var hit = RL.autoLink(l, cand);
    if (hit && l.cat !== 'photo') B.setDone(block, hit.id, true);
  }

  function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) navigator.storage.persist().catch(function () {}); }); } catch (e) {}
  }
  function showStorage() {
    var node = el('sv-storage');
    if (!node) return;
    try {
      if (!navigator.storage || !navigator.storage.estimate) { node.textContent = ''; return; }
      Promise.all([navigator.storage.estimate(), navigator.storage.persisted ? navigator.storage.persisted().catch(function () { return false; }) : Promise.resolve(false)])
        .then(function (r) {
          var mb = (r[0].usage || 0) / 1048576, cap = (r[0].quota || 0) / 1048576;
          node.textContent = 'Đang dùng ' + (Math.round(mb * 10) / 10) + ' MB' + (cap ? ' trong khoảng ' + Math.round(cap) + ' MB trình duyệt cho phép' : '') +
            (r[1] ? '. Ảnh được đánh dấu lưu bền.' : '. Chưa được đánh dấu lưu bền, thỉnh thoảng tải ảnh về máy để chắc ăn.');
        }).catch(function () { node.textContent = ''; });
    } catch (e) { node.textContent = ''; }
  }

  function addFiles(files) {
    var arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!arr.length) return;
    var catSel = el('sv-cat'), cat = catSel && catSel.value === 'photo' ? 'photo' : 'strava';
    arr.reduce(function (p, f) {
      return p.then(function () {
        return RL.shrink(f).then(function (b) {
          var l = RL.newRun({ blob: b, cat: cat, blockId: block ? block.id : '', raceId: raceId });
          logs.unshift(l);
          return RL.saveRun(l);
        });
      });
    }, Promise.resolve()).then(function () { renderAll(); showStorage(); });
  }

  var COPY = {
    not_granted: 'Bạn chưa cho phép trang dùng Claude, hãy nhập số liệu tay.',
    sampling_disabled: 'Tài khoản này chưa dùng được Claude trong trang, hãy nhập số liệu tay.',
    rate_limited: 'Đã gọi Claude quá nhiều lần, thử lại sau ít phút.',
    image_rejected: 'Không đọc được ảnh này, thử ảnh khác hoặc nhập tay.',
    invalid_json: 'Claude không trả về số liệu đọc được, hãy nhập tay.',
    session_expired: 'Phiên đăng nhập hết hạn, hãy đăng nhập lại.'
  };
  function readLog(l) {
    if (!sampleFn || l.busy) return Promise.resolve();
    l.busy = true; l.msg = 'Claude đang đọc ảnh...'; renderStrava();
    var prompt = 'Đây là ảnh chụp màn hình một hoạt động trên Strava. Hôm nay là ' + C.iso(C.today0()) + '. ' +
      'Chỉ trả về một đối tượng JSON: {"title": chuỗi hoặc null, "date": "YYYY-MM-DD" hoặc null, "km": số hoặc null, "pace": "m:ss" hoặc null, "time": "m:ss" hoặc "h:mm:ss" hoặc null, "kind": "run" hoặc "walk" hoặc "other"}. ' +
      'Nếu ảnh ghi "Yesterday" thì date là hôm qua, "Today" là hôm nay. Chỉ lấy số hiển thị trong ảnh, thiếu thì để null.';
    return sampleFn.json(prompt, { images: [l.blob] }).then(function (d) {
      if (d && typeof d === 'object') {
        if (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) l.date = d.date;
        var km = Number(d.km);
        if (isFinite(km) && km > 0 && km < 200) l.km = String(Math.round(km * 100) / 100);
        if (typeof d.pace === 'string' && /^\d{1,2}:\d{2}$/.test(d.pace)) l.pace = d.pace;
        if (typeof d.time === 'string' && /^\d{1,2}(:\d{2}){1,2}$/.test(d.time)) l.time = d.time;
        if (typeof d.title === 'string') l.title = d.title.slice(0, 60);
        if (RL.KIND[d.kind]) l.kind = d.kind;
        linkRun(l);
      }
      l.msg = l.km ? 'Claude đã điền số liệu. Hãy kiểm tra lại với ảnh.' : 'Không thấy số liệu trong ảnh, hãy nhập tay.';
      return RL.saveRun(l);
    }).catch(function (e) {
      var c = e && e.code;
      l.msg = COPY[c] || 'Chưa đọc được ảnh lúc này, hãy nhập tay hoặc thử lại.';
      if (c === 'not_granted' || c === 'sampling_disabled' || c === 'images_unavailable') sampleFn = null;
    }).then(function () { l.busy = false; renderAll(); });
  }

  function renderStrava() {
    var box = el('sv-list');
    if (!box) return;
    var shots = logs.filter(function (l) { return l.cat !== 'photo'; });
    var photos = logs.filter(function (l) { return l.cat === 'photo'; });
    var runs = shots.filter(function (l) { return l.kind !== 'walk' && Number(l.km) > 0; });
    var km = runs.reduce(function (a, l) { return a + Number(l.km); }, 0);
    el('sv-sum').textContent = logs.length ? shots.length + ' ảnh Strava · ' + photos.length + ' ảnh chạy · ' + C.fmtKm(km) + ' km đã ghi (không tính đi bộ)' : 'Chưa có ảnh nào.';
    el('sv-read-all').hidden = !(sampleFn && shots.some(function (l) { return !l.km && !l.busy; }));
    el('sv-note').textContent = persist ? '' : 'Trình duyệt này không cho lưu ảnh nên ảnh chỉ còn đến khi bạn đóng trang.';
    var sess = sessions().filter(function (x) { return x.s.type !== 'rest'; });
    var list = logs.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || b.added - a.added; });
    box.innerHTML = list.map(function (l) {
      var p = 'lg-' + l.id + '-', isPhoto = l.cat === 'photo';
      var linkOpts = '<option value="">Chưa gắn vào buổi nào</option>' + sess.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === l.sessionId ? ' selected' : '') + '>Tuần ' + (x.wi + 1) + ' · ' + C.WD[x.off] + ' ' + C.fmt(x.date) + ' · ' + C.esc(x.s.title) + '</option>';
      }).join('');
      var kindOpts = Object.keys(RL.KIND).map(function (k) { return '<option value="' + k + '"' + (k === l.kind ? ' selected' : '') + '>' + RL.KIND[k] + '</option>'; }).join('');
      var catOpts = [['strava', 'Ảnh Strava (có số liệu)'], ['photo', 'Ảnh chạy (chỉ ảnh)']].map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === l.cat ? ' selected' : '') + '>' + c[1] + '</option>';
      }).join('');
      var statFields = isPhoto ? '' :
        '<label class="fld"><span>Loại</span><select id="' + p + 'kind" data-f="kind">' + kindOpts + '</select></label>' +
        '<label class="fld"><span>Quãng đường (km)</span><input type="text" inputmode="decimal" id="' + p + 'km" data-f="km" value="' + C.esc(l.km) + '" placeholder="6,03"></label>' +
        '<label class="fld"><span>Pace (phút/km)</span><input type="text" id="' + p + 'pace" data-f="pace" value="' + C.esc(l.pace) + '" placeholder="7:17"></label>' +
        '<label class="fld"><span>Thời gian</span><input type="text" id="' + p + 'time" data-f="time" value="' + C.esc(l.time) + '" placeholder="43:56"></label>';
      return '<article class="lg' + (l.zoom ? ' zoom' : '') + (isPhoto ? ' photo' : '') + '" data-id="' + l.id + '">' +
        '<button type="button" class="lg-thumb" data-act="zoom" aria-label="' + (l.zoom ? 'Thu nhỏ ảnh' : 'Phóng to ảnh') + '"><img src="' + l.url + '" alt="' + (isPhoto ? 'Ảnh buổi chạy' : 'Ảnh chụp màn hình Strava') + '"></button>' +
        '<div class="lg-body"><div class="lg-fields">' +
        '<label class="fld"><span>Loại ảnh</span><select id="' + p + 'cat" data-f="cat">' + catOpts + '</select></label>' +
        '<label class="fld"><span>Ngày</span><input type="date" id="' + p + 'date" data-f="date" value="' + C.esc(l.date) + '"></label>' +
        statFields +
        '<label class="fld wide"><span>Chú thích</span><input type="text" id="' + p + 'note" data-f="note" value="' + C.esc(l.note) + '" placeholder="' + (isPhoto ? 'Chạy ven sông, trời mát' : 'Ghi chú thêm nếu cần') + '"></label>' +
        (sess.length ? '<label class="fld wide"><span>Buổi trong giáo án</span><select id="' + p + 'link" data-f="link">' + linkOpts + '</select></label>' : '') +
        '</div>' + (l.msg ? '<div class="lg-msg">' + C.esc(l.msg) + '</div>' : '') +
        '<div class="lg-actions">' +
        '<button type="button" class="btn-sm primary" data-act="save">' + (l.saved && Date.now() - l.saved < 4000 ? 'Đã lưu' : 'Lưu') + '</button>' +
        (!isPhoto && sampleFn ? '<button type="button" class="btn-sm" data-act="read"' + (l.busy ? ' disabled' : '') + '>Đọc bằng Claude</button>' : '') +
        '<button type="button" class="btn-sm" data-act="del" data-armed="' + (l.armed ? 1 : 0) + '">' + (l.armed ? 'Bấm lại để xóa' : 'Xóa ảnh') + '</button>' +
        '</div></div></article>';
    }).join('');
  }

  /* ================= sự kiện ================= */
  function on(target, ev, fn) { var node = typeof target === 'string' ? el(target) : target; if (node) node.addEventListener(ev, fn); }

  function bindEvents() {
    on('weeks', 'change', function (e) {
      var t = e.target, sel = t && t.getAttribute('data-sel');
      if (sel) {
        var p = sel.split('|'), wi = +p[0];
        (block.schedWk[wi] = block.schedWk[wi] || {})[p[1]] = +t.value;
        B.save(block); renderAll(t.id); return;
      }
      var k = t && t.getAttribute('data-id');
      if (!k) return;
      var prev = B.stats(block).pct;
      B.setDone(block, k, t.checked);
      var row = t.closest('.row');
      if (row) row.classList.toggle('done', t.checked);
      var x = findSession(k);
      if (x) syncWeekBadge(x.wi);
      renderChart(); renderProgress(); renderNext();
      if (t.checked) {
        if (row) { row.classList.add('just'); setTimeout(function () { row.classList.remove('just'); }, 900); }
        celebrate(k, t, prev);
      }
    });
    on('weeks', 'click', function (e) {
      var r = e.target && e.target.getAttribute('data-reset');
      if (r == null) return;
      delete block.schedWk[r]; B.save(block); renderAll();
    });
    on('weeks', 'input', function (e) {
      var t = e.target, k = t && t.getAttribute('data-note');
      if (!k) return;
      B.setNote(block, k, t.value);
    });
    on('sched-fields', 'change', function (e) {
      var i = e.target && e.target.getAttribute('data-def');
      if (i == null) return;
      block.schedDef[+i] = +e.target.value; B.save(block); renderAll(e.target.id);
    });
    on('sched-reset', 'click', function () {
      block.schedDef = tpl.days.map(function (d) { return d.def; }); block.schedWk = {}; B.save(block); renderAll();
    });
    on('next', 'click', function (e) {
      var k = e.target && e.target.getAttribute('data-done');
      if (!k) return;
      var prev = B.stats(block).pct;
      B.setDone(block, k, true);
      celebrate(k, e.target, prev);
      renderAll();
    });
    on('m4', 'click', function () { block.mode = 4; B.save(block); renderAll(); });
    on('m3', 'click', function () { block.mode = 3; B.save(block); renderAll(); });
    on('jump-now', 'click', jumpNow);

    on('cal-prev', 'click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
    on('cal-next', 'click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });
    on('cal', 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-day]') : null;
      if (!b) return;
      var key = b.getAttribute('data-day');
      calSel = calSel === key ? '' : key;
      renderCalendar(); renderDay();
    });
    on('cal-day', 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-cal-done]') : null;
      if (!b) return;
      var sid = b.getAttribute('data-cal-done');
      var prev = B.stats(block).pct, wasDone = !!block.done[sid];
      B.setDone(block, sid, !wasDone);
      renderAll();
      if (!wasDone) celebrate(sid, b, prev);
    });

    on('tabs', 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) setTab(b.getAttribute('data-tab'), true);
    });

    on('sv-list', 'change', function (e) {
      var t = e.target, f = t && t.getAttribute('data-f'), art = t && t.closest('.lg');
      if (!f || !art) return;
      var l = findLog(art.getAttribute('data-id'));
      if (!l) return;
      var v = String(t.value).trim();
      if (f === 'link') { l.sessionId = v; if (v) B.setDone(block, v, true); }
      else if (f === 'km') l.km = v.replace(',', '.');
      else l[f] = v;
      if (f === 'date' || f === 'kind') linkRun(l);
      RL.saveRun(l);
      renderAll(t.id);
    });
    on('sv-list', 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      var art = e.target && e.target.closest ? e.target.closest('.lg') : null;
      if (!b || !art) return;
      var l = findLog(art.getAttribute('data-id'));
      if (!l) return;
      var act = b.getAttribute('data-act');
      if (act === 'zoom') { l.zoom = !l.zoom; renderStrava(); }
      else if (act === 'save') {
        var prevPct = block ? B.stats(block).pct : 0;
        var wasDone = l.sessionId && block ? !!block.done[l.sessionId] : false;
        readCard(art, l);
        var now = new Date();
        l.saved = Date.now();
        l.msg = 'Đã lưu lúc ' + C.pad(now.getHours()) + ':' + C.pad(now.getMinutes()) + '.';
        RL.saveRun(l).then(function () {
          renderAll(); showStorage();
          if (block && l.sessionId && !wasDone && block.done[l.sessionId]) celebrate(l.sessionId, b, prevPct);
          else {
            var sum = [];
            if (Number(l.km) > 0) sum.push(C.fmtKm(Number(l.km)) + ' km');
            if (l.pace) sum.push(l.pace + '/km');
            if (l.time) sum.push(l.time);
            C.toast('Đã lưu vào hệ thống', sum.join(' · ') || (l.cat === 'photo' ? 'Ảnh chạy đã được lưu.' : 'Ảnh đã được lưu.'));
          }
          setTimeout(renderStrava, 4200);
        });
      }
      else if (act === 'read') readLog(l);
      else if (act === 'del') {
        if (!l.armed) { l.armed = true; renderStrava(); setTimeout(function () { if (l.armed) { l.armed = false; renderStrava(); } }, 4000); }
        else {
          try { URL.revokeObjectURL(l.url); } catch (x) {}
          logs = logs.filter(function (z) { return z !== l; });
          RL.removeRun(l.id); renderAll();
        }
      }
    });
    on('sv-read-all', 'click', function () {
      logs.filter(function (l) { return l.cat !== 'photo' && !l.km && !l.busy; }).reduce(function (p, l) { return p.then(function () { return readLog(l); }); }, Promise.resolve());
    });
    var svFile = el('sv-file'), svDrop = el('sv-drop');
    if (svFile) svFile.addEventListener('change', function () { addFiles(svFile.files); svFile.value = ''; });
    if (svDrop) {
      ['dragenter', 'dragover'].forEach(function (n) { svDrop.addEventListener(n, function (ev) { ev.preventDefault(); svDrop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (n) { svDrop.addEventListener(n, function (ev) { ev.preventDefault(); svDrop.classList.remove('over'); }); });
      svDrop.addEventListener('drop', function (ev) { addFiles(ev.dataTransfer && ev.dataTransfer.files); });
    }
  }

  /* ================= khởi động ================= */
  function boot() {
    race = R.get(raceId);
    if (!race) {
      document.querySelector('.wrap').innerHTML = '<a class="back-link" href="index.html">← Trang chủ</a><section class="panel"><h2>Không tìm thấy giải này</h2><p class="hint">Có thể đường dẫn sai hoặc giải đã bị xoá.</p></section>';
      return;
    }
    block = race.blockId ? B.get(race.blockId) : null;
    tpl = block ? T.get(block.templateId) : null;
    bindEvents();
    setTab('overview', false);
    renderAll();
    renderReference();
    askPersist();
    RL.loadRuns().then(function (all) { logs = all.filter(function (l) { return l.raceId === raceId; }); renderAll(); showStorage(); });
    try {
      if (window.claude && window.claude.use) {
        window.claude.use('sample').then(function (s) {
          if (!s) return;
          return s.limits().then(function (lim) { if (lim && lim.images) { sampleFn = s; renderStrava(); } });
        }).catch(function () {});
      }
    } catch (e) {}
    C.registerSW();
  }

  boot();
})();
