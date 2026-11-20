# ADR-0001: Đèn có nhiên liệu cạn dần và luật thắng "giữ đảo sáng tới bình minh"

- **Trạng thái:** Đã chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- **Ngày:** 2026-11-20
- **Người ra quyết định:** Nguyễn Tuấn Phong (2A202603712)
- **Liên quan:** [ticket-03.md](../lab/ticket-03.md), [phase-3.md](phase-3.md), [CHANGELOG.md](../../CHANGELOG.md)

## Bối cảnh

Phase 1–2 (Ticket-02): đèn "đã sáng" thì khoá vĩnh viễn, mỗi đèn cần nạp đủ 10 đom đóm, khi tất cả đèn sáng thì **thắng ngay** (`all_lit`). Playtest cho thấy người chơi giỏi thắng trong ~2 phút — phần còn lại của Đêm không có gì để làm, mất căng thẳng ở cuối Đêm.

Ticket-03 đổi trục chơi: **đèn thắp rồi vẫn có thể tắt**, mục tiêu là **giữ đủ đèn sáng tới bình minh**. Đây là thay đổi cốt lõi — đổi mô hình trạng thái đèn, thêm trạng thái Bóng Mực, đổi luật thắng/thua và công thức điểm.

## Quyết định

### 1. Mô hình trạng thái đèn

Đèn từ 3 trường mang tính Phase 2 (`lit`, `deposited`) chuyển sang:

| Trường | Ý nghĩa | Ghi chú |
|---|---|---|
| `lit: boolean` | Đang sáng | Quyết định chặn Bóng Mực (khi `fuel ≥ 30`), thắp/buộc đèn, win-count |
| `fuel100: int` | Nhiên liệu theo **đơn vị nguyên 1/60** | 100 dầu = 6000 đơn vị; tránh sai số float; chỉ làm tròn khi xuất snapshot |
| `everLit: boolean` | Đã từng sáng | Chọn giá thắp lại (5 thay vì 10) |
| `relitCount: int` | Số lần thắp lại | Kiểm chứng trong scenario |
| `deposited: int` | **Giữ trường cũ** để tương thích | Không còn là điều kiện thắp ở v1.2; chỉ cộng dồn số đom đóm đã châm trong Đêm và đặt lại 0 khi đèn tắt |

Lý do tách `fuel100` và `deposited`:

- `deposited` ở Phase 2 là **tiến độ thắp** (0..10). Ở Phase 3 khái niệm này biến mất; nhiên liệu là **trạng thái động** (0..6000). Gộp vào `deposited` sẽ làm các scenario Phase 2 (`L1 deposited: 9` mô tả "sắp thắp") không còn ý nghĩa.
- Tên trường mới (`fuel` trong snapshot) rõ nghĩa với Test Contract v1.2; trường nội bộ `fuel100` nói rõ "đơn vị 1/60".
- Tương thích: scenario v1.1 dùng `deposited` vẫn chạy được (đèn có `deposited >= 10` coi là `lit: true`), nhưng không tính tiến độ thắp nữa.

### 2. Đơn vị nguyên 1/60 thay vì float

- Lý do kỹ thuật: `1.0 fuel/giây` ở 60 tick/giây → mỗi tick −1 đơn vị 1/60; nếu lưu float và cộng dồn 60 lần thì sai số tích luỹ. Ticket-03 nói rõ "Nên tính dầu theo đơn vị nguyên 1/60".
- Chuyển đổi: `fuel100 = round(fuel × 60)`; `fuel = fuel100 / 60`. Chỉ làm tròn ở **biên xuất** (snapshot, event).
- Ngoại lệ có chủ đích: tôi viết `Math.round((fuel_decay_per_s * 60) / TICK_RATE)` chứ không phải `Math.round(fuel_decay_per_s * 60)`; nếu viết sau thì mỗi tick mất 60 đơn vị = 1 dầu/giây — sai gấp 60 lần (lỗi này đã bị bắt bởi test AC-F1 rồi được sửa).

### 3. Tick 1 không hao dầu

Ticket-03 nói "ở bước 2 trừ dầu; ngay sau bước 2, đèn có fuel ≤ 0 tắt". Nếu trừ ngay ở bước 2 (giống dp hụt), đèn đặt `fuel: 1` (60 đơn vị) sẽ tắt ngay tick 1 — làm scenario "1 dầu, vẫn sáng 60 tick" khó kiểm.

Tôi áp dụng quy ước **tick 1 không hao**, khớp với cách Phase 2 xử lý TTL/cooldown (chỉ giảm sau khi tick đã tăng). Hệ quả:

- Đèn scenario `fuel: 100` vẫn đúng 100.0 dầu ở snapshot tick 1.
- `fuel: 30` (ngưỡng "vẫn còn vùng an toàn") đúng 30.0 dầu ở tick 1, và giảm 1 đơn vị 1/60 ở tick 2 → mất safe zone.
- "Châm dầu 20 → 100 mất 8 đom đóm" khớp đúng ceil((100−20)/10) = 8 thay vì 9.

