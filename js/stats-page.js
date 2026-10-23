// Điều khiển stats.html — số liệu tổng hợp km/streak/PR, phân tích xu hướng
// rule-based và mục tiêu cá nhân. Tách khỏi trang chủ để trang chủ gọn, chỉ
// tập trung vào "hôm nay cần làm gì".
(function () {
  'use strict';
  var C = window.Core, B = window.Blocks, RL = window.RunLog, G = window.Goals;
  var el = function (id) { return document.getElementById(id); };
  var on = function (id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); };
  var runs = [];

  function renderHeader() {
    var d = new Date();
    el('st-eyebrow').textContent = C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear();
  }

  /* ================= vòng tiến độ tuần này ================= */
  // Mốc so sánh ưu tiên mục tiêu km/tuần người dùng đặt; chưa đặt thì lấy
  // trung bình 8 tuần trước làm chuẩn để vòng vẫn có ý nghĩa.
  function renderWeekRing() {
    var box = el('week-ring'), side = el('week-side');
    if (!box || !side) return;
    var t0 = C.today0(), wk = RL.thisWeekRange(t0);
    var km = RL.kmBetween(runs, wk.start, wk.end);
    var sessions = runs.filter(function (r) {
      if (r.kind === 'walk' || !r.date) return false;
      var d = C.fromIso(r.date);
      return d >= wk.start && d <= wk.end;
    }).length;

    var goal = G.all().filter(function (g) { return g.type === 'weekly_km' && g.target > 0; })[0];
    var prev = RL.weeklyKmSeries(runs, 9).slice(0, 8);
    var avg = prev.reduce(function (a, w) { return a + w.km; }, 0) / (prev.length || 1);
    var target = goal ? Number(goal.target) : avg;
    var pct = target > 0 ? Math.min(100, Math.round(km / target * 100)) : 0;

    var R = 52, CIRC = 2 * Math.PI * R;
    box.innerHTML =
      '<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Đã chạy ' + C.fmtKm(km) + ' km tuần này' + (target > 0 ? ', đạt ' + pct + '%' : '') + '">' +
      '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop class="ring-g1" offset="0%"/><stop class="ring-g2" offset="100%"/></linearGradient></defs>' +
      '<circle class="ring-track" cx="60" cy="60" r="' + R + '"/>' +
      '<circle class="ring-fill" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + CIRC.toFixed(1) + '"' +
      ' stroke-dashoffset="' + (CIRC * (1 - pct / 100)).toFixed(1) + '"/>' +
      '</svg>' +
      '<div class="ring-center"><div class="ring-v num">' + C.fmtKm(km) + '</div><div class="ring-l">km</div></div>';

    var basis = goal
      ? 'trên mục tiêu ' + C.fmtNum(goal.target) + ' km/tuần'
      : (avg > 0 ? 'so với trung bình 8 tuần (' + C.fmtKm(avg) + ' km)' : 'chưa có mốc so sánh — đặt mục tiêu ở dưới');
    side.innerHTML =
      '<div class="ring-stat"><b class="num">' + (target > 0 ? pct + '%' : '—') + '</b><span>' + C.esc(basis) + '</span></div>' +
      '<div class="ring-stat"><b class="num">' + sessions + '</b><span>buổi trong tuần</span></div>' +
      '<p class="hint num">' + C.fmt(wk.start) + ' – ' + C.fmt(wk.end) + '</p>';
  }

  /* ================= chuỗi ngày chạy 14 ngày ================= */
  function renderStreakDots() {
    var box = el('streak-dots'), sum = el('streak-sum');
    if (!box) return;
    var days = {};
    runs.forEach(function (r) {
      if (r.kind === 'walk' || !r.date || !(Number(r.km) > 0)) return;
      days[r.date] = (days[r.date] || 0) + Number(r.km);
    });
    var t0 = C.today0(), html = '';
    for (var i = 13; i >= 0; i--) {
      var d = C.addDays(t0, -i), key = C.iso(d), on = !!days[key];
      var label = C.WD[(d.getDay() + 6) % 7].replace('Thứ ', 'T').replace('Chủ nhật', 'CN');
      html += '<span class="sdot' + (on ? ' on' : '') + (i === 0 ? ' today' : '') + '"'
        + ' title="' + C.fmt(d) + (on ? ': ' + C.fmtKm(days[key]) + ' km' : ': nghỉ') + '">'
        + '<i></i><em>' + label + '</em></span>';
    }
    box.innerHTML = html;
    if (sum) sum.textContent = RL.computeStreak(runs) + ' ngày liên tục';
  }

  /* ================= km theo tháng ================= */
  function renderMonths() {
    var box = el('month-chart');
    if (!box) return;
    var t0 = C.today0(), out = [];
    for (var i = 5; i >= 0; i--) {
      var s = new Date(t0.getFullYear(), t0.getMonth() - i, 1);
      var e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      out.push({ s: s, km: RL.kmBetween(runs, s, e) });
    }
    var max = Math.max.apply(null, out.map(function (m) { return m.km; })) || 1;
    box.innerHTML = out.map(function (m, i) {
      var h = Math.max(2, Math.round(m.km / max * 100));
      var now = i === out.length - 1;
      return '<div class="cweek' + (now ? ' now' : '') + '" style="--i:' + i + '">' +
        '<span class="cval num">' + C.fmtKm(m.km) + '</span>' +
        '<div class="cbar" style="--h:' + h + '%" title="Tháng ' + (m.s.getMonth() + 1) + '/' + m.s.getFullYear() + ': ' + C.fmtKm(m.km) + ' km"></div>' +
        '<span class="clabel num">T' + (m.s.getMonth() + 1) + '</span></div>';
    }).join('');
    box.classList.add('in');
  }

  /* ================= thống kê tổng hợp ================= */
  function renderStats() {
    var t0 = C.today0();
    var wk = RL.thisWeekRange(t0);
    var mStart = new Date(t0.getFullYear(), t0.getMonth(), 1), mEnd = new Date(t0.getFullYear(), t0.getMonth() + 1, 0);
    var weekKm = RL.kmBetween(runs, wk.start, wk.end);
    var monthKm = RL.kmBetween(runs, mStart, mEnd);
    var totalKm = runs.reduce(function (a, r) { return a + (r.kind !== 'walk' ? Number(r.km) || 0 : 0); }, 0);
    var totalN = runs.filter(function (r) { return r.kind !== 'walk' && Number(r.km) > 0; }).length;
    var streak = RL.computeStreak(runs);
    var cards = [
      { label: 'Km tuần này', value: C.fmtKm(weekKm) },
      { label: 'Km tháng này', value: C.fmtKm(monthKm) },
      { label: 'Streak', value: streak + ' ngày' },
      { label: 'Tổng', value: C.fmtKm(totalKm) + ' km · ' + totalN + ' buổi' },
      { label: 'Thời gian', value: C.fmtDuration(RL.totalTimeSecs(runs)) }
    ];
    el('stat-grid').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="stat-v num">' + c.value + '</div><div class="stat-l">' + c.label + '</div></div>';
    }).join('');
  }

  function renderPR() {
    var prs = RL.computePRs(runs);
    el('pr-grid').innerHTML = RL.PR_BUCKETS.map(function (b) {
      var p = prs[b.key];
      return '<div class="pr-card"><div class="pr-label">' + b.label + '</div>' +
        '<div class="pr-v num">' + (p ? RL.formatTime(p.timeSeconds) : '—') + '</div>' +
        '<div class="pr-d">' + (p ? C.fmt(C.fromIso(p.date)) : 'Chưa có thành tích') + '</div></div>';
    }).join('');
  }

  /* ================= mục tiêu ================= */
  function renderGoals() {
    var box = el('goal-list'), goals = G.all();
    if (!goals.length) { box.innerHTML = '<p class="hint">Chưa có mục tiêu nào.</p>'; return; }
    box.innerHTML = goals.map(function (g) {
      var p = G.progress(g, runs);
      var label = g.type === 'pr_target'
        ? G.TYPE_LABEL[g.type] + ' ' + (g.distanceKm) + 'K: ' + RL.formatTime(g.target) + (p.label ? ' (hiện ' + p.label + ')' : '')
        : G.TYPE_LABEL[g.type] + ': ' + C.fmtNum(p.current) + '/' + C.fmtNum(g.target) + (g.type.indexOf('km') >= 0 ? ' km' : ' buổi');
      return '<div class="goal-row">' +
        '<div class="goal-info"><strong>' + C.esc(label) + '</strong>' +
        '<div class="bar"><i style="width:' + p.pct + '%"></i></div></div>' +
        '<button type="button" class="lnk" data-goal-del="' + g.id + '">Xoá</button></div>';
    }).join('');
  }

  /* ================= phân tích xu hướng ================= */
  function renderAnalysis() {
    var series = RL.weeklyKmSeries(runs, 8);
    var max = Math.max.apply(null, series.map(function (w) { return w.km; })) || 1;
    el('trend-chart').innerHTML = series.map(function (w, i) {
      var h = Math.max(2, Math.round(w.km / max * 100));
      var isNow = i === series.length - 1;
      return '<div class="cweek' + (isNow ? ' now' : '') + '" style="--i:' + i + '">' +
        '<span class="cval num">' + C.fmtKm(w.km) + '</span>' +
        '<div class="cbar" style="--h:' + h + '%" title="' + C.fmt(w.start) + ' – ' + C.fmt(w.end) + ': ' + C.fmtKm(w.km) + ' km"></div>' +
        '<span class="clabel num">' + (isNow ? 'Nay' : C.fmt(w.start)) + '</span></div>';
    }).join('');
    el('trend-chart').classList.add('in');

    var notes = [];
    var curWeek = series[series.length - 1].km;
    var prevAvg = series.slice(0, -1).reduce(function (a, w) { return a + w.km; }, 0) / Math.max(1, series.length - 1);
    if (prevAvg > 0 && curWeek > prevAvg * 1.1) {
      notes.push('Km tuần này (' + C.fmtKm(curWeek) + ') cao hơn trung bình 7 tuần trước (' + C.fmtKm(prevAvg) + ') hơn 10%. Nguyên tắc tăng tải không quá 10%/tuần — cân nhắc giữ nhịp hoặc thêm một buổi nghỉ.');
    } else if (prevAvg > 0 && curWeek < prevAvg * 0.6) {
      notes.push('Km tuần này thấp hơn nhiều so với trung bình gần đây. Nếu không phải tuần giảm tải chủ động, có thể bù nhẹ nhàng vào cuối tuần.');
    }
    var activeBlocks = B.list().filter(B.isActive);
    if (activeBlocks.length) {
      var qTotal = 0, qDone = 0, lTotal = 0, lDone = 0, t0 = C.today0(), from = C.addDays(t0, -27);
      activeBlocks.forEach(function (b) {
        B.sessionsOf(b).list.forEach(function (x) {
          if (x.date < from || x.date > t0) return;
          if (x.s.type === 'quality') { qTotal++; if (b.done[x.id]) qDone++; }
          if (x.s.type === 'long') { lTotal++; if (b.done[x.id]) lDone++; }
        });
      });
      if (qTotal) notes.push('Buổi chất lượng 4 tuần gần đây: hoàn thành ' + qDone + '/' + qTotal + '.');
      if (lTotal) notes.push('Buổi chạy dài 4 tuần gần đây: hoàn thành ' + lDone + '/' + lTotal + '.');
    }
    if (!notes.length) notes.push('Chưa đủ dữ liệu để đưa ra nhận xét — cứ tiếp tục ghi nhật ký đều đặn.');
    el('analysis-notes').innerHTML = '<ul class="rules">' + notes.slice(0, 3).map(function (n) { return '<li>' + C.esc(n) + '</li>'; }).join('') + '</ul>';
  }

  function renderAll() {
    renderWeekRing(); renderStreakDots(); renderStats();
    renderPR(); renderAnalysis(); renderMonths(); renderGoals();
  }

  function bindEvents() {
    on('goal-add-toggle', 'click', function () { el('goal-form').hidden = !el('goal-form').hidden; });
    on('goal-type', 'change', function () {
      var isPr = el('goal-type').value === 'pr_target';
      el('goal-dist-wrap').hidden = !isPr;
      el('goal-target-label').textContent = isPr ? 'Mục tiêu thời gian (giây)' : 'Mục tiêu';
    });
    on('goal-form', 'submit', function (e) {
      e.preventDefault();
      G.create({ type: el('goal-type').value, target: el('goal-target').value, distanceKm: el('goal-dist').value });
      el('goal-form').reset(); el('goal-form').hidden = true;
      renderGoals();
    });
    on('goal-list', 'click', function (e) {
      var id = e.target && e.target.getAttribute('data-goal-del');
      if (!id) return;
      G.remove(id); renderGoals();
    });
  }

  function boot() {
    renderHeader();
    bindEvents();
    window.Migrate.run().then(function () { return RL.loadRuns(); }).then(function (all) {
      runs = all;
      renderAll();
    });
    C.registerSW();
  }

  boot();
})();
