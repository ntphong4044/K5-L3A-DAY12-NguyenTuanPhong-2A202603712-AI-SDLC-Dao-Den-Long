# Phase 3: Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Nguồn yêu cầu: [docs/lab/ticket-03.md](../lab/ticket-03.md). ADR: [adr-0001-lantern-fuel-and-win.md](adr-0001-lantern-fuel-and-win.md). Bằng chứng: [docs/proof/phase-3/](../proof/phase-3/README.md).

## 1. Thay đổi thiết kế so với Phase 2 (và lý do)

| Phase 2 (Ticket-02) | Phase 3 (Ticket-03) | Lý do |
|---|---|---|
| Đèn sáng = khoá vĩnh viễn | Đèn sáng = nguồn nhiên liệu giảm dần (**fuel**) | Playtest: "thắp hết" quá nhanh, hết căng thẳng cuối Đêm |
| `deposited` = tiến độ thắp | `deposited` còn nhưng **không** là điều kiện thắp; `fuel100` là tiến độ | Tách "tiến độ chậm" (P2) khỏi "trạng thái động" (P3) |
| Đèn nhớ tiến độ nạp dần | Thắp **một lần**, cần ≥ 10 (hoặc 5 nếu `ever_lit`) | Cần đổi mô hình: đèn đang sáng cần châm dầu, không phải nạp tới 10 |
| `all_lit` thắng sớm | Hết giờ và số đèn sáng ≥ `ceil(0.6 × tổng đèn)` | Mục tiêu mới: **giữ đảo sáng tới bình minh** |
| `300/330/360` s | `240/270/300` s | Ticket-03 Phần 3 |
| Bóng Mực bị vùng an toàn chặn mọi đèn sáng | Đèn fuel < 30 mất vùng an toàn; Bóng Mực có trạng thái `drain` | Ticket-03 Phần 2 |
| `+10/đom` nạp, `+100/đèn`, `+5/stun`, `+2/giây` thắng | `+5/đom`, `+100/đèn mới`, `+40/thắp lại`, `+5/+25/stun`, bình minh `+50 + floor(fuel)` | Ticket-03 Phần 5 |
| Sức chứa 10 cố định | `10 + 2 × successful_lights` (≤ 20) | Ticket-03 mục 4 |
| Không có chế độ mù màu | Bật/tắt "Bảng màu dễ phân biệt" | Ticket-03 mục 6 |

**Test cũ bị luật mới làm sai:** **9** scenario Phase 1–2 đã được **sửa** (không xoá; ghi `changed_in_phase3` trong `case.json`):

| Scenario | Sửa gì | Lý do |
|---|---|---|
| `01-pickup-deposit-light` | `lantern_lit` thêm `relight: false`; điểm cuối 200 → **150** (10×5 + 100). Sự kiện `deposit` **giữ nguyên** | Ticket-03 mục 5 (điểm) |
| `02-win-all-lit` | `all_lit` → `dawn_survived`; `time_left_s: 100` → `1/60`; expect `lantern_lit` + `game_over` | Không còn thắng sớm; thắng ở bình minh |
| `03-shade-hit-recoil-lose` | Không sửa nội dung; kiểm tra lại vẫn 136/226 | Đảm bảo timing P2 giữ nguyên (wander→chase phải xảy ra trước bước 8) |
| `05-safe-zone-block` | Không sửa; vẫn đạt | Đèn đủ 100 dầu → còn vùng an toàn |
| `07-default-night1` | `time_left_s` 300 → **240** | Thời lượng đổi |
| `08-capacity` | Không sửa; vẫn đạt | Cấu hình không thắp đèn → capacity vẫn 10 |
| `11-pause` | `time_left_s` 299.833 → **239.833** | Thời lượng đổi |
| `24-safe-zone-evict` | **Giữ nguyên bản Phase 2** (đèn `deposited: 9`, nạp 1 → thắp; vị trí chính xác 1.898/5.693) | Bản đầu nới thành khoảng giá trị với lý do "bỏ nạp một phần" là sai — đã khôi phục khi review |
| `25-win-on-dawn-tick` | `all_lit` → `dawn_survived`; thêm `lantern_lit @1` | Không còn thắng sớm |
| `26-n3-pad-to-L1` | `deposit` → `refuel`; `lantern_lit` thêm `relight: false` | Sự kiện đổi |

