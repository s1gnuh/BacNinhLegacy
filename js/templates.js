// Khuôn giáo án tái sử dụng được. Mỗi template mô tả hình dạng một chu kỳ
// tập luyện (số tuần, giai đoạn, khối lượng easy/quality/long từng tuần)
// mà KHÔNG gắn ngày cụ thể — ngày chỉ sinh ra khi áp khuôn vào một block.
//
// Hai dạng khuôn cùng tồn tại:
//   - Dạng cũ (periodized-12w): days dùng khoá cố định mon/wed/fri/sun.
//   - Dạng theo cấp độ: mỗi day có `role` (easy/quality/long) nên số buổi
//     mỗi tuần tuỳ ý. Khoá buổi khác nhau giữa hai dạng nên dữ liệu đã lưu
//     của khuôn cũ (done/notes/ảnh) không bị ảnh hưởng.
window.Templates = (function (Core) {
  'use strict';
  var KEY = 'app-templates';
  var WARM = 'Khởi động 10 phút chạy rất nhẹ, ';
  var COOL = ' hạ nhiệt 10 phút.';
  var REST = { type: 'rest', title: 'Nghỉ', d: 'Hoặc đi bộ nhẹ 20 phút.', km: 0 };

  /* ================= bộ sinh buổi chất lượng ================= */
  function qInt(n, min, pace, km) {
    return { t: n + ' × ' + min + ' phút @ ' + pace,
             d: WARM + n + ' lần ' + min + ' phút @ ' + pace + ', nghỉ 2 phút đi bộ nhanh giữa các lần,' + COOL, km: km };
  }
  function qIntKm(n, dist, pace, km) {
    return { t: n + ' × ' + dist + ' km @ ' + pace,
             d: WARM + n + ' lần ' + dist + ' km @ ' + pace + ', nghỉ 2 phút đi bộ giữa các lần,' + COOL, km: km };
  }
  function qTempo(dist, pace, km) {
    return { t: 'Tempo ' + dist + ' km @ ' + pace,
             d: WARM + dist + ' km liền @ ' + pace + ', giữ nhịp đều, thở nặng nhưng vẫn kiểm soát được.' + COOL, km: km };
  }
  function qFartlek(n, min, km) {
    return { t: 'Fartlek ' + n + ' × ' + min + ' phút',
             d: WARM + n + ' lần ' + min + ' phút chạy nhanh theo cảm giác (thở gấp nhưng chưa hết sức), giữa các lần chạy nhẹ ' + min + ' phút,' + COOL, km: km };
  }
  function qStrides(n, km) {
    return { t: 'Chạy nhẹ + ' + n + ' nước rút',
             d: 'Chạy nhẹ thoải mái, cuối buổi thêm ' + n + ' lần nước rút 20 giây gần hết sức, đi bộ 60 giây giữa các lần. Mục tiêu là đánh thức chân, không phải làm mệt.', km: km };
  }
  function qTT(dist, km) {
    return { t: 'Chạy thử ' + dist + ' km hết sức',
             d: 'Khởi động 15 phút nhẹ, ' + dist + ' km nhanh nhất có thể mà không phải đi bộ,' + COOL + ' Chạy trên đường phẳng và ghi lại thời gian — kết quả này dùng để chỉnh pace cho các tuần sau.', km: km };
  }
  function qHill(n, km) {
    return { t: 'Đạp dốc ' + n + ' lần',
             d: WARM + 'tìm đoạn dốc vừa phải dài 60–90 giây, chạy lên mạnh ' + n + ' lần, xuống dốc đi bộ hoặc chạy rất nhẹ để hồi,' + COOL, km: km };
  }
  function qProgress(dist, km) {
    return { t: 'Chạy tăng tốc dần ' + dist + ' km',
             d: WARM + dist + ' km chia ba phần đều nhau: phần đầu pace nhẹ, phần giữa nhanh hơn 20 giây/km, phần cuối nhanh hơn 20 giây/km nữa.' + COOL, km: km };
  }

  /* ================= khuôn cũ (giữ nguyên để không vỡ dữ liệu) ================= */
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

  /* ================= 5 khuôn theo cấp độ ================= */
  // Bộ ngày dùng lại cho các cấp: role quyết định buổi lấy km từ đâu
  // (easy lấy w.e[ei], quality lấy w.q[qi], long lấy w.l).
  var D3 = [
    { k: 'e1', def: 1, name: 'Chạy nhẹ 1', role: 'easy', ei: 0 },
    { k: 'e2', def: 3, name: 'Chạy nhẹ 2', role: 'easy', ei: 1 },
    { k: 'lg', def: 6, name: 'Chạy dài', role: 'long' }
  ];
  var D4 = [
    { k: 'e1', def: 0, name: 'Chạy nhẹ 1', role: 'easy', ei: 0 },
    { k: 'q1', def: 2, name: 'Chất lượng', role: 'quality', qi: 0 },
    { k: 'e2', def: 4, name: 'Chạy nhẹ 2', role: 'easy', ei: 1 },
    { k: 'lg', def: 6, name: 'Chạy dài', role: 'long' }
  ];
  var D5 = [
    { k: 'e1', def: 0, name: 'Chạy nhẹ 1', role: 'easy', ei: 0 },
    { k: 'q1', def: 1, name: 'Chất lượng 1', role: 'quality', qi: 0 },
    { k: 'e2', def: 2, name: 'Chạy nhẹ 2', role: 'easy', ei: 1 },
    { k: 'q2', def: 3, name: 'Chất lượng 2', role: 'quality', qi: 1 },
    { k: 'lg', def: 6, name: 'Chạy dài', role: 'long' }
  ];
  var D6 = [
    { k: 'e1', def: 0, name: 'Chạy nhẹ 1', role: 'easy', ei: 0 },
    { k: 'q1', def: 1, name: 'Chất lượng 1', role: 'quality', qi: 0 },
    { k: 'e2', def: 2, name: 'Chạy nhẹ 2', role: 'easy', ei: 1 },
    { k: 'q2', def: 3, name: 'Chất lượng 2', role: 'quality', qi: 1 },
    { k: 'e3', def: 5, name: 'Chạy nhẹ 3', role: 'easy', ei: 2 },
    { k: 'lg', def: 6, name: 'Chạy dài', role: 'long' }
  ];

  // Cấp 1 — chạy liên tục chưa quen, mục tiêu là về đích 5–10K không phải đi bộ.
  var LV1 = {
    id: 'level-1-khoi-dau', level: 1, name: 'Cấp 1 · Khởi đầu — 8 tuần, 3 buổi/tuần',
    levelLabel: 'Khởi đầu',
    desc: 'Mới chạy hoặc chạy lại sau thời gian dài nghỉ. Chưa chạy liên tục được 30 phút. Tất cả các buổi đều nhẹ, việc duy nhất cần làm là đi đủ số buổi.',
    easyPace: '8:30–9:30', longPace: '8:30–9:30', days: D3,
    weeks: [
      { ph: 'Làm quen', e: [3, 3], l: 4, nt: 'Nếu chưa chạy liền được, cứ chạy 3 phút rồi đi bộ 2 phút và lặp lại cho đủ số km. Đi bộ không phải là thất bại.' },
      { ph: 'Làm quen', e: [3, 3], l: 5 },
      { ph: 'Làm quen', e: [4, 3], l: 6, nt: 'Từ tuần này cố gắng chạy liền không xen đi bộ ở hai buổi ngắn.' },
      { ph: 'Làm quen', e: [3, 3], l: 4, nt: 'Tuần nhẹ có chủ đích. Cơ thể khoẻ lên trong lúc nghỉ, không phải trong lúc chạy.' },
      { ph: 'Dày nền', e: [4, 4], l: 6 },
      { ph: 'Dày nền', e: [4, 4], l: 8, nt: 'Buổi dài tuần này là dài nhất trước giải. Chạy thật chậm, dừng uống nước nếu cần.' },
      { ph: 'Giảm tải', e: [4, 3], l: 5, nt: 'Giảm tải để dồn sức cho ngày thi.' },
      { ph: 'Tuần thi đấu', e: [3, null], l: 8, race: true, nt: 'Hai ngày trước giải không chạy. Ngày thi xuất phát chậm hơn bạn nghĩ là đúng.' }
    ]
  };

  // Cấp 2 — chạy đều đặn được, bắt đầu làm quen buổi nhanh.
  var LV2 = {
    id: 'level-2-co-ban', level: 2, name: 'Cấp 2 · Cơ bản — 10 tuần, 4 buổi/tuần',
    levelLabel: 'Cơ bản',
    desc: 'Đã chạy đều vài tháng, chạy liền 5 km thoải mái. Giáo án thêm một buổi nhanh mỗi tuần để làm quen với cảm giác thở gấp.',
    easyPace: '7:40–8:30', longPace: '7:30–8:15', days: D4,
    weeks: [
      { ph: 'Nền tảng', e: [5, 4], l: 7, q: qStrides(4, 5) },
      { ph: 'Nền tảng', e: [5, 4], l: 8, q: qFartlek(4, 2, 5.5) },
      { ph: 'Nền tảng', e: [5, 5], l: 9, q: qFartlek(5, 2, 6) },
      { ph: 'Nền tảng', e: [4, 4], l: 6, nt: 'Tuần nhẹ: giảm khối lượng, giữ buổi nhanh nhưng ngắn lại.', q: qStrides(5, 5) },
      { ph: 'Xây sức bền', e: [5, 5], l: 10, q: qInt(5, 3, '6:40', 6.5) },
      { ph: 'Xây sức bền', e: [5, 5], l: 11, nt: 'Chạy thử 5 km để biết pace thật của mình. Các tuần sau chỉnh theo kết quả này.', q: qTT(5, 7) },
      { ph: 'Xây sức bền', e: [6, 5], l: 12, q: qTempo(3, '6:55', 6.5) },
      { ph: 'Đặc thù cự ly', e: [5, 5], l: 10, nt: 'Tuần nhẹ trước khi vào hai tuần nặng nhất.', q: qIntKm(3, 1, '6:40', 6) },
      { ph: 'Đặc thù cự ly', e: [6, 5], l: 13, nt: 'Tuần nặng nhất của chu kỳ.', q: qTempo(4, '6:50', 7) },
      { ph: 'Tuần thi đấu', e: [4, null], l: 10, race: true, nt: 'Giảm tải mạnh. Không cố tập bù những buổi đã bỏ.', q: qStrides(4, 5) }
    ]
  };

  // Cấp 3 — đã có nền, muốn phá PR. Tương đương khuôn Bắc Ninh gốc.
  var LV3 = {
    id: 'level-3-trung-cap', level: 3, name: 'Cấp 3 · Trung cấp — 12 tuần, 4 buổi/tuần',
    levelLabel: 'Trung cấp',
    desc: 'Chạy quanh 30–45 km mỗi tuần, đã hoàn thành ít nhất một giải. Giáo án đủ 5 giai đoạn và có mốc chạy thử 5 km ở giữa chu kỳ để chốt pace mục tiêu.',
    easyPace: '6:50–7:40', longPace: '6:50–7:30', days: D4,
    weeks: [
      { ph: 'Nền tảng', e: [6, 5], l: 10, q: qInt(5, 3, '5:45', 7) },
      { ph: 'Nền tảng', e: [6, 6], l: 11, q: qInt(4, 4, '5:45', 7.5) },
      { ph: 'Nền tảng', e: [7, 6], l: 12, q: qIntKm(4, 1, '5:40', 8) },
      { ph: 'Nền tảng', e: [5, 5], l: 9, nt: 'Tuần nhẹ: giảm khoảng 25% khối lượng để hấp thu ba tuần trước.', q: qIntKm(3, 1, '5:40', 7) },
      { ph: 'Xây sức bền', e: [7, 6], l: 14, q: qTempo(5, '6:00', 8.5) },
      { ph: 'Xây sức bền', e: [7, 6], l: 14, nt: 'Chạy thử 5 km hết sức. Kết quả quyết định pace tempo và pace mục tiêu ngày thi.', q: qTT(5, 9) },
      { ph: 'Xây sức bền', e: [8, 6], l: 16, nt: 'Chỉnh pace theo kết quả tuần 6: đoạn 1 km chạy bằng pace 5 km, tempo chậm hơn pace 5 km 10–15 giây.', q: qTempo(6, '6:00', 9.5) },
      { ph: 'Xây sức bền', e: [6, 5], l: 11, nt: 'Tuần nhẹ, giữ một buổi nhanh ngắn cho chân không bị cùn.', q: qIntKm(4, 1, '5:35', 8) },
      { ph: 'Đặc thù cự ly', e: [8, 7], l: 17, q: qIntKm(3, 2, '5:55', 10) },
      { ph: 'Đặc thù cự ly', e: [8, 7], l: 18, nt: 'Tuần nặng nhất. Sau tuần này chỉ còn giảm tải.', q: qProgress(8, 10) },
      { ph: 'Giảm tải', e: [6, 5], l: 12, nt: 'Giảm khoảng 30% khối lượng, giữ cường độ.', q: qIntKm(4, 1, '5:35', 8) },
      { ph: 'Tuần thi đấu', e: [5, null], l: 12, race: true, nt: 'Nghỉ hẳn ngày trước thi. Ngày thi chia đều pace, nửa sau mới tăng.', q: qStrides(5, 6) }
    ]
  };

  // Cấp 4 — hai buổi chất lượng mỗi tuần, khối lượng cao.
  var LV4 = {
    id: 'level-4-nang-cao', level: 4, name: 'Cấp 4 · Nâng cao — 14 tuần, 5 buổi/tuần',
    levelLabel: 'Nâng cao',
    desc: 'Chạy 50–70 km mỗi tuần quanh năm, chịu được hai buổi chất lượng một tuần. Có buổi đạp dốc và buổi tăng tốc dần để nâng ngưỡng.',
    easyPace: '6:00–6:50', longPace: '6:00–6:40', days: D5,
    weeks: [
      { ph: 'Nền tảng', e: [8, 7], l: 16, q: [qInt(6, 3, '5:05', 9), qTempo(5, '5:30', 9)] },
      { ph: 'Nền tảng', e: [9, 8], l: 17, q: [qIntKm(5, 1, '5:00', 10), qTempo(6, '5:30', 10)] },
      { ph: 'Nền tảng', e: [9, 8], l: 19, q: [qHill(8, 9), qTempo(6, '5:25', 10)] },
      { ph: 'Nền tảng', e: [7, 6], l: 13, nt: 'Tuần nhẹ: giảm khoảng 25% khối lượng, giữ cả hai buổi chất lượng nhưng ngắn hơn.', q: [qIntKm(4, 1, '5:00', 9), qTempo(4, '5:30', 8)] },
      { ph: 'Xây sức bền', e: [10, 8], l: 20, q: [qIntKm(5, 1, '4:55', 11), qTempo(8, '5:25', 12)] },
      { ph: 'Xây sức bền', e: [10, 9], l: 21, nt: 'Chạy thử 5 km hết sức để chốt pace cho nửa sau chu kỳ.', q: [qTT(5, 11), qTempo(8, '5:20', 12)] },
      { ph: 'Xây sức bền', e: [10, 9], l: 22, nt: 'Chỉnh toàn bộ pace theo kết quả tuần 6.', q: [qIntKm(4, 2, '5:10', 12), qProgress(10, 12)] },
      { ph: 'Xây sức bền', e: [8, 7], l: 15, nt: 'Tuần nhẹ giữa chu kỳ.', q: [qIntKm(4, 1, '4:55', 9), qTempo(5, '5:25', 9)] },
      { ph: 'Đặc thù cự ly', e: [10, 9], l: 23, q: [qIntKm(5, 2, '5:05', 13), qTempo(10, '5:20', 14)] },
      { ph: 'Đặc thù cự ly', e: [11, 9], l: 24, q: [qIntKm(3, 3, '5:15', 13), qProgress(12, 14)] },
      { ph: 'Đặc thù cự ly', e: [11, 10], l: 25, nt: 'Tuần nặng nhất của chu kỳ. Ngủ và ăn quan trọng ngang buổi tập.', q: [qIntKm(6, 1, '4:50', 12), qTempo(11, '5:15', 15)] },
      { ph: 'Giảm tải', e: [9, 8], l: 18, nt: 'Giảm khoảng 30% khối lượng, giữ nguyên cường độ.', q: [qIntKm(4, 1, '4:50', 10), qTempo(6, '5:20', 10)] },
      { ph: 'Giảm tải', e: [7, 6], l: 14, nt: 'Giảm tiếp. Chân sẽ cảm thấy ngứa muốn chạy — đó là dấu hiệu đúng.', q: [qIntKm(3, 1, '4:50', 8), qStrides(6, 7)] },
      { ph: 'Tuần thi đấu', e: [6, null], l: 15, race: true, nt: 'Chỉ còn một buổi nhanh rất ngắn đầu tuần. Ngày trước thi nghỉ hẳn.', q: [qStrides(5, 6), null] }
    ]
  };

  // Cấp 5 — khối lượng cao nhất, 6 buổi/tuần, có buổi đôi tuần nặng.
  var LV5 = {
    id: 'level-5-canh-tranh', level: 5, name: 'Cấp 5 · Cạnh tranh — 16 tuần, 6 buổi/tuần',
    levelLabel: 'Cạnh tranh',
    desc: 'Nhắm podium nhóm tuổi. Chạy trên 70 km mỗi tuần, có kinh nghiệm nhiều chu kỳ và biết tự đọc tín hiệu cơ thể. Giáo án này chỉ hợp khi bạn đã chạy ở cấp 4 ít nhất một chu kỳ trọn vẹn.',
    easyPace: '5:20–6:00', longPace: '5:20–5:50', days: D6,
    weeks: [
      { ph: 'Nền tảng', e: [10, 9, 8], l: 20, q: [qInt(8, 3, '4:25', 12), qTempo(8, '4:50', 12)] },
      { ph: 'Nền tảng', e: [11, 10, 8], l: 22, q: [qIntKm(6, 1, '4:20', 13), qTempo(9, '4:50', 13)] },
      { ph: 'Nền tảng', e: [11, 10, 9], l: 24, q: [qHill(10, 12), qTempo(10, '4:45', 14)] },
      { ph: 'Nền tảng', e: [9, 8, 7], l: 17, nt: 'Tuần nhẹ: giảm khoảng 25%. Giữ cả hai buổi chất lượng, cắt bớt độ dài.', q: [qIntKm(5, 1, '4:20', 11), qTempo(6, '4:50', 11)] },
      { ph: 'Xây sức bền', e: [12, 10, 9], l: 25, q: [qIntKm(6, 1, '4:15', 14), qTempo(11, '4:45', 15)] },
      { ph: 'Xây sức bền', e: [12, 11, 9], l: 26, nt: 'Chạy thử 5 km hết sức để chốt pace cho toàn bộ nửa sau.', q: [qTT(5, 13), qTempo(11, '4:40', 15)] },
      { ph: 'Xây sức bền', e: [13, 11, 10], l: 28, nt: 'Chỉnh toàn bộ pace theo kết quả tuần 6.', q: [qIntKm(5, 2, '4:30', 15), qProgress(14, 16)] },
      { ph: 'Xây sức bền', e: [10, 9, 8], l: 19, nt: 'Tuần nhẹ giữa chu kỳ.', q: [qIntKm(5, 1, '4:15', 12), qTempo(7, '4:45', 12)] },
      { ph: 'Đặc thù cự ly', e: [13, 11, 10], l: 29, q: [qIntKm(6, 2, '4:25', 16), qTempo(13, '4:40', 17)] },
      { ph: 'Đặc thù cự ly', e: [13, 12, 10], l: 30, q: [qIntKm(4, 3, '4:35', 16), qProgress(16, 18)] },
      { ph: 'Đặc thù cự ly', e: [14, 12, 10], l: 32, nt: 'Tuần nặng nhất. Nếu có dấu hiệu quá tải kéo dài, cắt buổi chất lượng thứ hai chứ không cắt buổi dài.', q: [qIntKm(8, 1, '4:10', 15), qTempo(14, '4:35', 18)] },
      { ph: 'Đặc thù cự ly', e: [13, 11, 10], l: 28, nt: 'Vẫn nặng nhưng đã bắt đầu rút. Đây là tuần cuối của khối tải chính.', q: [qIntKm(5, 2, '4:25', 15), qTempo(12, '4:35', 16)] },
      { ph: 'Giảm tải', e: [11, 10, 8], l: 22, nt: 'Giảm khoảng 30% khối lượng, giữ nguyên cường độ.', q: [qIntKm(5, 1, '4:10', 12), qTempo(8, '4:40', 12)] },
      { ph: 'Giảm tải', e: [9, 8, 7], l: 18, q: [qIntKm(4, 1, '4:10', 10), qTempo(6, '4:40', 10)] },
      { ph: 'Giảm tải', e: [8, 7, null], l: 14, nt: 'Tuần áp cuối. Khối lượng còn khoảng một nửa đỉnh.', q: [qIntKm(3, 1, '4:10', 8), qStrides(6, 8)] },
      { ph: 'Tuần thi đấu', e: [7, 6, null], l: 18, race: true, nt: 'Chỉ một buổi kích chân đầu tuần. Hai ngày trước thi nghỉ hoặc chạy rất nhẹ 20 phút.', q: [qStrides(6, 7), null] }
    ]
  };

  var BUILTIN = [PERIODIZED_12W, LV1, LV2, LV3, LV4, LV5];
  var BUILTIN_MAP = {};
  BUILTIN.forEach(function (t) { BUILTIN_MAP[t.id] = t; });

  /* ================= sinh buổi tập ================= */
  function easySession(km, stride, paceHint) {
    return { type: 'easy', title: 'Chạy nhẹ ' + km + ' km' + (stride ? ' + nước rút' : ''),
             d: 'Pace ' + (paceHint || '7:40–8:30') + ', nói được cả câu.' + (stride ? ' Cuối buổi thêm 4–6 lần nước rút 20 giây, thả lỏng, nghỉ đi bộ 40–60 giây giữa các lần.' : ''),
             km: km };
  }
  function longSession(km, paceHint) {
    return { type: 'long', title: 'Chạy dài ' + km + ' km',
             d: 'Pace ' + (paceHint || '7:30–8:00') + ', không cần nhanh.' + (km >= 9 ? ' Mang nước nếu chạy trên 9 km.' : ''),
             km: km };
  }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  // Dạng cũ: khoá ngày cố định mon/wed/fri/sun.
  function buildLegacy(tpl, raceTitle, raceDesc, raceKm) {
    return tpl.weeks.map(function (w, i) {
      var stride = i >= 2 && i <= tpl.weeks.length - 2;
      var s = {};
      s.mon = easySession(w.e[0], stride);
      s.wed = { type: 'quality', title: w.q.t, d: w.q.d, km: w.q.km };
      s.fri = w.e[1] == null ? REST : easySession(w.e[1], stride);
      s.sun = w.race
        ? { type: 'race', title: raceTitle || 'Ngày thi đấu', d: raceDesc || '', km: raceKm || w.l }
        : longSession(w.l);
      return s;
    });
  }

  // Dạng theo cấp độ: đọc role của từng day nên số buổi mỗi tuần tuỳ ý.
  function buildByRole(tpl, raceTitle, raceDesc, raceKm) {
    var last = tpl.weeks.length - 1;
    return tpl.weeks.map(function (w, i) {
      var stride = i >= 2 && i < last;
      var qs = w.q == null ? [] : (isArr(w.q) ? w.q : [w.q]);
      var s = {};
      tpl.days.forEach(function (dy) {
        if (dy.role === 'quality') {
          var q = qs[dy.qi || 0];
          s[dy.k] = q ? { type: 'quality', title: q.t, d: q.d, km: q.km } : REST;
        } else if (dy.role === 'long') {
          s[dy.k] = w.race
            ? { type: 'race', title: raceTitle || 'Ngày thi đấu', d: raceDesc || '', km: raceKm || w.l }
            : longSession(w.l, tpl.longPace);
        } else {
          var km = (w.e || [])[dy.ei || 0];
          s[dy.k] = km == null ? REST : easySession(km, stride && (dy.ei || 0) === 0, tpl.easyPace);
        }
      });
      return s;
    });
  }

  function buildSessions(tpl, raceTitle, raceDesc, raceKm) {
    var byRole = tpl.days && tpl.days[0] && tpl.days[0].role;
    return byRole ? buildByRole(tpl, raceTitle, raceDesc, raceKm)
                  : buildLegacy(tpl, raceTitle, raceDesc, raceKm);
  }

  /* ================= lưu trữ ================= */
  // Khuôn dựng sẵn sống trong code nên luôn thắng bản lưu trong localStorage;
  // localStorage chỉ để giữ khuôn do người dùng tự thêm.
  function all() {
    var saved = Core.store.getJSON(KEY, null);
    if (!saved) return BUILTIN_MAP;
    var out = {};
    Object.keys(saved).forEach(function (k) { if (!BUILTIN_MAP[k]) out[k] = saved[k]; });
    Object.keys(BUILTIN_MAP).forEach(function (k) { out[k] = BUILTIN_MAP[k]; });
    return out;
  }
  function get(id) { return all()[id] || null; }
  function list() { var a = all(); return Object.keys(a).map(function (k) { return a[k]; }); }
  // Danh sách khuôn theo cấp độ, sắp theo cấp — dùng cho ô chọn giáo án.
  function levels() {
    return [LV1, LV2, LV3, LV4, LV5];
  }
  function save(tpl) {
    var saved = Core.store.getJSON(KEY, null) || {};
    saved[tpl.id] = tpl;
    Core.store.setJSON(KEY, saved);
    return tpl;
  }

  // Số tuần và tổng km dự kiến của một khuôn — để hiện kèm lúc chọn.
  function summary(tpl) {
    var weeks = tpl.weeks.length, total = 0, peak = 0;
    var s = buildSessions(tpl, '', '', 0);
    s.forEach(function (wk) {
      var sum = 0;
      Object.keys(wk).forEach(function (k) { sum += Number(wk[k].km) || 0; });
      total += sum;
      if (sum > peak) peak = sum;
    });
    return { weeks: weeks, totalKm: Math.round(total), peakKm: Math.round(peak),
             daysPerWeek: (tpl.days || []).length };
  }

  // Tuần cuối (raceWeek) có buổi thi đấu vào Chủ nhật. Từ ngày thi suy ra
  // ngày bắt đầu (Thứ 2 của tuần 1) để lịch khớp đúng.
  function startFromRaceDate(tpl, raceDate) {
    var totalDays = (tpl.weeks.length - 1) * 7 + 6;
    return Core.addDays(raceDate, -totalDays);
  }
  function raceDateFromStart(tpl, startDate) {
    return Core.addDays(startDate, (tpl.weeks.length - 1) * 7 + 6);
  }

  return {
    PERIODIZED_12W_ID: PERIODIZED_12W.id,
    all: all, get: get, list: list, levels: levels, save: save, summary: summary,
    buildSessions: buildSessions,
    startFromRaceDate: startFromRaceDate, raceDateFromStart: raceDateFromStart
  };
})(window.Core);
