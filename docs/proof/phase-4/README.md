# Bằng chứng Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0"

Ngày: 2026-11-20 · Contract v1.3 · Máy tự đo: AMD Ryzen 5 5600H + Radeon iGPU, Windows 10 19044, 19 GB RAM, pin "Balanced", Google Chrome (GPU ANGLE/D3D11).
Tiêu chí nghiệm thu và giả định: [docs/notes/phase-4.md](../../notes/phase-4.md) · Retro: [retro.md](../../notes/retro.md)

## Bảng truy vết yêu cầu → bằng chứng

| Yêu cầu Ticket-04 | Bằng chứng | Kết quả |
|---|---|---|
| 1. Cảnh benchmark: 1280×720, không toàn màn hình, tắt vsync, Đêm 1 đầy đủ ánh sáng, 200 Bóng Mực wander + 100 đom đóm + L1–L3 fuel 100, tắt sát thương/nhặt/hao dầu/kết thúc, camera (30,15,0) 15 s/vòng, bỏ 3 s khởi động | [`../../bench.json`](../../../bench.json); code `src/core/bench.js`, `web/bench.js`; test AC-BENCH1/BENCH2/BENCH3/BENCH5/BENCH8 | `shades: 200`, `motes: 100`, `window: [1280,720]`, `vsync_off: true` |
| 1. Ngưỡng đạt avg ≥ 60, p1 ≥ 30, load ≤ 10 s | [`../../bench.json`](../../../bench.json) | **avg 283.7 · p1 129.2 · load 1198.5 ms** · p95 5.9 ms · 8511 khung |
| 1. Công thức `avg_fps`, `p1_low_fps` (k = max(1, ceil(0.01N))), `frame_ms_p95` | test AC-BENCH6 | Khớp số tính tay |
| 1. `peak_mem_mb` là RSS, hoặc null kèm giải thích nếu là bản web | [`../../bench.json`](../../../bench.json), README mục Bench | Bản web ghi **heap JS** (`performance.memory`), chế độ headless ghi RSS thật — có giải thích |
| 2. Soak 10 Đêm, seed 7+i, input ngẫu nhiên theo seed, cùng một tiến trình | [`../../soak.json`](../../../soak.json); test AC-SOAK1/2/3/4 | 10 Đêm, 0 crash, `lost`×10, 25.728 tick |
| 2. `crashes = 0`, `mem_end ≤ 1.2 × mem_start` | [`../../soak.json`](../../../soak.json) | **38 → 39 MB (×1.026)** (ngưỡng ≤ 68, trần 128); heap 7.5 → 7.8 MB |
| 2. Chạy lâu không rò rỉ | [`soak-500.json`](soak-500.json) | 500 Đêm / 1.326.618 tick (cùng cờ `soak_cmd`): 0 crash, RSS 38→43 MB (×1.13), heap 5.6→4.6 MB — không xu hướng rò rỉ |
| 3. Nhập tên sau Bình Minh / sau khi thua; tên 3–12 ký tự, chữ Việt có dấu | [`img/name-prompt.png`](img/name-prompt.png), [`img/name-invalid.png`](img/name-invalid.png), [`img/ui-report.json`](img/ui-report.json) | Lỗi tên ngắn hiện đúng câu; tên `Mây_K5` lưu được |
| 3. Mục `name, score, nights_won, achieved_at (ISO 8601 có múi giờ), seed`; top 10; score giảm dần; bằng điểm ai trước đứng trên | test AC-LB1/LB2/LB3/LB4; [`img/leaderboard.png`](img/leaderboard.png) | Mục: `Mây_K5 · 1500 · 1/3 · 2026-11-20T20:09:07+07:00 · seed 7` |
| 3. Lưu đĩa cục bộ, còn sau khi mở lại; màn hình từ menu chính | [`img/leaderboard-page.png`](img/leaderboard-page.png) (trang đọc lại localStorage sau khi chuyển trang); `web/store.js` | Bảng hiện đúng ở trang riêng |
| 3. `<run_cmd> --export-leaderboard out.json` → `{"entries":[…]}` đúng thứ tự | `node scripts/serve.js --export-leaderboard`; test AC-LB5 | Đã chạy với hồ sơ Chrome thật: xuất đúng mục `Phong_K5 · 1720` |
| 4. Đổi phím 9 hành động, phát hiện trùng và báo, khôi phục mặc định, được lưu | [`img/settings-conflict.png`](img/settings-conflict.png); [`img/ui-report.json`](img/ui-report.json); test AC-KEY1 | `Phím E đã dùng cho "Tương tác (thắp / châm dầu)".`; vẫn chờ phím mới |
| 4. Phụ đề/chỉ báo hình ảnh: Bóng Mực + mũi tên mép, gió sắp thổi, 10 s cuối, đèn fuel < 30 | [`img/night1-subs.png`](img/night1-subs.png); `ui-report.json`; test AC-UI2 | `Bóng Mực: 2 sắp hiện · tổng 2`, `Đèn yếu (dầu < 30): L1 14, L2 14, L3 14`, 1 mũi tên mép, ⚠ trên đèn |
| 4. Giảm chuyển động tắt rung camera và chớp màn hình | [`img/settings-large.png`](img/settings-large.png); `ui-report.json` (`reducedMotion: true` đã lưu); test AC-UI1 | Tắt rung (`cameraShake`) và nhấp nháy (`body.reduce-motion`) |
| 4. Chữ UI ≥ 18 px; tùy chọn ×1.25 | `ui-report.json`: `menuFontSize: 18px`, `largeFontCss: 22.5px`, `timerFont: 36px`; test AC-UI1 | Đạt cả hai |
| 5. Clone sạch → ≤ 3 lệnh → chơi được | README mục Cài đặt (`npm install`, `npm start`); [`img/release-build.png`](img/release-build.png) | Zip phát hành giải nén, `node serve.mjs`, cảnh 3D chạy, không lỗi console |
| 5. README (mô tả, ảnh, yêu cầu, cài đặt, điều khiển, test/headless/bench/soak), CHANGELOG 4 phase, CREDITS, LICENSE | [`README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), [`CREDITS.md`](../../../CREDITS.md), [`LICENSE`](../../../LICENSE); test AC-PKG1 | Đủ |
| 5. Release v1.0.0 có bản chạy được | `dist/dao-den-long-web.zip` (tạo bằng `npm run release`); hướng dẫn Release: [RELEASE.md](RELEASE.md) | Zip 0.31 MB, 24 tệp; `Dockerfile` có nhưng **chưa kiểm** (Docker daemon không chạy trên máy này) |
| 6. Contract v1.3 + `bench_cmd` + `soak_cmd`; v1.0–v1.2 giữ nguyên | [`game.contract.json`](../../../game.contract.json); test `[P4 đổi] Số chuẩn …`; `npm test` | 110/110 test; mọi scenario Phase 1–3 đạt |
| 7. Retro 1–2 trang + token/chi phí | [`retro.md`](../../notes/retro.md), [`ai-log.md`](../../notes/ai-log.md) | Có bảng 4 phase, lỗi AI, harness, ước tính chi phí |
| 7. Video demo `.mp4` < 5 phút | Chưa có (không quay được trong môi trường agent) — hướng dẫn quay: [RELEASE.md](RELEASE.md) | **Còn thiếu**, phải làm tay |

## Lệnh tái lập

```bash
npm install
npm test                                        # 110 test
node scripts/bench.js --seed 42 --duration 30 --out bench.json                                   # -> bench.json (cần Chrome; ~45 s)
node --jitless --max-semi-space-size=1 src/soak.js --seed 7 --nights 10 --out soak.json                                    # -> soak.json (~1 s)
node --jitless --max-semi-space-size=1 src/soak.js --seed 7 --nights 500 --out docs/proof/phase-4/soak-500.json
npm run shots                                   # -> img/*.png + img/ui-report.json (cần Chrome)
npm run release                                 # -> dist/dao-den-long-web.zip
node scripts/serve.js --export-leaderboard out.json      # -> {"entries": [...]}
```

## Ảnh

| Tệp | Nội dung |
|---|---|
| [`menu.png`](img/menu.png) | Menu chính (Bắt đầu / Bảng xếp hạng / Cài đặt), chữ 18 px |
| [`settings-conflict.png`](img/settings-conflict.png) | Gán phím trùng → báo lỗi, nút vẫn chờ phím |
| [`settings-large.png`](img/settings-large.png) | Chữ lớn ×1.25 + giảm chuyển động đã bật |
| [`night1-subs.png`](img/night1-subs.png) | Đêm 1: phụ đề (Bóng Mực sắp hiện, đèn yếu), mũi tên mép, ⚠ trên đèn |
| [`name-prompt.png`](img/name-prompt.png) / [`name-invalid.png`](img/name-invalid.png) | Nhập tên / báo tên chưa hợp lệ |
| [`leaderboard.png`](img/leaderboard.png) | Bảng xếp hạng sau khi lưu |
| [`leaderboard-page.png`](img/leaderboard-page.png) | Trang bảng xếp hạng riêng (đọc lại localStorage) |
| [`release-build.png`](img/release-build.png) | Bản zip phát hành chạy từ thư mục giải nén |

Cách kiểm UI tự động: `scripts/shots.js` mở Chrome qua DevTools Protocol, bấm nút, đọc DOM và ghi `ui-report.json` — ảnh chỉ để người xem đối chiếu, còn số liệu kiểm nằm ở JSON.

## Ghi chú trung thực

- Số bench là trên máy của tôi; máy chấm của giảng viên sẽ khác.
- `peak_mem_mb` của bản web không phải RSS (giới hạn của trình duyệt); đã ghi rõ trong README và `bench.json`.
- Dockerfile chưa build thử (Docker Desktop không chạy trên máy này); bản phát hành được kiểm là zip tĩnh.
- Video demo chưa có; xem [RELEASE.md](RELEASE.md) để biết kịch bản quay.
