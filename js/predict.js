// Dự đoán thành tích và pace gợi ý từ chính nhật ký chạy.
//
// Cách tính (có chủ đích đơn giản, minh bạch):
//  - Mỗi buổi chạy có km và thời gian là một "nỗ lực". Từ nỗ lực (d, t) ước
//    tính thời gian cho cự ly D bằng công thức Riegel: T = t × (D / d)^e.
//    Hệ số e là 1,06 cho 5K/10K, 1,07 cho Half, 1,08 cho Full (cự ly dài
//    thì sức bền hao nhanh hơn).
//  - Lấy nỗ lực cho ra thời gian tốt nhất, nhưng chỉ nhận buổi dài ít nhất
//    1/4 cự ly cần dự đoán (và tối thiểu 2,5 km) để buổi ngắn không kéo
//    dự đoán marathon lên quá lạc quan.
//  - Half/Full bị cộng thêm tối đa 15% nếu buổi chạy dài nhất 60 ngày qua
//    chưa đạt 60% (Half) / 50% (Full) cự ly.
//  - Buổi chạy nhẹ cho kết quả chậm hơn khả năng thật, nên đây là mức ước
//    tính thận trọng; kết quả chạy thử hết sức sẽ cho dự đoán sát hơn.
window.Predict = (function (Core, RL) {
  'use strict';
  var TARGETS = [
    { key: '5', label: '5K', km: 5 },
    { key: '10', label: '10K', km: 10 },
    { key: '21', label: 'Half', km: 21.0975 },
    { key: '42', label: 'Full', km: 42.195 }
  ];
  var EXP = { '5': 1.06, '10': 1.06, '21': 1.07, '42': 1.08 };
  var LONG_NEED = { '21': 0.6, '42': 0.5 };
  var LOOKBACK = 120, RECENT = 60, MIN_KM = 2.5;
  var SPREAD = { cao: 0.03, 'vừa': 0.05, 'thấp': 0.08 };

  function daysAgo(dateStr, today) {
    return Math.round((today - Core.fromIso(dateStr)) / 864e5);
  }

  // Các buổi chạy đủ điều kiện làm nỗ lực: có km, có thời gian, pace hợp lý.
  function efforts(runs, today) {
    var out = [];
    runs.forEach(function (r) {
      var km = Number(r.km), sec = RL.parseTime(r.time);
      if (r.kind !== 'run' || !(km >= MIN_KM) || !(sec > 0) || !r.date) return;
      var pace = sec / km;
      if (pace < 150 || pace > 720) return;           // 2:30 – 12:00 /km
      var age = daysAgo(r.date, today);
      if (age < 0) return;
      out.push({ km: km, sec: sec, date: r.date, age: age });
    });
    return out;
  }

  function longestRecent(runs, today) {
    var m = 0;
    runs.forEach(function (r) {
      if (r.kind !== 'run' || !r.date) return;
      var age = daysAgo(r.date, today), km = Number(r.km) || 0;
      if (age >= 0 && age <= RECENT && km > m) m = km;
    });
    return m;
  }

  function predictOne(t, pool, stale, longest, recentN) {
    var need = Math.max(MIN_KM, t.km * 0.25), best = null;
    pool.forEach(function (e) {
      if (e.km < need) return;
      var T = e.sec * Math.pow(t.km / e.km, EXP[t.key]);
      if (!best || T < best.T) best = { T: T, e: e };
    });
    var res = { key: t.key, label: t.label, km: t.km, needKm: need };
    if (!best) return res;

    var pen = 0, needLong = LONG_NEED[t.key];
    if (needLong && longest < t.km * needLong) {
      pen = 0.15 * (t.km * needLong - longest) / (t.km * needLong);
    }
    var ratio = best.e.km / t.km;
    var score = (recentN >= 6 ? 2 : recentN >= 3 ? 1 : 0)
              + (ratio >= 0.5 ? 2 : ratio >= 0.25 ? 1 : 0)
              + (pen === 0 ? 1 : 0) - (stale ? 1 : 0);
    var level = score >= 5 ? 'cao' : score >= 2 ? 'vừa' : 'thấp';
    var T = best.T * (1 + pen);
    res.timeSec = Math.round(T);
    res.paceSec = Math.round(T / t.km);
    res.low = Math.round(T * (1 - SPREAD[level]));
    res.high = Math.round(T * (1 + SPREAD[level]));
    res.confidence = level;
    res.penalty = pen;
    res.longest = longest;
    res.source = { km: best.e.km, sec: best.e.sec, date: best.e.date };
    return res;
  }

  // Pace trung bình (tổng thời gian / tổng km) của các buổi chạy trong N ngày.
  function averagePace(runs, today, days) {
    var km = 0, sec = 0, n = 0;
    runs.forEach(function (r) {
      var k = Number(r.km), s = RL.parseTime(r.time);
      if (r.kind !== 'run' || !(k > 0) || !(s > 0) || !r.date) return;
      var age = daysAgo(r.date, today);
      if (age < 0 || age >= days) return;
      km += k; sec += s; n++;
    });
    return n ? { paceSec: Math.round(sec / km), km: km, n: n } : null;
  }

  // Vùng pace suy ra từ dự đoán 10K (nền) và 5K / Full nếu có.
  function zones(preds) {
    var p10 = preds['10'];
    if (!p10 || !p10.paceSec) return null;
    var base = p10.paceSec;
    var p5 = preds['5'] && preds['5'].paceSec ? preds['5'].paceSec : Math.round(base * 0.97);
    var out = [
      { key: 'easy', label: 'Chạy nhẹ / dài', lo: Math.round(base * 1.14), hi: Math.round(base * 1.28),
        note: 'Nói chuyện được, chiếm khoảng 80% số buổi' },
      { key: 'tempo', label: 'Tempo', lo: Math.round(base * 1.03), hi: Math.round(base * 1.05),
        note: 'Thở nặng nhưng kiểm soát được' },
      { key: 'interval', label: 'Interval', lo: Math.round(p5 * 0.98), hi: p5,
        note: 'Quãng nhanh 3–5 phút, ngang pace 5K' }
    ];
    var p42 = preds['42'];
    if (p42 && p42.paceSec) {
      out.push({ key: 'marathon', label: 'Pace Full', lo: p42.paceSec, hi: p42.paceSec,
                 note: 'Pace trung bình dự đoán cho 42K' });
    }
    return out;
  }

  function compute(runs, today) {
    today = today || Core.today0();
    var all = efforts(runs, today);
    var pool = all.filter(function (e) { return e.age <= LOOKBACK; });
    var stale = false;
    if (!pool.length) { pool = all; stale = all.length > 0; }
    var recentN = all.filter(function (e) { return e.age <= RECENT; }).length;
    var longest = longestRecent(runs, today);

    var preds = {};
    TARGETS.forEach(function (t) { preds[t.key] = predictOne(t, pool, stale, longest, recentN); });
    return {
      preds: preds, list: TARGETS.map(function (t) { return preds[t.key]; }),
      zones: zones(preds), efforts: all.length, recentEfforts: recentN, longest: longest,
      stale: stale, avg30: averagePace(runs, today, 30)
    };
  }

  function paceText(sec) { return sec ? RL.formatTime(sec) : '—'; }
  function rangeText(z) {
    return z.lo === z.hi ? paceText(z.lo) : paceText(z.lo) + '–' + paceText(z.hi);
  }

  // Dòng gợi ý pace theo loại buổi, dùng trong Lịch tập. Chuỗi rỗng nếu
  // chưa đủ dữ liệu để dự đoán.
  function hintFor(type, zs) {
    if (!zs) return '';
    var by = {};
    zs.forEach(function (z) { by[z.key] = z; });
    if (type === 'easy' || type === 'long') return 'Pace gợi ý theo kết quả của bạn: ' + rangeText(by.easy) + '/km';
    if (type === 'quality') return 'Pace gợi ý: tempo ' + rangeText(by.tempo) + ' · interval ' + rangeText(by.interval) + '/km';
    return '';
  }

  return {
    TARGETS: TARGETS, compute: compute, hintFor: hintFor,
    paceText: paceText, rangeText: rangeText, efforts: efforts
  };
})(window.Core, window.RunLog);
