// Đồng bộ nhiều thiết bị (điện thoại, máy tính, iPhone Safari lẫn app đã thêm
// vào màn hình chính) qua /api/sync. Cách hoạt động, để khỏi phải đoán:
//
//  - Dữ liệu được cắt thành các "đơn vị" nhỏ: một giải, một buổi chạy, một
//    mục tiêu, một đôi giày, và với giáo án thì từng ô đã đánh dấu / ghi chú /
//    buổi đã sửa. Cắt nhỏ để hai máy cùng đánh dấu hai buổi khác nhau thì cả
//    hai đều được giữ, thay vì máy nào gửi sau ghi đè cả giáo án.
//  - Mỗi đơn vị có mốc thời gian t. Cùng một đơn vị bị sửa trên hai máy thì
//    bản có t lớn hơn thắng (hoà thì giữ bản đã có trên máy chủ). Xoá để lại
//    "bia mộ" để máy kia biết mà xoá theo.
//  - Ảnh chụp KHÔNG đồng bộ (quá nặng cho kho miễn phí): ảnh ở máy nào ở lại
//    máy đó, các số liệu của buổi chạy thì đi khắp nơi.
//  - Mã đồng bộ là chìa khoá duy nhất: máy chủ chỉ lưu hash của nó.
//  - Cài đặt riêng từng máy (giao diện, nhắc chạy, khoá Gemini) không đồng bộ.
window.Sync = (function (Core, RunLog) {
  'use strict';
  var K_CFG = 'app-sync', K_META = 'app-sync-meta';
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var CODE_RE = /^[A-Z2-9]{20}$/;
  var UNIT_RE = /^[a-z]\|[\w.-]{1,64}(\|[\w.:-]{1,64})?$/;
  var CURSOR_MARGIN = 5000, TOMB_MS = 120 * 864e5, CHUNK_BYTES = 500000, CHUNK_UNITS = 300;
  var DEBOUNCE = 3000, POLL = 60000, MIN_GAP = 20000;

  var RECORDS = ['app-races', 'app-templates', 'app-shoes'];   // object: id -> bản ghi
  var LISTS = ['app-goals'];                                    // mảng bản ghi có id
  var SCALARS = ['app-shoe-def'];                               // chuỗi đơn
  var BLOCKS = 'app-blocks';
  // phần "mềm" của giáo án, mỗi ô là một đơn vị riêng (tiền tố -> trường)
  var SUB = { d: 'done', n: 'notes', e: 'edits', x: 'removed', j: 'adj', w: 'schedWk' };
  var SUBFIELDS = Object.keys(SUB).map(function (p) { return SUB[p]; });
  var SYNCED = RECORDS.concat(LISTS, SCALARS, [BLOCKS]);
  var RUN_FIELDS = ['id', 'date', 'km', 'pace', 'time', 'title', 'kind', 'cat', 'blockId',
                    'sessionId', 'raceId', 'note', 'added', 'shoeId'];

  var applying = false, running = null, again = false, timer = 0, lastRun = 0;
  var state = { busy: false, error: '', hard: '' };
  var subs = [];

  /* ================= tiện ích ================= */
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function readJSON(k, fb) { try { var v = JSON.parse(lsGet(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } }

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + '.' + s.length.toString(36);
  }

  function loadCfg() { var c = readJSON(K_CFG, null); return isObj(c) && c.code ? c : null; }
  function saveCfg(c) { lsSet(K_CFG, JSON.stringify(c)); }
  function loadMeta() { var m = readJSON(K_META, {}); return isObj(m) ? m : {}; }
  function saveMeta(m) { lsSet(K_META, JSON.stringify(m)); }
  function enabled() { return !!loadCfg(); }

  // Đồng hồ máy có thể lệch; lệch bao nhiêu so với máy chủ thì bù bấy nhiêu để
  // mốc t của các máy so sánh được với nhau.
  function now() { var c = loadCfg(); return Date.now() + ((c && c.skew) || 0); }

  function cleanRun(r) {
    var o = {};
    RUN_FIELDS.forEach(function (f) { o[f] = r[f] == null ? (f === 'added' ? 0 : '') : r[f]; });
    return o;
  }

  /* ================= cắt dữ liệu thành đơn vị ================= */
  function keyOfUnit(uk) {
    var p = uk.split('|');
    if (SUB[p[0]]) return BLOCKS;
    if (p[0] === 'r') return 'run';
    if (p[0] === 'm' || p[0] === 'l' || p[0] === 'k') return p[1];
    return null;
  }

  // { unitKey: giá trị } của một khoá localStorage.
  function unitsOf(key) {
    var out = {};
    if (key === BLOCKS) {
      var bs = Core.store.getJSON(key, {});
      if (!isObj(bs)) return out;
      Object.keys(bs).forEach(function (id) {
        var b = bs[id];
        if (!isObj(b)) return;
        var base = {};
        Object.keys(b).forEach(function (f) { if (SUBFIELDS.indexOf(f) < 0) base[f] = b[f]; });
        out['m|' + key + '|' + id] = base;
        Object.keys(SUB).forEach(function (p) {
          var m = b[SUB[p]];
          if (!isObj(m)) return;
          Object.keys(m).forEach(function (sid) { out[p + '|' + id + '|' + sid] = m[sid]; });
        });
      });
    } else if (RECORDS.indexOf(key) >= 0) {
      var rec = Core.store.getJSON(key, {});
      if (isObj(rec)) Object.keys(rec).forEach(function (id) { if (rec[id] != null) out['m|' + key + '|' + id] = rec[id]; });
    } else if (LISTS.indexOf(key) >= 0) {
      var arr = Core.store.getJSON(key, []);
      if (Array.isArray(arr)) arr.forEach(function (it) { if (isObj(it) && it.id) out['l|' + key + '|' + it.id] = it; });
    } else if (SCALARS.indexOf(key) >= 0) {
      var s = Core.store.get(key);
      if (s != null && s !== '') out['k|' + key] = s;
    }
    // Bỏ tên đơn vị mà máy chủ sẽ từ chối.
    Object.keys(out).forEach(function (uk) { if (!UNIT_RE.test(uk)) delete out[uk]; });
    return out;
  }

  // So sánh với meta, đóng dấu t cho đơn vị mới/đổi, bia mộ cho đơn vị biến mất.
  // adopt = true (lúc mới bật): chỉ thêm đơn vị CHƯA có meta với t = 1, tức "cũ
  // hơn mọi chỉnh sửa thật" để máy mới nhập mã không đè dữ liệu của máy chính.
  function touchKey(key, adopt) {
    var m = loadMeta(), cur = unitsOf(key), changed = false, t = adopt ? 1 : now();
    Object.keys(cur).forEach(function (uk) {
      var h = hash(JSON.stringify(cur[uk])), e = m[uk];
      if (adopt) {
        if (!e) { m[uk] = { t: 1, h: h, s: 0, d: 0 }; changed = true; }
      } else if (!e || e.d || e.h !== h) {
        m[uk] = { t: t, h: h, s: e ? e.s : 0, d: 0 };
        changed = true;
      }
    });
    if (!adopt) {
      Object.keys(m).forEach(function (uk) {
        if (keyOfUnit(uk) !== key || cur[uk] !== undefined || m[uk].d) return;
        m[uk] = { t: t, h: '', s: m[uk].s, d: 1 };
        changed = true;
      });
    }
    if (changed) { saveMeta(m); if (!adopt) schedule(); }
  }

  function onRunEvent(ev) {
    if (!enabled() || applying) return;
    var m = loadMeta(), uk, e;
    if (ev.type === 'put' && ev.run) {
      var c = cleanRun(ev.run), h = hash(JSON.stringify(c));
      uk = 'r|run|' + c.id; e = m[uk];
      if (e && !e.d && e.h === h) return;
      m[uk] = { t: now(), h: h, s: e ? e.s : 0, d: 0 };
    } else if (ev.type === 'del') {
      uk = 'r|run|' + ev.id; e = m[uk];
      m[uk] = { t: now(), h: '', s: e ? e.s : 0, d: 1 };
    } else return;
    saveMeta(m);
    schedule();
  }

  function adopt() {
    SYNCED.forEach(function (k) { touchKey(k, true); });
    return RunLog.rawAll().then(function (rows) {
      var m = loadMeta();
      rows.forEach(function (r) {
        var uk = 'r|run|' + r.id;
        if (!m[uk]) m[uk] = { t: 1, h: hash(JSON.stringify(cleanRun(r))), s: 0, d: 0 };
      });
      saveMeta(m);
    });
  }

  /* ================= gửi đi ================= */
  function dirtyUnits(runMap) {
    var m = loadMeta(), out = [], cache = {};
    Object.keys(m).forEach(function (uk) {
      var e = m[uk];
      if (e.t === e.s || !UNIT_RE.test(uk)) return;
      var payload;
      if (e.d) payload = { t: e.t, d: 1 };
      else {
        var v = valueOf(uk, runMap, cache);
        if (v === undefined) return;
        payload = { t: e.t, v: v };
      }
      out.push({ uk: uk, t: e.t, payload: payload, size: JSON.stringify(payload).length + uk.length });
    });
    // bản ghi giải/giáo án đi trước ô con, để máy nhận có chỗ gắn vào
    out.sort(function (a, b) { return (a.uk.charAt(0) === 'm' ? 0 : 1) - (b.uk.charAt(0) === 'm' ? 0 : 1); });
    return out;
  }

  function valueOf(uk, runMap, cache) {
    var key = keyOfUnit(uk);
    if (key === 'run') {
      var r = runMap[uk.split('|')[2]];
      return r ? cleanRun(r) : undefined;
    }
    if (!cache[key]) cache[key] = unitsOf(key);
    return cache[key][uk];
  }

  function chunkify(list) {
    var out = [], cur = [], bytes = 0;
    list.forEach(function (u) {
      if (cur.length && (bytes + u.size > CHUNK_BYTES || cur.length >= CHUNK_UNITS)) { out.push(cur); cur = []; bytes = 0; }
      cur.push(u); bytes += u.size;
    });
    if (cur.length) out.push(cur);
    return out;
  }

  function markSynced(sent) {
    var m = loadMeta();
    sent.forEach(function (u) { var e = m[u.uk]; if (e && e.t === u.t) e.s = u.t; });
    saveMeta(m);
  }

  /* ================= nhận về ================= */
  function applyOps(ops) {
    var by = {};
    ops.forEach(function (o) { var k = keyOfUnit(o.uk); if (k && k !== 'run') (by[k] = by[k] || []).push(o); });
    applying = true;
    try {
      Object.keys(by).forEach(function (key) {
        var list = by[key];
        if (key === BLOCKS) {
          var bs = Core.store.getJSON(key, {});
          if (!isObj(bs)) bs = {};
          list.sort(function (a, b) { return (a.uk.charAt(0) === 'm' ? 0 : 1) - (b.uk.charAt(0) === 'm' ? 0 : 1); });
          list.forEach(function (o) {
            var p = o.uk.split('|');
            if (p[0] === 'm') {
              if (o.d) delete bs[p[2]];
              else if (isObj(o.v)) {
                var old = bs[p[2]] || {}, nb = JSON.parse(JSON.stringify(o.v));
                SUBFIELDS.forEach(function (f) {
                  if (old[f] !== undefined) nb[f] = old[f];
                  else if (f === 'done' || f === 'notes' || f === 'schedWk') nb[f] = {};
                });
                bs[p[2]] = nb;
              }
            } else {
              var b = bs[p[1]], f = SUB[p[0]];
              if (!b) { o.orphan = true; return; }
              if (o.d) { if (isObj(b[f])) delete b[f][p[2]]; }
              else { if (!isObj(b[f])) b[f] = {}; b[f][p[2]] = o.v; }
            }
          });
          Core.store.setJSON(key, bs);
        } else if (RECORDS.indexOf(key) >= 0) {
          var rec = Core.store.getJSON(key, {});
          if (!isObj(rec)) rec = {};
          list.forEach(function (o) {
            var id = o.uk.split('|')[2];
            if (o.d) delete rec[id]; else if (o.v != null) rec[id] = o.v;
          });
          Core.store.setJSON(key, rec);
        } else if (LISTS.indexOf(key) >= 0) {
          var arr = Core.store.getJSON(key, []);
          if (!Array.isArray(arr)) arr = [];
          list.forEach(function (o) {
            var id = o.uk.split('|')[2];
            arr = arr.filter(function (it) { return !(isObj(it) && it.id === id); });
            if (!o.d && isObj(o.v)) arr.push(o.v);
          });
          Core.store.setJSON(key, arr);
        } else if (SCALARS.indexOf(key) >= 0) {
          var last = list[list.length - 1];
          if (last.d) lsDel(key); else Core.store.set(key, String(last.v));
        }
      });
    } finally { applying = false; }
  }

  function applyRuns(runOps) {
    if (!runOps.length) return Promise.resolve();
    return RunLog.rawAll().then(function (rows) {
      var by = {};
      rows.forEach(function (r) { by[r.id] = r; });
      return runOps.reduce(function (p, o) {
        return p.then(function () {
          var id = o.uk.split('|')[2];
          if (o.d) return RunLog.removeRun(id, { silent: true });
          var base = by[id] || {}, v = cleanRun(isObj(o.v) ? o.v : {});
          var rec = {};
          Object.keys(base).forEach(function (f) { rec[f] = base[f]; });     // giữ ảnh (blob) của máy này
          RUN_FIELDS.forEach(function (f) { rec[f] = v[f]; });
          rec.id = id;
          rec.cat = rec.cat === 'photo' ? 'photo' : 'strava';
          rec.kind = rec.kind || 'run';
          return RunLog.saveRun(rec, { silent: true });
        });
      }, Promise.resolve());
    });
  }

  // Trả về số đơn vị thật sự làm đổi dữ liệu trên máy này.
  function applyRemote(units) {
    var m = loadMeta(), ops = [], runOps = [], quiet = [], names = Object.keys(units || {});
    names.forEach(function (uk) {
      var u = units[uk], k = keyOfUnit(uk);
      if (!u || typeof u.t !== 'number' || !UNIT_RE.test(uk)) return;
      if (k !== 'run' && SYNCED.indexOf(k) < 0) return;          // máy chủ không được ghi khoá lạ
      var e = m[uk];
      // máy này mới hơn, hoặc cùng bản đã đồng bộ rồi: bỏ qua
      if (e && (e.t > u.t || (e.t === u.t && e.s === e.t))) return;
      var o = { uk: uk, t: u.t, d: !!u.d, v: u.v };
      var h = o.d ? '' : hash(JSON.stringify(k === 'run' ? cleanRun(isObj(u.v) ? u.v : {}) : u.v));
      o.h = h;
      // nội dung y hệt thì chỉ cập nhật mốc, không tính là thay đổi
      if (e && ((!o.d && !e.d && e.h === h) || (o.d && e.d))) { quiet.push(o); return; }
      if (!e && o.d) { quiet.push(o); return; }
      (k === 'run' ? runOps : ops).push(o);
    });

    applyOps(ops);
    return applyRuns(runOps).then(function () {
      var meta = loadMeta();
      ops.concat(runOps, quiet).forEach(function (o) {
        meta[o.uk] = { t: o.t, h: o.h, s: o.t, d: o.d ? 1 : 0 };
      });
      saveMeta(meta);
      return ops.filter(function (o) { return !o.orphan; }).length + runOps.length;
    });
  }

  /* ================= vòng đồng bộ ================= */
  var ERR = {
    storage_not_configured: 'Máy chủ chưa nối kho Upstash Redis (hoặc nối xong chưa deploy lại), nên chưa đồng bộ được.',
    no_such_space: 'Không tìm thấy mã này. Kiểm tra lại mã trên máy đã bật đồng bộ.',
    bad_code: 'Mã đồng bộ không hợp lệ.',
    too_many_units: 'Lượng dữ liệu gửi một lần quá lớn.',
    space_full: 'Kho đồng bộ đã đầy. Hãy xóa bớt buổi chạy cũ.'
  };

  function post(body) {
    return fetch('api/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).catch(function () {
      throw new Error('Không kết nối được máy chủ. Kiểm tra mạng.');
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.ok && j && j.ok) return j;
        var code = j && j.error;
        var e = new Error(ERR[code] || (r.status === 404 && !code ? 'Máy chủ chưa có /api/sync. Bản deploy có thể chưa xong.' : 'Máy chủ trả lỗi ' + r.status + '.'));
        e.code = code || ('http_' + r.status);
        throw e;
      });
    });
  }

  function notify() { subs.slice().forEach(function (fn) { try { fn(status()); } catch (e) {} }); }
  function setState(p) { Object.keys(p).forEach(function (k) { state[k] = p[k]; }); notify(); }

  function doSync() {
    var cfg = loadCfg();
    if (!cfg) return Promise.resolve({ skipped: true });
    setState({ busy: true, error: '' });
    var pulled = 0, lastNow = 0, sentN = 0;

    return (cfg.adopted ? Promise.resolve() : adopt().then(function () {
      var c = loadCfg(); if (c) { c.adopted = true; saveCfg(c); }
    })).then(function () {
      return RunLog.rawAll();
    }).then(function (rows) {
      var runMap = {};
      rows.forEach(function (r) { runMap['' + r.id] = r; });
      var chunks = chunkify(dirtyUnits(runMap));
      if (!chunks.length) chunks = [[]];
      return chunks.reduce(function (p, ch, i) {
        return p.then(function () {
          var units = {};
          ch.forEach(function (u) { units[u.uk] = u.payload; });
          var c = loadCfg() || cfg;
          return post({ code: c.code, since: c.cursor || 0, units: units, join: i === 0 && !!c.join, create: i === 0 && !!c.create }).then(function (res) {
            lastNow = res.now; sentN += ch.length;
            // Áp bản của máy chủ TRƯỚC khi đánh dấu 'đã gửi': đơn vị gửi lên mà thua
            // (hoà mốc t nhưng máy chủ giữ bản khác) phải nhận bản của máy chủ.
            return applyRemote(res.units).then(function (n) { pulled += n; markSynced(ch); });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      var c = loadCfg();
      if (c) {
        c.cursor = Math.max(0, lastNow - CURSOR_MARGIN);
        var skew = lastNow - Date.now();
        c.skew = Math.abs(skew) > 2000 ? skew : 0;
        c.last = Date.now(); c.join = false; c.create = false;
        saveCfg(c);
      }
      pruneTombstones();
      setState({ busy: false, error: '', hard: '' });
      if (pulled > 0) remoteApplied(pulled);
      return { pulled: pulled, sent: sentN };
    }).catch(function (e) {
      var hard = e && (e.code === 'no_such_space' || e.code === 'bad_code');
      var c = loadCfg();
      // nhập mã sai thì bỏ luôn trạng thái "đang kết nối" chứ đừng treo mãi
      if (hard && c && c.join) { lsDel(K_CFG); lsDel(K_META); }
      setState({ busy: false, error: (e && e.message) || 'Đồng bộ lỗi.', hard: hard ? e.code : '' });
      throw e;
    });
  }

  function pruneTombstones() {
    var m = loadMeta(), cut = Date.now() - TOMB_MS, ch = false;
    Object.keys(m).forEach(function (uk) { if (m[uk].d && m[uk].t === m[uk].s && m[uk].t < cut) { delete m[uk]; ch = true; } });
    if (ch) saveMeta(m);
  }

  function syncNow() {
    if (!enabled()) return Promise.resolve({ skipped: true });
    if (running) { again = true; return running; }
    clearTimeout(timer); timer = 0;
    lastRun = Date.now();
    running = doSync().then(function (r) { running = null; return r; }, function (e) { running = null; throw e; });
    running.then(finishRun, finishRun);
    return running;
  }
  function finishRun() { if (again) { again = false; schedule(500); } }

  function schedule(ms) {
    if (!enabled() || timer) return;
    timer = setTimeout(function () { timer = 0; syncNow().catch(function () {}); }, ms || DEBOUNCE);
  }

  /* ================= khi máy khác vừa đổi dữ liệu ================= */
  function recentReload() {
    try { return Date.now() - Number(sessionStorage.getItem('bn-sync-rl') || 0) < 10000; } catch (e) { return false; }
  }
  function banner() {
    if (document.getElementById('sync-banner') || !document.body) return;
    var b = document.createElement('div');
    b.id = 'sync-banner'; b.className = 'sync-banner'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>Có dữ liệu mới từ máy khác.</span><button type="button" class="btn-sm primary">Tải lại</button>';
    b.querySelector('button').addEventListener('click', function () { window.location.reload(); });
    document.body.appendChild(b);
  }
  function remoteApplied(n) {
    try { Core.toast('Đã cập nhật từ máy khác', n + ' mục mới'); } catch (e) {}
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var ae = document.activeElement;
    var typing = !!ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    var form = /^(log|settings)\.html$/.test(page);       // trang có form dở dang: để người dùng tự tải lại
    if (typing || form || recentReload()) { banner(); return; }
    try { sessionStorage.setItem('bn-sync-rl', String(Date.now())); } catch (e) {}
    setTimeout(function () { window.location.reload(); }, 900);
  }

  /* ================= thao tác của người dùng ================= */
  function genCode() {
    var bytes = new Uint8Array(20), out = '';
    var cr = window.crypto || window.msCrypto;
    if (cr && cr.getRandomValues) cr.getRandomValues(bytes);
    else for (var i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 20; j++) out += ALPHABET.charAt(bytes[j] & 31);
    return out;
  }
  function normalizeCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function formatCode(c) { return String(c || '').replace(/(.{5})(?=.)/g, '$1-'); }
  function link(code) {
    return window.location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + 'settings.html#sync=' + code;
  }

  function start(code, joining) {
    lsSet(K_META, '{}');
    saveCfg({ code: code, join: !!joining, create: !joining, cursor: 0, skew: 0, adopted: false, last: 0 });
    setState({ error: '', hard: '' });
    return syncNow();
  }
  function create() {
    if (enabled()) return Promise.reject(new Error('Máy này đã bật đồng bộ.'));
    return start(genCode(), false);
  }
  function join(input) {
    if (enabled()) return Promise.reject(new Error('Máy này đã bật đồng bộ.'));
    var code = normalizeCode(input);
    if (!CODE_RE.test(code)) return Promise.reject(new Error('Mã gồm 20 ký tự chữ và số, ví dụ ABCDE-FGHJK-LMNPQ-RSTUV.'));
    return start(code, true);
  }
  // wipe = true: xoá luôn dữ liệu đồng bộ trên máy chủ (mọi máy khác mất kết nối).
  function disable(wipe) {
    var c = loadCfg();
    if (!c) return Promise.resolve();
    var step = wipe ? post({ code: c.code, wipe: true }) : Promise.resolve();
    return step.then(function () {
      clearTimeout(timer); timer = 0;
      lsDel(K_CFG); lsDel(K_META);
      setState({ error: '', hard: '' });
    });
  }

  function status() {
    var c = loadCfg(), m = c ? loadMeta() : {}, dirty = 0;
    Object.keys(m).forEach(function (uk) { if (m[uk].t !== m[uk].s) dirty++; });
    return { enabled: !!c, code: c ? c.code : '', last: c ? c.last || 0 : 0, dirty: dirty,
             busy: state.busy, error: state.error, hard: state.hard, joining: !!(c && c.join) };
  }
  function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }

  /* ================= khởi động ================= */
  // Móc vào ghi dữ liệu NGAY khi file được nạp, trước mọi mã của trang.
  Core.store.onSet = function (k) {
    if (applying || SYNCED.indexOf(k) < 0 || !enabled()) return;
    touchKey(k, false);
  };
  RunLog.watch(onRunEvent);

  function boot() {
    // Đăng ký luôn cả khi chưa bật: người dùng có thể bật đồng bộ ngay trong phiên này.
    if (enabled()) setTimeout(function () { syncNow().catch(function () {}); }, 600);
    document.addEventListener('visibilitychange', function () {
      if (!enabled()) return;
      if (!document.hidden && Date.now() - lastRun > MIN_GAP) syncNow().catch(function () {});
      else if (document.hidden && status().dirty) syncNow().catch(function () {});
    });
    window.addEventListener('online', function () { syncNow().catch(function () {}); });
    setInterval(function () {
      if (!document.hidden && enabled()) syncNow().catch(function () {});
    }, POLL);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return {
    enabled: enabled, status: status, subscribe: subscribe, syncNow: syncNow,
    create: create, join: join, disable: disable,
    normalizeCode: normalizeCode, formatCode: formatCode, link: link, CODE_RE: CODE_RE
  };
})(window.Core, window.RunLog);
