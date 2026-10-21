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
- **Cài đặt như app (PWA)** — có `manifest.json` + service worker, dùng được offline sau lần mở đầu tiên và thêm được vào màn hình chính trên điện thoại.

## Lưu trữ dữ liệu

Toàn bộ trạng thái (buổi đã chạy, lịch tùy chỉnh, ghi chú, ảnh Strava) chỉ lưu **trong trình duyệt của bạn** (`localStorage` + `IndexedDB`), không gửi lên server nào. Đổi trình duyệt hoặc xóa dữ liệu trang là mất hết — hiện chưa có tính năng xuất/nhập backup.

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
script.js      logic: lịch, tick, biểu đồ, ghi chú, ảnh Strava, pháo hoa, tab, service worker
sw.js          service worker (cache app-shell để dùng offline)
manifest.json  khai báo PWA
icons/         icon app (192/512/apple-touch/favicon)
```

## Chạy / deploy

- **Local**: cần chạy qua một server tĩnh vì `sections/` được nạp bằng `fetch` (mở thẳng `index.html` theo `file://` sẽ không tải được nội dung tab). Ví dụ nhanh nhất: `npx serve` hoặc `python -m http.server` trong thư mục này.
- **GitHub Pages**: Settings → Pages → Deploy from branch → chọn `main` / `/ (root)`. Trang sẽ có ở `https://<tên-tài-khoản>.github.io/<tên-repo>/`.
