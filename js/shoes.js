// Quản lý giày chạy: mỗi đôi có tên, số km đã chạy trước khi dùng app, ngưỡng
// nên thay, và mỗi buổi chạy gắn (tuỳ chọn) với một đôi qua run.shoeId. Số km
// của đôi giày = km ban đầu + tổng km các buổi gắn với nó, tính lại mỗi lần từ
// nhật ký chứ không lưu cộng dồn nên sửa/xoá buổi chạy luôn cho số đúng.
window.Shoes = (function (Core) {
  'use strict';
  var KEY = 'app-shoes', DEF = 'app-shoe-def';
  var DEFAULT_RETIRE = 700;          // km, mức thường được khuyên cho giày đường nhựa
  var WARN = 0.8;                    // từ 80% bắt đầu nhắc "sắp thay"

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function all() { var m = Core.store.getJSON(KEY, {}); return isObj(m) ? m : {}; }
  function get(id) { return all()[id] || null; }

  // Đang dùng trước, đã nghỉ sau; trong mỗi nhóm theo thứ tự thêm vào.
  function list() {
    var a = all();
    return Object.keys(a).map(function (k) { return a[k]; }).filter(isObj).sort(function (x, y) {
      return (x.retired ? 1 : 0) - (y.retired ? 1 : 0) || (x.added || 0) - (y.added || 0);
    });
  }
  function active() { return list().filter(function (s) { return !s.retired; }); }

  function num(v, fb) {
    var n = Number(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : fb;
  }
  function clean(o, base) {
    var s = base ? JSON.parse(JSON.stringify(base)) : { id: Core.uid('s'), added: Date.now(), retired: false };
    if (o.name !== undefined) s.name = String(o.name).trim().slice(0, 40);
    if (o.startKm !== undefined) s.startKm = num(o.startKm, 0);
    if (o.retireKm !== undefined) { var r = num(o.retireKm, DEFAULT_RETIRE); s.retireKm = r > 0 ? r : DEFAULT_RETIRE; }
    if (o.since !== undefined) s.since = /^\d{4}-\d{2}-\d{2}$/.test(o.since) ? o.since : '';
    if (o.retired !== undefined) s.retired = !!o.retired;
    if (s.startKm === undefined) s.startKm = 0;
    if (s.retireKm === undefined) s.retireKm = DEFAULT_RETIRE;
    if (s.since === undefined) s.since = '';
    return s;
  }
  function save(s) { var a = all(); a[s.id] = s; Core.store.setJSON(KEY, a); return s; }
  function create(o) {
    var s = clean(o);
    if (!s.name) return null;
    save(s);
    if (!defaultId()) setDefault(s.id);              // đôi đầu tiên tự thành mặc định
    return s;
  }
  function update(id, patch) {
    var cur = get(id);
    if (!cur) return null;
    var s = clean(patch, cur);
    if (!s.name) return null;
    save(s);
    if (s.retired && defaultId() === id) Core.store.set(DEF, '');
    return s;
  }
  function remove(id) {
    var a = all();
    delete a[id];
    Core.store.setJSON(KEY, a);
    if (Core.store.get(DEF) === id) Core.store.set(DEF, '');
  }

  function defaultId() {
    var id = Core.store.get(DEF) || '', s = id && get(id);
    return s && !s.retired ? id : '';
  }
  function setDefault(id) { Core.store.set(DEF, id && get(id) && !get(id).retired ? id : ''); }

  // km, số buổi, buổi gần nhất và km 28 ngày gần đây của từng đôi.
  function usage(runs) {
    var out = {}, cut = Core.iso(Core.addDays(Core.today0(), -28));
    runs.forEach(function (r) {
      if (!r.shoeId || r.kind === 'other') return;
      var u = out[r.shoeId] = out[r.shoeId] || { km: 0, n: 0, last: '', recent: 0 };
      var km = Number(r.km) || 0;
      u.km += km; u.n++;
      if (r.date && (!u.last || r.date > u.last)) u.last = r.date;
      if (r.date && r.date >= cut) u.recent += km;
    });
    return out;
  }

  function level(pct) { return pct >= 1 ? 'over' : pct >= WARN ? 'warn' : 'ok'; }
  // Tình trạng một đôi: tổng km, phần trăm so với ngưỡng, mức độ, số tuần còn
  // dùng được nếu tốc độ chạy 4 tuần gần đây giữ nguyên.
  function stat(shoe, use) {
    use = use || { km: 0, n: 0, last: '', recent: 0 };
    var total = (shoe.startKm || 0) + use.km, retire = shoe.retireKm || DEFAULT_RETIRE;
    var pct = total / retire, left = Math.max(0, retire - total);
    var perWeek = use.recent / 4;
    return { total: total, retire: retire, pct: pct, level: level(pct), left: left, n: use.n, last: use.last,
             weeks: perWeek > 0.5 && left > 0 ? Math.ceil(left / perWeek) : null };
  }
  // Mức sau khi thêm/bớt `deltaKm`, để báo "vừa vượt ngưỡng" đúng lúc.
  function crossed(shoe, use, deltaKm) {
    var before = stat(shoe, { km: Math.max(0, (use ? use.km : 0) - deltaKm), n: 0, last: '', recent: 0 });
    var after = stat(shoe, use);
    return before.level !== after.level && after.level !== 'ok' ? after : null;
  }

  function optionsHtml(selected, noneLabel) {
    var shown = active();
    var sel = selected && get(selected);
    if (sel && sel.retired) shown.push(sel);          // buổi cũ vẫn thấy đôi đã nghỉ của nó
    return '<option value="">' + Core.esc(noneLabel || 'Không chọn') + '</option>'
      + shown.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>'
          + Core.esc(s.name) + (s.retired ? ' (đã nghỉ)' : '') + '</option>';
      }).join('');
  }

  // Các buổi chưa gắn giày, từ ngày `since` trở đi (hoặc tất cả).
  function unassigned(runs, since) {
    return runs.filter(function (r) {
      return !r.shoeId && r.kind !== 'other' && Number(r.km) > 0 && (!since || (r.date && r.date >= since));
    });
  }

  return {
    DEFAULT_RETIRE: DEFAULT_RETIRE, WARN: WARN,
    all: all, get: get, list: list, active: active, create: create, update: update, remove: remove,
    defaultId: defaultId, setDefault: setDefault,
    usage: usage, stat: stat, crossed: crossed, optionsHtml: optionsHtml, unassigned: unassigned
  };
})(window.Core);