### 4. Đèn trong scenario **thay thế** danh sách mặc định

Ở Phase 2, `scenario.lanterns` chỉ **vá** các đèn có id (đèn nào không khai báo thì lấy mặc định). Điều này khiến test "Đêm 1 có 3/5 đèn sáng" không thể diễn đạt (5 đèn khác vẫn lit mặc định = 0). Tôi cho `scenario.lanterns` **thay thế toàn bộ** (giống `drifters`, `charms` ở v1.1). Hệ quả: mọi scenario cũ phải khai báo đủ đèn — đó là lý do tôi đã cập nhật 01, 02, 03, 24, 25.

### 5. Luật thắng mới

```
nếu flames ≤ 0:                       thua, no_flames
nếu time_left ≤ 0:
   nếu số đèn sáng ≥ ceil(0.6 × tổng đèn):  thắng, dawn_survived
   ngược lại:                                thua, dawn
```

- Không còn thắng sớm `all_lit` — `all_lit` không còn xuất hiện trong game_over.
- `no_flames` luôn xét trước `dawn_survived` để tuân đúng câu "hết Ngọn Lửa luôn thua no_flames trước" (kể cả ở tick cuối).
- `ceil(0.6 × tổng đèn)` với sai số 1e-9: 0.6×5 = 3, 0.6×6 = 3.6 → 4, 0.6×7 = 4.2 → 5.

### 6. Bóng Mực hút dầu: thêm trạng thái `drain`

- Trạng thái mới `drain` (sau `chase/recoil/stunned/spawning/wander`), **chỉ có** từ wander → đèn yếu (fuel < 30) gần nhất.
- Wander **chỉ nhắm đèn yếu** khi Mây **không** trong 12 m (vẫn ưu tiên chase hơn). Nếu không có đèn yếu nào, wander quay về đèn tắt gần nhất; không có luôn thì lượn vòng 2 m.
- `drain` không gây sát thương "khi đang đứng yên" theo nghĩa là nó **không** cản người chơi thông thường, nhưng vẫn tính là Bóng Mực "đang sống" → **gây hit** nếu Mây chạm vào nó (khi cùng vị trí). Lý do: nó vẫn là kẻ địch, không phải vùng an toàn; bỏ hit sẽ mở lỗ hổng lách (đứng sát đèn đang bị hút là an toàn tuyệt đối).
- Tôi thêm `target` (id đèn) — snapshot có `target_lantern_id`.

### 7. Vùng an toàn phụ thuộc fuel

- `keepOutOfSafe` và `insideSafe` **bỏ qua đèn có fuel < 30**. Nghĩa là đèn yếu không chặn Bóng Mực nữa; chúng có thể đi vào tới tâm đèn → drain.
- Khi fuel được châm lên ≥ 30, đèn **lấy lại vùng an toàn** ngay. Bóng Mực đang trong 6 m (kể cả đang drain) bị đẩy ra mép 30 tick — cùng code path với "đèn vừa thắp" của Phase 2. Nhờ vậy luật "châm dầu lên ≥ 30 để xua Bóng Mực" dùng chung một cơ chế.

### 8. Sức chứa tăng dần

- `capacity = min(20, 10 + 2 × successfulLights)`.
- `successfulLights` tăng mỗi lần **thắp hoặc thắp lại thành công** (cả châm dầu? **không**). Ticket-03 nói "số lần thắp thành công trong Đêm (tính cả thắp lại; đèn đặt sẵn bằng scenario không tính)".
- Đèn đặt sẵn bằng scenario **không** cộng. Điều này giúp test `?lit=3` của web không cộng sức chứa ảo.
- Reset về 0 ở đầu mỗi Đêm — mỗi `createGame` là một Đêm nên mỗi Đêm có `successfulLights: 0` tự nhiên; không cần reset trong `step`.

### 9. Điểm mới

| Sự kiện | Điểm | Ghi chú |
|---|---|---|
| Mỗi đom đóm châm vào đèn (thắp mới, thắp lại, hoặc châm dầu) | 5 | Đổi từ 10 → 5 (Ticket-03 Phần 5) |
| Thắp lần đầu | 100 | giữ nguyên |
| Thắp lại | 40 | thay `-100 + ...` từ Phase 2 |
| Bóng Mực trúng Tỏa Sáng | +5 mỗi con; **tổng +15 nếu ngay trước đó nó đang drain** | Ticket-03: đọc là "tổng 15" → `per_stun_bonus` phải = 10. Cấu hình hiện tại đang sai (25 → tổng 30) — xem "Khiếm khuyết (a)". |
| Bình minh (thắng): mỗi đèn sáng | 50 + floor(fuel) | thay thưởng thời gian |
| Bình minh: mỗi Ngọn Lửa | 50 | giữ nguyên |
| Thưởng thời gian | Bỏ | bỏ hẳn |