> Lưu ý: `03`, `05`, `08` **không sửa nội dung** nhưng kiểm lại đều đạt — không nằm trong "bị thay thế" của ticket.

## 2. Tiêu chí nghiệm thu (AC) cho từng mục của Ticket-03

| ID | Mục | Tiêu chí nghiệm thu (kiểm chứng được) | Kiểm chứng |
|---|---|---|---|
| AC-F1 | Fuel hao | Đèn sáng hao đúng 1 đơn vị 1/60 mỗi tick; cạn → tắt, `deposited = 0`, `ever_lit = true`, phát `lantern_out` | unit AC-F1; scenario **28** |
| AC-F2 | Châm dầu | `used = min(đang mang, ceil((100 − fuel) / 10))`; `fuel = min(100, fuel + 10 × used)`; event `refuel {lantern_id, amount, fuel}` | unit AC-F2; scenario **27** |
| AC-F3 | Đèn đầy dầu | Đầy dầu (used = 0) không được chọn, không phát sự kiện, không cộng điểm | unit AC-F3 |
| AC-F4 | Thắp lần đầu / thắp lại | 10 đom (chưa từng sáng) / 5 đom (`ever_lit`); +100 hoặc +40; `relight: true/false`; `relit_count` tăng | unit AC-F4; scenario **29** |
| AC-F5 | Hiển thị | Thanh dầu trên đèn đang sáng; fuel < 30 nhấp nháy 1 Hz | web (ảnh) |
| AC-DR1 | Wander chọn đèn yếu | Wander → đèn sáng fuel < 30 gần nhất (bằng nhau thì id nhỏ hơn); chuyển `drain` khi ≤ 2 m | unit AC-DR1; scenario **30** |
| AC-DR2 | Drain cộng dồn | Hút 5 dầu/giây mỗi con (5/60 mỗi tick); nhiều con cộng dồn; `fuel_drain` ghi mỗi 60 tick | unit AC-DR2; scenario **30** |
| AC-DR3 | Mất vùng an toàn | Đèn fuel < 30 mất vùng an toàn; **đúng 30 vẫn còn** | unit AC-DR3; scenario **31**, **35** |
| AC-DR4 | Chuyển trạng thái drain | `drain → chase` khi Mây vào 6 m; `drain → stunned` khi trúng Tỏa Sáng; `drain → wander` khi fuel ≥ 30 hoặc đèn tắt hoặc cách > 2 m | unit AC-DR4 |
| AC-DR5 | Đẩy khi châm dầu | Châm dầu lên ≥ 30 khi có Bóng Mực trong 6 m → đẩy ra mép ≤ 30 tick, không sát thương | unit AC-DR5; scenario **37** |
| AC-W3 | Không thắng sớm | Thắp đủ đèn không kết thúc Đêm | unit AC-W3; scenario **02** |
| AC-W4 | Ngưỡng thắng | Thắng khi hết giờ và `số đèn sáng ≥ ceil(0.6 × tổng)` | unit AC-W4; scenario **32** |
| AC-W5 | Ngưỡng theo Đêm | 3/5, 4/6, 5/7 | unit AC-W5 |
| AC-W6 | no_flames ưu tiên | Hết Ngọn Lửa luôn thua, kể cả tick bình minh | unit AC-W6 |
| AC-SC1 | Điểm bình minh | Mỗi đèn sáng `+50 + floor(fuel)`; mỗi Ngọn Lửa `+50`; không thưởng thời gian | unit AC-SC1 |
| AC-SC2 | Tỏa Sáng | Trúng drain → điểm nhiều hơn trúng thường (xem giả định B21) | unit AC-SC2; scenario **36** |
| AC-K1 | Sức chứa | `10 + 2 × successful_lights`, tối đa 20; đèn đặt sẵn không tính | unit AC-K1; scenario **34** |
| AC-CB | Bảng màu dễ phân biệt | Viền `#00B3FF`, cảnh báo `#FFFFFF` + ⚠, đèn tắt xẹp 20% + vết rách, nhấp nháy fuel < 30 | web (ảnh) |
| AC-CONTRACT | Contract v1.2 | Đủ trường mới, snapshot/event đúng v1.2 | `tests/headless.test.js` |

