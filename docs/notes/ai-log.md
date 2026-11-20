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

### Token / chi phí (ước tính)
- Phase 1: khoảng 150k token đầu vào (phần lớn là đọc tài liệu lab và lab board) và khoảng 45k token đầu ra (code + tài liệu). *Ước tính thủ công. Hãy thay bằng số thật từ `/cost` hoặc trang usage nếu có.*
- Cách tiết kiệm:
  - Chỉ đọc lab board một lần rồi trích text ra file.
  - Viết lõi + test trong một lần, chạy test sớm.
  - Không dùng subagent.
  - Giữ `CLAUDE.md` ngắn.
