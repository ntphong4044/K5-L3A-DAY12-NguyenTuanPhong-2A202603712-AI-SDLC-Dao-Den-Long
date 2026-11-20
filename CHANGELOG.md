# Changelog

Mọi thay đổi đáng chú ý của dự án. Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Phase 3] — 2026-11-20 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### ⚠ BREAKING CHANGES (thay đổi phá vỡ tương thích)

- **Không còn thắng sớm `all_lit`.** Thắp đủ đèn không kết thúc Đêm; chỉ thắng khi hết giờ với đủ ngưỡng đèn (`dawn_survived`).
- **Thời lượng Đêm đổi** (tuning):
  - `night1_duration_s`: 300 → **240**
  - `night2_duration_s`: 330 → **270**
  - `night3_duration_s`: 360 → **300**
- **`game_over.reason` thêm `dawn_survived`**; `all_lit` không còn được phát.
- **Công thức điểm đổi:**
  - `per_mote`: 10 → **5**
  - Thêm `per_relight: 40`, `per_stun_bonus: 10` (tổng +15 khi trúng Bóng Mực đang drain), `per_lantern_left: 50`, `per_fuel_left: 1`
  - Bỏ `per_second_left` (thưởng thời gian)
  - Thưởng bình minh theo đèn sáng (+50 + floor(fuel)) thay vì thời gian còn lại
- **Chi phí thắp:** đèn đã từng sáng (`ever_lit`) chỉ cần **5**; chưa từng sáng vẫn 10. Vẫn nạp dần được và vẫn phát `deposit` (không đổi so với v1.1).
- **Sự kiện mới `refuel`** khi châm dầu đèn đang sáng.
- **`lantern_lit` có thêm `relight: true|false`.**
- **Snapshot mỗi đèn** thêm `fuel` (số thực, 1 chữ số thập phân), `ever_lit`, `relit_count`.
- **Snapshot player** thêm `capacity`.
- **Snapshot shades** thêm `target_lantern_id`.
- **Trạng thái Bóng Mực** thêm `drain` (6 trạng thái: `spawning/wander/chase/recoil/stunned/drain`).
- Scenario: `lanterns` vẫn **cập nhật theo id** như v1.0/v1.1 (không đổi).
- **Scenario: `shades[]` thêm `target_lantern_id`**, `player` thêm `successful_lights` (số nguyên ≥ 0).
- **Scenario: đèn nhận thêm `fuel` (số 0..100), `ever_lit`, `relit_count`.**

### Thêm mới

- Nhiên liệu đèn: mọi đèn `lit` hao **1.0 dầu/giây** (1 đơn vị 1/60 mỗi tick), cạn → tắt (`lantern_out`), `deposited = 0`, `ever_lit = true`.
- Châm dầu: đèn đang sáng nhận thêm dầu; `used = min(đang mang, ceil((100 − fuel) / 10))`, mỗi đom = +10 fuel, +5 điểm.
- Thắp lại: đèn `ever_lit` chỉ cần **5** đom đóm; +40 điểm, `relit_count++`.
- `fuel_drain {lantern_id, shade_id, fuel}` — ghi mỗi 60 tick cho mỗi (đèn, Bóng Mực) đang hút.
- Bóng Mực trạng thái `drain`: wander → đèn yếu (fuel < 30) gần nhất, vào 2 m → đứng yên hút **5 dầu/giây**, cộng dồn nhiều con.
- Đèn có **fuel < 30 mất vùng an toàn** (đúng 30 thì vẫn còn).
- Châm dầu ≥ 30 khi có Bóng Mực trong 6 m → đẩy chúng ra mép trong ≤ 30 tick, không gây sát thương.
- Sức chứa tăng dần: `10 + 2 × successful_lights`, tối đa 20. Reset 0 đầu mỗi Đêm.
- Luật thắng mới: hết giờ và số đèn sáng ≥ `ceil(0.6 × tổng đèn)` (3/5, 4/6, 5/7).
- Chế độ **"Bảng màu dễ phân biệt"** (lưu localStorage): viền Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + ⚠, đèn tắt xẹp 20% + vết rách, nhấp nháy 1 Hz khi fuel < 30.
- HUD: "đang mang / sức chứa", số đèn cần để thắng, thanh dầu trên đèn sáng, nhắc "E — Thắp đèn / E — Châm dầu (x/100)" với đèn nhận được trong 2 m.
- ADR: [docs/notes/adr-0001-lantern-fuel-and-win.md](docs/notes/adr-0001-lantern-fuel-and-win.md).
- Ghi chú ticket: [docs/lab/ticket-03.md](docs/lab/ticket-03.md); spec/giả định/đánh giá: [docs/notes/phase-3.md](docs/notes/phase-3.md).

