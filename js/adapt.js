// Tự điều chỉnh giáo án theo thực tế. Hai loại gợi ý, đều tính bằng quy tắc
// minh bạch (không dùng AI) và đều chỉ đụng tới buổi CHƯA chạy:
//
//  1. Khối lượng, trong 7 ngày tới. Giảm khi
//       - đã nghỉ từ 10 ngày trở lên (về mức khoảng 55% kế hoạch),
//       - hoặc tuần qua chạy dưới 60% kế hoạch (về khoảng 110% những gì đã chạy,
//         không thấp hơn 75% kế hoạch),
//       - hoặc tuần qua nhiều hơn 30% / 50% so với trung bình 4 tuần trước
//         (giảm 8% / 15%).
//     Mức giảm nặng (còn 80% trở xuống) còn đổi buổi chất lượng thành chạy nhẹ.
//     Điều kiện hết thì gợi ý khôi phục lại đúng buổi gốc.
//  2. Pace, trong 21 ngày tới. Pace ghi sẵn trong buổi (ví dụ "Pace 7:40–8:30",
//     "5 × 3 phút @ 6:40") so với vùng pace suy ra từ dự đoán 10K (Predict). Chỉ
//     sửa khi lệch quá 5% (chạy nhẹ) hoặc 3–4% (chất lượng), mỗi lần tối đa 15%.
//
// Không bao giờ đụng: buổi thi đấu, tuần thi đấu cuối, buổi đã chạy, buổi do
// chính người dùng tự sửa. Mọi thay đổi ghi vào block.edits nên "Hoàn tác"
// (về bản gốc) luôn dùng được.
window.Adapt = (function (Core, Blocks, RL, Predict) {
  'use strict';
  var K_AUTO = 'app-adapt-auto';
  var VOL_DAYS = 6, PACE_DAYS = 21;
  var PACE_RANGE = /Pace (\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/;
  var AT_PACE = /@ (\d{1,2}):(\d{2})/g;

  function isAuto() { return Core.store.get(K_AUTO) === '1'; }
  function setAuto(v) { Core.store.set(K_AUTO, v ? '1' : '0'); }

  function iso(d) { return Core.iso(d); }
  function plus(d, n) { return Core.addDays(d, n); }
  function r05(x) { return Math.round(x * 2) / 2; }
  function secs(m, s) { return Number(m) * 60 + Number(s); }
  function label(d) { return Core.WD[(d.getDay() + 6) % 7] + ' ' + Core.fmt(d); }
  function sumKm(runs, from, to) {
    return runs.reduce(function (a, r) { return r.date >= from && r.date <= to ? a + (Number(r.km) || 0) : a; }, 0);
  }
  function kmNum(x) { return String(Math.round(x * 10) / 10); }
  // đổi số km đầu tiên trong tên buổi ("Chạy nhẹ 6 km" -> "Chạy nhẹ 4.5 km")
  function replaceKm(title, km) {
    return /\d+(?:[.,]\d+)?\s*km/.test(title) ? title.replace(/\d+(?:[.,]\d+)?(\s*km)/, kmNum(km) + '$1') : title;
  }

  /* ================= khối lượng ================= */
  function volume(block, info, list, runs, today, easyText) {
    var t = iso(today), lastWi = info.tpl.weeks.length - 1;
    if (list[0].date > today) return null;                       // giáo án chưa bắt đầu
    var rr = runs.filter(function (r) { return r.kind === 'run' && r.date && Number(r.km) > 0 && r.date <= t; });
    if (!rr.length) return null;

    var d7 = iso(plus(today, -7)), d1 = iso(plus(today, -1)), d8 = iso(plus(today, -8)), d35 = iso(plus(today, -35));
    var last7 = sumKm(rr, d7, d1), chronic = sumKm(rr, d35, d8) / 4;
    var lastRun = rr.reduce(function (m, r) { return r.date > m ? r.date : m; }, '');
    var since = Math.round((today - Core.fromIso(lastRun)) / 864e5);
    var planned7 = list.filter(function (x) { return iso(x.date) >= d7 && iso(x.date) <= d1 && x.s.type !== 'race'; })
      .reduce(function (a, x) { return a + (Number(x.s.km) || 0); }, 0);

    // Buổi người dùng tự sửa thì để nguyên; tính trên km GỐC để chạy lại nhiều lần không giảm chồng.
    var end = iso(plus(today, VOL_DAYS));
    var win = list.filter(function (x) {
      var d = iso(x.date);
      return d >= t && d <= end && !block.done[x.id] && x.s.type !== 'race' && x.wi < lastWi && !(x.edited && !x.adj);
    });
    if (!win.length) return null;
    var base = win.reduce(function (a, x) { return a + (Number(x.orig.km) || 0); }, 0);
    if (base < 4) return null;

    var f = 1, why = [], head = '';
    var gap = since >= 10, comp = planned7 >= 8 ? last7 / planned7 : null;
    if (gap || (comp !== null && comp < 0.6)) {
      var target = Math.min(base, Math.max(last7 * 1.1, base * (gap ? 0.55 : 0.75)));
      var f1 = target / base;
      if (f1 < 0.97) {
        f = Math.min(f, f1);
        if (gap) { why.push('bạn chưa chạy ' + since + ' ngày'); head = 'Quay lại nhẹ nhàng sau thời gian nghỉ'; }
        else { why.push('tuần qua bạn chạy ' + Core.fmtKm(last7) + ' km, chỉ ' + Math.round(comp * 100) + '% kế hoạch (' + Core.fmtKm(planned7) + ' km)'); head = 'Giảm khối lượng vì tuần qua thiếu buổi'; }
      }
    }
    if (chronic >= 8 && last7 > chronic * 1.3) {
      var f2 = last7 > chronic * 1.5 ? 0.85 : 0.92;
      f = Math.min(f, f2);
      why.push('tuần qua ' + Core.fmtKm(last7) + ' km, nhiều hơn ' + Math.round((last7 / chronic - 1) * 100) + '% so với trung bình 4 tuần trước (' + Core.fmtKm(chronic) + ' km)');
      if (!head) head = 'Giảm tải vì tuần qua chạy nhiều';
    }

    var changes = [];
    if (f >= 0.97) {
      // điều kiện đã hết: trả buổi do app giảm về đúng bản gốc
      win.forEach(function (x) {
        if (!x.adj || x.adj.k !== 'vol') return;
        changes.push({ sid: x.id, date: x.date, line: label(x.date) + ' · ' + x.s.title + ' → ' + x.orig.title,
                       delta: { type: x.orig.type, title: x.orig.title, d: x.orig.d, km: x.orig.km } });
      });
      if (!changes.length) return null;
      return { kind: 'vol', restore: true, level: 'info', title: 'Khôi phục khối lượng gốc',
               why: 'Nhịp tập đã ổn lại nên không còn lý do giảm các buổi tuần này.', changes: changes };
    }

    var before = 0, after = 0;
    win.forEach(function (x) {
      var ot = x.orig.type, bk = Number(x.orig.km) || 0, cur = Number(x.s.km) || 0;
      if (ot === 'easy' || ot === 'long') {
        var nk = Math.min(bk, Math.max(ot === 'long' ? 4 : 2, r05(bk * f)));
        if (Math.abs(nk - cur) < 0.4) return;
        before += cur; after += nk;
        changes.push({ sid: x.id, date: x.date, line: label(x.date) + ' · ' + x.s.title + ' → ' + kmNum(nk) + ' km',
                       delta: { km: nk, title: replaceKm(x.s.title, nk) } });
      } else if (ot === 'quality' && f <= 0.8) {
        var qk = Math.max(3, r05(bk * f));
        if (x.s.type === 'easy' && Math.abs(qk - cur) < 0.4) return;
        before += cur; after += qk;
        changes.push({ sid: x.id, date: x.date, line: label(x.date) + ' · ' + x.s.title + ' → chạy nhẹ ' + kmNum(qk) + ' km',
                       delta: { type: 'easy', title: 'Chạy nhẹ ' + kmNum(qk) + ' km', km: qk,
                                d: (easyText ? 'Pace ' + easyText + ', nói được cả câu.' : 'Chạy thật nhẹ, nói được cả câu.')
                                   + ' Đổi từ buổi chất lượng để giảm tải.' } });
      }
    });
    if (!changes.length) return null;
    return { kind: 'vol', restore: false, level: f <= 0.8 ? 'high' : 'mild', title: head || 'Điều chỉnh khối lượng',
             why: why.join('; ').replace(/^./, function (c) { return c.toUpperCase(); })
               + '. Giảm 7 ngày tới từ ' + Core.fmtKm(before) + ' còn ' + Core.fmtKm(after) + ' km'
               + (f <= 0.8 ? ', buổi chất lượng đổi thành chạy nhẹ' : '') + '.',
             changes: changes };
  }

  /* ================= pace ================= */
  // Dải pace phù hợp cho một buổi chất lượng, suy từ kiểu buổi: tempo, quãng
  // ngắn (cỡ pace 5K), quãng trung bình hoặc dài (cỡ pace 10K).
  function bandFor(x, zm, p10) {
    var title = x.s.title;
    if (/^Tempo/i.test(title)) return { lo: zm.tempo.lo, hi: zm.tempo.hi };
    var m = /(\d+)\s*×\s*(\d+(?:[.,]\d+)?)\s*(km|phút)/i.exec(title);
    if (!m) return null;
    var size = Number(m[2].replace(',', '.')), repKm = m[3].toLowerCase() === 'km'
      ? size : size * 60 / ((zm.interval.lo + zm.interval.hi) / 2);
    if (repKm <= 1.2) return { lo: zm.interval.lo, hi: zm.interval.hi };
    if (repKm >= 2.5) return { lo: Math.round(p10 * 1.0), hi: Math.round(p10 * 1.03) };
    return { lo: Math.round(p10 * 0.98), hi: Math.round(p10 * 1.0) };
  }

  function retune(x, zm, p10) {
    var s = x.s, delta = {}, lines = [];
    if (s.type === 'easy' || s.type === 'long') {
      var m = PACE_RANGE.exec(s.d || '');
      if (!m) return null;
      var mid = (secs(m[1], m[2]) + secs(m[3], m[4])) / 2, band = zm.easy, bmid = (band.lo + band.hi) / 2;
      if (Math.abs(mid - bmid) / bmid <= 0.05) return null;
      var txt = Predict.rangeText(band);
      delta.d = s.d.replace(PACE_RANGE, 'Pace ' + txt);
      lines.push(m[1] + ':' + m[2] + '–' + m[3] + ':' + m[4] + ' → ' + txt);
    } else if (s.type === 'quality') {
      var tokens = [], seen = {}, mm;
      AT_PACE.lastIndex = 0;
      while ((mm = AT_PACE.exec(s.title + ' ' + (s.d || '')))) {
        var k = mm[1] + ':' + mm[2];
        if (!seen[k]) { seen[k] = 1; tokens.push({ txt: k, sec: secs(mm[1], mm[2]) }); }
      }
      var bd = tokens.length ? bandFor(x, zm, p10) : null;
      if (!bd) return null;
      var title = s.title, d = s.d || '';
      tokens.forEach(function (tk) {
        var tgt = tk.sec < bd.lo * 0.96 ? bd.lo : tk.sec > bd.hi * 1.04 ? bd.hi : 0;
        if (!tgt) return;
        // mỗi lần nhích tối đa 15% để một dự đoán lệch không làm giáo án đổi hẳn
        tgt = Math.max(tk.sec * 0.85, Math.min(tk.sec * 1.15, tgt));
        var nt = RL.formatTime(Math.round(tgt));
        if (nt === tk.txt) return;
        var re = new RegExp('@ ' + tk.txt, 'g');
        title = title.replace(re, '@ ' + nt); d = d.replace(re, '@ ' + nt);
        lines.push(tk.txt + ' → ' + nt);
      });
      if (!lines.length) return null;
      delta.title = title; delta.d = d;
    } else return null;
    return { sid: x.id, date: x.date, line: label(x.date) + ' · ' + s.title + ': pace ' + lines.join(', '), delta: delta };
  }

  function pace(block, info, list, runs, today, pred, skip) {
    var p10 = pred.preds['10'];
    if (!pred.zones || !p10 || !p10.paceSec || p10.confidence === 'thấp' || pred.stale) return null;
    var zm = {};
    pred.zones.forEach(function (z) { zm[z.key] = z; });
    var t = iso(today), end = iso(plus(today, PACE_DAYS)), lastWi = info.tpl.weeks.length - 1;
    var changes = [];
    list.forEach(function (x) {
      var d = iso(x.date);
      if (d < t || d > end || block.done[x.id] || x.s.type === 'race' || x.wi >= lastWi) return;
      if ((x.edited && !x.adj) || skip[x.id]) return;
      var c = retune(x, zm, p10.paceSec);
      if (c) changes.push(c);
    });
    if (!changes.length) return null;
    return { kind: 'pace', restore: false, level: 'mild', title: 'Chỉnh pace theo khả năng hiện tại',
             why: 'Dự đoán 10K của bạn hiện là ' + RL.formatTime(p10.timeSec) + ' (khoảng ' + RL.formatTime(p10.paceSec)
               + '/km, độ tin cậy ' + p10.confidence + '), nên pace ghi trong giáo án đã lệch khỏi mức phù hợp.',
             changes: changes };
  }

  /* ================= gợi ý + áp dụng ================= */
  // Trả về mảng gợi ý cho một giáo án; mảng rỗng khi mọi thứ đang khớp.
  function propose(block, runs, opts) {
    var today = (opts && opts.today) || Core.today0();
    var info = Blocks.sessionsOf(block);
    if (!info.tpl) return [];
    var list = info.list.filter(function (x) { return x.s.type !== 'rest'; });
    if (!list.length || list[list.length - 1].date < today) return [];     // giáo án đã kết thúc
    var pred = Predict.compute(runs, today);
    var easy = pred.zones ? Predict.rangeText(pred.zones[0]) : '';
    var out = [], skip = {};
    var v = volume(block, info, list, runs, today, easy);
    if (v) { v.changes.forEach(function (c) { skip[c.sid] = 1; }); out.push(v); }
    var p = pace(block, info, list, runs, today, pred, skip);
    if (p) out.push(p);
    out.forEach(function (it) { it.blockId = block.id; });
    return out;
  }

  // Áp một gợi ý lên block. Chỉ ghi những trường gợi ý đổi, phần còn lại lấy từ
  // trạng thái hiện tại của buổi nên áp nhiều gợi ý liên tiếp không đè nhau.
  function applyItem(block, item) {
    var n = 0;
    item.changes.forEach(function (c) {
      var x = Blocks.findSession(block, c.sid);
      if (!x || block.done[c.sid]) return;
      var patch = { type: x.s.type, title: x.s.title, d: x.s.d, km: x.s.km };
      Object.keys(c.delta).forEach(function (k) { patch[k] = c.delta[k]; });
      // chỉnh pace lên buổi đã được giảm khối lượng thì giữ nguyên nhãn cũ để còn khôi phục được
      var keep = x.adj && item.kind === 'pace';
      block = Blocks.editSession(block, c.sid, patch,
        item.restore ? null : (keep ? { why: x.adj.why, k: x.adj.k } : { why: item.why, k: item.kind }));
      n++;
    });
    return { block: block, n: n };
  }

  // Chế độ tự động: áp mọi gợi ý của mọi giáo án chưa kết thúc.
  function auto(runs) {
    if (!isAuto() || !runs) return 0;
    var total = 0;
    Blocks.list().forEach(function (b) {
      var cur = Blocks.get(b.id);
      // Hai vòng: buổi vừa giảm km ở vòng 1 mới được xét pace ở vòng 2.
      for (var pass = 0; pass < 2; pass++) {
        var n = 0;
        propose(cur, runs).forEach(function (it) {
          var r = applyItem(cur, it);
          cur = r.block; n += r.n;
        });
        total += n;
        if (!n) break;
      }
    });
    if (total) Core.toast('Đã tự điều chỉnh giáo án', total + ' buổi · xem lý do ở tab Lịch tập');
    return total;
  }

  return { isAuto: isAuto, setAuto: setAuto, propose: propose, applyItem: applyItem, auto: auto };
})(window.Core, window.Blocks, window.RunLog, window.Predict);
