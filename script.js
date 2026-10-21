(function () {

  /* ================= hiệu ứng ăn mừng (canvas) ================= */
  var FX = (function () {
    var cvs = null, ctx = null, parts = [], raf = 0, w = 0, h = 0, dpr = 1, booted = false;
    var COLORS = ['#46C9C1', '#FF9460', '#9EABFF', '#FFD166', '#FF5D8F', '#FFFFFF'];
    var TIER = {
      easy:      { spark: 26, conf: 16, ring: 1, rocket: 0, power: 4.2 },
      quality:   { spark: 38, conf: 26, ring: 1, rocket: 1, power: 5.0 },
      long:      { spark: 42, conf: 30, ring: 1, rocket: 1, power: 5.2 },
      week:      { spark: 58, conf: 44, ring: 2, rocket: 3, power: 6.0 },
      milestone: { spark: 68, conf: 58, ring: 2, rocket: 4, power: 6.4 },
      race:      { spark: 92, conf: 84, ring: 3, rocket: 6, power: 7.0 }
    };

    function reduced() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function boot() {
      if (booted) return !!ctx;
      booted = true;
      cvs = document.getElementById('fx');
      if (!cvs || !cvs.getContext) return false;
      ctx = cvs.getContext('2d');
      if (!ctx) return false;
      resize();
      window.addEventListener('resize', resize);
      return true;
    }
    function resize() {
      if (!ctx) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
      cvs.style.width = w + 'px'; cvs.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }

    function spark(x, y, power) {
      var a = rnd(0, Math.PI * 2), sp = rnd(power * 0.25, power);
      return { k: 's', x: x, y: y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
               g: 0.085, drag: 0.975, delay: 0, life: 0, max: rnd(38, 70), c: pick(COLORS), r: rnd(1.4, 3) };
    }
    function conf(x, y, power) {
      var a = rnd(0, Math.PI * 2), sp = rnd(power * 0.3, power * 0.9);
      return { k: 'c', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4,
               g: 0.14, drag: 0.985, delay: 0, life: 0, max: rnd(70, 125), c: pick(COLORS),
               bw: rnd(5, 9), bh: rnd(8, 14), rot: rnd(0, Math.PI), vr: rnd(-0.22, 0.22), sway: rnd(0.02, 0.06), ph: rnd(0, 6) };
    }
    function ring(x, y, delay) {
      return { k: 'r', x: x, y: y, delay: delay || 0, life: 0, max: 26, c: pick(COLORS), r: 6, vr: 4.4 };
    }
    function rocket(power, delay) {
      var x = rnd(w * 0.15, w * 0.85);
      return { k: 'k', x: x, y: h + 10, px: x, py: h + 10, vx: rnd(-0.7, 0.7), vy: -rnd(9.5, 13.5),
               g: 0.16, drag: 0.995, delay: delay || 0, life: 0, max: rnd(32, 50), c: pick(COLORS), r: 2.2, power: power };
    }
    function explode(into, x, y, power, n) {
      for (var i = 0; i < n; i++) into.push(spark(x, y, power));
      into.push(ring(x, y, 0));
    }

    function tick() {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      var next = [], i, p;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.delay > 0) { p.delay--; next.push(p); continue; }
        p.life++;
        var t = p.life / p.max;
        var fade = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1;

        if (p.k === 's' || p.k === 'k') {
          p.px = p.x; p.py = p.y;
          p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
          p.x += p.vx; p.y += p.vy;
          ctx.globalAlpha = fade;
          ctx.strokeStyle = p.c; ctx.lineWidth = p.r; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
        } else if (p.k === 'c') {
          p.ph += p.sway;
          p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
          p.x += p.vx + Math.cos(p.ph) * 0.9; p.y += p.vy;
          p.rot += p.vr;
          ctx.globalAlpha = fade;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.bw / 2, -p.bh / 2, p.bw, Math.max(1, p.bh * Math.abs(Math.cos(p.ph))));
          ctx.restore();
        } else {
          p.r += p.vr; p.vr *= 0.93;
          ctx.globalAlpha = Math.max(0, 1 - t) * 0.6;
          ctx.strokeStyle = p.c; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        }

        var spent = p.life >= p.max;
        if (!spent && p.y < h + 90) next.push(p);
        else if (spent && p.k === 'k') explode(next, p.x, p.y, p.power, 26);
      }
      ctx.globalAlpha = 1;
      parts = next;
      if (parts.length) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    }

    return {
      party: function (tier, el) {
        if (reduced() || !boot()) return;
        var cfg = TIER[tier] || TIER.easy;
        var x = w / 2, y = h * 0.4, r, i;
        if (el && el.getBoundingClientRect) {
          r = el.getBoundingClientRect();
          if (r.width || r.height) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
        }
        for (i = 0; i < cfg.spark; i++) parts.push(spark(x, y, cfg.power));
        for (i = 0; i < cfg.conf; i++) parts.push(conf(x, y, cfg.power));
        for (i = 0; i < cfg.ring; i++) parts.push(ring(x, y, i * 7));
        for (i = 0; i < cfg.rocket; i++) parts.push(rocket(cfg.power, 8 + i * 13));
        if (parts.length > 1000) parts = parts.slice(parts.length - 1000);
        if (!raf) raf = requestAnimationFrame(tick);
      }
    };
  })();

  /* ================= dữ liệu giáo án ================= */
  var RACE = new Date(2027, 0, 10);
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
    { ph: 'Xây sức bền', e: [5, 5], l: 9, nt: 'Buổi chất lượng tuần này là chạy thử 5 km. Kết quả quyết định mục tiêu pace, xem bảng ở tab Tham khảo.', q: { t: 'Chạy thử 5 km hết sức', d: 'Khởi động 15 phút nhẹ, 5 km nhanh nhất có thể mà không đi bộ, hạ nhiệt 10 phút. Chạy trên đường phẳng, ghi lại thời gian.', km: 7 } },
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

  /* ================= trạng thái lưu trong trình duyệt ================= */
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

  /* ================= tiện ích ================= */
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
  function el(i) { return document.getElementById(i); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
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
  function findSession(sid) {
    var list = all();
    for (var i = 0; i < list.length; i++) if (list[i].id === sid) return list[i];
    return null;
  }
  function stats() {
    var list = all().filter(function (x) { return x.s.type !== 'rest'; });
    var n = 0, km = 0;
    list.forEach(function (x) { if (done[x.id]) { n++; km += x.s.km; } });
    return { n: n, total: list.length, km: km, pct: list.length ? Math.round(n / list.length * 100) : 0 };
  }
  function weekComplete(wi) {
    var items = all().filter(function (x) { return x.wi === wi && x.s.type !== 'rest'; });
    return items.length > 0 && items.every(function (x) { return !!done[x.id]; });
  }
  function weekKm(wi) {
    return all().filter(function (x) { return x.wi === wi; }).reduce(function (a, x) { return a + x.s.km; }, 0);
  }

  /* ================= render ================= */
  function renderSched() {
    var box = el('sched-fields');
    if (!box) return;
    var html = '';
    DAYS.forEach(function (dy, i) {
      if (!visible(dy)) return;
      html += '<div class="sf"><label for="def-' + dy.k + '">' + dy.name + '</label><select id="def-' + dy.k + '" data-def="' + i + '">' + options(sched.def[i]) + '</select></div>';
    });
    box.innerHTML = html;
  }

  function renderWeeks() {
    var box = el('weeks');
    if (!box) return;
    var t0 = today0(), html = '', list = all();
    sessions.forEach(function (s, wi) {
      var start = dayOf(wi, 0), end = dayOf(wi, 6);
      var cur = t0 >= start && t0 <= end;
      var items = list.filter(function (x) { return x.wi === wi; });
      var tot = 0, rows = '', seen = {}, dup = false, full = weekComplete(wi);
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
      html += '<article class="week' + (cur ? ' current' : '') + (full ? ' full' : '') + '">' +
        '<div class="wk-head"><h3>Tuần ' + (wi + 1) + '</h3><span class="dates num">' + fmt(start) + ' – ' + fmt(end) + '</span>' +
        (cur ? '<span class="chip tag-now">Tuần này</span>' : '') +
        (full ? '<span class="chip t-easy chip-full">Xong cả tuần</span>' : '') +
        '<span class="sp"></span><span class="km num">' + fmtKm(tot) + ' km</span></div>' +
        '<div class="wk-phase"><span>Giai đoạn: ' + W[wi].ph + '</span>' +
        (dup ? '<span class="chip t-quality">Có 2 buổi trùng ngày</span>' : '') +
        (hasOverride(wi) ? '<button type="button" class="lnk" data-reset="' + wi + '">Đặt lại ngày tuần này</button>' : '') + '</div>' + rows +
        (W[wi].nt ? '<div class="wk-note">' + esc(W[wi].nt) + '</div>' : '') + '</article>';
    });
    box.innerHTML = html;
  }

  // Cập nhật tại chỗ thay vì vẽ lại cả danh sách tuần, để không xoá mất
  // hiệu ứng của dòng vừa tick và ô đang được thao tác.
  function syncWeekBadge(wi) {
    var card = document.querySelectorAll('#weeks .week')[wi];
    if (!card) return;
    var full = weekComplete(wi), head = card.querySelector('.wk-head');
    card.classList.toggle('full', full);
    if (!head) return;
    var chip = head.querySelector('.chip-full');
    if (full && !chip) {
      chip = document.createElement('span');
      chip.className = 'chip t-easy chip-full';
      chip.textContent = 'Xong cả tuần';
      head.insertBefore(chip, head.querySelector('.sp'));
    } else if (!full && chip) {
      chip.parentNode.removeChild(chip);
    }
  }

  var chartSeen = false;
  function renderChart() {
    var box = el('chart');
    if (!box) return;
    var list = all(), t0 = today0();
    var weeks = sessions.map(function (s, wi) {
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
      return '<div class="cweek' + (cur ? ' now' : '') + '" style="--i:' + w.wi + '">' +
        '<span class="cval num">' + fmtKm(w.planned) + '</span>' +
        '<div class="cbar" style="--h:' + ph + '%" title="Tuần ' + (w.wi + 1) + ': ' + fmtKm(w.actual) + ' / ' + fmtKm(w.planned) + ' km đã chạy">' +
        (af > 0 ? '<div class="cfill" style="--f:' + af + '%"></div>' : '') +
        '</div><span class="clabel num">T' + (w.wi + 1) + '</span></div>';
    }).join('');
    if (!chartSeen) { chartSeen = true; box.classList.add('in'); }
  }

  function renderProgress() {
    var st = stats(), fill = el('pfill'), bar = el('pbar');
    if (fill) fill.style.width = st.pct + '%';
    if (bar) bar.setAttribute('aria-valuenow', st.pct);
    if (el('plabel')) el('plabel').textContent = st.n + '/' + st.total + ' buổi đã chạy';
    if (el('pkm')) el('pkm').textContent = fmtKm(st.km) + ' km';
    NT.sync();
  }

  function renderNext() {
    var box = el('next');
    if (!box) return;
    var t0 = today0();
    var nxt = all().filter(function (x) { return x.s.type !== 'rest' && !done[x.id] && x.date >= t0; })[0];
    if (!nxt) {
      box.innerHTML = '<div class="when"><span class="chip t-rest">Hết lịch</span></div><h2>Không còn buổi nào phía trước</h2><p class="detail">Mọi buổi từ hôm nay đã được đánh dấu hoặc đã qua.</p>';
      return;
    }
    var diff = Math.round((nxt.date - t0) / 864e5);
    var when = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : 'Còn ' + diff + ' ngày nữa';
    box.innerHTML =
      '<div class="when"><span class="chip tag-now">' + when + '</span><span class="num">' + WD[nxt.off] + ' ' + fmt(nxt.date) + ' · Tuần ' + (nxt.wi + 1) + '</span><span class="chip t-' + nxt.s.type + '">' + LABEL[nxt.s.type] + '</span></div>' +
      '<h2>' + esc(nxt.s.title) + '</h2><p class="detail">' + esc(nxt.s.d) + '</p>' +
      (nxt.s.note ? '<p class="note">' + esc(nxt.s.note) + '</p>' : '') +
      (nxt.s.type === 'race' ? '' : '<button type="button" class="btn" data-done="' + nxt.id + '">Đánh dấu đã chạy</button>');
  }

  function renderAll(focusId) {
    var d = Math.max(0, Math.ceil((RACE - today0()) / 864e5));
    if (el('days')) el('days').textContent = d;
    if (el('m4')) el('m4').setAttribute('aria-pressed', mode === 4);
    if (el('m3')) el('m3').setAttribute('aria-pressed', mode === 3);
    renderSched(); renderChart(); renderWeeks(); renderProgress(); renderNext(); renderStrava();
    if (focusId) { var f = el(focusId); if (f) f.focus(); }
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

  /* ================= chúc mừng ================= */
  var CHEER = {
    easy: ['Xong buổi nhẹ!', 'Nhẹ nhàng mà chắc!', 'Thêm một buổi vào sổ!', 'Đều đặn là thắng!'],
    quality: ['Buổi chất lượng xong!', 'Ngưỡng vừa được đẩy lên!', 'Đó mới là tốc độ!', 'Chân vừa học được cách chạy nhanh!'],
    long: ['Chạy dài xong!', 'Nền sức bền dày thêm một lớp!', 'Đường dài không làm khó được bạn!'],
    week: ['Trọn vẹn một tuần!', 'Không sót buổi nào cả tuần!', 'Tuần hoàn hảo!'],
    milestone: ['Cột mốc mới!', 'Giáo án đã đi được một đoạn dài!', 'Nhìn lại mà xem, xa phết rồi!'],
    race: ['VỀ ĐÍCH!', 'Bắc Ninh Legacy 10K — hoàn thành!', 'Bạn đã làm được!']
  };

  function toast(title, sub) {
    var wrap = el('toasts');
    if (!wrap) return;
    while (wrap.children.length > 1) wrap.removeChild(wrap.firstChild);
    var box = document.createElement('div');
    box.className = 'toast';
    box.innerHTML = '<strong>' + esc(title) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '');
    wrap.appendChild(box);
    function close() {
      box.classList.add('out');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 420);
    }
    var timer = setTimeout(close, 3600);
    box.addEventListener('click', function () { clearTimeout(timer); close(); });
  }

  function crossed(prev, now) {
    var marks = [25, 50, 75, 100];
    for (var i = marks.length - 1; i >= 0; i--) if (prev < marks[i] && now >= marks[i]) return marks[i];
    return 0;
  }

  function celebrate(sid, anchor, prevPct) {
    var x = findSession(sid);
    if (!x) return;
    var st = stats();
    var ms = crossed(prevPct, st.pct);
    var full = weekComplete(x.wi);
    var tier = x.s.type === 'race' ? 'race' : full ? 'week' : x.s.type === 'long' ? 'long' : x.s.type === 'quality' ? 'quality' : 'easy';
    if (ms === 100) tier = 'race';
    else if (ms) tier = 'milestone';

    var sub;
    if (ms) sub = 'Đã xong ' + ms + '% giáo án · ' + st.n + '/' + st.total + ' buổi · ' + fmtKm(st.km) + ' km';
    else if (tier === 'week') sub = 'Tuần ' + (x.wi + 1) + ' trọn vẹn · ' + fmtKm(weekKm(x.wi)) + ' km';
    else sub = x.s.title + (x.s.km ? ' · ' + fmtKm(x.s.km) + ' km' : '');

    FX.party(tier, anchor);
    toast(pick(CHEER[tier]), sub);
    renderQuote();
  }

  /* ================= câu truyền động lực ================= */
  var lastQuote = -1;
  function renderQuote() {
    var qs = window.BN_QUOTES, qEl = el('quote-q'), aEl = el('quote-a');
    if (!qEl || !aEl || !qs || !qs.length) return;
    var i = (Math.random() * qs.length) | 0;
    if (qs.length > 1) while (i === lastQuote) i = (Math.random() * qs.length) | 0;
    lastQuote = i;
    qEl.textContent = '“' + qs[i].q + '”';
    aEl.textContent = '— ' + qs[i].a;
  }

  /* ================= nhắc chạy qua thông báo ================= */
  var REST_TIPS = ['Tập chống đẩy hoặc squat vài hiệp cho chân khỏe.'];
  function loadTips() {
    return fetch('rest-tips.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (Array.isArray(d) && d.length) REST_TIPS = d; })
      .catch(function () {});
  }

  var NT = (function () {
    var KEY = 'bn27-notify';
    // "99:99" vẫn khớp \d{2}:\d{2} nên phải xét cả khoảng giá trị, không thì
    // giờ nhắc vô nghĩa sẽ làm phần nhắc im lặng không chạy.
    function okTime(t) {
      var m = typeof t === 'string' ? /^(\d{2}):(\d{2})$/.exec(t) : null;
      return !!m && +m[1] <= 23 && +m[2] <= 59;
    }
    var cfg = { on: false, time: '06:30' };
    try {
      var s = JSON.parse(store.get(KEY) || 'null');
      if (s && typeof s === 'object') {
        cfg.on = !!s.on;
        if (okTime(s.time)) cfg.time = s.time;
      }
    } catch (e) {}
    var timer = 0, hasPush = false;

    function save() { store.set(KEY, JSON.stringify(cfg)); }
    function canNotify() { return 'Notification' in window && 'serviceWorker' in navigator; }
    function granted() { return canNotify() && Notification.permission === 'granted'; }
    function stateUrl() { return new URL('state.json', location.href).href; }

    // Service worker không đọc được localStorage, nên trạng thái được chép
    // sang Cache để lần chạy nền sau còn biết hôm nay có buổi nào chưa xong.
    function buildDays() {
      return all().filter(function (x) { return x.s.type !== 'rest'; }).map(function (x) {
        return { date: iso(x.date), title: x.s.title, done: !!done[x.id] };
      });
    }

    function syncState() {
      pushState();
      if (!('caches' in window)) return Promise.resolve();
      var body = JSON.stringify({ on: cfg.on, time: cfg.time, days: buildDays(), tips: REST_TIPS });
      return caches.open('bn27-state')
        .then(function (c) { return c.put(stateUrl(), new Response(body, { headers: { 'Content-Type': 'application/json' } })); })
        .catch(function () {});
    }

    function planRange() {
      var ds = all().filter(function (x) { return x.s.type !== 'rest'; })
        .map(function (x) { return iso(x.date); }).sort();
      return ds.length ? { first: ds[0], last: ds[ds.length - 1] } : null;
    }

    // Nội dung nhắc cho hôm nay, hoặc null nếu không cần nhắc: ngày có buổi
    // chạy thì nhắc buổi đó, ngày trống trong kỳ giáo án thì gợi ý bài tập,
    // buổi đã đánh dấu xong rồi thì thôi.
    function todayPlan() {
      var key = iso(today0());
      var todays = all().filter(function (x) { return x.s.type !== 'rest' && iso(x.date) === key; });
      var undone = todays.filter(function (x) { return !done[x.id]; })[0];
      if (undone) return { title: 'Hôm nay có buổi chạy', body: undone.s.title };
      if (todays.length) return null;
      var r = planRange();
      if (!r || key < r.first || key > r.last) return null;
      return { title: 'Hôm nay không có buổi chạy', body: REST_TIPS[(Math.random() * REST_TIPS.length) | 0] };
    }

    function show(title, body) {
      if (!granted()) return Promise.resolve();
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.showNotification(title, {
          body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
          tag: 'bn27-remind', data: { url: location.href }
        });
      }).catch(function () {});
    }

    function remindAt() {
      var hm = cfg.time.split(':');
      var at = new Date();
      at.setHours(+hm[0], +hm[1], 0, 0);
      return at;
    }

    function schedule() {
      clearTimeout(timer);
      if (!cfg.on || !granted()) return;
      if (!todayPlan()) return;
      var ms = remindAt() - new Date();
      if (ms <= 0) return;
      // chỉ đặt được khi trang còn mở; đóng tab thì phần chạy nền lo tiếp
      timer = setTimeout(function () {
        var p = todayPlan();
        if (p) show(p.title, p.body);
      }, Math.min(ms, 0x7fffffff));
    }

    // Đã quá giờ nhắc mà hôm nay vẫn còn việc cần nhắc thì nhắc ngay.
    function nudgeIfDue() {
      var p = todayPlan();
      if (!p || new Date() < remindAt()) return false;
      show(p.title, p.body);
      return true;
    }

    function registerPeriodic() {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.ready.then(function (reg) {
        if (!reg.periodicSync) return;
        return reg.periodicSync.register('bn27-remind', { minInterval: 12 * 60 * 60 * 1000 });
      }).catch(function () {});
    }

    /* --- Web Push qua máy chủ: nhắc đúng giờ cả khi đã đóng app --- */
    var pushSub = null, pushTimer = 0;

    function b64ToBytes(s) {
      var pad = '='.repeat((4 - (s.length % 4)) % 4);
      var raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
      var out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }

    function vapidKey() {
      return fetch('api/vapid')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && d.key ? d.key : null; })
        .catch(function () { return null; });
    }

    // Không có backend (mở từ file hoặc GitHub Pages) thì bỏ qua, phần nhắc
    // cục bộ vẫn chạy như cũ.
    function enablePush() {
      if (!('PushManager' in window) || !granted()) return Promise.resolve(false);
      return vapidKey().then(function (key) {
        if (!key) return false;
        return navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager.getSubscription().then(function (existing) {
            if (existing) return existing;
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
          });
        }).then(function (sub) {
          pushSub = sub;
          return postSub(sub);
        }).then(function () { return true; });
      }).catch(function () { return false; });
    }

    function postSub(sub) {
      if (!sub) return Promise.resolve();
      return fetch('api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          on: cfg.on,
          time: cfg.time,
          tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || 'Asia/Ho_Chi_Minh',
          days: buildDays()
        })
      }).catch(function () {});
    }

    // Gộp nhiều lần render thành một lần gửi.
    function pushState() {
      if (!pushSub) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () { postSub(pushSub); }, 2000);
    }

    // Máy chủ trả mã lỗi cụ thể, dịch ra việc cần làm thay vì báo chung chung.
    var PUSH_ERR = {
      push_not_configured: 'Thiếu VAPID_PRIVATE_KEY trên Vercel. Dán đủ biến môi trường rồi deploy lại.',
      storage_not_configured: 'Chưa nối kho Upstash Redis trên Vercel (Project → Storage → Connect), hoặc nối xong chưa deploy lại.',
      subscription_not_registered: 'Máy này chưa được lưu lên máy chủ. Tắt rồi bật lại nhắc nhở.',
      no_subscriptions: 'Chưa có máy nào đăng ký nhận thông báo.',
      need_subscription_or_secret: 'Thiếu thông tin đăng ký khi gọi máy chủ.'
    };

    function tryPush(allowRetry) {
      return fetch('api/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: pushSub })
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) { return { status: r.status, d: d }; });
      }).then(function (out) {
        var d = out.d || {};
        if (out.status === 200 && d.ok) return '';

        // Subscription chưa nằm trong kho: lưu lại rồi thử đúng một lần nữa.
        if (d.error === 'subscription_not_registered' && allowRetry) {
          return postSub(pushSub).then(function () { return tryPush(false); });
        }
        if (out.status === 404 && !d.error) return 'Máy chủ không có /api/test-push. Bản deploy có thể chưa xong.';
        if (PUSH_ERR[d.error]) return PUSH_ERR[d.error];

        // Dịch vụ push của trình duyệt từ chối: hay gặp khi khoá VAPID đổi
        // sau lúc máy này đăng ký.
        var e0 = (d.errors && d.errors[0]) || null;
        if (e0 && (e0.status === 403 || e0.status === 400)) {
          return 'Khoá VAPID không khớp với đăng ký cũ của máy này. Tắt rồi bật lại nhắc nhở.';
        }
        if (e0) return 'Dịch vụ push trả lỗi ' + e0.status + ': ' + e0.message;
        return 'Máy chủ trả lỗi ' + out.status + (d.error ? ' (' + d.error + ')' : '') + '.';
      }).catch(function () {
        return 'Không gọi được máy chủ. Kiểm tra mạng hoặc trang đã deploy chưa.';
      });
    }

    function disablePush() {
      if (!pushSub) return Promise.resolve();
      var sub = pushSub;
      pushSub = null;
      clearTimeout(pushTimer);
      return fetch('api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      }).catch(function () {}).then(function () {
        return sub.unsubscribe ? sub.unsubscribe().catch(function () {}) : null;
      });
    }

    function render() {
      var btn = el('nt-toggle'), st = el('nt-status'), tm = el('nt-time'), test = el('nt-test');
      if (!btn || !st) return;
      if (tm) tm.value = cfg.time;
      if (test) test.hidden = !granted() || !cfg.on;

      if (!canNotify()) {
        btn.disabled = true;
        btn.textContent = 'Không dùng được';
        st.textContent = 'Trình duyệt này chưa cho gửi thông báo. Trên iPhone, hãy bấm Chia sẻ → Thêm vào màn hình chính, rồi mở lại từ icon đó.';
        return;
      }
      btn.disabled = false;
      if (Notification.permission === 'denied') {
        btn.textContent = 'Đã bị chặn';
        btn.disabled = true;
        st.textContent = 'Bạn đã chặn thông báo cho trang này. Mở lại trong cài đặt trình duyệt rồi quay lại đây.';
        return;
      }
      btn.textContent = cfg.on && granted() ? 'Tắt nhắc nhở' : 'Bật nhắc nhở';
      if (!cfg.on || !granted()) { st.textContent = 'Đang tắt.'; return; }
      st.textContent = hasPush
        ? 'Đang bật kèm thông báo đẩy từ máy chủ, nhắc lúc 6:30 sáng mỗi ngày kể cả khi đã đóng app.'
        : 'Đang bật, nhắc lúc ' + cfg.time + ' nhưng chỉ khi app đang mở hoặc khi điện thoại đánh thức app chạy nền. Máy chủ đẩy thông báo chưa sẵn sàng.';
    }

    function enable() {
      if (!canNotify()) return;
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') {
          cfg.on = true; save();
          syncState(); registerPeriodic();
          // Dùng chung tag nên chỉ gửi một cái: ưu tiên lời nhắc thật.
          if (!nudgeIfDue()) show('Đã bật nhắc chạy', 'Sẽ nhắc lúc ' + cfg.time + ' vào ngày có buổi chạy.');
          schedule();
          enablePush().then(function (ok) { hasPush = ok; render(); });
        }
        render();
      }).catch(function () { render(); });
    }

    function disable() {
      cfg.on = false; save(); clearTimeout(timer);
      syncState();
      disablePush().then(function () { hasPush = false; render(); });
      render();
    }

    return {
      render: render,
      // Lần mở sau: nối lại subscription cũ để trạng thái giáo án tiếp tục
      // được đẩy lên máy chủ.
      init: function () {
        render();
        if (cfg.on && granted()) {
          registerPeriodic();
          schedule();
          enablePush().then(function (ok) { hasPush = ok; render(); });
        }
      },
      sync: function () { syncState(); schedule(); },
      // Hỏi thẳng máy chủ xem còn thiếu mảnh nào, đỡ phải đoán.
      health: function () {
        var st = el('nt-status');
        if (st) st.textContent = 'Đang kiểm tra máy chủ...';
        fetch('api/health')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!st) return;
            if (!d) { st.textContent = 'Không gọi được /api/health. Bản deploy có thể chưa xong.'; return; }
            var bad = [];
            if (!d.vapidPublic) bad.push('thiếu VAPID_PUBLIC_KEY');
            if (!d.vapidPrivate) bad.push('thiếu VAPID_PRIVATE_KEY');
            if (d.storage === 'missing_env') bad.push('chưa nối kho Upstash Redis');
            if (d.storage === 'wrong_env_shape') bad.push('kho nối sai kiểu biến');
            if (d.storage === 'unreachable') bad.push('không kết nối được Upstash (' + (d.storageError || '') + ')');
            var keys = (d.envKeys || []).join(', ') || 'không có biến nào';
            // VAPID_SUBJECT không bắt buộc nhưng thiếu thì Apple hay từ chối,
            // nên nhắc riêng chứ không tính là hỏng.
            var warn = d.vapidSubject ? '' : ' Lưu ý: chưa đặt VAPID_SUBJECT, iPhone có thể từ chối nhận.';
            st.textContent = bad.length
              ? 'Máy chủ còn thiếu: ' + bad.join('; ') + '. ' + (d.hint ? d.hint + ' ' : '')
                + 'Biến đang có trên server: ' + keys + '. Sửa trên Vercel rồi deploy lại.'
              : 'Máy chủ sẵn sàng, đang có ' + d.subscriptions + ' máy đăng ký nhận thông báo.' + warn;
          })
          .catch(function () { if (st) st.textContent = 'Không gọi được /api/health.'; });
      },
      toggle: function () { if (cfg.on && granted()) disable(); else enable(); },
      setTime: function (v) {
        if (!okTime(v)) return;
        cfg.time = v; save(); syncState(); schedule(); render();
      },
      // Có push thật thì thử luôn đường đi qua máy chủ, vì đó mới là thứ
      // hoạt động khi app đã đóng. Không có thì báo cục bộ.
      test: function () {
        var st = el('nt-status');
        if (!pushSub) {
          show('Thử thông báo cục bộ', 'Thông báo này từ chính máy bạn, chưa phải từ máy chủ.');
          toast('Chưa có push từ máy chủ', 'Bấm "Kiểm tra máy chủ" để xem còn thiếu gì.');
          return;
        }
        if (st) st.textContent = 'Đang gửi thử qua máy chủ...';
        tryPush(true).then(function (msg) {
          if (msg) {
            if (st) st.textContent = msg;
            toast('Gửi thử thất bại', msg);
          } else {
            toast('Đã gửi từ máy chủ', 'Thông báo sẽ hiện ra trong vài giây.');
            render();
          }
        });
      }
    };
  })();

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
    store.set('bn27-tab', name);
    if (scroll) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
  }
  function jumpNow() {
    var target = document.querySelector('#weeks .week.current') || document.querySelector('#weeks .week');
    if (!target) return;
    try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { target.scrollIntoView(); }
  }

  /* ================= ảnh Strava ================= */
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
  function idbRun(m, fn) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var tx = db.transaction('logs', m), req = fn(tx.objectStore('logs'));
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
  function removeLog(lid) { return idbRun('readwrite', function (st) { return st.delete(lid); }); }
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
  function findLog(lid) { for (var i = 0; i < logs.length; i++) if (logs[i].id === lid) return logs[i]; return null; }

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
    var box = el('sv-list');
    if (!box) return;
    var runs = logs.filter(function (l) { return l.kind !== 'walk' && Number(l.km) > 0; });
    var km = runs.reduce(function (a, l) { return a + Number(l.km); }, 0);
    if (el('sv-sum')) el('sv-sum').textContent = logs.length ? logs.length + ' ảnh · ' + fmtKm(km) + ' km chạy đã ghi (không tính đi bộ)' : 'Chưa có ảnh nào.';
    if (el('sv-read-all')) el('sv-read-all').hidden = !(sampleFn && logs.some(function (l) { return !l.km && !l.busy; }));
    if (el('sv-note')) el('sv-note').textContent = persist ? '' : 'Trình duyệt này không cho lưu ảnh nên ảnh chỉ còn đến khi bạn đóng trang.';
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

  /* ================= gắn sự kiện ================= */
  function on(target, ev, fn) {
    var node = typeof target === 'string' ? el(target) : target;
    if (node) node.addEventListener(ev, fn);
  }

  function bindEvents() {
    on('weeks', 'change', function (e) {
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
      var prev = stats().pct;
      setDone(k, t.checked);
      var row = t.closest('.row');
      if (row) row.classList.toggle('done', t.checked);
      var x = findSession(k);
      if (x) syncWeekBadge(x.wi);
      renderChart(); renderProgress(); renderNext();
      if (t.checked) {
        if (row) {
          row.classList.add('just');
          setTimeout(function () { row.classList.remove('just'); }, 900);
        }
        celebrate(k, t, prev);
      }
    });

    on('weeks', 'click', function (e) {
      var r = e.target && e.target.getAttribute('data-reset');
      if (r == null) return;
      delete sched.wk[r]; saveSched(); renderAll();
    });

    on('weeks', 'input', function (e) {
      var t = e.target, k = t && t.getAttribute('data-note');
      if (!k) return;
      setNote(k, t.value);
    });

    on('sched-fields', 'change', function (e) {
      var i = e.target && e.target.getAttribute('data-def');
      if (i == null) return;
      sched.def[+i] = +e.target.value; saveSched(); renderAll(e.target.id);
    });

    on('sched-reset', 'click', function () {
      sched = { def: defaults(), wk: {} }; saveSched(); renderAll();
    });

    on('next', 'click', function (e) {
      var k = e.target && e.target.getAttribute('data-done');
      if (!k) return;
      var prev = stats().pct;
      setDone(k, true);
      celebrate(k, e.target, prev);
      renderAll();
    });

    on('m4', 'click', function () { mode = 4; store.set('bn27-mode', '4'); renderAll(); });
    on('m3', 'click', function () { mode = 3; store.set('bn27-mode', '3'); renderAll(); });
    on('jump-now', 'click', jumpNow);
    on('quote-next', 'click', renderQuote);
    on('nt-toggle', 'click', function () { NT.toggle(); });
    on('nt-time', 'change', function (e) { NT.setTime(e.target.value); });
    on('nt-test', 'click', function () { NT.test(); });
    on('nt-health', 'click', function () { NT.health(); });

    on('tabs', 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) setTab(b.getAttribute('data-tab'), true);
    });
    on('tabs', 'keydown', function (e) {
      var k = e.key;
      if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
      var cur = TAB_IDS.indexOf((document.activeElement && document.activeElement.getAttribute('data-tab')) || '');
      if (cur < 0) return;
      e.preventDefault();
      var nx = k === 'Home' ? 0 : k === 'End' ? TAB_IDS.length - 1
        : (cur + (k === 'ArrowRight' ? 1 : -1) + TAB_IDS.length) % TAB_IDS.length;
      setTab(TAB_IDS[nx], false);
      var btn = el('tab-' + TAB_IDS[nx]);
      if (btn) btn.focus();
    });

    on('sv-list', 'change', function (e) {
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

    on('sv-list', 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      var art = e.target && e.target.closest ? e.target.closest('.lg') : null;
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

    on('sv-read-all', 'click', function () {
      logs.filter(function (l) { return !l.km && !l.busy; })
        .reduce(function (p, l) { return p.then(function () { return readLog(l); }); }, Promise.resolve());
    });

    var svFile = el('sv-file'), svDrop = el('sv-drop');
    if (svFile) svFile.addEventListener('change', function () { addFiles(svFile.files); svFile.value = ''; });
    if (svDrop) {
      ['dragenter', 'dragover'].forEach(function (n) { svDrop.addEventListener(n, function (ev) { ev.preventDefault(); svDrop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (n) { svDrop.addEventListener(n, function (ev) { ev.preventDefault(); svDrop.classList.remove('over'); }); });
      svDrop.addEventListener('drop', function (ev) { addFiles(ev.dataTransfer && ev.dataTransfer.files); });
    }
  }

  /* ================= nạp module HTML rồi khởi động ================= */
  function loadSections() {
    var panes = Array.prototype.slice.call(document.querySelectorAll('[data-src]'));
    return Promise.all(panes.map(function (pane) {
      return fetch(pane.getAttribute('data-src'))
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) { pane.innerHTML = html; })
        .catch(function () {
          pane.innerHTML = '<section class="panel"><h2>Không tải được phần này</h2>' +
            '<p class="hint">Hãy mở trang qua một địa chỉ http (GitHub Pages hoặc server local) thay vì mở thẳng file trên máy.</p></section>';
        });
    }));
  }

  function countUp(node, to) {
    if (!node) return;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = to; return; } } catch (e) {}
    var from = 0, t0 = Date.now(), dur = 900;
    (function step() {
      var k = Math.min(1, (Date.now() - t0) / dur);
      node.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })();
  }

  function boot() {
    bindEvents();
    setTab(store.get('bn27-tab') || 'overview', false);
    renderAll();
    renderQuote();
    // Nạp gợi ý bài tập trước, rồi mới dựng phần nhắc, để lời nhắc ngày
    // trống có đủ danh sách thay vì mỗi câu mặc định.
    loadTips().then(function () { NT.init(); });
    countUp(el('days'), Math.max(0, Math.ceil((RACE - today0()) / 864e5)));
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
  }

  loadSections().then(boot);
})();
