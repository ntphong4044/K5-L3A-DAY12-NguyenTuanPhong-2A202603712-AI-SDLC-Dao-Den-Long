# Phase 1: PRD-0 + Test Contract v1.0

## 1. Yêu cầu và tiêu chí nghiệm thu

| ID | Yêu cầu (PRD-0) | Tiêu chí nghiệm thu (kiểm tra được) |
|---|---|---|
| R1 | Một màn "Đêm 1 – Đảo Bến", đảo tròn, 5 Đèn Lồng Lớn | Snapshot tick 0 có 5 đèn L1..L5, 30 đom đóm, `time_left_s` = 300 |
| R2 | Đi lại, nhảy, camera 3D | `move [0,1]` 60 tick thì đi được đúng `player_speed` m theo +Z; công thức `cam_yaw_deg` đúng; vector được chuẩn hóa; nhảy theo cạnh lên; web có camera góc nhìn thứ ba |
| R3 | Đom đóm rải rác, nhặt được | Trong `pickup_radius` (<= r) thì `mote_picked` và `carried+1`; khi đã đầy `carry_capacity` thì không nhặt |
| R4 | Nạp ánh sáng vào đèn để thắp | `interact` trong `interact_radius` thì `deposit`; đủ `lantern_cost` thì `lantern_lit` |
| R5 | Bóng Mực xuất hiện, đuổi, chạm thì mất máu | `shade_spawned` theo lịch; shade tiến về người chơi với `shade_speed`; trong `shade_hit_radius` thì `player_hit`, mất 1 flame, rơi đom đóm, bất tử `invuln_s` |
| R5b | Tỏa sáng xua Bóng Mực, tốn ánh sáng | `pulse` tốn `pulse_cost` đom đóm; shade trong `pulse_radius` bị `stunned` `pulse_stun_s` giây và bị đẩy `pulse_push_m` m; có `pulse_cooldown_s` |
| R5c | Bóng Mực sợ đèn | Shade không bao giờ ở trong `safe_radius` của đèn đã thắp |
| R6 | Thắng / thua | Thắp đủ 5 đèn thì `won/all_lit`; flames = 0 thì `lost/no_flames`; hết giờ thì `lost/dawn` |
| R7 | Điểm số + HUD | Điểm theo `tuning.score`; HUD hiển thị lửa, đom đóm, số đèn, thời gian, điểm, trạng thái pulse |
| R8 | Chơi lại | Màn hình kết thúc, phím R/Enter tạo ván mới |
| R9 | Phong cách: đêm, ấm, đảo sáng dần, nón lá có đèn | Ảnh chụp: đảo tối/tím, sáng dần khi thắp đèn; Mây đội nón lá có đèn lồng nhỏ |
| C1-C5 | Test Contract v1.0 (A-E) | Scenario headless + test định dạng + test tất định + test mã thoát 2 |

## 2. Giả định (chỗ PRD-0 chưa quy định)

