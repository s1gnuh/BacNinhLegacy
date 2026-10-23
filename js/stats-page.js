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

  function renderAll() { renderStats(); renderPR(); renderAnalysis(); renderGoals(); }

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
