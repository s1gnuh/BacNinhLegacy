# Giáo án Bắc Ninh 10K

Ứng dụng web theo dõi giáo án tập luyện 10 km cho **Bắc Ninh Legacy Marathon 2027**, chạy từ 19/10/2026 đến ngày thi 10/1/2027.

Không có framework, không có bước build: HTML, CSS và JavaScript thuần, cộng vài serverless function trên Vercel để đẩy thông báo nhắc chạy. Cài được ra màn hình chính điện thoại như một app.

---

## Tính năng

### Theo dõi giáo án

- **Lịch 12 tuần** chia 5 giai đoạn: Nền tảng → Xây sức bền → Đặc thù cự ly → Giảm tải → Tuần thi đấu. Mỗi tuần có buổi nhẹ, buổi chất lượng và buổi dài; chuyển được giữa chế độ 4 buổi hoặc 3 buổi mỗi tuần khi bận.
- **Lịch tháng** với chấm màu theo loại buổi. Bấm vào một ngày để xem buổi tập, số liệu Strava, ghi chú và ảnh của ngày đó, đánh dấu đã chạy ngay tại chỗ.
- **Đổi ngày chạy** mặc định cho cả giáo án, hoặc riêng từng tuần.
- **Ghi chú từng buổi** cho cảm nhận, đau mỏi, thời tiết.
- **Biểu đồ km theo tuần**: cột nhạt là dự kiến, phần tô đậm là đã chạy.
- **Chạy thử 5 km ở tuần 6** kèm bảng quy đổi để tự chỉnh lại pace mục tiêu.

### Ảnh và số liệu

Hai loại ảnh, chọn lúc tải lên và đổi được sau:

| | Ảnh Strava | Ảnh chạy |
| --- | --- | --- |
| Dùng để | ghi số liệu buổi tập | lưu kỷ niệm trên đường |
| Các ô nhập | ngày, loại, km, pace, thời gian, chú thích, buổi | ngày, chú thích, buổi |
| Tự gắn vào buổi theo ngày | có | có |
| Tự đánh dấu đã chạy | có | không |

Mỗi ảnh có nút **Lưu** riêng, đọc thẳng giá trị đang có trong ô nên không phụ thuộc việc bạn đã rời con trỏ hay chưa. Lưu xong mà buổi tập chuyển thành đã chạy thì app bắn pháo hoa chúc mừng.

### Động lực

- **Pháo hoa ăn mừng** mỗi lần đánh dấu xong một buổi, to dần theo mức độ: buổi nhẹ → chất lượng/dài → trọn một tuần → mốc 25/50/75% giáo án → ngày thi đấu. Tự tắt khi hệ điều hành bật chế độ giảm chuyển động.
- **200 câu truyền động lực** tiếng Anh, đổi câu khi bấm nút hoặc mỗi lần hoàn thành một buổi.

### Nhắc chạy

Thông báo đẩy lúc **6:30 sáng mỗi ngày**, nội dung tuỳ ngày:

| Hôm nay | Thông báo |
| --- | --- |
| Có buổi chạy, chưa đánh dấu xong | "Hôm nay có buổi chạy" kèm tên buổi |
| Có buổi chạy, đã đánh dấu xong | im lặng |
| Không có buổi nào, vẫn trong kỳ giáo án | "Hôm nay không có buổi chạy" kèm một gợi ý ngẫu nhiên từ `rest-tips.json` — chống đẩy, squat, plank, tập chân |
| Ngoài khoảng 19/10/2026 – 10/1/2027 | im lặng |

---

## Dữ liệu được lưu ở đâu

Mặc định mọi thứ nằm trong trình duyệt của bạn:

- `localStorage` — buổi đã chạy, lịch ngày tuỳ chỉnh, ghi chú, tab đang mở, cài đặt nhắc chạy
- `IndexedDB` — ảnh Strava và ảnh chạy. App xin quyền `persist` để trình duyệt không tự dọn khi máy thiếu chỗ, và hiện dung lượng đang dùng trong tab ảnh
- `Cache Storage` — bản sao trạng thái giáo án cho service worker đọc khi chạy nền, vì service worker không đọc được `localStorage`

