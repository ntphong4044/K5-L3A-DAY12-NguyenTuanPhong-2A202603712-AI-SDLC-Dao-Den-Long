# Nhật ký dùng AI

Công cụ: **Claude Code** (model Claude Opus), chạy trong repo. Harness: `CLAUDE.md`, hook Stop (`scripts/hooks/stop-gate.js`), skill `.claude/skills/verify-phase`, CI `.github/workflows/ci.yml`.

## Phase 1

| Bước | Lời nhắc chính / việc giao cho AI | Ghi chú |
|---|---|---|
| Đọc yêu cầu | "đọc các file md và trang web đảo đèn lồng rồi phân tích những việc tôi phải làm" | AI đọc 6 file lab + lab board, tóm tắt việc phải làm và các điểm bắt buộc của contract |
| Build | "làm giúp tôi phase 1 theo chuẩn các yêu cầu" | AI chọn stack Node + Three.js. Lý do: không cần build, chạy trên macOS/Linux, dễ giữ tính tất định. AI viết lõi `sim.js`, CLI headless, test, web, tài liệu |
| Kiểm chứng | AI viết scenario với số tick tính tay **trước khi chạy** (ví dụ shade cách 10 m, tốc độ 3.5 m/s, bán kính chạm 1 m nên chạm ở tick 155) | Cả 8 scenario đều khớp số tính tay |
| Chống test giả | Mutation thủ công: đổi `shade_speed` thì test đỏ | Xác nhận test không "luôn đạt" |
| Ảnh | Chrome headless chụp bản web thật | Ảnh đầu tối quá, nên tăng ánh sáng nền |

### Lỗi / điểm AI cần sửa trong phase này
- Lệnh chụp ảnh đầu tiên không ra file vì Chrome dùng chung profile với trình duyệt đang mở. Sửa bằng `--user-data-dir` riêng, đã ghi vào skill.
- Vòng lặp bash dùng `"$P\\$n.png"` nên `$n` không được thay thế, làm 2 ảnh ghi đè lên nhau. AI phát hiện khi `ls` thấy tên file lạ, rồi chạy lại.
- Ảnh đầu cho thấy cảnh quá tối, khó nhìn thấy đường. Đã tăng ánh sáng hemisphere và đèn trên nón.
- Lưu ý cho phase sau: test đơn vị đọc số từ contract nên **không** bắt được việc khai sai contract. Chỉ scenario với số cứng mới bắt được. Phải giữ cả hai loại test.

### Token / chi phí (số thật từ `/cost`)
- Chi phí ước tính của session: **$4.18**
- Thời gian: API 13m 51s, tổng (wall) 43m 19s
- Thay đổi code: +1610 dòng, −1 dòng
- Token theo model:

| Model | Input | Output | Cache read | Cache write | Chi phí |
|---|---|---|---|---|---|
| claude-opus-5-5 | 102 | 89.1k | 6.0M | 149.4k | $4.18 |
| claude-haiku-5-5 | 7.9k | 4.6k | 0 | 0 | $0.0031 |

- Prompt cache: 47 request, 98% token đầu vào lấy từ cache. Phần lớn chi phí nằm ở output của Opus và việc ghi cache.
- Cách tiết kiệm:
  - Chỉ đọc lab board một lần rồi trích text ra file.
  - Viết lõi + test trong một lần, chạy test sớm.
  - Không dùng subagent.
  - Giữ `CLAUDE.md` ngắn.

## Phase 2

| Bước | Lời nhắc chính / việc giao cho AI | Ghi chú |
|---|---|---|
| Phân tích | Dán nguyên văn Ticket-02: "đã có phase 2 rồi đọc và phân tích yêu cầu" | AI lập bảng so sánh Phase 1 với Phase 2, 9 chỗ mơ hồ, kế hoạch 60 phút theo mức ưu tiên |
| Build | "ok rồi, bạn làm giúp tôi theo bảng phân tích trên" | AI lưu ticket vào `docs/lab/ticket-02.md` làm nguồn spec, rồi viết lại `sim.js` theo 12 bước, thêm `maps.js`, contract v1.1 |
| Kiểm chứng | 26 scenario với số tick **tính tay trước** (ví dụ chạm ở tick 136 và 226, rơi ở tick 64, cướp ở tick 33) | 25/25 khớp ngay lần chạy đầu |
| Chống test giả | Đổi `pulse_radius` từ 5 thành 4 thì 3 test đỏ | Đã khôi phục |
| Bot | Bot có tìm đường để chứng minh "chơi được" | Lần đầu bot thua cả 9 ván, dẫn đến xem lại giả định `wander` |
| FPS | Chrome thật + GPU qua DevTools Protocol (WebSocket có sẵn của Node), không cần thêm thư viện | Lần đầu đo viewport 1262×624, sai kích thước; sửa bằng `Emulation.setDeviceMetricsOverride` |

### Lỗi / điểm AI cần sửa trong phase này
- **Giả định `wander` trôi về phía Mây** làm mọi Bóng Mực dồn lại, bot thua 9/9 ván. Phát hiện nhờ số liệu bot (số lần bị chạm, lúc thua), không phải nhờ test. Đổi thành lượn vòng tại chỗ (giả định B3).
- **Lỗi lệch 1 tick của `recoil`:** chỉ lùi 59/60 lần vì bộ đếm giảm ở bước 2 trước khi di chuyển. AI tự rà lại trước khi chạy test, chuyển việc đếm recoil sang bước 8.
- **Lỗi "đáp đất từ dưới lên":** unit test AC-W1 lộ ra rằng Mây ở y = −10 bị kéo lên y = 0. Đã sửa trong `movePlayer`, thêm test AC-W2.
- **Test sai, không phải code sai:** AC-S1 (Bóng Mực bay theo địa hình nên không thể ở "dưới" tầng 1) và AC-P2 (đếm TTL lệch 1, Bóng Mực đánh lần hai). Sửa test sau khi đọc lại luật, **không** sửa code để chiều test.
- **Heredoc bash lỗi do dấu nháy** khi sinh scenario. Chuyển script sinh scenario ra file Python riêng.
- **Bot kẹt ở góc giữa vách tầng 1 và dốc.** AI kiểm tra trước xem có phải lỗi va chạm của lõi không (r = 24.017 nên mặt đất đúng là 0), rồi mới sửa bot.

### Token / chi phí
- *Ghi số thật từ `/cost` sau khi kết thúc phase (cùng session với Phase 1 nên lấy hiệu số).*
- Cách tiết kiệm:
  - Lưu ticket vào repo một lần.
  - Sinh scenario bằng script thay vì viết tay từng file.
  - Chạy test trước khi đọc lại code.
  - Đo FPS bằng CDP thay vì cài Puppeteer.
