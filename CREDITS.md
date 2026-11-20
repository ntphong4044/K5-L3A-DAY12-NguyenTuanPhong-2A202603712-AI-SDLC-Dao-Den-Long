# CREDITS

Mọi asset của Đảo Đèn Lồng đều tự tạo trong repo hoặc lấy từ thư viện mã nguồn mở. Không có âm thanh, mô hình hay ảnh tải từ bên ngoài.

## Nội dung sáng tạo

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Nhân vật, bối cảnh, tên gọi (Mây, Bóng Mực, Gió Lạc, Ông Đăng, Đảo Bến/Cau/Chuông) | Bản gốc của Day 12 AI SDLC Lab | Theo lab |
| Mô hình 3D (đảo, đèn lồng, Bóng Mực, đom đóm, nón lá, cầu tre, tháp chuông) | Tự dựng bằng primitive của three.js trong `web/main.js`, `web/bench.js` | MIT (repo này) |
| Biểu tượng cảnh báo ⚠ trên đèn yếu | Vẽ bằng canvas lúc chạy (`warnTexture` trong `web/main.js`), ký tự hệ thống | Sys - dùng tự do |
| Chữ, giao diện, phụ đề | HTML/CSS trong `web/index.html`, `web/bench.html`, `web/leaderboard.html` | MIT (repo này) |
| Ảnh chụp bằng chứng `docs/proof/**/img/*.png` | Tự chụp bằng Chrome qua `scripts/fps-bench.js` và `scripts/shots.js` | MIT (repo này) |

## Âm thanh

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Nhạc nền, hiệu ứng (nhặt, nạp, thắp đèn, tỏa sáng, trúng đòn, Bóng Mực, Gió Lạc, Bùa Gió, thắng/thua) | Tự tổng hợp bằng WebAudio lúc chạy trong `web/audio.js`; không có file âm thanh | MIT (repo này) |

## Thư viện và công cụ

| Thành phần | Phiên bản | Giấy phép |
|---|---|---|
| [three.js](https://threejs.org) (npm `three`) | 0.170.0 | MIT |
| Node.js | ≥ 20 (đo trên 24.16.0) | MIT |
| Chrome / Chromium (đo bench, chụp ảnh) | Google Chrome ổn định | Phần mềm của Google |
| Chrome DevTools Protocol (điều khiển Chrome qua WebSocket, không dùng `puppeteer`) | — | — |

## Công cụ AI tạo nội dung

| Công cụ | Dùng cho | Ghi chú |
|---|---|---|
| Claude Code (Anthropic) | Viết/sửa mã, test, tài liệu, script kiểm chứng; sinh ảnh bằng chứng không do AI vẽ | Nhật ký: [docs/notes/ai-log.md](docs/notes/ai-log.md) |
| Kilo Code (agent trong VS Code) | Phase 4: bench/soak/leaderboard/accessibility, đóng gói, tài liệu | Có ghi trong nhật ký AI |

Mọi đoạn mã do AI viết đều được kiểm bằng `npm test`, scenario headless, benchmark và chạy thật trên Chrome trước khi nhận (xem [phase-4.md, mục 5](docs/notes/phase-4.md#5-lỗi-thật-tìm-ra-và-cách-sửa)).