**Khi bật nhắc chạy bằng push**, một phần dữ liệu được gửi lên máy chủ và lưu trong Upstash Redis: danh sách ngày tập kèm tên buổi và cờ đã-chạy, múi giờ, giờ nhắc, và địa chỉ đăng ký nhận thông báo của trình duyệt. **Ảnh không bao giờ rời khỏi máy bạn.** Tắt nhắc nhở thì bản ghi đó bị xoá khỏi máy chủ.

Chưa có chức năng xuất/nhập file backup, nên đổi máy hoặc xoá dữ liệu trang là mất hết.

---

## Cấu trúc file

```
index.html        khung trang: header, thanh tab, canvas pháo hoa, vùng toast
sections/         nội dung từng tab, nạp bằng fetch khi mở trang
  overview.html     buổi tiếp theo, câu truyền động lực, biểu đồ km,
                    chọn ngày chạy, cài đặt nhắc chạy
  schedule.html     lịch tháng + lịch 12 tuần
  strava.html       ảnh buổi chạy
  reference.html    pace, chạy thử 5 km, chiến thuật ngày thi, nguyên tắc tập
style.css         toàn bộ giao diện, sáng/tối theo hệ điều hành
script.js         toàn bộ logic phía trình duyệt
quotes.js         200 câu truyền động lực
rest-tips.json    gợi ý bài tập cho ngày không có buổi chạy
sw.js             service worker: cache offline, nhận push, nhắc chạy nền
manifest.json     khai báo PWA
icons/            icon app (192, 512, apple-touch, favicon)

api/              serverless function trên Vercel
  vapid.js          trả khoá công khai VAPID cho trình duyệt
  subscribe.js      lưu hoặc xoá subscription kèm trạng thái giáo án
  cron.js           chạy hằng ngày, đẩy thông báo nhắc chạy
  test-push.js      bắn thử một thông báo ngay lập tức
  health.js         báo xem máy chủ đã cấu hình đủ chưa
lib/store.js      kho subscription trên Upstash Redis
vercel.json       header cache và lịch cron
package.json      dependency cho phần api/ (web-push, @upstash/redis)
```

Phía trình duyệt không dùng dependency nào, `package.json` chỉ phục vụ các serverless function.

---

## Chạy ở máy

Cần một server tĩnh, **không mở thẳng `index.html`** được vì `sections/` nạp bằng `fetch` và trình duyệt chặn `fetch` trên `file://`.

```bash
npx serve
# hoặc
python -m http.server
```

Phần `api/` chỉ chạy trên Vercel. Ở máy, app tự nhận ra không có máy chủ và lùi về nhắc cục bộ, mọi tính năng khác hoạt động bình thường.

---

## Deploy

Project nối thẳng với Vercel qua Git integration: push lên `main` là Vercel tự build và deploy, không cần GitHub Actions.

### Bật thông báo đẩy

Phần nhắc chạy có hai tầng. Tầng cục bộ chạy sẵn không cần cấu hình. Tầng Web Push cần làm một lần:

**1. Tạo kho Redis.** Vercel → project → tab **Storage** → **Create Database** → **Upstash** → **Redis** → gói Free, region Singapore → Connect vào project, tick cả ba môi trường. Để trống ô prefix nếu được hỏi.

