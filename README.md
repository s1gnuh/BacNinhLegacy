# Giáo án Bắc Ninh 10K

Trang web tĩnh một trang, theo dõi giáo án tập luyện 10K cho **Bắc Ninh Legacy Marathon 2027** (19/10/2026 → 10/1/2027). Không cần backend, không cần build — mở thẳng `index.html` hoặc host trên GitHub Pages.

👉 Demo: `https://<tên-tài-khoản>.github.io/BacNinhLegacy/`

## Tính năng

- **Chia tab** — Tổng quan / Lịch tập / Strava / Tham khảo, không phải cuộn một trang dài. Tab đang mở được nhớ lại cho lần sau, chuyển tab được bằng phím mũi tên.
- **Lịch 12 tuần** chia theo giai đoạn (Nền tảng → Xây sức bền → Đặc thù cự ly → Giảm tải → Tuần thi đấu), mỗi tuần gồm buổi nhẹ / chất lượng / dài, chuyển được giữa chế độ 4 buổi hoặc 3 buổi mỗi tuần.
- **Tick "đã chạy"** cho từng buổi, đổi ngày chạy mặc định hoặc riêng cho từng tuần nếu bận.
- **Pháo hoa ăn mừng** khi đánh dấu xong một buổi, to dần theo mức độ: buổi nhẹ → buổi chất lượng/dài → trọn một tuần → mốc 25/50/75% giáo án → ngày thi đấu. Kèm lời chúc ngẫu nhiên. Tự tắt khi hệ điều hành bật chế độ giảm chuyển động.
- **Biểu đồ số km theo tuần** — cột nhạt là khối lượng dự kiến, phần tô đậm là số km các buổi đã đánh dấu chạy xong, cập nhật ngay khi tick.
- **Ghi chú cho từng buổi tập** — ô ghi chú gấp mở (cảm nhận, đau mỏi, thời tiết...), lưu riêng theo từng buổi.
- **Ảnh Strava** — kéo-thả ảnh chụp màn hình sau buổi chạy, tự khớp theo ngày với buổi tập trong giáo án và tự đánh dấu đã chạy; có thể nhập tay quãng đường/pace/thời gian.
- **Chạy thử 5 km ở tuần 6** để tự tính lại pace mục tiêu cho ngày thi.
- **200 câu truyền động lực tiếng Anh** — hiện ngẫu nhiên một câu ở tab Tổng quan, đổi câu khi bấm nút hoặc mỗi lần đánh dấu xong một buổi chạy.
- **Cài đặt như app (PWA)** — có `manifest.json` + service worker, dùng được offline sau lần mở đầu tiên và thêm được vào màn hình chính trên điện thoại.
- **Nhắc chạy bằng thông báo** — bật trong tab Tổng quan, chọn giờ nhắc, chỉ nhắc vào ngày có buổi chạy mà bạn chưa đánh dấu xong.

## Lưu trữ dữ liệu

Toàn bộ trạng thái (buổi đã chạy, lịch tùy chỉnh, ghi chú, ảnh Strava) chỉ lưu **trong trình duyệt của bạn** (`localStorage` + `IndexedDB`), không gửi lên server nào. Đổi trình duyệt hoặc xóa dữ liệu trang là mất hết — hiện chưa có tính năng xuất/nhập backup.

## Thiết lập nhắc chạy trên Vercel

Phần nhắc chạy có hai tầng. Tầng cục bộ chạy sẵn không cần cấu hình gì. Tầng Web Push cần bốn bước dưới đây, làm một lần:

**1. Thêm kho lưu subscription.** Trong Vercel: Project → Storage → chọn Upstash Redis (gói free) → Connect. Vercel sẽ tự thêm `KV_REST_API_URL` và `KV_REST_API_TOKEN` vào project.

**2. Thêm biến môi trường.** Mở `.env.local` ở máy (file này đã bị gitignore, chứa cặp khoá VAPID sinh sẵn) rồi dán `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` vào Project Settings → Environment Variables. Muốn sinh cặp khoá mới thì chạy `npx web-push generate-vapid-keys`.

**3. Deploy lại** để Vercel nạp biến môi trường và đăng ký cron trong `vercel.json`.

**4. Bật trong app**: mở tab Tổng quan → Bật nhắc nhở. Khi dòng trạng thái ghi "kèm thông báo đẩy từ máy chủ" là đã chạy.

### Nhắc cái gì, lúc nào

Cron đặt `30 23 * * *` theo giờ UTC, tức **6:30 sáng giờ Việt Nam mỗi ngày**. Nội dung tuỳ ngày:

| Hôm nay | Thông báo |
| --- | --- |
| Có buổi chạy, chưa đánh dấu xong | "Hôm nay có buổi chạy" kèm tên buổi |
| Có buổi chạy, đã đánh dấu xong | Không nhắc |
| Không có buổi nào, vẫn trong kỳ giáo án | "Hôm nay không có buổi chạy" kèm một gợi ý lấy ngẫu nhiên từ `rest-tips.json` (chống đẩy, squat, plank, tập chân...) |
| Ngoài khoảng 19/10/2026 – 10/1/2027 | Không nhắc |

Gói Hobby của Vercel **chỉ cho cron chạy một lần mỗi ngày**, nên giờ chạy cron chính là giờ nhận thông báo đẩy. Ô "Giờ nhắc khi app mở" chỉ điều khiển lời nhắc cục bộ lúc app đang mở, không ảnh hưởng push. Muốn đổi giờ push thì sửa `schedule` trong `vercel.json` (Việt Nam = UTC+7).

Máy chủ lưu múi giờ của từng máy đăng ký nên tính ngày theo đúng nơi bạn đang ở.

### Bắn thử một thông báo đẩy

Cách dễ nhất: mở app trên điện thoại, tab Tổng quan → **Gửi thử**. Khi push đang bật, nút này đi qua máy chủ thật chứ không phải thông báo cục bộ.

Từ dòng lệnh, gửi tới mọi máy đã đăng ký:

```bash
curl -X POST https://<tên-project>.vercel.app/api/test-push \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Chạy thử nguyên luồng cron (đúng nội dung sẽ nhận lúc 6:30 sáng):

```bash
curl https://<tên-project>.vercel.app/api/cron \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Kết quả trả về dạng `{"ok":true,"total":1,"sent":1,...}`. Nếu `sent` bằng 0, xem `skipped` và `errors` để biết vì sao.

### Khi chưa có máy chủ

Nếu mở từ GitHub Pages, từ file, hoặc chưa cấu hình xong, app tự lùi về nhắc cục bộ:

- **Android đã thêm vào màn hình chính**: Periodic Background Sync (tối thiểu 12 tiếng/lần), hệ điều hành quyết định lúc đánh thức nên giờ có thể lệch.
- **iPhone**: phải thêm vào màn hình chính rồi mở từ icon đó thì Safari mới cho phép thông báo (iOS 16.4+). iOS không hỗ trợ Periodic Background Sync nên chỉ nhắc khi app đang mở.
- **Khi app đang mở**: hẹn giờ chính xác bằng `setTimeout`.

Trạng thái giáo án được chép sang Cache Storage (`bn27-state`) vì service worker không đọc được `localStorage`, nhờ đó lần chạy nền vẫn biết hôm nay còn buổi nào chưa xong.

Mục "Đọc bằng Claude" trong phần ảnh Strava dùng API `window.claude.use('sample')`, chỉ hoạt động khi trang được mở trong Claude Artifacts. Khi host trên GitHub Pages, nút này tự ẩn và bạn nhập số liệu tay như bình thường — không ảnh hưởng các tính năng khác.

## Cấu trúc file

```
index.html     khung trang: header, thanh tab, canvas pháo hoa
sections/      nội dung từng tab, nạp vào khung khi mở trang
  overview.html   buổi tiếp theo + biểu đồ km + chọn ngày chạy
  schedule.html   lịch 12 tuần
  strava.html     ảnh Strava
  reference.html  pace, chạy thử 5 km, ngày thi, nguyên tắc tập
style.css      toàn bộ giao diện và hiệu ứng
script.js      logic: lịch, tick, biểu đồ, ghi chú, ảnh Strava, pháo hoa, tab, nhắc chạy
quotes.js      200 câu truyền động lực
rest-tips.json gợi ý bài tập cho ngày không có buổi chạy
sw.js          service worker: cache offline, thông báo nhắc chạy
api/           serverless function trên Vercel
  vapid.js        trả khoá công khai VAPID cho trình duyệt
  subscribe.js    lưu/xoá subscription kèm trạng thái giáo án
  cron.js         chạy 6:30 sáng, nhắc buổi chạy hoặc gợi ý bài tập
  test-push.js    bắn thử một thông báo đẩy ngay
  health.js       báo xem đã cấu hình đủ chưa
lib/store.js   kho subscription trên Upstash Redis
vercel.json    header cache và lịch cron
manifest.json  khai báo PWA
icons/         icon app (192/512/apple-touch/favicon)
```

## Chạy / deploy

- **Local**: cần chạy qua một server tĩnh vì `sections/` được nạp bằng `fetch` (mở thẳng `index.html` theo `file://` sẽ không tải được nội dung tab). Ví dụ nhanh nhất: `npx serve` hoặc `python -m http.server` trong thư mục này.
- **GitHub Pages**: Settings → Pages → Deploy from branch → chọn `main` / `/ (root)`. Trang sẽ có ở `https://<tên-tài-khoản>.github.io/<tên-repo>/`.
