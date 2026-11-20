# Bằng chứng Phase 3: bảng truy vết

Chạy lại: `npm test` → `npm run proof -- --phase 3` (sinh [results.md](results.md) và `runs/`) → `npm start` + `npm run fps` (sinh [fps.md](fps.md)).
Yêu cầu, tiêu chí nghiệm thu và giả định: [docs/notes/phase-3.md](../../notes/phase-3.md). ADR: [docs/notes/adr-0001-lantern-fuel-and-win.md](../../notes/adr-0001-lantern-fuel-and-win.md).

| Yêu cầu Ticket-03 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| **Mục 1** fuel_max 100, `fuel = 100` khi vừa thắp | Snapshot `lanterns[].fuel` == 100 sau `refuel`/`lantern_lit` | 27, 29; unit AC-F2/AC-F4 | Đạt |
| **Mục 1** hao 1.0 dầu/giây (1/60 mỗi tick) | Snapshot fuel sau N tick | 28; unit AC-F1 | Đạt |
| **Mục 1** châm dầu `used = min(carried, ceil((100 − fuel) / 10))` | Sự kiện `refuel {amount, fuel}` | 27 (9 = ceil(80.017/10), vì bước 2 đã hao 1/60); 37; unit AC-F2 | Đạt |
| **Mục 1** đèn đầy dầu không được chọn, không sự kiện | `no_event refuel`, `carried` không đổi | unit AC-F3 (đèn đầy bị bỏ qua, chọn đèn nhận được dù xa hơn) | Đạt |
| **Mục 1** chọn đèn: chỉ đèn nhận được (chưa sáng, hoặc sáng nhưng chưa đầy); gần nhất, bằng nhau id nhỏ hơn | Test chọn thứ tự | unit AC-L1; 27 | Đạt |
| **Mục 1** tính dầu theo đơn vị nguyên 1/60 | `fuel100` là số nguyên; chỉ làm tròn khi xuất snapshot | unit «Số chuẩn», toàn bộ snapshot không có sai số float | Đạt |
| **Mục 1** hết dầu: tắt, deposited = 0, `lantern_out`, `ever_lit = true` | Sự kiện + snapshot | 28; unit AC-F1 | Đạt |
| **Mục 1** thắp lại 5 đom nếu `ever_lit`, +40, `relight: true`, `relit_count++` | Sự kiện + snapshot | 29; unit AC-F4 | Đạt |
| **Mục 1** thanh dầu + nhấp nháy 1 Hz khi fuel < 30 | Ảnh chụp bản web (thanh dầu trên đèn) | [img/n1-lit3.png](img/n1-lit3.png), [img/n3-demo.png](img/n3-demo.png) | **Có ảnh** — chất lượng hiển thị cần kiểm tay (chưa có ảnh zoom riêng) |
| **Mục 2** fuel < 30 mất vùng an toàn; đúng 30 vẫn còn | Snapshot vị trí Bóng Mực | 31, 35; unit AC-DR3 | Đạt |
| **Mục 2** wander → đèn yếu gần nhất rồi `drain` | Snapshot `shades[].state = "drain"`, `target_lantern_id` | 30; unit AC-DR1 | Đạt |
| **Mục 2** hút 5/giây, cộng dồn; `fuel_drain` mỗi 60 tick | Snapshot fuel sau N tick; `count fuel_drain` | 30; unit AC-DR2 | Đạt |
| **Mục 2** chuyển `drain → chase/stunned/wander` | Snapshot trạng thái | unit AC-DR4 | Đạt |
| **Mục 2** châm lên ≥ 30 → đẩy ra mép ≤ 30 tick, không sát thương | `no_event player_hit`; vị trí | 37; unit AC-DR5 | Đạt |
| **Mục 3** thời lượng 240/270/300 | Snapshot `time_left_s` | 07, 11; unit AC-N2 | Đạt |
| **Mục 3** thắng khi hết giờ và `số đèn sáng ≥ ceil(0.6 × tổng)` | `game_over {result: won, reason: dawn_survived}` | 32; unit AC-W4, AC-W5 | Đạt |
| **Mục 3** thua khi hết giờ mà dưới ngưỡng | `game_over {result: lost, reason: dawn}` | 33 | Đạt |
| **Mục 3** không còn thắng sớm `all_lit` | Thắp đủ đèn → vẫn `playing` | unit AC-W3; 02 | Đạt |
| **Mục 3** thua `no_flames` ngay cả tick cuối | `game_over {reason: no_flames}` khi flames = 0 và time_left = 0 | unit AC-W6; 03 | Đạt |
| **Mục 3** thứ tự trong tick: trừ dầu ngay sau bước 2; xét thắng/thua sau mọi cập nhật | Snapshot tại tick bình minh | toàn bộ scenario 32/33 | Đạt |
| **Mục 4** sức chứa `10 + 2 × successful_lights`, tối đa 20 | Snapshot `player.capacity` | 34; unit AC-K1 | Đạt |
| **Mục 4** đèn đặt sẵn không tính | `preset` scenario → capacity = 10 | unit AC-K1 | Đạt |
| **Mục 4** HUD hiện "đang mang / sức chứa" | Ảnh chụp bản web | [img/n1-lit3.png](img/n1-lit3.png) | **Có ảnh** — chưa kiểm tay |
| **Mục 5** +5/đom nạp, +100 lần đầu, +40 thắp lại | `end.score` | 01 (150 = 10×5 + 100); 29 (65 = 5×5 + 40) | Đạt |
| **Mục 5** Tỏa Sáng trúng drain điểm cao hơn | `end.score` sau pulse | 36; unit AC-SC2 | **Chưa khớp ticket** — xem ghi chú dưới |
| **Mục 5** bình minh: `+50 + floor(fuel)` mỗi đèn; `+50` mỗi Ngọn Lửa; bỏ thưởng thời gian | `end.score` | unit AC-SC1 | Đạt |
| **Mục 6** viền Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + ⚠ khi bật | Web (cài đặt + ảnh) | `web/main.js` (`applyPalette`), `web/index.html` (`body.cb`) | **Có mã** — chưa có ảnh chế độ bật |
| **Mục 6** đèn tắt xẹp 20% + vết rách; nhấp nháy khi fuel < 30 | Web | `web/main.js` `render()` (`v.roof.scale`, `v.tear`) | **Có mã** — chưa có ảnh chụp cận |
| **Mục 7** contract_version "1.2", đủ 8 khóa tuning mới | Unit so contract | `tests/headless.test.js`; unit «Số chuẩn v1.2» | Đạt |
| **Mục 7** snapshot thêm `fuel`, `ever_lit`, `relit_count`, `capacity`, `target_lantern_id` | Test hình dạng snapshot | `tests/headless.test.js`; unit AC-N2 | Đạt |
| **Mục 7** scenario thêm `fuel`, `ever_lit`, `relit_count`, `successful_lights`, `target_lantern_id` | `validate.js` | dùng trong 27…37 | Đạt |
| **Mục 7** event mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit.relight`; `game_over.reason = dawn_survived`; bỏ `all_lit` | Headless output | `runs/*.jsonl`; 27, 28, 30, 32 | Đạt |
| **DoD** ADR mô tả mô hình trạng thái đèn và luật thắng | Có file | [adr-0001-lantern-fuel-and-win.md](../../notes/adr-0001-lantern-fuel-and-win.md) | Đạt |
| **DoD** changelog breaking changes | Có file | [CHANGELOG.md](../../../CHANGELOG.md) | Đạt |
| **DoD** test cũ bị luật mới làm sai được sửa / xoá có lý do | Ghi `changed_in_phase3` trong `case.json` | 01, 02, 07, 11, 25, 26 (24 giữ nguyên bản Phase 2); trường `changed_in_phase3_review` ghi các sửa khi review | Đạt |
| **DoD** test ẩn Phase 1–2 vẫn đạt | Chạy toàn bộ test | `npm test`: 87/87 | Đạt |
| **DoD** ≥ 30 FPS @1280×720 | `scripts/fps-bench.js` (bot tự chơi 27 s mỗi Đêm) | [fps.md](fps.md) (139.0 / 132.8 / 141.5 FPS, đo lại sau review) | Đạt |
| **DoD** ≤ 30 s cho 21.600 tick | `results.md` mục 2 | [results.md](results.md) | Đạt (~0.2 s/Đêm) |
| **DoD** chơi được từng Đêm | Bot chơi trọn, phát lại qua headless | `results.md` mục 3 | Đêm 1: 3/3 thắng (bot đã biết châm dầu); Đêm 2: 0/3; Đêm 3: 0/3 — **hạn chế của bot** (di chuyển nhiều đảo/tầng), không phải lỗi luật |

Ảnh chụp bằng Chrome headless từ bản web thật. `?lit=k` thắp sẵn k đèn (chỉ phía web, đặt `lit = true`, `ever_lit = true`, `fuel = 6000`, không cộng `successful_lights`).

| **Hồi quy P1–P2** scenario.lanterns cập nhật theo id; nạp dần + `deposit` | Scenario canh hồi quy | **38**; 01, 24, 26 | Đạt |
| **Contract v1.2** fuel xuất 1 chữ số thập phân (snapshot + sự kiện) | Scenario 35 (`lanterns.0.fuel == 30`), unit AC-F2 (`fuel 80` từ 79.983) | | Đạt |
| **Mục 6** chế độ dễ phân biệt (web) | Ảnh bản web thật với `?cb` | [img/n1-low.png](img/n1-low.png) (thường), [img/n1-low-cb.png](img/n1-low-cb.png), [img/n1-off-cb.png](img/n1-off-cb.png) | Ảnh: web chạy, HUD đúng. Thanh dầu nhấp nháy và viền #00B3FF nhìn không rõ ở góc xa, sẽ cho thấy trong video |

## Ghi chú trung thực

- Bản đầu Phase 3 có 6 lỗi, phát hiện khi review đối chiếu với nguyên văn ticket. Tất cả đã sửa, xem [phase-3.md mục 5](../../notes/phase-3.md):
  - `scenario.lanterns` thay cả danh sách.
  - Bỏ nạp dần và sự kiện `deposit`.
  - Không hao dầu ở tick 1.
  - Thưởng drain +30.
  - fuel xuất 3 chữ số thập phân.
  - Mã debug `process.env` trong lõi.
- `per_stun_bonus` = 10, Bóng Mực đang drain trúng Tỏa Sáng được **tổng +15**. Scenario 36 và AC-DR4 kiểm đúng giá trị 15.
- Luồng menu, tạm dừng, cài đặt và âm thanh của bản web chỉ kiểm tra tay, chưa có test tự động.