### 10. Khiếm khuyết đã biết / nợ kỹ thuật

**(a) Bonus Tỏa Sáng trúng Bóng Mực đang drain hiện tại = +30, không phải +15 như ticket.**

Câu gốc Ticket-03:

> Bóng Mực trúng Tỏa Sáng: **Tổng +5 mỗi con; tổng +15 nếu ngay trước đó nó đang drain**

Tôi đã cấu hình `score.per_stun = 5`, `score.per_stun_bonus = 25` → tổng = 30. Cách đọc hợp lý là: bình thường +5, nếu đang drain thì tổng là +15 (tức bonus = +10, không phải +25). Điều này **chưa đúng ticket** và cần sửa trong Phase 3 patch:

- `per_stun_bonus` → 10 (để 5 + 10 = 15).
- Hệ quả test: AC-DR4, SC-SC2 sẽ đổi từ "≥ 20" thành "= 15" (đang lỏng lẻo), scenario 36 phải đổi `amount` 30 → 15.

Lỗi phát sinh vì contract v1.2 ghi `per_stun_bonus` nhưng tôi không kịp đối chiếu kỹ câu "tổng +15". Tôi ghi ở đây theo quy tắc "Trung thực về bằng chứng" của RULES mục 5.

**(b) `insideSafe` đã sửa để bỏ qua đèn fuel < 30 nhưng `insideSafe` vẫn được dùng ở 2 nơi:**

- `stunned` push của Phase 2 ("gặp vật cản vùng an toàn thì dừng") — vẫn đúng (chỉ dừng khi đèn đó còn an toàn).
- `keepOutOfSafe` cũng đã sửa tương tự — đúng.

**(c) "Chạm đèn đang drain có gây sát thương không?"** Ticket-03 không nói rõ. Tôi cho phép **có** (đã ghi ở 6). Đây là **giả định B19** trong [phase-3.md](phase-3.md).

**(d) Thứ tự `chase` (12 m) > đèn yếu.** Ticket-03 nói "Chỉ Bóng Mực ở trạng thái wander mới chọn đèn yếu"; do vậy chase ưu tiên hơn — giả định rõ trong phase-3.md (B17).

## Hệ quả

- Toàn bộ 9 scenario Phase 1–2 đã **đổi** (không xoá), ghi `changed_in_phase3` trong `case.json`.
- 11 scenario mới thêm trong `tests/scenarios/27-…37-…` (xem [phase-3.md](phase-3.md) mục 2).
- 23 unit test mới thêm vào `tests/sim.test.js` (mã AC-*), 38 unit test tổng.
- Web thêm HUD "đang mang / sức chứa", thanh dầu trên đèn, cài đặt "Bảng màu dễ phân biệt" (lưu localStorage, viền `#00B3FF`, cảnh báo `#FFFFFF` + ⚠, đèn tắt xẹp 20% + vết rách, nhấp nháy 1 Hz khi fuel < 30).

## Xem lại

- Nếu Key Coach/trợ giảng xác nhận nghĩa câu "+15 nếu drain" là "tổng 15" (không phải "cộng thêm 15 vào 5"), sửa `per_stun_bonus` thành 10 và cập nhật 3 test/1 scenario — xem "Khiếm khuyết (a)".
- Nếu việc `drain` gây sát thương bị cho là không đúng ý thiết kế, bỏ nhánh `sh.state === 'drain'` trong bước 9 và thêm scenario kiểm.


## Cập nhật sau review (thay thế các mục 3, 4 và 10(a) ở trên)

- **Mục 3 bị hủy:** dầu hao ở bước 2 của **mọi** tick, kể cả tick 1 (Ticket-03 mục 3). Cờ "tick đầu không hao" làm mọi mốc hết dầu trễ 1 tick.
- **Mục 4 bị hủy:** `scenario.lanterns` **cập nhật theo id** (contract mục D, không đổi ở v1.1/v1.2). Thay thế cả danh sách sẽ làm test ẩn Phase 1–2 trượt.
- **Mô hình đèn (bổ sung mục 1):**
  - Đèn tắt vẫn **nạp dần** (sự kiện `deposit`, `deposited` là tiến độ) tới chi phí 10 (chưa từng sáng) hoặc 5 (`ever_lit`).
  - Đủ chi phí thì `lantern_lit {relight}`, fuel 100.
  - Đèn sáng chỉ nhận châm dầu (`refuel`).
  - Hết dầu: tắt, `deposited = 0`, `lantern_out`.
  - Chu trình: `tắt(deposited)` → `sáng(fuel)` → `tắt(ever_lit, deposited 0)` → thắp lại với 5.
- **Mục 10(a) đã sửa:** `per_stun_bonus` = 10, tổng +15 đúng nguyên văn ticket.
