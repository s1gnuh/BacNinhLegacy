// Giải đấu = cột mốc trên dòng thời gian cá nhân. Có thể gắn 1 block tập
// luyện (sinh từ template) hoặc không — chạy tự do vẫn log run được bình
// thường, không bắt buộc phải có giáo án.
window.Races = (function (Core) {
  'use strict';
  var KEY = 'app-races';

  function all() { return Core.store.getJSON(KEY, {}); }
  function get(id) { return all()[id] || null; }
  function list() {
    var a = all();
    return Object.keys(a).map(function (k) { return a[k]; })
      .sort(function (x, y) { return Core.fromIso(x.date) - Core.fromIso(y.date); });
  }
  function save(race) { var a = all(); a[race.id] = race; Core.store.setJSON(KEY, a); return race; }
  function remove(id) { var a = all(); delete a[id]; Core.store.setJSON(KEY, a); }

  function create(opts) {
    var race = {
      id: opts.id || Core.uid('race-'),
      name: opts.name,
      date: opts.date,                         // ISO, ngày thi
      distanceKm: Number(opts.distanceKm) || 0,
      location: opts.location || '',
      targetA: opts.targetA || '', targetB: opts.targetB || '', targetC: opts.targetC || '',
      paceZones: opts.paceZones || null,        // [{label,type,pace,note}]
      raceDayPlan: opts.raceDayPlan || '',
      blockId: opts.blockId || null,
      status: 'upcoming',
      result: null
    };
    return save(race);
  }

  function refreshStatus(race) {
    race.status = Core.fromIso(race.date) < Core.today0() ? (race.result ? 'done' : 'past') : 'upcoming';
    return race;
  }

  function upcoming() { return list().map(refreshStatus).filter(function (r) { return r.status === 'upcoming'; }); }
  function past() { return list().map(refreshStatus).filter(function (r) { return r.status !== 'upcoming'; }); }

  function daysUntil(race) {
    return Math.round((Core.fromIso(race.date) - Core.today0()) / 864e5);
  }

  return { all: all, get: get, list: list, save: save, remove: remove, create: create,
           refreshStatus: refreshStatus, upcoming: upcoming, past: past, daysUntil: daysUntil };
})(window.Core);