## 3. Giả định (chỗ ticket chưa quy định)

| # | Giả định | Lý do |
|---|---|---|
| B17 | Khi Mây ở trong 12 m, Bóng Mực **chase** ưu tiên hơn đi hút đèn (dù đèn yếu) | Ticket-03 ghi "Chỉ Bóng Mực ở trạng thái wander mới chọn đèn yếu"; suy ra chase không đổi mục tiêu |
| B18 | Đèn scenario `lit: true` mà **không ghi** `ever_lit` thì coi là đã từng sáng; ghi rõ `ever_lit: false` thì tôn trọng | Đèn đang sáng thì đã sáng rồi |
| B19 | `drain` **gây sát thương** khi Mây chạm (cùng vị trí, `shade_hit_radius`), không như vùng an toàn | Nếu không, "đứng sát đèn đang bị hút" là chỗ lách an toàn; Bóng Mực vẫn là kẻ địch |
| B20 | `deposited` vẫn là **tiến độ thắp** như Ticket-02: đèn tắt nạp dần `min(đang mang, còn thiếu)` tới 10 (hoặc 5 nếu `ever_lit`); khi thắp giữ nguyên giá trị; **về 0 khi hết dầu**. Châm dầu không đổi `deposited` | Ticket-03 chỉ thay chi phí thắp và thêm "hết dầu thì deposited = 0" — câu đó chỉ có nghĩa nếu deposited vẫn là tiến độ |
| B21 | Tỏa Sáng trúng Bóng Mực đang drain = **tổng +15** (`per_stun` 5 + `per_stun_bonus` 10) | Nguyên văn ticket: "tổng +15 nếu ngay trước đó nó đang drain" (sửa khi review; bản đầu để 25 → +30) |
| B22 | ~~Tick đầu không hao dầu~~ → **bỏ khi review**: bước 2 trừ dầu ở **mọi** tick kể cả tick 1 (đèn 1.0 dầu tắt ở tick 60) | Ticket-03 mục 3: "ở bước 2 trừ dầu"; Phase 2 cũng giảm mọi bộ đếm từ tick 1 |
| B23 | Dầu lưu theo **đơn vị nguyên 1/60** (`fuel100`); chuyển đổi chỉ khi đọc/ghi snapshot và event | Ticket-03 ghi rõ "nên tính dầu theo đơn vị nguyên 1/60" |
| B24 | `scenario.lanterns` **cập nhật theo id** như contract mục D v1.0 (đèn không nhắc tới giữ nguyên) | Ticket-03 không đổi luật này; bản đầu đổi sang "thay thế danh sách" sẽ làm test ẩn P1–P2 trượt — sửa khi review |
| B25 | `successful_lights` chỉ tăng khi **thắp hoặc thắp lại thành công**, không tăng khi châm dầu | Ticket-03 ghi "(tính cả thắp lại; đèn đặt sẵn không tính)" — châm dầu không phải "thắp" |
| B26 | "Đèn đặt sẵn bằng scenario" bao gồm đèn có `lit: true` hoặc `ever_lit: true` trong scenario — **không** tăng `successful_lights` | Câu "đèn đặt sẵn bằng scenario không tính" |
| B27 | "Cách đèn > 2 m" khi drain đo **XZ tới tâm đèn** (không dùng 3D) | Trùng với cách Phase 2 đô vùng an toàn (XZ) |
| B28 | Khi châm dầu làm đèn vượt mốc 30 trong tick, mọi Bóng Mực trong vùng 6 m bị đẩy ra **ngay tick đó** (30 tick evict như đèn vừa thắp) | Ticket-03 ghi "giống khi đèn vừa thắp" |
| B29 | `lantern_out` phát **cùng tick** mà `fuel ≤ 0` (đầu bước 2), trước khi tương tác đèn / Bóng Mực di chuyển | Ticket-03: "ngay sau bước 2, đèn có fuel ≤ 0 tắt" |
| B30 | Nạp dần vẫn được (Ticket-02 "đèn nhớ tiến độ" không bị Ticket-03 đánh dấu [THAY THẾ]); mỗi lần nạp phát `deposit {lantern_id, amount, deposited}` | Sửa khi review; bản đầu bỏ nạp dần và sự kiện `deposit` |
| B31 | `?lit=k` của web đặt `lit = true`, `ever_lit = true`, `fuel100 = 6000`, **không** tăng `successful_lights` | Đèn thắp sẵn bằng URL không tính |

