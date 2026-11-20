# Phase 2: Ticket-02 "Ba hòn đảo" (Contract v1.1)

Nguồn yêu cầu: [docs/lab/ticket-02.md](../lab/ticket-02.md). Bằng chứng: [docs/proof/phase-2/](../proof/phase-2/README.md).

## 1. Thay đổi thiết kế so với Phase 1 (và lý do)

| Phase 1 | Phase 2 | Lý do |
|---|---|---|
| `step()` xét thắng/thua ngay khi sự kiện xảy ra | `step()` viết lại theo **đúng 12 bước** của ticket; thắng/thua xét ở bước 11 theo thứ tự no_flames → all_lit → dawn | Ticket bắt buộc thứ tự |
| Vị trí cộng thẳng, không có trọng lực thật, đảo phẳng | Có vận tốc, trọng lực, `surface(x,z)` theo từng bản đồ (`src/core/maps.js`), vách đứng (bậc tối đa 0.35 m), rơi khỏi đảo | Có Đêm 2 (cầu, 2 đảo) và Đêm 3 (3 tầng, dốc) |
| `tick = sim_tick` | `tick` (tổng) tách khỏi `steps` (sim_tick) | Tạm dừng: tick tăng, sim đứng yên |
| Số tự chọn (mang 5, đèn 3, pulse 1…) | Số chuẩn trong `game.contract.json` v1.1 | Ticket Phần 1 |
| Bóng Mực chỉ có `chase`/`stunned` | 5 trạng thái `spawning/wander/chase/recoil/stunned` | Contract v1.1 |
| Đom đóm rơi khi bị đánh thì mất | Rơi ra vành 1.5–2.5 m, tồn tại 480 tick | Ticket |
| Một màn | 3 Đêm, menu, tạm dừng, cài đặt, âm thanh, HUD đầy đủ | Ticket Phần 3 |

**Test cũ bị luật mới làm sai:** cả 8 scenario Phase 1 được **sửa** (không xóa). Mỗi file `case.json` có trường `changed_in_phase2` ghi lý do. Unit test được viết lại; test nào bị thay luật được đánh dấu `[P2 đổi]`. Không test nào bị tắt.

## 2. Tiêu chí nghiệm thu (AC) cho từng mục Phần 3 và các luật mới

