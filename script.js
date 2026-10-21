(function () {
  var START = new Date(2026, 9, 19), RACE = new Date(2027, 0, 10);
  var DAYS = [
    { k: 'mon', def: 0, name: 'Chạy nhẹ 1' }, { k: 'wed', def: 2, name: 'Chất lượng' },
    { k: 'fri', def: 4, name: 'Chạy nhẹ 2' }, { k: 'sun', def: 6, name: 'Chạy dài' }
  ];
  var WD = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  var WARM = 'Khởi động 10 phút chạy rất nhẹ, ';
  var W = [
    { ph: 'Nền tảng', e: [5, 4], l: 7, q: { t: '5 × 3 phút @ 6:40', d: WARM + '5 lần 3 phút @ 6:40, nghỉ 2 phút đi bộ nhanh, hạ nhiệt 10 phút.', km: 6 } },
    { ph: 'Nền tảng', e: [5, 4], l: 7, q: { t: '4 × 4 phút @ 6:40', d: WARM + '4 lần 4 phút @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 6.5 } },
    { ph: 'Nền tảng', e: [5, 5], l: 8, q: { t: '3 × 1 km @ 6:40', d: WARM + '3 lần 1 km @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 6 } },
    { ph: 'Nền tảng', e: [4, 4], l: 6, nt: 'Tuần nhẹ: giảm khối lượng để cơ thể hấp thu những tuần trước.', q: { t: '3 × 1 km @ 6:40', d: WARM + '3 lần 1 km @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 5.5 } },
    { ph: 'Xây sức bền', e: [5, 5], l: 9, q: { t: 'Tempo 3 km @ 6:55', d: WARM + '3 km liền @ 6:55, hạ nhiệt 10 phút.', km: 6 } },
    { ph: 'Xây sức bền', e: [5, 5], l: 9, nt: 'Buổi chất lượng tuần này là chạy thử 5 km. Kết quả quyết định mục tiêu pace, xem bảng ở cuối trang.', q: { t: 'Chạy thử 5 km hết sức', d: 'Khởi động 15 phút nhẹ, 5 km nhanh nhất có thể mà không đi bộ, hạ nhiệt 10 phút. Chạy trên đường phẳng, ghi lại thời gian.', km: 7 } },
    { ph: 'Xây sức bền', e: [5, 5], l: 10, nt: 'Chỉnh pace theo kết quả 5 km ở tuần 6: đoạn 1 km chạy bằng pace 5 km, tempo và đoạn 2 km chậm hơn pace 5 km khoảng 10–15 giây.', q: { t: 'Tempo 4 km @ 6:55', d: WARM + '4 km liền @ 6:55, hạ nhiệt 10 phút.', km: 7 } },
    { ph: 'Xây sức bền', e: [4, 4], l: 7, nt: 'Tuần nhẹ: giảm khối lượng, giữ một buổi nhanh ngắn.', q: { t: '3 × 1 km @ 6:35', d: WARM + '3 lần 1 km @ 6:35, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 5.5 } },
    { ph: 'Đặc thù cự ly', e: [5, 5], l: 11, nt: 'Giữ pace tempo đã chỉnh theo kết quả 5 km ở tuần 6.', q: { t: 'Tempo 5 km @ 6:50', d: WARM + '5 km liền @ 6:50, hạ nhiệt 10 phút.', km: 8 } },
    { ph: 'Đặc thù cự ly', e: [5, 4], l: 10, nt: 'Tuần nặng nhất. Sau tuần này chỉ còn giảm tải.', q: { t: '3 × 2 km @ 6:40', d: WARM + '3 lần 2 km @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 8.5 } },
    { ph: 'Giảm tải', e: [4, 4], l: 8, nt: 'Giảm khoảng 25% khối lượng nhưng vẫn giữ nhịp. Tuần có Tết Dương lịch (thứ 6 ngày 1/1), xếp lại buổi chạy nếu bận nhưng đừng bỏ buổi dài.', q: { t: '4 × 1 km @ 6:35', d: WARM + '4 lần 1 km @ 6:35, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 6.5 } },
    { ph: 'Tuần thi đấu', e: [4, null], l: 10, race: true, nt: 'Ngày thi cố định là Chủ nhật 10/1. Nên nghỉ hẳn ngày thứ 7 và không tập thêm để bù.', q: { t: '2 km @ 6:40 + 4 nước rút', d: WARM + '2 km @ 6:40, sau đó 4 lần nước rút 20 giây, đi bộ về. Buổi này để chân quen tốc độ, không cần mệt.', km: 5 } }
  ];

  function easy(km, note, st) {
    return { type: 'easy', title: 'Chạy nhẹ ' + km + ' km' + (st ? ' + nước rút' : ''),
             d: 'Pace 7:40–8:30, nói được cả câu.' + (st ? ' Cuối buổi thêm 4–6 lần nước rút 20 giây, thả lỏng, nghỉ đi bộ 40–60 giây giữa các lần.' : ''),
             km: km, note: note };
  }
  var sessions = W.map(function (w, i) {
    var s = {};
    s.mon = easy(w.e[0], i === 0 ? 'Buổi đầu tiên. Bạn vừa chạy 6 km hôm 18/10, nên đi bộ 5 phút khởi động rồi chạy rất thoải mái ở 7:45–8:15. Nếu chân còn mỏi, rút xuống 4 km. Kết thúc bằng 5 phút đi bộ và giãn bắp chân, đùi trước.' : '', i >= 2 && i <= 10);
    s.wed = { type: 'quality', title: w.q.t, d: w.q.d, km: w.q.km };
    s.fri = w.e[1] == null
      ? { type: 'rest', title: 'Nghỉ', d: 'Hoặc đi bộ nhẹ 20 phút.', km: 0 }
      : easy(w.e[1], '', i >= 2 && i <= 10);
    s.sun = w.race
      ? { type: 'race', title: 'Bắc Ninh Legacy Marathon, 10 km', d: 'Km 1–2 @ 7:00, km 3–8 @ 6:50, km 9–10 tăng tốc nếu còn sức.', km: 10 }
      : { type: 'long', title: 'Chạy dài ' + w.l + ' km', d: 'Pace 7:30–8:00, không cần nhanh.' + (w.l >= 9 ? ' Mang nước nếu chạy trên 9 km.' : ''), km: w.l };
    return s;
  });

  var LABEL = { easy: 'Nhẹ', quality: 'Chất lượng', long: 'Dài', race: 'Thi đấu', rest: 'Nghỉ' };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var done = {}; try { done = JSON.parse(store.get('bn27-done') || '{}') || {}; } catch (e) { done = {}; }
  var notes = {}; try { notes = JSON.parse(store.get('bn27-notes') || '{}') || {}; } catch (e) { notes = {}; }
  var mode = store.get('bn27-mode') === '3' ? 3 : 4;

  function defaults() { return DAYS.map(function (d) { return d.def; }); }
  function okOff(n) { return typeof n === 'number' && n >= 0 && n <= 6 && n === Math.floor(n); }
  var sched = { def: defaults(), wk: {} };
  try {
    var sv = JSON.parse(store.get('bn27-sched') || 'null');
    if (sv && Array.isArray(sv.def) && sv.def.length === 4) sched.def = sv.def.map(function (n, i) { return okOff(n) ? n : DAYS[i].def; });
    if (sv && sv.wk && typeof sv.wk === 'object') sched.wk = sv.wk;
  } catch (e) {}
  function saveSched() { store.set('bn27-sched', JSON.stringify(sched)); }

  function slotIdx(k) { for (var i = 0; i < DAYS.length; i++) if (DAYS[i].k === k) return i; return 0; }
  function offFor(wi, k) {
    if (sessions[wi][k].type === 'race') return 6;
    var o = sched.wk[wi] && sched.wk[wi][k];
    return okOff(o) ? o : sched.def[slotIdx(k)];
  }
  function dayOf(wi, off) { return new Date(2026, 9, 19 + wi * 7 + off); }
  function fmt(d) { return d.getDate() + '/' + (d.getMonth() + 1); }
  function today0() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function visible(day) { return mode === 4 || day.k !== 'fri'; }
  function fmtKm(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  function id(wi, k) { return 'w' + wi + k; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function options(sel) { return WD.map(function (n, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + n + '</option>'; }).join(''); }
  function hasOverride(wi) { return !!(sched.wk[wi] && Object.keys(sched.wk[wi]).length); }
  function noteHtml(key) {
    var v = notes[key] || '';
    return '<details class="note-box"' + (v ? ' open' : '') + '><summary>Ghi chú</summary><textarea class="note-ta" data-note="' + key + '" placeholder="Cảm nhận, đau mỏi, thời tiết...">' + esc(v) + '</textarea></details>';
  }

  function all() {
    var out = [];
    sessions.forEach(function (s, wi) {
      DAYS.forEach(function (dy, si) {
        if (!visible(dy)) return;
        var off = offFor(wi, dy.k);
        out.push({ wi: wi, dy: dy, si: si, off: off, s: s[dy.k], date: dayOf(wi, off), id: id(wi, dy.k) });
      });
    });
    out.sort(function (a, b) { return a.date - b.date || a.si - b.si; });
    return out;
  }

  function renderSched() {
    var html = '';
    DAYS.forEach(function (dy, i) {
      if (!visible(dy)) return;
      html += '<div class="sf"><label for="def-' + dy.k + '">' + dy.name + '</label><select id="def-' + dy.k + '" data-def="' + i + '">' + options(sched.def[i]) + '</select></div>';
    });
    document.getElementById('sched-fields').innerHTML = html;
  }

  function renderWeeks() {
    var t0 = today0(), html = '', list = all();
    sessions.forEach(function (s, wi) {
      var start = dayOf(wi, 0), end = dayOf(wi, 6);
      var cur = t0 >= start && t0 <= end;
      var items = list.filter(function (x) { return x.wi === wi; });
      var tot = 0, rows = '', seen = {}, dup = false;
      items.forEach(function (x) {
        tot += x.s.km;
        if (seen[x.off]) dup = true;
        seen[x.off] = 1;
        var key = x.id, dn = !!done[key], dayCell;
        if (x.s.type === 'race') {
          dayCell = '<b>' + WD[x.off] + '</b>';
        } else {
          dayCell = '<label class="sr" for="d-' + key + '">Ngày chạy: ' + esc(x.s.title) + '</label><select id="d-' + key + '" data-sel="' + wi + '|' + x.dy.k + '">' + options(x.off) + '</select>';
        }
        rows += '<div class="row' + (dn ? ' done' : '') + '">' +
          (x.s.type === 'rest' ? '<span class="spacer"></span>' :
            '<input type="checkbox" id="c-' + key + '" data-id="' + key + '"' + (dn ? ' checked' : '') + ' aria-label="Đã chạy: ' + esc(x.s.title) + ' ngày ' + fmt(x.date) + '">') +
          '<div class="day">' + dayCell + '<span class="num">' + fmt(x.date) + '</span></div>' +
          '<div class="what"><div><span class="chip t-' + x.s.type + '">' + LABEL[x.s.type] + '</span></div><strong>' + esc(x.s.title) + '</strong><p>' + esc(x.s.d) + '</p>' + actualHtml(key) + noteHtml(key) + '</div>' +
          '<div class="kmv num">' + (x.s.km ? fmtKm(x.s.km) + ' km' : '') + '</div></div>';
      });
      html += '<article class="week' + (cur ? ' current' : '') + '">' +
        '<div class="wk-head"><h3>Tuần ' + (wi + 1) + '</h3><span class="dates num">' + fmt(start) + ' – ' + fmt(end) + '</span>' +
        (cur ? '<span class="chip tag-now">Tuần này</span>' : '') +
        '<span class="sp"></span><span class="km num">' + fmtKm(tot) + ' km</span></div>' +
        '<div class="wk-phase"><span>Giai đoạn: ' + W[wi].ph + '</span>' +
        (dup ? '<span class="chip t-quality">Có 2 buổi trùng ngày</span>' : '') +
        (hasOverride(wi) ? '<button type="button" class="lnk" data-reset="' + wi + '">Đặt lại ngày tuần này</button>' : '') + '</div>' + rows +
        (W[wi].nt ? '<div class="wk-note">' + esc(W[wi].nt) + '</div>' : '') + '</article>';
    });
    document.getElementById('weeks').innerHTML = html;
  }

  function renderChart() {
    var box = document.getElementById('chart');
    if (!box) return;
    var list = all(), t0 = today0();
    var weeks = W.map(function (w, wi) {
      var planned = 0, actual = 0;
      list.filter(function (x) { return x.wi === wi; }).forEach(function (x) {
        planned += x.s.km;
        if (done[x.id]) actual += x.s.km;
      });
      return { wi: wi, planned: planned, actual: Math.min(actual, planned) };
    });
    var max = Math.max.apply(null, weeks.map(function (w) { return w.planned; })) || 1;
    box.innerHTML = weeks.map(function (w) {
      var start = dayOf(w.wi, 0), end = dayOf(w.wi, 6);
      var cur = t0 >= start && t0 <= end;
      var ph = Math.max(2, Math.round(w.planned / max * 100));
      var af = w.planned ? Math.round(w.actual / w.planned * 100) : 0;
      return '<div class="cweek' + (cur ? ' now' : '') + '">' +
        '<span class="cval num">' + fmtKm(w.planned) + '</span>' +
        '<div class="cbar" style="--h:' + ph + '%" title="Tuần ' + (w.wi + 1) + ': ' + fmtKm(w.actual) + ' / ' + fmtKm(w.planned) + ' km đã chạy">' +
        (af > 0 ? '<div class="cfill" style="--f:' + af + '%"></div>' : '') +
        '</div><span class="clabel num">T' + (w.wi + 1) + '</span></div>';
    }).join('');
  }

  function renderProgress() {
    var list = all().filter(function (x) { return x.s.type !== 'rest'; });
    var n = 0, km = 0;
    list.forEach(function (x) { if (done[x.id]) { n++; km += x.s.km; } });
    var pct = list.length ? Math.round(n / list.length * 100) : 0;
    document.getElementById('pfill').style.width = pct + '%';
    document.getElementById('pbar').setAttribute('aria-valuenow', pct);
    document.getElementById('plabel').textContent = n + '/' + list.length + ' buổi đã chạy';
    document.getElementById('pkm').textContent = fmtKm(km) + ' km';
  }

  function renderNext() {
    var t0 = today0(), el = document.getElementById('next');
    var nxt = all().filter(function (x) { return x.s.type !== 'rest' && !done[x.id] && x.date >= t0; })[0];
    if (!nxt) {
      el.innerHTML = '<div class="when"><span class="chip t-rest">Hết lịch</span></div><h2>Không còn buổi nào phía trước</h2><p class="detail">Mọi buổi từ hôm nay đã được đánh dấu hoặc đã qua.</p>';
      return;
    }
    var diff = Math.round((nxt.date - t0) / 864e5);
    var when = diff === 0 ? 'Tối nay' : diff === 1 ? 'Ngày mai' : 'Còn ' + diff + ' ngày nữa';
    el.innerHTML =
      '<div class="when"><span class="chip tag-now">' + when + '</span><span class="num">' + WD[nxt.off] + ' ' + fmt(nxt.date) + ' · Tuần ' + (nxt.wi + 1) + '</span><span class="chip t-' + nxt.s.type + '">' + LABEL[nxt.s.type] + '</span></div>' +
      '<h2>' + esc(nxt.s.title) + '</h2><p class="detail">' + esc(nxt.s.d) + '</p>' +
      (nxt.s.note ? '<p class="note">' + esc(nxt.s.note) + '</p>' : '') +
      (nxt.s.type === 'race' ? '' : '<button type="button" class="btn" data-done="' + nxt.id + '">Đánh dấu đã chạy</button>');
  }

  function renderAll(focusId) {
    var d = Math.max(0, Math.ceil((RACE - today0()) / 864e5));
    document.getElementById('days').textContent = d;
    document.getElementById('m4').setAttribute('aria-pressed', mode === 4);
    document.getElementById('m3').setAttribute('aria-pressed', mode === 3);
    renderSched(); renderChart(); renderWeeks(); renderProgress(); renderNext(); renderStrava();
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
  }

  function setDone(k, v) {
    if (v) done[k] = 1; else delete done[k];
    store.set('bn27-done', JSON.stringify(done));
  }

  function setNote(k, v) {
    var t = String(v || '').trim();
    if (t) notes[k] = t; else delete notes[k];
    store.set('bn27-notes', JSON.stringify(notes));
  }

  document.getElementById('weeks').addEventListener('change', function (e) {
    var t = e.target;
    var sel = t && t.getAttribute('data-sel');
    if (sel) {
      var p = sel.split('|'), wi = +p[0];
      (sched.wk[wi] = sched.wk[wi] || {})[p[1]] = +t.value;
      saveSched(); renderAll(t.id);
      return;
    }
    var k = t && t.getAttribute('data-id');
    if (!k) return;
    setDone(k, t.checked);
    var row = t.closest('.row'); if (row) row.classList.toggle('done', t.checked);
    renderChart(); renderProgress(); renderNext();
  });
  document.getElementById('weeks').addEventListener('click', function (e) {
    var r = e.target && e.target.getAttribute('data-reset');
    if (r == null) return;
    delete sched.wk[r]; saveSched(); renderAll();
  });
  document.getElementById('weeks').addEventListener('input', function (e) {
    var t = e.target, k = t && t.getAttribute('data-note');
    if (!k) return;
    setNote(k, t.value);
  });
  document.getElementById('sched-fields').addEventListener('change', function (e) {
    var i = e.target && e.target.getAttribute('data-def');
    if (i == null) return;
    sched.def[+i] = +e.target.value; saveSched(); renderAll(e.target.id);
  });
  document.getElementById('sched-reset').addEventListener('click', function () {
    sched = { def: defaults(), wk: {} }; saveSched(); renderAll();
  });
  document.getElementById('next').addEventListener('click', function (e) {
    var k = e.target && e.target.getAttribute('data-done');
    if (!k) return;
    setDone(k, true); renderAll();
  });
  document.getElementById('m4').addEventListener('click', function () { mode = 4; store.set('bn27-mode', '4'); renderAll(); });
  document.getElementById('m3').addEventListener('click', function () { mode = 3; store.set('bn27-mode', '3'); renderAll(); });

  /* ---- Ảnh Strava ---- */
  var logs = [], persist = true, sampleFn = null, idbp = null;
  var KIND = { run: 'Chạy', walk: 'Đi bộ', other: 'Khác' };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function openDB() {
    if (idbp) return idbp;
    idbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('bn27-strava', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('logs', { keyPath: 'id' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
        r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return idbp;
  }
  function idbRun(mode, fn) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var tx = db.transaction('logs', mode), req = fn(tx.objectStore('logs'));
          tx.oncomplete = function () { res(req && req.result !== undefined ? req.result : true); };
          tx.onerror = tx.onabort = function () { res(null); };
        } catch (e) { res(null); }
      });
    });
  }
  function saveLog(l) {
    var rec = { id: l.id, blob: l.blob, date: l.date, km: l.km, pace: l.pace, time: l.time, title: l.title, kind: l.kind, link: l.link, added: l.added };
    return idbRun('readwrite', function (st) { return st.put(rec); }).then(function (r) { if (r === null) { persist = false; renderStrava(); } });
  }
  function removeLog(id) { return idbRun('readwrite', function (st) { return st.delete(id); }); }
  function hydrate(r) {
    return { id: r.id, blob: r.blob, url: URL.createObjectURL(r.blob), date: r.date || '', km: r.km || '', pace: r.pace || '', time: r.time || '',
             title: r.title || '', kind: r.kind || 'run', link: r.link || '', added: r.added || 0, msg: '', busy: false, zoom: false, armed: false };
  }
  function loadLogs() {
    return idbRun('readonly', function (st) { return st.getAll(); }).then(function (rows) {
      if (rows === null) { persist = false; return; }
      if (Array.isArray(rows)) logs = rows.filter(function (r) { return r && r.blob; }).map(hydrate);
    });
  }
  function findLog(id) { for (var i = 0; i < logs.length; i++) if (logs[i].id === id) return logs[i]; return null; }

  function actualHtml(key) {
    var l = null;
    for (var i = 0; i < logs.length; i++) if (logs[i].link === key) { l = logs[i]; break; }
    if (!l) return '';
    var bits = [];
    if (Number(l.km) > 0) bits.push(fmtKm(Number(l.km)) + ' km');
    if (l.pace) bits.push(l.pace + '/km');
    if (l.time) bits.push(l.time);
    return '<p class="actual"><span class="chip t-easy">Strava</span><span class="num">' + esc(bits.join(' · ') || 'đã gắn ảnh') + '</span></p>';
  }

  function autoLink(l) {
    if (l.link || !l.date || l.kind === 'walk') return;
    var m = all().filter(function (x) { return x.s.type !== 'rest' && iso(x.date) === l.date; })[0];
    if (m) { l.link = m.id; setDone(m.id, true); }
  }

  function shrink(file) {
    return new Promise(function (res) {
      try {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          var sc = Math.min(1, 1400 / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.88);
        };
        img.onerror = function () { URL.revokeObjectURL(url); res(file); };
        img.src = url;
      } catch (e) { res(file); }
    });
  }

  function addFiles(files) {
    var arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!arr.length) return;
    arr.reduce(function (p, f) {
      return p.then(function () {
        return shrink(f).then(function (b) {
          var l = hydrate({ id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), blob: b, kind: 'run', added: Date.now() });
          logs.unshift(l);
          return saveLog(l);
        });
      });
    }, Promise.resolve()).then(function () { renderAll(); });
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
    var prompt = 'Đây là ảnh chụp màn hình một hoạt động trên Strava. Hôm nay là ' + iso(today0()) + '. ' +
      'Chỉ trả về một đối tượng JSON: {"title": chuỗi hoặc null, "date": "YYYY-MM-DD" hoặc null, "km": số hoặc null, "pace": "m:ss" (phút trên km) hoặc null, "time": "m:ss" hoặc "h:mm:ss" hoặc null, "kind": "run" hoặc "walk" hoặc "other"}. ' +
      'Nếu ảnh ghi "Yesterday" thì date là hôm qua, "Today" là hôm nay; nếu ảnh không ghi năm thì dùng năm của hôm nay. ' +
      'Chỉ lấy số hiển thị trong ảnh, không suy đoán, thiếu thì để null. Nếu có nhiều hoạt động thì đọc hoạt động đầu tiên.';
    return sampleFn.json(prompt, { images: [l.blob] }).then(function (d) {
      if (d && typeof d === 'object') {
        if (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) l.date = d.date;
        var km = Number(d.km);
        if (isFinite(km) && km > 0 && km < 200) l.km = String(Math.round(km * 100) / 100);
        if (typeof d.pace === 'string' && /^\d{1,2}:\d{2}$/.test(d.pace)) l.pace = d.pace;
        if (typeof d.time === 'string' && /^\d{1,2}(:\d{2}){1,2}$/.test(d.time)) l.time = d.time;
        if (typeof d.title === 'string') l.title = d.title.slice(0, 60);
        if (KIND[d.kind]) l.kind = d.kind;
        autoLink(l);
      }
      l.msg = l.km ? 'Claude đã điền số liệu. Hãy kiểm tra lại với ảnh.' : 'Không thấy số liệu trong ảnh, hãy nhập tay.';
      return saveLog(l);
    }).catch(function (e) {
      var c = e && e.code;
      l.msg = COPY[c] || 'Chưa đọc được ảnh lúc này, hãy nhập tay hoặc thử lại.';
      if (c === 'not_granted' || c === 'sampling_disabled' || c === 'images_unavailable') sampleFn = null;
    }).then(function () { l.busy = false; renderAll(); });
  }

  function renderStrava() {
    var box = document.getElementById('sv-list');
    var runs = logs.filter(function (l) { return l.kind !== 'walk' && Number(l.km) > 0; });
    var km = runs.reduce(function (a, l) { return a + Number(l.km); }, 0);
    document.getElementById('sv-sum').textContent = logs.length ? logs.length + ' ảnh · ' + fmtKm(km) + ' km chạy đã ghi (không tính đi bộ)' : 'Chưa có ảnh nào.';
    document.getElementById('sv-read-all').hidden = !(sampleFn && logs.some(function (l) { return !l.km && !l.busy; }));
    document.getElementById('sv-note').textContent = persist ? '' : 'Trình duyệt này không cho lưu ảnh nên ảnh chỉ còn đến khi bạn đóng trang.';
    var sess = all().filter(function (x) { return x.s.type !== 'rest'; });
    var list = logs.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || b.added - a.added; });
    box.innerHTML = list.map(function (l) {
      var p = 'lg-' + l.id + '-';
      var linkOpts = '<option value="">Chưa gắn vào buổi nào</option>' + sess.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === l.link ? ' selected' : '') + '>Tuần ' + (x.wi + 1) + ' · ' + WD[x.off] + ' ' + fmt(x.date) + ' · ' + esc(x.s.title) + '</option>';
      }).join('');
      var kindOpts = Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (k === l.kind ? ' selected' : '') + '>' + KIND[k] + '</option>'; }).join('');
      return '<article class="lg' + (l.zoom ? ' zoom' : '') + '" data-id="' + l.id + '">' +
        '<button type="button" class="lg-thumb" data-act="zoom" aria-label="' + (l.zoom ? 'Thu nhỏ ảnh' : 'Phóng to ảnh') + '"><img src="' + l.url + '" alt="Ảnh chụp màn hình Strava"></button>' +
        '<div class="lg-body"><div class="lg-fields">' +
        '<label class="fld"><span>Ngày</span><input type="date" id="' + p + 'date" data-f="date" value="' + esc(l.date) + '"></label>' +
        '<label class="fld"><span>Loại</span><select id="' + p + 'kind" data-f="kind">' + kindOpts + '</select></label>' +
        '<label class="fld"><span>Quãng đường (km)</span><input type="text" inputmode="decimal" id="' + p + 'km" data-f="km" value="' + esc(l.km) + '" placeholder="6,03"></label>' +
        '<label class="fld"><span>Pace (phút/km)</span><input type="text" id="' + p + 'pace" data-f="pace" value="' + esc(l.pace) + '" placeholder="7:17"></label>' +
        '<label class="fld"><span>Thời gian</span><input type="text" id="' + p + 'time" data-f="time" value="' + esc(l.time) + '" placeholder="43:56"></label>' +
        '<label class="fld wide"><span>Buổi trong giáo án</span><select id="' + p + 'link" data-f="link">' + linkOpts + '</select></label>' +
        '</div>' + (l.msg ? '<div class="lg-msg">' + esc(l.msg) + '</div>' : '') +
        '<div class="lg-actions">' +
        (sampleFn ? '<button type="button" class="btn-sm" data-act="read"' + (l.busy ? ' disabled' : '') + '>Đọc bằng Claude</button>' : '') +
        '<button type="button" class="btn-sm" data-act="del" data-armed="' + (l.armed ? 1 : 0) + '">' + (l.armed ? 'Bấm lại để xóa' : 'Xóa ảnh') + '</button>' +
        '</div></div></article>';
    }).join('');
  }

  var svList = document.getElementById('sv-list');
  svList.addEventListener('change', function (e) {
    var t = e.target, f = t && t.getAttribute('data-f'), art = t && t.closest('.lg');
    if (!f || !art) return;
    var l = findLog(art.getAttribute('data-id'));
    if (!l) return;
    var v = String(t.value).trim();
    if (f === 'link') { l.link = v; if (v) setDone(v, true); }
    else if (f === 'km') l.km = v.replace(',', '.');
    else l[f] = v;
    if (f === 'date' || f === 'kind') autoLink(l);
    saveLog(l);
    renderAll(t.id);
  });
  svList.addEventListener('click', function (e) {
    var b = e.target && e.target.closest('[data-act]'), art = e.target && e.target.closest('.lg');
    if (!b || !art) return;
    var l = findLog(art.getAttribute('data-id'));
    if (!l) return;
    var act = b.getAttribute('data-act');
    if (act === 'zoom') { l.zoom = !l.zoom; renderStrava(); }
    else if (act === 'read') readLog(l);
    else if (act === 'del') {
      if (!l.armed) {
        l.armed = true; renderStrava();
        setTimeout(function () { if (l.armed) { l.armed = false; renderStrava(); } }, 4000);
      } else {
        try { URL.revokeObjectURL(l.url); } catch (x) {}
        logs = logs.filter(function (z) { return z !== l; });
        removeLog(l.id); renderAll();
      }
    }
  });
  document.getElementById('sv-read-all').addEventListener('click', function () {
    logs.filter(function (l) { return !l.km && !l.busy; }).reduce(function (p, l) { return p.then(function () { return readLog(l); }); }, Promise.resolve());
  });
  var svFile = document.getElementById('sv-file'), svDrop = document.getElementById('sv-drop');
  svFile.addEventListener('change', function () { addFiles(svFile.files); svFile.value = ''; });
  ['dragenter', 'dragover'].forEach(function (n) { svDrop.addEventListener(n, function (e) { e.preventDefault(); svDrop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { svDrop.addEventListener(n, function (e) { e.preventDefault(); svDrop.classList.remove('over'); }); });
  svDrop.addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });

  renderAll();
  loadLogs().then(function () { renderAll(); });
  try {
    if (window.claude && window.claude.use) {
      window.claude.use('sample').then(function (s) {
        if (!s) return;
        return s.limits().then(function (lim) { if (lim && lim.images) { sampleFn = s; renderStrava(); } });
      }).catch(function () {});
    }
  } catch (e) {}

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
