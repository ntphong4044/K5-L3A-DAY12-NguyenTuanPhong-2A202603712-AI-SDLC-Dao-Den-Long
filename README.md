# Đảo Đèn Lồng · v1.0.0

> **Video demo:** [demo.mp4 (Release v1.0.0)](https://github.com/ntphong4044/K5-L3A-DAY12-NguyenTuanPhong-2A202603712-AI-SDLC-Dao-Den-Long/releases/download/v1.0.0/demo.mp4) · **Bản phát hành:** [Release v1.0.0](https://github.com/ntphong4044/K5-L3A-DAY12-NguyenTuanPhong-2A202603712-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0)
> Day 12 · AI SDLC Lab · Nguyễn Tuấn Phong · 2A202603712
> Ticket hiện tại: [Ticket-04 — "Bình minh: phát hành v1.0.0"](docs/lab/ticket-04.md) · Contract **v1.3** · Tài liệu lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba qua **3 Đêm, 3 hòn đảo**. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp và **giữ lửa** các Đèn Lồng Lớn suốt đêm. Đèn có **nhiên liệu** hao dần; Bóng Mực **hút dầu** các đèn yếu. Mục tiêu: **giữ đủ đèn sáng tới bình minh**.

![Đêm 3 – Đảo Chuông](docs/proof/phase-3/img/n3-demo.png)

Ảnh Phase 4 (bản phát hành, cài đặt phím, phụ đề, bảng xếp hạng): [`docs/proof/phase-4/img/`](docs/proof/phase-4/img/).
**Bản phát hành:** GitHub Release [v1.0.0](https://github.com/ntphong4044/K5-L3A-DAY12-NguyenTuanPhong-2A202603712-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0) đính kèm `dao-den-long-web.zip` (bản web tĩnh) và `demo.mp4`.

## Cài đặt và chơi (3 lệnh, cần Node.js ≥ 20)

```bash
npm install
npm start          # -> http://localhost:5173
```

`npm start` mở máy chủ tĩnh ở cổng 5173 (đổi bằng `PORT=8080 npm start`). Chạy trên macOS / Linux / Windows với Chrome, Edge hoặc Firefox có WebGL2.

### Chạy bản phát hành đã đóng gói

```bash
npm run release    # tạo dist/dao-den-long-web.zip (bản web tĩnh + serve.mjs + LICENSE)
```

Giải nén, rồi `node serve.mjs` trong thư mục vừa giải nén → http://localhost:5173.

### Docker (tùy chọn)

```bash
docker build -t dao-den-long . && docker run --rm -p 5173:5173 dao-den-long
```

## Điều khiển (mọi phím đổi được trong Cài đặt)

| Phím mặc định | Hành động |
|---|---|
| `W A S D` / `↑ ↓` | Di chuyển (theo hướng camera) |
| `←` `→` hoặc kéo chuột | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` (trái/phải) | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| `E` | Tương tác: thắp / thắp lại / châm dầu Đèn Lồng Lớn ở gần |
| `Q` | Tỏa Sáng: làm choáng và đẩy lùi Bóng Mực trong 5 m (tốn 3 đom đóm, hồi 3 s) |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

Cài đặt (menu chính hoặc màn tạm dừng): gán lại phím cho cả 9 hành động (phát hiện trùng phím và báo ngay, có nút **Khôi phục mặc định**), bảng màu dễ phân biệt, **giảm chuyển động** (tắt rung camera và chớp màn hình), **chữ lớn ×1.25**. Mọi thay đổi được lưu giữa các lần mở.

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm đặc biệt |
|---|---|---|---|---|
| 1 | Đảo Bến: đảo tròn 40 m | 5 | 240 s | Bóng Mực từ giây thứ 5, tối đa 6 |
| 2 | Đảo Cau: 2 đảo + cầu tre | 6 | 270 s | Bục nhảy vàng bay qua biển mây, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông: 3 tầng, tháp chuông | 7 | 300 s | Dốc, vách đứng, bục nhảy lên tầng 2, gió mạnh mỗi 30 s |

Thắng một Đêm thì sang Đêm kế tiếp. Thắng Đêm 3 thì tới màn **Bình Minh** rồi nhập tên lưu điểm. Thua thì chơi lại Đêm đó (vẫn lưu được điểm).

## Luật chơi và điểm (số chuẩn Ticket-03, giữ nguyên trong Contract v1.3)

- Đi qua đom đóm để nhặt tự động. Mang được **10 + 2 × số lần thắp thành công trong Đêm** (tối đa 20).
- **Đèn Lồng Lớn:** thắp lần đầu cần **10** đom đóm, **thắp lại** cần **5**; nạp dần nhiều lần được. Đèn sáng **hao 1 dầu/giây**; `E` ở đèn sáng để **châm dầu** (mỗi đom = +10, đầy 100). Cạn dầu thì đèn tắt và phải thắp lại.
- **Bóng Mực:** lượn quanh, đuổi trong 12 m (4 m/s; Đêm 3: 4.5 m/s), bỏ khi Mây xa hơn 18 m. Chạm Mây: mất 1 Ngọn Lửa, rơi một nửa đom đóm (nhặt lại 8 s), bất tử 1.5 s. Đèn có **dầu < 30 mất vùng an toàn**, Bóng Mực tới hút **5 dầu/giây**; châm lên ≥ 30 để xua nó.
- **Gió Lạc** (Đêm 2, 3): đuổi khi Mây mang ≥ 5 đom đóm, cướp 3. Tỏa Sáng trúng thì nó thả đồ lại. **Bùa Gió**: 10 s chạy 7.2 m/s, lướt không hồi chiêu.
- Rơi khỏi đảo: mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát.
- **Thắng** khi hết giờ và còn đủ đèn sáng: **3/5, 4/6, 5/7**. **Thua** khi hết 3 Ngọn Lửa hoặc hết giờ mà không đủ ngưỡng.

| Hành động | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +5 |
| Thắp đèn lần đầu | +100 |
| Thắp lại | +40 |
| Bóng Mực trúng Tỏa Sáng (mỗi con) | +5 (tổng **+15** nếu nó đang hút dầu) |
| Khi thắng: mỗi đèn đang sáng | +50 + floor(dầu) |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Mọi con số nằm trong [`game.contract.json`](game.contract.json) (v1.3); lõi đọc trực tiếp file này. Quyết định thiết kế: [ADR-0001](docs/notes/adr-0001-lantern-fuel-and-win.md).

## Bảng xếp hạng cục bộ

- Sau màn **Bình Minh** hoặc sau khi **thua** ở bất kỳ Đêm nào: bấm **Lưu điểm**, nhập tên **3–12 ký tự** (`A–Z a–z 0–9 _`, chữ Việt có dấu được).
- Mỗi mục: `name`, `score` (tổng điểm các Đêm đã thắng), `nights_won` (0–3), `achieved_at` (ISO 8601 có múi giờ), `seed`. Giữ **top 10**, sắp score giảm dần; bằng điểm thì ai đạt trước đứng trên.
- Lưu **trên đĩa** ở `.ddl/leaderboard.json` (máy chủ `npm start` ghi qua `/api/leaderboard`), nên vẫn còn sau khi tắt/mở lại game. Có màn hình **Bảng xếp hạng** từ menu chính và trang riêng `/web/leaderboard.html`.
- Xuất ra JSON, đúng lệnh của contract (`run_cmd` = `node scripts/serve.js`):

```bash
node scripts/serve.js --export-leaderboard out.json     # {"entries": [ ... ]} đúng thứ tự
```

## Test, headless, bench, soak

Các lệnh dưới đây là đúng các lệnh trong `game.contract.json` (máy chấm gọi y như vậy):

```bash
npm test                                                                # 110 test: unit + 38 scenario headless + tất định + Phase 4
node src/headless.js --seed 1 --night 2 --ticks 21600 --out out.jsonl  # headless_cmd
node scripts/bench.js --seed 42 --duration 30 --out bench.json         # bench_cmd (cần Chrome/Chromium/Edge)
node --jitless --max-semi-space-size=1 src/soak.js --seed 7 --nights 10 --out soak.json   # soak_cmd
npm run proof -- --phase 3                                              # sinh docs/proof/phase-3/results.md
```

- **Headless** theo Test Contract v1.3: `--night 1|2|3`, 60 tick/s, tất định theo seed. File inputs/scenario sai định dạng thì thoát mã 2.
- **Benchmark** (`bench_cmd` = `node scripts/bench.js`):
  - Mở **cửa sổ Chrome thật** (không headless) 1280×720, không toàn màn hình, tắt vsync bằng cờ trình duyệt `--disable-gpu-vsync --disable-frame-rate-limit`.
  - Cảnh: Đêm 1 đầy đủ ánh sáng, **200 Bóng Mực wander + 100 đom đóm**, L1–L3 sáng với fuel 100. Tắt sát thương, nhặt đom đóm, hao dầu, sinh thêm và kết thúc Đêm. Camera bay vòng tròn bán kính 30 m, cao 15 m, 15 s/vòng.
  - Bỏ 3 s khởi động rồi đo đúng `--duration` giây, ghi `bench.json` và thoát mã 0.
  - `load_ms` tính **từ lúc tiến trình bắt đầu** tới khung hình đầu tiên.
  - `peak_mem_mb` = **null**: bản web không đọc được RSS của tiến trình. JS heap ghi riêng ở `js_heap_peak_mb` để tham khảo.
  - Trên Linux không có màn hình thì chạy dưới `xvfb-run`.
- **Soak** (`soak_cmd`):
  - 10 Đêm liên tiếp trong một tiến trình (Đêm 1→2→3 xoay vòng, Đêm i dùng seed 7+i).
  - Input ngẫu nhiên theo seed: hướng đổi mỗi 30 tick; 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
  - `mem_start_mb` = RSS sau khi tải xong Đêm đầu tiên (không có Đêm khởi động); `mem_end_mb` = RSS sau khi reset xong Đêm cuối. GC chạy trước mỗi lần đo và sau mỗi Đêm.
  - Ngưỡng **đúng ticket**: `mem_end ≤ 1.2 × mem_start`.
  - Vì sao dùng `--jitless`: soak kiểm tra rò rỉ trạng thái game, còn bộ đệm mã JIT của V8 tăng theo số đường code được tối ưu. Đối chứng 100 Đêm: có JIT thì RSS 39 → 52 MB; tắt JIT thì RSS phẳng 37 → 39 MB. Heap game phẳng trong cả hai trường hợp. Chi tiết trong [phase-4.md](docs/notes/phase-4.md).
- **Kết quả tự đo** (AMD Ryzen 5 5600H + Radeon iGPU, Windows 10; chỉ để tham khảo, máy chấm đo lại):

| Bench (30 s, seed 42) | Kết quả | Ngưỡng |
|---|---|---|
| `avg_fps` | **283.7** | ≥ 60 |
| `p1_low_fps` | **129.2** | ≥ 30 |
| `load_ms` | **1198.5** | ≤ 10.000 |
| `frame_ms_p95` · `frames` | 5.9 ms · 8511 | — |

| Soak (10 Đêm, seed 7) | Kết quả | Ngưỡng |
|---|---|---|
| `crashes` | **0** | = 0 |
| `mem_start_mb → mem_end_mb` | **38 → 39** (×1.026) | ≤ 1.2 × mem_start |

## Tài liệu

- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md) · [Phase 4](docs/proof/phase-4/README.md) (bảng truy vết + ảnh + bench + soak)
- Spec, tiêu chí nghiệm thu (AC), giả định và đánh giá: [phase-1.md](docs/notes/phase-1.md) · [phase-2.md](docs/notes/phase-2.md) · [phase-3.md](docs/notes/phase-3.md) · [phase-4.md](docs/notes/phase-4.md)
- [Retro 4 phase](docs/notes/retro.md) · [Nhật ký AI & chi phí](docs/notes/ai-log.md) · [CHANGELOG](CHANGELOG.md) · [CREDITS](CREDITS.md)
- CI: GitHub Actions chạy `npm test` + `npm run proof` trên Ubuntu mỗi lần push.

## Cấu trúc

```text
game.contract.json     Test Contract v1.3 (tuning = số chuẩn, bench_cmd, soak_cmd)
src/core/sim.js        luật chơi tất định, step() theo 12 bước
src/core/maps.js       bản đồ chuẩn 3 Đêm
src/core/bench.js      cảnh benchmark chuẩn (200 Bóng Mực, camera quỹ đạo) + chế độ bench
src/core/benchstats.js thống kê khung hình (avg, p1, p95)
src/core/soak.js       vòng soak nhiều Đêm, input ngẫu nhiên theo seed
src/core/leaderboard.js bảng xếp hạng thuần (tên, sắp xếp, ISO 8601)
src/core/bot.js        bot tìm đường (chỉ để kiểm chứng)
src/bench.js           bench dự phòng chỉ chạy CPU (không phải bench_cmd; không dùng làm số chính thức)
src/soak.js            CLI soak
src/leaderboard.js     xuất bảng xếp hạng ra JSON
web/                   bản chơi 3D (Three.js), bench.html/bench.js, leaderboard.html, settings.js, store.js
tests/                 unit, scenario headless, Phase 4 (tests/phase4.test.js)
scripts/               serve.js, bench.js, shots.js, release.js, proof.js, hooks/stop-gate.js
docs/                  lab + ticket; notes: spec, giả định, retro, nhật ký AI; proof: bằng chứng
CLAUDE.md, .claude/    harness AI (hướng dẫn, hook Stop, skill verify-phase)
```

## Sáng tạo của tôi

Chỉ nằm ở phía hiển thị `web/`; không đổi luật hay output headless (cảnh benchmark tắt hiệu ứng sáng tạo, đo trên cùng cảnh chuẩn).

- **Đèn lồng trên nón lá của Mây** sáng mạnh dần theo số đom đóm đang mang.
- **Vòng sáng an toàn** màu cam trên mặt đất quanh đèn đã thắp.
- **Đom đóm rơi nhấp nháy** trong 2 giây cuối trước khi tan biến; **biểu tượng ⚠** nổi trên đèn sắp cạn dầu.
- **Lời dẫn của Ông Đăng** ở mỗi Đêm; màn Bình Minh chuyển trời sang cam hồng.
- **Gió Lạc** là dải lụa uốn lượn; Bóng Mực có viền tím phát sáng, phình dần khi `spawning`.

## Giấy phép

Mã nguồn dùng giấy phép MIT ([LICENSE](LICENSE)). Thư viện, âm thanh và công cụ AI: [CREDITS.md](CREDITS.md).