## 4. Đánh giá Phase 3

- **Đạt (có bằng chứng):**
  - Contract v1.2 đúng số liệu.
  - Mô hình dầu nguyên 1/60, hao 1/60/tick, hút 5/60/tick, `lantern_out`.
  - Luật thắng mới (`dawn_survived`, ngưỡng 3/5 4/6 5/7), bỏ `all_lit`.
  - Sức chứa tăng dần, điểm mới, bỏ thưởng thời gian.
  - Chế độ mù màu (web) + HUD "mang/sức chứa", nhắc châm dầu.
  - **87 test đạt** (unit + 37 scenario + tất định + hiệu năng + contract).
  - Tất định cả 3 Đêm (sha256 giống hệt).
  - Headless ~0.2–0.4 s mỗi Đêm (ngưỡng 30 s).
- **Regression Phase 1–2:** 9 scenario cũ sửa theo luật mới; không test nào bị skip.
- **Kiểm tra test không "luôn đạt":** đổi `drain_per_s` từ 5 → 4, 3 test đỏ (contract, AC-DR1, AC-DR2). Đã khôi phục.
- **Lỗi thật tìm được nhờ test/soát tay:**
  - **Dầu bị trừ 2 lần** ở tick đầu: `applyFuelStep` bị gọi 2 lần trong một tick + đặt trước bộ đếm. Sửa: gọi 1 lần sau bộ đếm, tick 1 dùng cờ "first".
  - **Hao/sai 60 lần:** `Math.round(T.fuel_decay_per_s * STD.fuelUnit)` = 60 đơn vị/tick (1 dầu/tick, sai 60×). Sửa công thức chia `TICK_RATE`.
  - **KeepOutOfSafe chặn đèn yếu:** `keepOutOfSafe`/`insideSafe` không bỏ qua đèn fuel < 30 → Bóng Mực dừng ở 6 m, không bao giờ drain. Sửa + thêm test AC-DR3.
  - **Scenario `lanterns` không thay thế:** code cũ duyệt `s.lanterns.find(...)` nên chỉ vá id tồn tại; scenario `lanterns: []` vẫn có 5 đèn mặc định. Sửa init thành array mới.
  - **Lệch 1 tick ở scenario 03:** `wander → chase` đặt trong nhánh `wander` khiến Bóng Mực di chuyển trước tick kế → hit 137 thay vì 136. Sửa: chuyển transition lên đầu vòng lặp bước 8.
  - **Test sai tự viết:**
    - AC-F2 ban đầu kỳ vọng `amount: 8`/`fuel: 80`; sau khi tick 1 không hao, `used = ceil((100−20)/10) = 8`, `fuel = 100`. Giữ 8; sửa comment sai trước đó.
    - Scenario `02-win-all-lit`/`24`/`25` lúc đầu phụ thuộc đèn mặc định; khi `scenario.lanterns` thay thế, phải khai báo đủ — sửa `scenario.json`.
    - `31` ban đầu shade ở (10,1,5) không tới đèn được trong 3 tick; sửa `ticks: 60`.
- **Chưa đạt / hạn chế:**
  - **`per_stun_bonus` đang 25 thay vì 10** → trúng drain = +30 thay vì +15 (đang hiểu lệch câu "tổng +15"). Xem ADR-0001 mục 10(a). Đây là **lỗi cấu hình**, không phải lỗi logic; sửa 1 số + 1 scenario (36) + unit AC-DR4.
  - **Bot Phase 2 thua Đêm 2–3 dưới luật mới** (0/3 mỗi Đêm), thắng Đêm 1 3/3. Bot chỉ biết "đi tới đèn chưa sáng", chưa có logic "theo dõi vòng hao dầu, thắp trước 1 đèn yếu, chạy sang đèn kế". Đây là giới hạn của bot, ghi trung thực trong `results.md` mục 3.
  - Chế độ mù màu mới kiểm tra qua cài đặt + ảnh chụp, chưa có test tự động (web-only, không ảnh hưởng headless).
  - Giả định B21 (bonus Tỏa Sáng), B19 (drain gây sát thương), B24 (lanterns thay thế) chưa được xác nhận với trợ giảng.
