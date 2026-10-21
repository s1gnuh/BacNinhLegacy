// Block = 1 lần áp một template vào 1 giải cụ thể: ngày bắt đầu, chế độ
// 3/4 buổi mỗi tuần, lịch ngày tuỳ chỉnh, buổi đã chạy, ghi chú. Tổng quát
// hoá từ sched/done/notes/mode vốn là biến toàn cục duy nhất trong bản cũ.
window.Blocks = (function (Core, Templates) {
  'use strict';
  var KEY = 'app-blocks';

  function all() { return Core.store.getJSON(KEY, {}); }
  function get(id) { return all()[id] || null; }
  function list() { var a = all(); return Object.keys(a).map(function (k) { return a[k]; }); }
  function save(block) { var a = all(); a[block.id] = block; Core.store.setJSON(KEY, a); return block; }
  function remove(id) { var a = all(); delete a[id]; Core.store.setJSON(KEY, a); }

  function create(opts) {
    var tpl = Templates.get(opts.templateId);
    var startDate = opts.startDate ? Core.fromIso(opts.startDate) : Templates.startFromRaceDate(tpl, Core.fromIso(opts.raceDate));
    var block = {
      id: opts.id || Core.uid('blk-'),
      raceId: opts.raceId,
      templateId: opts.templateId,
      startDate: Core.iso(startDate),
      mode: opts.mode || 4,
      schedDef: (tpl.days || []).map(function (d) { return d.def; }),
      schedWk: {},
      done: {},
      notes: {}
    };
    return save(block);
  }

  function sessionId(wi, k) { return 'w' + wi + k; }

  function okOff(n) { return typeof n === 'number' && n >= 0 && n <= 6 && n === Math.floor(n); }
  function slotIdx(days, k) { for (var i = 0; i < days.length; i++) if (days[i].k === k) return i; return 0; }

  function offFor(block, tpl, sessions, wi, k) {
    if (sessions[wi][k].type === 'race') return 6;
    var o = block.schedWk[wi] && block.schedWk[wi][k];
    return okOff(o) ? o : block.schedDef[slotIdx(tpl.days, k)];
  }
  function dayOf(block, wi, off) { return Core.addDays(Core.fromIso(block.startDate), wi * 7 + off); }
  function visible(block, tpl, day) { return block.mode === 4 || day.k !== 'fri'; }

  // Danh sách buổi tập đầy đủ của 1 block, sắp theo ngày — tương đương
  // hàm `all()` trong script.js bản cũ nhưng nhận block làm tham số.
  function sessionsOf(block) {
    var tpl = Templates.get(block.templateId);
    if (!tpl) return { tpl: null, sessions: [], list: [] };
    var sessions = Templates.buildSessions(tpl, block.raceTitle, block.raceDesc, block.raceKm);
    var out = [];
    sessions.forEach(function (s, wi) {
      tpl.days.forEach(function (dy, si) {
        if (!visible(block, tpl, dy)) return;
        var off = offFor(block, tpl, sessions, wi, dy.k);
        out.push({ wi: wi, dy: dy, si: si, off: off, s: s[dy.k], date: dayOf(block, wi, off), id: sessionId(wi, dy.k) });
      });
    });
    out.sort(function (a, b) { return a.date - b.date || a.si - b.si; });
    return { tpl: tpl, sessions: sessions, list: out };
  }

  function findSession(block, sid) {
    var list = sessionsOf(block).list;
    for (var i = 0; i < list.length; i++) if (list[i].id === sid) return list[i];
    return null;
  }

  function setDone(block, sid, v) {
    if (v) block.done[sid] = 1; else delete block.done[sid];
    save(block);
  }
  function setNote(block, sid, v) {
    var t = String(v || '').trim();
    if (t) block.notes[sid] = t; else delete block.notes[sid];
    save(block);
  }
  function hasOverride(block, wi) { return !!(block.schedWk[wi] && Object.keys(block.schedWk[wi]).length); }

  function stats(block) {
    var items = sessionsOf(block).list.filter(function (x) { return x.s.type !== 'rest'; });
    var n = 0, km = 0;
    items.forEach(function (x) { if (block.done[x.id]) { n++; km += x.s.km; } });
    return { n: n, total: items.length, km: km, pct: items.length ? Math.round(n / items.length * 100) : 0 };
  }

  // Km dự kiến / đã chạy của từng tuần trong block — dùng cho biểu đồ.
  function weeklyLoad(block) {
    var list = sessionsOf(block).list;
    var byWeek = {};
    list.forEach(function (x) {
      byWeek[x.wi] = byWeek[x.wi] || { wi: x.wi, planned: 0, actual: 0 };
      byWeek[x.wi].planned += x.s.km;
      if (block.done[x.id]) byWeek[x.wi].actual += x.s.km;
    });
    return Object.keys(byWeek).map(function (k) { return byWeek[k]; }).sort(function (a, b) { return a.wi - b.wi; });
  }

  function weekComplete(block, wi) {
    var items = sessionsOf(block).list.filter(function (x) { return x.wi === wi && x.s.type !== 'rest'; });
    return items.length > 0 && items.every(function (x) { return !!block.done[x.id]; });
  }

  // Trạng thái "đang active": hôm nay nằm trong khoảng ngày của block.
  function isActive(block) {
    var list = sessionsOf(block).list.filter(function (x) { return x.s.type !== 'rest'; });
    if (!list.length) return false;
    var t0 = Core.today0();
    return t0 >= list[0].date && t0 <= list[list.length - 1].date;
  }

  return {
    all: all, get: get, list: list, save: save, remove: remove, create: create,
    sessionId: sessionId, sessionsOf: sessionsOf, findSession: findSession,
    offFor: offFor, dayOf: dayOf, visible: visible,
    setDone: setDone, setNote: setNote, hasOverride: hasOverride,
    stats: stats, weeklyLoad: weeklyLoad, weekComplete: weekComplete, isActive: isActive
  };
})(window.Core, window.Templates);
