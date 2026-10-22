// Điều khiển index.html — trang chủ cá nhân: tổng hợp km/streak/PR/mục
// tiêu, câu truyền động lực, phân tích xu hướng rule-based, danh sách giải
// đấu (mỗi giải là một cột mốc, bấm vào mở race.html riêng), và bật nhắc
// chạy chung cho mọi giải đang có giáo án.
(function () {
  'use strict';
  var C = window.Core, T = window.Templates, B = window.Blocks, R = window.Races, RL = window.RunLog, G = window.Goals;
  var el = function (id) { return document.getElementById(id); };
  var runs = [];

  /* ================= header + quote ================= */
  function renderDate() {
    var d = new Date();
    el('dash-date').textContent = C.WD[(d.getDay() + 6) % 7] + ', ' + C.fmt(d) + '/' + d.getFullYear();
  }
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

  /* ================= buổi tiếp theo (gộp mọi block active) ================= */
  function nextAction() {
    var t0 = C.today0(), out = [];
    B.list().forEach(function (b) {
      B.sessionsOf(b).list.forEach(function (x) {
        if (x.s.type === 'rest' || b.done[x.id] || x.date < t0) return;
        out.push({ x: x, block: b, race: R.get(b.raceId) });
      });
    });
    out.sort(function (a, b2) { return a.x.date - b2.x.date; });
    return out[0] || null;
  }
  function renderNext() {
    var box = el('next'), hit = nextAction();
    if (hit) {
      var diff = Math.round((hit.x.date - C.today0()) / 864e5);
      var when = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : 'Còn ' + diff + ' ngày nữa';
      box.innerHTML = '<div class="when"><span class="chip tag-now">' + when + '</span><span class="num">' + C.fmt(hit.x.date) + '</span><span class="chip t-' + hit.x.s.type + '">' + C.LABEL[hit.x.s.type] + '</span></div>' +
        '<h2>' + C.esc(hit.x.s.title) + '</h2>' +
        '<p class="detail">' + (hit.race ? C.esc(hit.race.name) : '') + '</p>' +
        '<a class="btn" href="race.html?id=' + encodeURIComponent(hit.block.raceId) + '">Mở trang giải</a>';
      return;
    }
    var nextRace = R.upcoming()[0];
    if (nextRace) {
      box.innerHTML = '<div class="when"><span class="chip tag-now">Còn ' + R.daysUntil(nextRace) + ' ngày</span></div>' +
        '<h2>' + C.esc(nextRace.name) + '</h2><p class="detail">Chưa có buổi nào tới hạn. Mở trang giải để xem chi tiết hoặc ghi nhật ký chạy tự do.</p>' +
        '<a class="btn" href="race.html?id=' + encodeURIComponent(nextRace.id) + '">Mở trang giải</a>';
      return;
    }
    box.innerHTML = '<div class="when"><span class="chip t-rest">Chưa có giải nào</span></div><h2>Chạy tự do</h2><p class="detail">Tạo một giải mới ở dưới, hoặc cứ ghi nhật ký chạy hằng ngày — PR và streak vẫn được tính bình thường.</p>';
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
        : G.TYPE_LABEL[g.type] + ': ' + p.current + '/' + g.target + (g.type.indexOf('km') >= 0 ? ' km' : ' buổi');
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

  /* ================= danh sách giải ================= */
  var armedDel = '';

  function renderRaces() {
    var box = el('race-list');
    var all = R.list().map(R.refreshStatus);
    if (!all.length) { box.innerHTML = '<p class="hint">Chưa có giải nào. Tạo giải đầu tiên ở trên.</p>'; return; }
    box.innerHTML = all.map(function (r) {
      var d = R.daysUntil(r);
      var when = r.status === 'upcoming' ? 'Còn ' + d + ' ngày' : (r.result ? 'Đã hoàn thành' : 'Đã qua');
      var blk = r.blockId ? B.get(r.blockId) : null;
      var tpl = blk ? T.get(blk.templateId) : null;
      var armed = armedDel === r.id;
      return '<div class="race-card">' +
        '<a class="race-card-main" href="race.html?id=' + encodeURIComponent(r.id) + '">' +
        '<span class="chip ' + (r.status === 'upcoming' ? 'tag-now' : 't-rest') + '">' + when + '</span>' +
        '<strong>' + C.esc(r.name) + '</strong>' +
        '<span class="hint num">' + C.fmt(C.fromIso(r.date)) + '/' + C.fromIso(r.date).getFullYear() + (r.distanceKm ? ' · ' + r.distanceKm + ' km' : '') + '</span>' +
        '<span class="hint">' + (tpl ? C.esc(tpl.name) : 'Không có giáo án') + '</span>' +
        '</a>' +
        '<div class="race-card-acts">' +
        '<button type="button" class="btn-sm" data-race-edit="' + r.id + '">Sửa</button>' +
        '<button type="button" class="btn-sm"' + (armed ? ' data-armed="1"' : '') + ' data-race-del="' + r.id + '">' +
        (armed ? 'Chắc chắn xoá?' : 'Xoá') + '</button>' +
        '</div></div>';
    }).join('');
  }

  /* ================= form giải: dùng chung cho tạo và sửa ================= */
  function renderTemplateOptions() {
    var sel = el('race-template');
    if (!sel) return;
    var opts = ['<option value="">Không dùng giáo án — chỉ tạo giải, tự ghi nhật ký</option>'];
    T.levels().forEach(function (t) {
      var s = T.summary(t);
      opts.push('<option value="' + t.id + '">' + C.esc(t.name)
        + ' · đỉnh ' + s.peakKm + ' km/tuần</option>');
    });
    opts.push('<option value="' + T.PERIODIZED_12W_ID + '">Chu kỳ 12 tuần (kiểu Bắc Ninh 10K)</option>');
    sel.innerHTML = opts.join('');
  }
  function syncTemplateDesc() {
    var node = el('race-template-desc');
    if (!node) return;
    var t = T.get(el('race-template').value);
    if (!t) { node.textContent = 'Không sinh giáo án. Bạn vẫn ghi được nhật ký chạy cho giải này.'; return; }
    var s = T.summary(t);
    node.textContent = (t.desc ? t.desc + ' ' : '')
      + '(' + s.weeks + ' tuần · ' + s.daysPerWeek + ' buổi/tuần · đỉnh ' + s.peakKm + ' km/tuần · tổng khoảng ' + s.totalKm + ' km)';
  }
  function openCreate() {
    el('race-form').reset();
    el('race-edit-id').value = '';
    el('race-submit').textContent = 'Tạo giải';
    el('race-cancel').hidden = true;
    el('race-form').hidden = false;
    syncTemplateDesc();
  }
  function openEdit(id) {
    var race = R.get(id);
    if (!race) return;
    var blk = race.blockId ? B.get(race.blockId) : null;
    el('race-edit-id').value = id;
    el('race-name').value = race.name;
    el('race-date').value = race.date;
    el('race-km').value = race.distanceKm || 0;
    el('race-template').value = blk ? blk.templateId : '';
    el('race-submit').textContent = 'Lưu thay đổi';
    el('race-cancel').hidden = false;
    el('race-form').hidden = false;
    syncTemplateDesc();
    el('race-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function closeRaceForm() {
    el('race-form').reset();
    el('race-edit-id').value = '';
    el('race-submit').textContent = 'Tạo giải';
    el('race-cancel').hidden = true;
    el('race-form').hidden = true;
  }

  // Gắn / đổi / bỏ giáo án của một giải. Giữ nguyên tiến độ nếu khuôn không
  // đổi, chỉ dời lịch theo ngày thi mới.
  function applyBlock(race, templateId, name, km) {
    var oldBlock = race.blockId ? B.get(race.blockId) : null;
    if (!templateId) {
      if (oldBlock) B.remove(oldBlock.id);
      race.blockId = null;
      return null;
    }
    if (oldBlock && oldBlock.templateId === templateId) {
      var tpl = T.get(templateId);
      oldBlock.startDate = C.iso(T.startFromRaceDate(tpl, C.fromIso(race.date)));
      oldBlock.raceTitle = name + (km ? ', ' + km + ' km' : '');
      oldBlock.raceKm = km;
      B.save(oldBlock);
      return oldBlock;
    }
    if (oldBlock) B.remove(oldBlock.id);
    var blk = B.create({ id: C.uid('blk-'), templateId: templateId, raceDate: race.date, raceId: race.id, mode: 4 });
    blk.raceTitle = name + (km ? ', ' + km + ' km' : '');
    blk.raceDesc = '';
    blk.raceKm = km;
    B.save(blk);
    race.blockId = blk.id;
    return blk;
  }

  /* ================= sự kiện ================= */
  function on(id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); }

  function renderAll() {
    renderNext(); renderStats(); renderPR(); renderGoals(); renderAnalysis(); renderRaces();
  }

  function bindEvents() {
    on('quote-next', 'click', renderQuote);

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

    on('race-add-toggle', 'click', function () {
      if (el('race-form').hidden) openCreate(); else closeRaceForm();
    });
    on('race-cancel', 'click', closeRaceForm);
    on('race-template', 'change', syncTemplateDesc);

    on('race-form', 'submit', function (e) {
      e.preventDefault();
      var editId = el('race-edit-id').value;
      var name = el('race-name').value.trim();
      var date = el('race-date').value;
      var km = Number(el('race-km').value) || 0;
      var templateId = el('race-template').value;
      if (!name || !date) return;

      if (editId) {
        var race = R.get(editId);
        if (!race) return;
        var hadBlock = race.blockId ? B.get(race.blockId) : null;
        var swapped = hadBlock && templateId && hadBlock.templateId !== templateId;
        race.name = name; race.date = date; race.distanceKm = km;
        applyBlock(race, templateId, name, km);
        R.save(race);
        closeRaceForm();
        renderAll();
        C.toast('Đã lưu giải', swapped ? 'Đổi giáo án nên tiến độ cũ được làm lại' : name);
        return;
      }

      var fresh = R.create({ id: C.uid('race-'), name: name, date: date, distanceKm: km, blockId: null });
      applyBlock(fresh, templateId, name, km);
      R.save(fresh);
      closeRaceForm();
      renderAll();
      C.toast('Đã tạo giải mới', name + (fresh.blockId ? ' · đã sinh giáo án' : ''));
    });

    on('race-list', 'click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var editId = t.getAttribute('data-race-edit');
      if (editId) { armedDel = ''; openEdit(editId); renderRaces(); return; }
      var delId = t.getAttribute('data-race-del');
      if (!delId) return;
      if (armedDel !== delId) { armedDel = delId; renderRaces(); return; }
      var race = R.get(delId);
      if (race && race.blockId) B.remove(race.blockId);
      R.remove(delId);
      armedDel = '';
      if (el('race-edit-id').value === delId) closeRaceForm();
      renderAll();
      C.toast('Đã xoá giải', (race ? race.name : '') + ' · ảnh và nhật ký vẫn được giữ');
    });

    on('nt-toggle', 'click', function () { window.Notify.toggle(); });
    on('nt-time', 'change', function (e) { window.Notify.setTime(e.target.value); });
    on('nt-test', 'click', function () { window.Notify.test(); });
    on('nt-health', 'click', function () { window.Notify.health(); });
  }

  function boot() {
    renderDate(); renderQuote();
    renderTemplateOptions();
    bindEvents();
    window.Migrate.run().then(function () {
      renderAll();
      return RL.loadRuns();
    }).then(function (all) {
      runs = all;
      renderAll();
      window.Notify.init();
    });
    C.registerSW();
  }

  boot();
})();
