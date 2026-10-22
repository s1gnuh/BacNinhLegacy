(function () {
  'use strict';
  var C = window.Core, RL = window.RunLog;
  var runs = [], calMonth = null, calSel = '';

  function el(id) { return document.getElementById(id); }

  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function sameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function photosOn(dateStr) {
    return runs.filter(function (r) { return r.date === dateStr; });
  }

  function findRun(id) {
    for (var i = 0; i < runs.length; i++) { if (runs[i].id === id) return runs[i]; }
    return null;
  }

  /* ---- lịch ---- */
  function renderCal() {
    if (!calMonth) return;
    var months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
    el('log-cal-title').textContent = months[calMonth.getMonth()] + '/' + calMonth.getFullYear();
    var t0 = C.today0();
    var offset = (calMonth.getDay() + 6) % 7;
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1 - offset + i);
      var key = C.iso(d);
      var hasPics = photosOn(key).length > 0;
      var cls = ['cday'];
      if (!sameMonth(d, calMonth)) cls.push('out');
      if (key === C.iso(t0)) cls.push('today');
      if (key === calSel) cls.push('sel');
      cells += '<button type="button" class="' + cls.join(' ') + '" data-day="' + key + '"'
        + ' aria-label="' + C.fmt(d) + '">'
        + '<span class="cd-num num">' + d.getDate() + '</span>'
        + (hasPics ? '<i class="cd-pic"></i>' : '')
        + '</button>';
    }
    el('log-cal').innerHTML = cells;
  }

  /* ---- card HTML ---- */
  function cardHtml(l) {
    var isPhoto = l.cat === 'photo';
    if (l.saved && !l.expanded) {
      var stats = [];
      if (!isPhoto) {
        if (l.km) stats.push(l.km + ' km');
        if (l.time) stats.push(l.time);
        if (l.pace) stats.push(l.pace + '/km');
      }
      return '<article class="lg lg-mini' + (isPhoto ? ' photo' : '') + '" data-id="' + l.id + '">'
        + '<div class="lg-thumb"><img src="' + (l.url || '') + '" loading="lazy" alt=""></div>'
        + '<div class="lg-mini-body">'
        + '<div class="lg-mini-top">' + (isPhoto ? 'Ảnh chạy' : 'Strava') + '</div>'
        + '<div class="lg-mini-stats">' + (stats.length ? stats.join(' · ') : '—') + '</div>'
        + (l.note ? '<div class="hint">' + C.esc(l.note) + '</div>' : '')
        + '</div>'
        + '<button type="button" class="btn-sm" data-act="expand">Sửa</button>'
        + '</article>';
    }
    var statFields = isPhoto ? '' : '<div class="lg-fields">'
      + '<label class="fld"><span>Loại</span><select data-f="kind">'
      + '<option value="run"' + (l.kind === 'run' ? ' selected' : '') + '>Chạy</option>'
      + '<option value="walk"' + (l.kind === 'walk' ? ' selected' : '') + '>Đi bộ</option>'
      + '<option value="other"' + (l.kind === 'other' ? ' selected' : '') + '>Khác</option>'
      + '</select></label>'
      + '<label class="fld"><span>Km</span><input type="text" inputmode="decimal" data-f="km" value="' + C.esc(l.km) + '"></label>'
      + '<label class="fld"><span>Pace (phút/km)</span><input type="text" data-f="pace" value="' + C.esc(l.pace) + '" placeholder="7:30"></label>'
      + '<label class="fld"><span>Thời gian</span><input type="text" data-f="time" value="' + C.esc(l.time) + '" placeholder="45:00"></label>'
      + '</div>';
    return '<article class="lg' + (isPhoto ? ' photo' : '') + '" data-id="' + l.id + '">'
      + '<div class="lg-thumb"><img src="' + (l.url || '') + '" alt=""></div>'
      + '<div class="lg-body">'
      + '<div class="lg-fields">'
      + '<label class="fld"><span>Loại ảnh</span><select data-f="cat">'
      + '<option value="strava"' + (l.cat !== 'photo' ? ' selected' : '') + '>Ảnh Strava (có số liệu)</option>'
      + '<option value="photo"' + (l.cat === 'photo' ? ' selected' : '') + '>Ảnh chạy (chỉ ảnh)</option>'
      + '</select></label>'
      + '<label class="fld"><span>Ngày</span><input type="date" data-f="date" value="' + C.esc(l.date) + '"></label>'
      + '</div>'
      + statFields
      + '<label class="fld"><span>Chú thích</span><input type="text" data-f="note" value="' + C.esc(l.note) + '" placeholder="Ghi chú ngắn..."></label>'
      + '<div class="lg-actions">'
      + '<button type="button" class="btn-sm primary" data-act="save">Lưu</button>'
      + '<button type="button" class="btn-sm' + (l.armed ? '" data-armed="1"' : '"') + ' data-act="del">'
      + (l.armed ? 'Chắc chắn xóa?' : 'Xóa ảnh') + '</button>'
      + '</div>'
      + '</div>'
      + '</article>';
  }

  /* ---- chi tiết ngày ---- */
  function renderDay() {
    var panel = el('log-day');
    if (!calSel) { panel.hidden = true; return; }
    var pics = photosOn(calSel);
    var d = C.fromIso(calSel);
    var WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    var label = WD[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    var html = '<div class="cal-day">'
      + '<div class="cdh"><strong>' + label + '</strong></div>'
      + '<div class="sv-upload">'
      + '<label class="fld sv-cat"><span>Ảnh sắp thêm là</span>'
      + '<select id="log-cat">'
      + '<option value="strava">Ảnh Strava (có số liệu)</option>'
      + '<option value="photo">Ảnh chạy (chỉ ảnh)</option>'
      + '</select></label>'
      + '<label class="drop" id="log-drop" for="log-file">'
      + '<strong>Chọn ảnh hoặc kéo thả vào đây</strong>'
      + '<span>PNG hoặc JPG, chọn được nhiều ảnh cùng lúc</span>'
      + '<input class="sr" type="file" id="log-file" accept="image/*" multiple>'
      + '</label>'
      + '</div>'
      + (pics.length ? '<div class="cal-cards">' + pics.map(cardHtml).join('') + '</div>' : '')
      + '</div>';
    panel.innerHTML = html;
    panel.hidden = false;

    var fileInput = el('log-file');
    if (fileInput) fileInput.addEventListener('change', function () { addFiles(this.files); });
    var drop = el('log-drop');
    if (drop) {
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files);
      });
    }
  }

  /* ---- upload ảnh ---- */
  function addFiles(files) {
    var arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!arr.length) return;
    var catEl = el('log-cat'), cat = catEl && catEl.value === 'photo' ? 'photo' : 'strava';
    arr.reduce(function (p, f) {
      return p.then(function () {
        return RL.shrink(f).then(function (b) {
          var l = RL.newRun({ blob: b, cat: cat, blockId: '', raceId: '' });
          l.date = calSel;
          runs.unshift(l);
          return RL.saveRun(l);
        });
      });
    }, Promise.resolve()).then(function () { renderAll(); showStorage(); });
  }

  /* ---- đọc form vào object ---- */
  function readCard(art, l) {
    art.querySelectorAll('[data-f]').forEach(function (inp) {
      var f = inp.getAttribute('data-f'), v = inp.value;
      if (f === 'km') v = v.replace(',', '.');
      l[f] = v;
    });
  }

  /* ---- sự kiện trong day panel (delegation) ---- */
  function onDayClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn) return;
    var art = btn.closest('[data-id]');
    if (!art) return;
    var l = findRun(art.getAttribute('data-id'));
    if (!l) return;
    var act = btn.getAttribute('data-act');
    if (act === 'save') {
      readCard(art, l);
      l.saved = Date.now(); l.expanded = false;
      RL.saveRun(l).then(function () { C.toast('Đã lưu', l.date || ''); renderAll(); });
    } else if (act === 'del') {
      if (!l.armed) { l.armed = true; renderAll(); return; }
      RL.removeRun(l.id).then(function () {
        runs = runs.filter(function (r) { return r.id !== l.id; });
        renderAll();
      });
    } else if (act === 'expand') {
      l.expanded = true; renderAll();
    }
  }

  function onDayChange(e) {
    var inp = e.target;
    if (!inp || inp.getAttribute('data-f') !== 'cat') return;
    var art = inp.closest('[data-id]');
    if (!art) return;
    var l = findRun(art.getAttribute('data-id'));
    if (l) { l.cat = inp.value; renderAll(); }
  }

  function renderAll() { renderCal(); renderDay(); }

  /* ---- lưu bền ảnh trong IndexedDB ---- */
  function askPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (p) {
          if (!p) navigator.storage.persist().catch(function () {});
        });
      }
    } catch (e) {}
  }
  function showStorage() {
    var node = el('log-storage');
    if (!node) return;
    try {
      if (!navigator.storage || !navigator.storage.estimate) { node.textContent = ''; return; }
      Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted ? navigator.storage.persisted().catch(function () { return false; }) : Promise.resolve(false)
      ]).then(function (r) {
        var mb = (r[0].usage || 0) / 1048576, cap = (r[0].quota || 0) / 1048576;
        node.textContent = 'Đang dùng ' + (Math.round(mb * 10) / 10) + ' MB'
          + (cap ? ' trong khoảng ' + Math.round(cap) + ' MB trình duyệt cho phép' : '')
          + (r[1] ? '. Ảnh được đánh dấu lưu bền.' : '. Chưa được đánh dấu lưu bền, thỉnh thoảng tải ảnh về máy để chắc ăn.');
      }).catch(function () { node.textContent = ''; });
    } catch (e) { node.textContent = ''; }
  }

  /* ---- boot ---- */
  function boot() {
    C.registerSW();
    var now = new Date();
    el('log-eyebrow').textContent = C.WD[(now.getDay() + 6) % 7] + ', ' + C.fmt(now) + '/' + now.getFullYear();
    calMonth = monthStart(C.today0());
    calSel = C.iso(C.today0());
    askPersist();

    RL.openDB().then(function () {
      return RL.loadRuns();
    }).then(function (all) {
      runs = all;
      renderAll();
      showStorage();
    });

    var prev = el('log-prev');
    if (prev) prev.addEventListener('click', function () {
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
      renderCal();
    });
    var next = el('log-next');
    if (next) next.addEventListener('click', function () {
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
      renderCal();
    });
    var cal = el('log-cal');
    if (cal) cal.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-day]') : null;
      if (!b) return;
      var key = b.getAttribute('data-day');
      calSel = calSel === key ? '' : key;
      renderAll();
    });
    var dayPanel = el('log-day');
    if (dayPanel) {
      dayPanel.addEventListener('click', onDayClick);
      dayPanel.addEventListener('change', onDayChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
