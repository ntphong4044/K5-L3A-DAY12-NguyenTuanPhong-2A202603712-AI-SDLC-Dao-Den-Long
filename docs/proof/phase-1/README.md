# Bằng chứng Phase 1: bảng truy vết

Chạy lại toàn bộ: `npm test` rồi `npm run proof`. Kết quả chi tiết tự sinh ở [results.md](results.md); output thô nằm trong [runs/](runs/).
Yêu cầu và giả định: [docs/notes/phase-1.md](../../notes/phase-1.md).

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| R1 Đêm 1, đảo tròn, 5 đèn | Scenario mặc định seed 42 | `07-default-night` + `runs/07-default-night.jsonl`; unit AC-21 | Đạt |
| R2 Di chuyển, xoay camera, chuẩn hóa, nhảy | Unit test | AC-01..AC-05 (`tests/sim.test.js`) | Đạt |
| R2 Camera 3D góc nhìn thứ ba | Ảnh chụp bản web | [img/play.png](img/play.png) | Đạt |
| R3 Nhặt đom đóm, giới hạn mang | Scenario + unit | `01-pickup-deposit-light`, `08-capacity`; AC-06, AC-07 | Đạt |
| R4 Nạp, thắp đèn | Scenario + unit | `01-pickup-deposit-light`; AC-08, AC-09 | Đạt |
| R5 Bóng Mực xuất hiện, đuổi, chạm thì mất lửa | Scenario + unit | `03-shade-hit-lose`, `07-default-night`; AC-11, AC-12, AC-20 | Đạt |
| R5b Tỏa sáng xua Bóng Mực | Scenario + unit | `04-pulse-stun`; AC-14..AC-16 | Đạt |
| R5c Bóng Mực sợ đèn | Scenario + unit | `05-safe-zone`; AC-17 | Đạt |
| R6 Thắng / thua (all_lit, no_flames, dawn) | Scenario + unit | `02-win-all-lit`, `03-shade-hit-lose`, `06-dawn`; AC-10, AC-13, AC-18 | Đạt |
| R6 Chơi được từ đầu tới thắng | Bot chơi Đêm 1 mặc định rồi phát lại inputs qua headless | results.md mục 3; `runs/bot-seed*.inputs.json` / `.jsonl` | Đạt (3/3 seed thắng, khớp) |
| R7 Điểm số | Kiểm tra số điểm chính xác trong scenario | `01` (130), `02` (349), `04` (20) | Đạt |
| R7 HUD | Ảnh + DOM | [img/play.png](img/play.png), [img/lit3.png](img/lit3.png) | Đạt |
| R8 Màn kết thúc + chơi lại | Ảnh màn thắng (`?autostart&lit=5`). Phím R/Enter gọi `startPlaying()` để tạo ván mới (`web/main.js`) | [img/end-won.png](img/end-won.png) | Màn kết thúc: Đạt. Thao tác chơi lại: kiểm tra tay, sẽ cho thấy trong video |
| R9 Phong cách, đảo sáng dần, nón lá có đèn | Ảnh trước và sau khi thắp | [img/play.png](img/play.png) (0/5) và [img/lit3.png](img/lit3.png) (3/5), [img/title.png](img/title.png) | Đạt |
| C-A `game.contract.json` | Unit kiểm tra đủ trường; tuning được đọc trực tiếp bởi lõi | `tests/headless.test.js` | Đạt |
| C-B Mô hình tick, mã thoát | Test định dạng, mã thoát 2 / khác 0 | `tests/headless.test.js` | Đạt |
| C-C Inputs (giữ giá trị, cạnh lên, yaw) | Unit + scenario | AC-02, AC-04, AC-09, `01`, `04` | Đạt |
| C-D Scenario (thay thế, cập nhật theo id, không event/điểm) | Unit + scenario | AC-19, AC-20, `05` (id `S9`) | Đạt |
| C-E Output JSONL, làm tròn, tất định | Test định dạng + so sha256 hai lần chạy | `tests/headless.test.js`; results.md mục 2 | Đạt |

Ảnh được chụp bằng Chrome headless (SwiftShader) từ bản web thật; cách chụp nằm trong `.claude/skills/verify-phase/SKILL.md`.
Tham số `?lit=3` chỉ dùng để chụp ảnh, nó thắp sẵn 3 đèn ở phía web.

## Harness tự kiểm chứng

| Thành phần | Cách kiểm chứng | Kết quả |
|---|---|---|
| Hook Stop (`scripts/hooks/stop-gate.js`) | Thêm tạm một test fail, chạy `echo '{}' \| node scripts/hooks/stop-gate.js` | Thoát mã 2, in tên test đỏ (chặn agent kết thúc). Xóa test tạm thì thoát mã 0. Với `stop_hook_active: true` thì thoát 0 để tránh vòng lặp |
| Test không "luôn đạt" | Đổi `shade_speed` 3.5 thành 4 trong contract rồi chạy `npm test` | `03-shade-hit-lose` fail. Đã khôi phục |
| CI | `.github/workflows/ci.yml` chạy test + proof trên Ubuntu và macOS | Xem tab Actions sau khi push |