| # | Giả định | Lý do |
|---|---|---|
| A1 | "Máu" = **Ngọn Lửa** (`flames` = 3). Mỗi lần bị chạm mất 1 | PRD nói "mất máu"; contract dùng `flames` |
| A2 | "Ánh sáng" để tỏa sáng = **đom đóm đang mang**. Pulse tốn 1 đom đóm; không đủ thì nhấn không có tác dụng (không phát event) | Đơn giản, tạo lựa chọn chiến thuật: dùng đom đóm thắp đèn hay để tự vệ |
| A3 | Nhặt đom đóm **tự động** khi đi vào `pickup_radius`; nạp đèn bằng nút `interact` | Contract chỉ có nút interact cho đèn |
| A4 | Một lần interact nạp tối đa phần còn thiếu của đèn: `min(carried, lantern_cost - deposited)`. Chọn đèn **chưa thắp gần nhất** trong `interact_radius` | Không lãng phí đom đóm |
| A5 | `safe_radius` chỉ áp dụng quanh đèn **đã thắp**. Shade bị đẩy ra tới `safe_radius + 0.01` m (luôn ở ngoài bán kính) | Đèn tắt thì không có ánh sáng để Bóng Mực sợ. Hợp với câu "đảo sáng dần lên" |
| A6 | Bóng Mực ngẫu nhiên: con đầu ở 5 s, sau đó cứ 20 s một con, tối đa 4 con. Xuất hiện ở vòng bán kính 40 m (sương ngoài đảo), tâm cao 1 m. Không có con nào lúc tick 0 | Cho người chơi thời gian làm quen |
| A7 | Đom đóm bị rơi khi trúng đòn (`floor(carried × 0.5)`) **mất luôn**, không rơi ra đất | Đơn giản; có 30 đom đóm mà chỉ cần 15, đủ dư |
| A8 | Shade bị choáng thì đứng yên và **không gây sát thương**. Pulse lên shade đang choáng thì đặt lại thời gian choáng và vẫn cộng `per_stun` | |
| A9 | Mỗi bước bị chạm tối đa 1 lần. Hết bất tử thì có thể bị chạm lại ngay | |
| A10 | `fall_enabled = false`: không có vực. Người chơi bị giữ trong bán kính đảo 30 m, không có event `fall` | Contract cho phép |
| A11 | Điểm thưởng khi **thắng**: `floor(time_left_s) × per_second_left + flames × per_flame_left`. Thua thì không có thưởng | |
| A12 | Thứ tự trong một bước: bộ đếm, di chuyển và nhảy, nhặt, nạp đèn (có thể thắng ngay), pulse, sinh shade, shade di chuyển, va chạm (có thể thua), kiểm tra bình minh | Ghi rõ để test giảng viên có thể suy luận |
| A13 | So sánh khoảng cách dùng dung sai 1e-6 (`dist <= r + 1e-6`) | Tránh lỗi số thực khi vị trí cộng dồn 0.1 m mỗi tick |
| A14 | Bộ đếm (bất tử, cooldown, choáng) tính bằng tick = `round(s × 60)`. Ví dụ bị chạm ở tick t thì lần chạm kế tiếp sớm nhất ở tick t+90 | Tất định, không trôi số thực |
| A15 | Snapshot chỉ ghi ở các tick là bội của `--snapshot-every`; game kết thúc giữa chừng thì dòng `end` mang trạng thái cuối | Theo đúng chữ của contract |
| A16 | `--night` khác 1 thì báo lỗi, thoát mã 1. Thiếu hoặc sai tham số CLI thì mã 1. File inputs/scenario sai định dạng thì mã 2 | |
| A17 | Scenario `lanterns[].deposited >= lantern_cost` thì đèn coi như đã thắp (không cộng điểm) | |

## 3. Thiết kế

- **Lõi tất định** `src/core/sim.js` không phụ thuộc DOM, dùng chung cho headless và web. Nhờ vậy thứ giảng viên test chính là thứ người chơi chơi.
- Tuning đọc trực tiếp từ `game.contract.json`, nên số khai báo luôn khớp số game dùng.
- Số ngẫu nhiên dùng PRNG `mulberry32(seed)`, với 2 luồng riêng cho đom đóm và cho shade.
- Web: Three.js, chạy mô phỏng ở 60 Hz cố định với accumulator. Hoạt động trên macOS/Linux/Windows chỉ cần Node.

## 4. Đánh giá Phase 1

- **Đạt:** R1 đến R9 và C1 đến C5 đều có bằng chứng (`docs/proof/phase-1/`). 36 test đạt; 8 scenario đạt; tất định đạt; bot thắng trọn Đêm 1 với 3 seed và phát lại qua headless khớp từng điểm.
- **Kiểm tra test không "luôn đạt":** thử đổi `shade_speed` 3.5 thành 4 trong contract thì scenario `03-shade-hit-lose` fail như mong đợi. Đã khôi phục.
- **Rủi ro / chưa chắc:**
  - Bot thắng trong khoảng 28 s nên độ khó còn thấp. Đây là cân bằng, không phải yêu cầu; có thể chỉnh ở phase sau.
  - Chưa kiểm chứng bằng tay trên macOS/Linux. CI có chạy `ubuntu-latest` + `macos-latest` sau khi push.
  - Giả định A5 (safe zone chỉ quanh đèn đã thắp) có thể khác với cách giảng viên hiểu. Nên hỏi trợ giảng để xác nhận.
- **Harness:** thêm `CLAUDE.md`, hook Stop chặn kết thúc khi test đỏ, skill `verify-phase`, CI.