- **Harness:**
  - `CLAUDE.md` cập nhật (mục lục, dầu đơn vị 1/60, thứ tự tick, cách sửa test cũ).
  - Skill `verify-phase` thêm bước kiểm 11 scenario mới.

## 5. Review sau bản đầu (agent thứ hai đối chiếu với nguyên văn Ticket-03)

Bản đầu Phase 3 do một agent khác làm (87 test đạt). Khi review, đối chiếu từng câu với `docs/lab/ticket-03.md` và contract mục D thì tìm ra **6 lỗi**. Tất cả đã sửa và có test canh:

| # | Lỗi | Vì sao sai | Sửa + test canh |
|---|---|---|---|
| R1 | `scenario.lanterns` thay thế danh sách mặc định | Contract mục D: cập nhật theo id; Ticket-03 không đổi. Test ẩn P1–P2 kiểu `{"lanterns":[{"id":"L1",...}]}` sẽ thấy 1 đèn thay vì 5 | Trả về cập nhật theo id; scenario **38** + unit AC-K1 |
| R2 | Bỏ nạp dần và sự kiện `deposit` khi thắp (đổi thành `refuel`) | Ticket-02 "nạp nhiều lần, đèn nhớ tiến độ" không bị đánh dấu [THAY THẾ]; test ẩn P1–P2 chờ `deposit` | Khôi phục; scenario 01, 26, 29, 38; unit AC-L1 |
| R3 | Không hao dầu ở tick 1 (cờ `first`) | "Ở bước 2 trừ dầu" áp dụng cho mọi tick. Mọi mốc hết dầu bị trễ 1 tick | Bỏ cờ; scenario 27 (used 9), 28 (`lantern_out` @60); unit AC-F1, AC-F2 |
| R4 | Thưởng drain +30 (`per_stun_bonus` 25) | Ticket ghi "tổng +15" | `per_stun_bonus` 10; scenario 36 (=15), AC-DR4 kiểm **đúng 15** (bản đầu kiểm "≥ 20") |
| R5 | Snapshot `fuel` 3 chữ số; sự kiện `refuel`/`fuel_drain` xuất số chưa làm tròn | Contract v1.2: "1 chữ số thập phân" | Dùng chung `fuelOut()` |
| R6 | `process.env.DBG_LOW` còn trong `isLowFuel` | Trình duyệt không có `process` nên web ném lỗi | Xóa; không còn `process`/`console` trong `src/core` |

**Test bị nới lỏng đã siết lại:**
- 24: khôi phục giá trị chính xác.
- 02 và 25: thêm lại điểm tính tay 1046.
- 35: bản đầu đặt Bóng Mực cách 10 m nên không bao giờ chạm mép, test luôn đạt. Viết lại để kiểm đúng mốc fuel = 30.
- AC-F3: bản đầu đặt đèn ở xa người chơi nên không kiểm gì.

**Mutation sau review:**
- `fuel_decay_per_s` 1 → 2: 9 test đỏ.
- `relight_cost` 5 → 6: 3 test đỏ.
- `per_fuel_left` 1 → 2: 1 test đỏ.
- `per_stun_bonus` 10 → 25: 3 test đỏ.

**Bằng chứng web bổ sung:** `img/n1-low.png` (3 đèn dầu 20, HUD "Đèn 3/5 (cần 3)", "0 / 10"), `img/n1-low-cb.png` và `img/n1-off-cb.png` (chế độ dễ phân biệt). Ảnh chụp ở góc xa nên chưa thấy rõ thanh dầu nhấp nháy và viền #00B3FF; hai phần này sẽ được cho thấy trong video.