Vercel sẽ tự thêm một cặp biến REST. Code nhận được cả `KV_REST_API_URL`/`KV_REST_API_TOKEN` lẫn `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, và chịu được cả tiền tố kiểu `STORAGE_`. Token `READ_ONLY` bị bỏ qua vì không ghi được.

**2. Thêm biến môi trường** vào Project Settings → Environment Variables:

| Biến | Lấy ở đâu |
| --- | --- |
| `VAPID_PUBLIC_KEY` | `.env.local` (đã gitignore) |
| `VAPID_PRIVATE_KEY` | `.env.local` |
| `VAPID_SUBJECT` | `.env.local`, dạng `mailto:ban@email.com` |
| `CRON_SECRET` | `.env.local`, bảo vệ `/api/cron` khỏi bị gọi tuỳ tiện |

Muốn sinh cặp khoá VAPID mới: `npx web-push generate-vapid-keys`.

**3. Deploy lại.** Vercel chỉ nạp biến môi trường khi tạo deployment mới, thêm biến xong mà không deploy lại thì hàm vẫn chạy bản cũ. Deployments → bản trên cùng → ⋯ → **Redeploy**.

**4. Bật trong app.** Tab Tổng quan → **Kiểm tra máy chủ**, phải thấy "Máy chủ sẵn sàng". Rồi **Bật nhắc nhở** → **Gửi thử**.

### Giờ nhắc

Cron đặt `30 23 * * *` giờ UTC, tức 6:30 sáng giờ Việt Nam. Máy chủ lưu múi giờ của từng máy đăng ký nên tính ngày theo đúng nơi bạn đang ở.

Gói Hobby của Vercel **chỉ cho cron chạy một lần mỗi ngày**, nên giờ chạy cron chính là giờ nhận thông báo đẩy. Ô "Giờ nhắc khi app mở" chỉ điều khiển lời nhắc cục bộ lúc app đang mở. Muốn đổi giờ push thì sửa `schedule` trong `vercel.json` (Việt Nam = UTC+7).

### Bắn thử từ dòng lệnh

```bash
# gửi tới mọi máy đã đăng ký
curl -X POST https://<project>.vercel.app/api/test-push \
  -H "Authorization: Bearer <CRON_SECRET>"

# chạy đúng luồng cron, tức nội dung sẽ nhận lúc 6:30 sáng
curl https://<project>.vercel.app/api/cron \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Kết quả dạng `{"ok":true,"total":1,"sent":1,...}`. Nếu `sent` bằng 0 thì xem `skipped` và `errors`.

---

## Gặp trục trặc

**Sửa gì trên Vercel cũng không thấy tác dụng.** Phải Redeploy. Biến môi trường chỉ được nạp lúc tạo deployment.

**App vẫn hiện bản cũ sau khi deploy.** Service worker cũ đang giữ cache. App tự nhận bản mới và tải lại, nhưng nếu đang kẹt ở một bản cũ thì cần làm tay một lần: máy tính bấm F12 → Application → Service Workers → Unregister rồi Ctrl+Shift+R; điện thoại xoá icon khỏi màn hình chính rồi thêm lại.

**"Kiểm tra máy chủ" báo thiếu kho Upstash.** Chưa nối kho, hoặc nối rồi nhưng chưa Redeploy. Dòng báo lỗi có liệt kê tên các biến đang có trên server để đối chiếu.

**Gửi thử báo lỗi 403.** Khoá VAPID đã đổi sau khi máy này đăng ký. Tắt rồi bật lại nhắc nhở để đăng ký lại.

**iPhone không nhận thông báo.** Safari chỉ cho phép thông báo khi trang đã được thêm vào màn hình chính và mở từ icon đó (iOS 16.4 trở lên).

**Ảnh biến mất.** Trình duyệt dọn IndexedDB khi máy thiếu chỗ. App có xin quyền lưu bền nhưng không phải trình duyệt nào cũng cho; xem dòng dung lượng trong tab ảnh để biết tình trạng.

---

## Ghi chú kỹ thuật

- **Service worker** lấy HTML/CSS/JS từ mạng trước rồi mới dùng cache, để bản vừa deploy có hiệu lực ngay. Icon thì cache dài hạn. Mọi đường dẫn `/api/` đi thẳng ra mạng, không bao giờ qua cache — cache nhầm từng khiến `/api/health` báo lỗi cũ sau khi máy chủ đã sửa xong.
- **Nhắc cục bộ** khi chưa có máy chủ: Android đã cài ra màn hình chính dùng Periodic Background Sync (tối thiểu 12 tiếng một lần, hệ điều hành quyết định lúc đánh thức nên giờ có thể lệch); iOS không hỗ trợ nên chỉ nhắc khi app đang mở; app đang mở thì hẹn giờ chính xác bằng `setTimeout`.
- **Nút "Đọc bằng Claude"** trong tab ảnh dùng `window.claude.use('sample')` để đọc số liệu từ ảnh chụp màn hình. API này chỉ tồn tại khi trang chạy trong Claude Artifacts; ở nơi khác nút tự ẩn và bạn nhập tay.
- **`api/cron.js`** không chặn theo giờ người dùng chọn. Với cron một lần mỗi ngày, chặn như vậy sẽ làm thông báo không bao giờ được gửi nếu giờ chọn muộn hơn giờ cron.