| ID | Mục | Tiêu chí nghiệm thu (kiểm tra được) | Kiểm chứng |
|---|---|---|---|
| AC-D (Gió Lạc) | Sinh | Chỉ ở Đêm 2, 3; sinh ở tick 1200, 2400…; tối đa 2 con chưa `removed`; id D1, D2… | unit AC-D2 |
| | idle → chase | Khi Mây mang ≥ 5 và cách ≤ 15 m; mất điều kiện thì về idle | scenario 12 |
| | Cướp | Chạm XZ ≤ 1.2 m: cướp min(3, đang mang), event `drifter_steal`, chuyển flee 240 tick rồi `removed`; bất tử không ngăn; vùng an toàn không chặn; không mất lửa | scenario 12, unit AC-D1 |
| | Tỏa Sáng | Trúng khi đang chase thì flee, không cướp. Trúng khi flee có đồ thì thả lại thành đom đóm `dropped`, event `drifter_drop`, biến mất sau 120 tick | scenario 13, 14 |
| AC-C (Bùa Gió) | Nhặt | Theo luật đom đóm (XZ ≤ 1 m, chênh cao ≤ 1.5 m), event `charm_picked {charm_id, charm_ticks: 600}`; nhặt lại làm mới 600 | scenario 15, unit AC-C1 |
| | Hiệu lực | Chạy 7.2 m/s; lướt không hồi chiêu; nhấn khi đang lướt bị bỏ qua | scenario 15, unit AC-C2 |
| | Hồi lại | `available=false`, `respawn_s` đếm 2700 tick | scenario 15 |
| AC-N (Chuỗi 3 Đêm) | Luồng | Menu → giới thiệu (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp; thắng Đêm 3 thì ra màn Bình Minh với tổng điểm; thua thì chơi lại Đêm đó | ảnh `img/menu.png`; thao tác tay trong video |
| | Điểm | Tổng = tổng điểm các Đêm đã thắng | `showResult()` / `showDawn()` trong `web/main.js` |
| AC-PAUSE | Headless | Input `pause` (cạnh lên): event `paused`/`resumed`; tick tăng nhưng `sim_tick`, thời gian đứng yên; `state: "paused"` | scenario 11 |
| | Web | Esc/P dừng logic hoàn toàn; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | kiểm tra tay |
| AC-SET | Cài đặt | Âm lượng + độ nhạy chuột, lưu `localStorage` (`ddl-settings`) | kiểm tra tay: đổi, F5, giá trị còn |
| AC-SND | Âm thanh | Nhạc nền + hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (+ gió, cướp, bùa) | `web/audio.js`; nghe trong video |
| AC-HUD | HUD | Lửa trên trái; mm:ss trên giữa (đỏ, nhấp nháy khi ≤ 30 s); đèn k/n + điểm trên phải; 10 ô đom đóm dưới giữa; hồi chiêu Lướt/Sáng dưới phải; "E — Nạp ánh sáng (x/10)"; mũi tên chỉ đèn chưa sáng gần nhất khi nó ngoài màn hình | ảnh `img/n2.png`, `img/n3-lit.png` |
| AC-COLOR | Bảng màu | Đúng hex chuẩn (hằng `C` trong `web/main.js`); ambient = 0.15 + 0.55 × tỉ lệ đèn sáng | mã + ảnh |
| AC-DASH | Lướt | 14 m/s × 12 tick; hồi 90 tick tính từ lúc bắt đầu; hướng = hướng di chuyển, đứng yên thì hướng mặt; giữ độ cao trên không | scenario 09, unit AC-M4 |
| AC-FALL | Rơi | Y < −10: event `player_hit {by:"fall", lost}` đúng 1 lần, bỏ qua bất tử; chờ 60 tick; hồi sinh ở điểm xuất phát, bất tử 90 tick | scenario 10, 17 |
| AC-MAP | Bản đồ | Đúng tọa độ đèn và điểm sinh; Đêm 2: cầu, bục nhảy; Đêm 3: vách, dốc, bục, tháp, gió | scenario 07, 16–21, 26; unit AC-N1 |
| AC-PERF | Hiệu năng | 21.600 tick ≤ 30 s mỗi Đêm; web ≥ 30 FPS ở 1280×720 | `results.md` mục 2; `fps.md` |

## 3. Giả định (chỗ ticket chưa quy định)

| # | Giả định | Lý do |
|---|---|---|
| B1 | "Tăng tốc/dừng ≤ 0.1 s": đạt tốc độ **ngay lập tức** (0 s) | Thỏa ≤ 0.1 s; giữ đúng các phép tính vị trí của Phase 1 |
| B2 | `spawning` kéo dài 60 tick; không di chuyển, không gây sát thương | Cho người chơi thấy Bóng Mực xuất hiện |
| B3 | `wander`: lượn vòng 1 m/s, bán kính 2 m quanh chỗ bắt đầu lượn; phát hiện (≤ 12 m) thì chase, xa hơn 18 m thì về wander | Lần đầu cho wander trôi về phía Mây thì mọi Bóng Mực dồn về một chỗ, bot thua cả 9 ván. Đổi để phát hiện 12 m có ý nghĩa |
| B4 | Chỉ `wander`/`chase` gây sát thương; `spawning`/`stunned`/`recoil` và Bóng Mực đang bị đẩy khỏi vùng an toàn thì không | |
| B5 | Bóng Mực và Gió Lạc **bay theo địa hình** (tâm cao 1 m / 1.5 m trên mặt đất, bỏ qua vách và tháp), ngoài đảo coi mặt = 0 | Sinh vật sương; vách chỉ chặn Mây |
| B6 | Vùng an toàn: Bóng Mực bị chặn ở 6 + 0.001 m (luôn ở ngoài). Đẩy khi đèn vừa thắp: tuyến tính trong đúng 30 tick | "Trong bán kính r" là ≤ r |
| B7 | `night_start` được ghi ở **bước đầu tiên** (tick 1) | Contract v1.0: dựng scenario không phát event |
| B8 | Snapshot `player.invuln` là **boolean** (không có hậu tố `_s` như các trường khác) | |
| B9 | Đêm 3 xuất phát ở **(0, 0, −30)** quay về +Z, vì (0,0,0) nằm trong tháp chuông | **Cần hỏi trợ giảng** |
| B10 | Đom đóm ban đầu: rút ngẫu nhiên 20 điểm khác nhau theo seed. Sinh thêm: chọn ngẫu nhiên trong các điểm chưa có đom đóm `random` | |
| B11 | Bóng Mực sinh: chọn ngẫu nhiên trong các điểm cách Mây ≥ 15 m; 2 con cùng tick không trùng điểm | |
| B12 | Gió Lạc sinh ở một điểm sinh Bóng Mực ngẫu nhiên của Đêm đó ("điểm sương"); idle lượn vòng bán kính 3 m | |
| B13 | Gió: bắt đầu ở sim tick 1800, 3600… (mỗi 30 s), kéo dài 300 tick, hướng ngẫu nhiên (độ nguyên). Chỉ Đêm 3 (`wind_enabled` mặc định theo bản đồ). Báo trước 120 tick trên web | |
| B14 | Bục nhảy kích hoạt khi chân Mây đứng trên bục (XZ ≤ 1 m, chạm đất). Đêm 2 hướng về tâm đảo kia tính từ vị trí lúc bắn | |
| B15 | Đom đóm rơi ra ngoài đảo (không có mặt đất) thì đặt tại chân Mây | |
| B16 | Scenario: `motes` nhận `[x,y,z]` (kind random) hoặc `{pos, kind, ttl_s}`; `charms` nhận `{id?, pos, available?}`; `drifters` nhận `{id?, pos, state?, stolen?}`; shade mặc định `wander` | |
| B17 | Đêm 3, mặt tháp chuông (r ≤ 2) cao 14 m nên tự thành vách không leo được | |

## 4. Đánh giá Phase 2

- **Đạt (có bằng chứng):**
  - Số chuẩn và Contract v1.1.
  - 3 bản đồ.
  - Thứ tự 12 bước.
  - Lướt, rơi khỏi đảo, tạm dừng, Gió Lạc, Bùa Gió, gió mạnh, lịch sinh.
  - 26 scenario + 23 unit + test định dạng, tất định, hiệu năng: tổng **60 test đạt**.
  - Tất định cả 3 Đêm (sha256 giống hệt).
  - Headless khoảng 0.11 s mỗi Đêm (ngưỡng 30 s).
  - Web khoảng 140 FPS ở 1280×720.
- **Regression Phase 1:** 8 scenario cũ được sửa theo số chuẩn, giữ nguyên ý nghĩa kiểm tra; đều đạt.
- **Kiểm tra test không "luôn đạt":** đổi `pulse_radius` từ 5 thành 4 thì 3 test đỏ (04, 14, số chuẩn). Đã khôi phục.
- **Lỗi thật tìm được nhờ test:** Mây đang ở dưới mặt đảo thì vẫn "đáp đất" và bị kéo lên y = 0 (AC-W2). Đã sửa: chỉ đáp khi đi qua mặt đất từ phía trên.
- **Chưa đạt / hạn chế:**
  - Bot chỉ thắng Đêm 1 (3/3) và Đêm 2 (1/3); **Đêm 3 bot chưa thắng**, vì chưa biết dùng bục nhảy để thắp L1. Đây là giới hạn của bot. Scenario 26 chứng minh L1 thắp được qua bục nhảy.
  - Luồng menu, tạm dừng, cài đặt, âm thanh mới kiểm tra bằng tay và ảnh, chưa có test tự động. Sẽ quay trong video.
  - Giả định B9 (điểm xuất phát Đêm 3) chưa xác nhận với trợ giảng.
- **Harness:**
  - Cập nhật `CLAUDE.md` (bản đồ, thứ tự tick, cách đổi test cũ).
  - Cập nhật skill `verify-phase` (thêm đo FPS).
  - Thêm `scripts/fps-bench.js`.
