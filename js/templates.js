// Khuôn giáo án tái sử dụng được. Mỗi template mô tả hình dạng một chu kỳ
// tập luyện (số tuần, giai đoạn, khối lượng easy/quality/long từng tuần)
// mà KHÔNG gắn ngày cụ thể — ngày chỉ sinh ra khi áp khuôn vào một block.
window.Templates = (function (Core) {
  'use strict';
  var KEY = 'app-templates';
  var WARM = 'Khởi động 10 phút chạy rất nhẹ, ';

  // Khuôn gốc trích từ giáo án Bắc Ninh Legacy Marathon 2027: 12 tuần,
  // periodized 5 giai đoạn, lịch mặc định Thứ 2/4/6/Chủ nhật.
  var PERIODIZED_12W = {
    id: 'periodized-12w',
    name: 'Chu kỳ 12 tuần (kiểu Bắc Ninh 10K)',
    days: [
      { k: 'mon', def: 0, name: 'Chạy nhẹ 1' }, { k: 'wed', def: 2, name: 'Chất lượng' },
      { k: 'fri', def: 4, name: 'Chạy nhẹ 2' }, { k: 'sun', def: 6, name: 'Chạy dài' }
    ],
    weeks: [
      { ph: 'Nền tảng', e: [5, 4], l: 7, q: { t: '5 × 3 phút @ 6:40', d: WARM + '5 lần 3 phút @ 6:40, nghỉ 2 phút đi bộ nhanh, hạ nhiệt 10 phút.', km: 6 } },
      { ph: 'Nền tảng', e: [5, 4], l: 7, q: { t: '4 × 4 phút @ 6:40', d: WARM + '4 lần 4 phút @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 6.5 } },
      { ph: 'Nền tảng', e: [5, 5], l: 8, q: { t: '3 × 1 km @ 6:40', d: WARM + '3 lần 1 km @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 6 } },
      { ph: 'Nền tảng', e: [4, 4], l: 6, nt: 'Tuần nhẹ: giảm khối lượng để cơ thể hấp thu những tuần trước.', q: { t: '3 × 1 km @ 6:40', d: WARM + '3 lần 1 km @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 5.5 } },
      { ph: 'Xây sức bền', e: [5, 5], l: 9, q: { t: 'Tempo 3 km @ 6:55', d: WARM + '3 km liền @ 6:55, hạ nhiệt 10 phút.', km: 6 } },
      { ph: 'Xây sức bền', e: [5, 5], l: 9, nt: 'Buổi chất lượng tuần này là chạy thử 5 km. Kết quả quyết định mục tiêu pace.', q: { t: 'Chạy thử 5 km hết sức', d: 'Khởi động 15 phút nhẹ, 5 km nhanh nhất có thể mà không đi bộ, hạ nhiệt 10 phút. Chạy trên đường phẳng, ghi lại thời gian.', km: 7 } },
      { ph: 'Xây sức bền', e: [5, 5], l: 10, nt: 'Chỉnh pace theo kết quả 5 km ở tuần 6: đoạn 1 km chạy bằng pace 5 km, tempo và đoạn 2 km chậm hơn pace 5 km khoảng 10–15 giây.', q: { t: 'Tempo 4 km @ 6:55', d: WARM + '4 km liền @ 6:55, hạ nhiệt 10 phút.', km: 7 } },
      { ph: 'Xây sức bền', e: [4, 4], l: 7, nt: 'Tuần nhẹ: giảm khối lượng, giữ một buổi nhanh ngắn.', q: { t: '3 × 1 km @ 6:35', d: WARM + '3 lần 1 km @ 6:35, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 5.5 } },
      { ph: 'Đặc thù cự ly', e: [5, 5], l: 11, nt: 'Giữ pace tempo đã chỉnh theo kết quả 5 km ở tuần 6.', q: { t: 'Tempo 5 km @ 6:50', d: WARM + '5 km liền @ 6:50, hạ nhiệt 10 phút.', km: 8 } },
      { ph: 'Đặc thù cự ly', e: [5, 4], l: 10, nt: 'Tuần nặng nhất. Sau tuần này chỉ còn giảm tải.', q: { t: '3 × 2 km @ 6:40', d: WARM + '3 lần 2 km @ 6:40, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 8.5 } },
      { ph: 'Giảm tải', e: [4, 4], l: 8, nt: 'Giảm khoảng 25% khối lượng nhưng vẫn giữ nhịp.', q: { t: '4 × 1 km @ 6:35', d: WARM + '4 lần 1 km @ 6:35, nghỉ 2 phút, hạ nhiệt 10 phút.', km: 6.5 } },
      { ph: 'Tuần thi đấu', e: [4, null], l: 10, race: true, nt: 'Nên nghỉ hẳn ngày trước thi và không tập thêm để bù.', q: { t: '2 km @ 6:40 + 4 nước rút', d: WARM + '2 km @ 6:40, sau đó 4 lần nước rút 20 giây, đi bộ về.', km: 5 } }
    ]
  };

  function easySession(km, stride) {
    return { type: 'easy', title: 'Chạy nhẹ ' + km + ' km' + (stride ? ' + nước rút' : ''),
             d: 'Pace 7:40–8:30, nói được cả câu.' + (stride ? ' Cuối buổi thêm 4–6 lần nước rút 20 giây, thả lỏng, nghỉ đi bộ 40–60 giây giữa các lần.' : ''),
             km: km };
  }

  function all() {
    var saved = Core.store.getJSON(KEY, null);
    if (saved && saved[PERIODIZED_12W.id]) return saved;
    saved = saved || {};
    saved[PERIODIZED_12W.id] = PERIODIZED_12W;
    Core.store.setJSON(KEY, saved);
    return saved;
  }
  function get(id) { return all()[id] || null; }
  function list() { var a = all(); return Object.keys(a).map(function (k) { return a[k]; }); }
  function save(tpl) { var a = all(); a[tpl.id] = tpl; Core.store.setJSON(KEY, a); return tpl; }

  // Sinh sessions[] (mảng theo tuần, mỗi tuần {mon,wed,fri,sun}) từ 1 template,
  // giống hệt cấu trúc `sessions` cũ trong script.js nhưng không còn hard-code ngày.
  function buildSessions(tpl, raceTitle, raceDesc, raceKm) {
    return tpl.weeks.map(function (w, i) {
      var s = {};
      s.mon = easySession(w.e[0], i >= 2 && i <= tpl.weeks.length - 2);
      s.wed = { type: 'quality', title: w.q.t, d: w.q.d, km: w.q.km };
      s.fri = w.e[1] == null
        ? { type: 'rest', title: 'Nghỉ', d: 'Hoặc đi bộ nhẹ 20 phút.', km: 0 }
        : easySession(w.e[1], i >= 2 && i <= tpl.weeks.length - 2);
      s.sun = w.race
        ? { type: 'race', title: raceTitle || 'Ngày thi đấu', d: raceDesc || '', km: raceKm || w.l }
        : { type: 'long', title: 'Chạy dài ' + w.l + ' km', d: 'Pace 7:30–8:00, không cần nhanh.' + (w.l >= 9 ? ' Mang nước nếu chạy trên 9 km.' : ''), km: w.l };
      return s;
    });
  }

  // Tuần cuối (raceWeek) có Chủ nhật = ngày thi. Từ ngày thi suy ra ngày bắt
  // đầu (Thứ 2 của tuần 1) để lịch khớp đúng, không cần người dùng tự tính.
  function startFromRaceDate(tpl, raceDate) {
    var totalDays = (tpl.weeks.length - 1) * 7 + 6;
    return Core.addDays(raceDate, -totalDays);
  }
  function raceDateFromStart(tpl, startDate) {
    return Core.addDays(startDate, (tpl.weeks.length - 1) * 7 + 6);
  }

  return {
    PERIODIZED_12W_ID: PERIODIZED_12W.id,
    all: all, get: get, list: list, save: save,
    buildSessions: buildSessions,
    startFromRaceDate: startFromRaceDate, raceDateFromStart: raceDateFromStart
  };
})(window.Core);