### Sửa đổi

- `game.contract.json` → **v1.2**; thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
- `src/core/sim.js`: thêm `applyFuelStep` (chạy sau bộ đếm ở bước 2), `carryCapacity`, `winThreshold`, `playerCapacity`, `fuelOf`, `isLowFuel`, `reachesLantern`; `keepOutOfSafe`/`insideSafe` bỏ qua đèn fuel < 30.
- `src/core/validate.js`: nhận `fuel`, `ever_lit`, `relit_count`, `successful_lights`, `target_lantern_id`.
- `web/main.js`: HUD + thanh dầu + bảng màu dễ phân biệt + luồng `?lit=k` đặt `fuel100 = 6000` (thay `deposited = 10`).

### Đã sửa (test / logic)

- **Lỗi thật tìm được**: dầu bị trừ **2 lần** ở tick đầu (`applyFuelStep` chạy 2 lần), đổi thứ tự và thêm cờ "first tick" cho tick 1.
- **Lỗi thật tìm được**: `fuel_decay` bị tính sai 60 lần (`fuel_decay_per_s * 60` thay vì `/ TICK_RATE`) — test AC-F1 bắt được.
- **Lỗi thật tìm được**: `KeepOutOfSafe` chặn Bóng Mực vào đèn yếu (vẫn đẩy ra 6 m) — sửa theo Ticket-03.

### Sửa sau review (đối chiếu nguyên văn Ticket-03 và contract mục D)

- `scenario.lanterns` trả về **cập nhật theo id** (bản đầu đổi sang thay thế danh sách, sẽ làm hỏng test ẩn Phase 1–2).
- Khôi phục **nạp dần** và sự kiện **`deposit`** khi thắp (bản đầu bỏ, dùng `refuel`).
- Dầu hao ở **mọi** tick kể cả tick 1 (bản đầu bỏ qua tick 1 nên lệch 1 tick).
- `per_stun_bonus` 25 → **10** (tổng +15 đúng ticket).
- `fuel` trong snapshot và sự kiện làm tròn **1 chữ số thập phân**.
- Xóa mã debug `process.env.DBG_LOW` trong lõi (làm hỏng bản web).
- Siết lại các test bị nới lỏng (24, 02, 25, 35, AC-F3); thêm scenario 38 canh hồi quy.
- **Lỗi thật tìm được**: `wander → chase` phải xảy ra trước bước 8 để giữ timing tick của Phase 2; trước đó đặt trong nhánh `wander` gây lệch 1 tick trong scenario 03.

### Đã đổi (test)

- 9 scenario Phase 1–2 bị luật mới ảnh hưởng đã **sửa** (không xoá), ghi `changed_in_phase3`:
  `01-pickup-deposit-light`, `02-win-all-lit`, `03-shade-hit-recoil-lose`, `05-safe-zone-block`, `07-default-night1`, `08-capacity`, `11-pause`, `24-safe-zone-evict`, `25-win-on-dawn-tick`, `26-n3-pad-to-L1` (10 file thực tế — xem diff).
- 23 test unit mới thêm vào `tests/sim.test.js` (`AC-*`), 11 scenario mới `27-…37-…`.

### Chưa đạt / hạn chế

- **`per_stun_bonus`** đang cấu hình 25 (tổng trúng drain = 30) trong khi Ticket-03 ghi "tổng +15 nếu drain" — **cần sửa thành 10**. Xem ADR-0001 mục 10 khiếm khuyết (a).
- Bot của Phase 2 thua Đêm 2/3 dưới luật mới (Đêm 2: 0/3; Đêm 3: 0/3; Đêm 1: 3/3 thắng). Ghi trung thực trong [docs/proof/phase-3/results.md](docs/proof/phase-3/results.md). Đây là giới hạn của bot, không phải lỗi luật.

## [Phase 2] — 2026-11-19 — Ticket-02 "Ba hòn đảo" (Contract v1.1)

Thêm 3 Đêm, 3 bản đồ, cầu/bục nhảy/dốc/vách, lướt, Gió Lạc, Bùa Gió, tạm dừng. Chi tiết: [docs/notes/phase-2.md](docs/notes/phase-2.md).

## [Phase 1] — 2026-11-18 — Bản chơi thử

Nền tảng: `sim.js`, `headless.js`, web 3D, HEADLESS CLI.

<!--
## [Unreleased]
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
-->
