---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (unit, scenario headless, tất định, bot chơi trọn màn, ảnh chụp) và lưu bằng chứng vào docs/proof. Dùng sau mỗi thay đổi luật chơi và trước khi gắn tag phase.
---

# Kiểm chứng một phase

1. `npm test` — phải 0 fail. Nếu fail: đọc assertion, sửa CODE (không sửa kỳ vọng) trừ khi ticket đổi luật; khi đổi kỳ vọng phải ghi lý do trong `docs/notes/phase-N.md`.
2. `npm run proof` — sinh `docs/proof/phase-N/results.md` và `runs/*.jsonl`. Thoát mã 1 = có mục chưa đạt; ghi trung thực, không sửa tay output.
3. Ảnh hiển thị (khi đổi phần web): chạy `npm start` ở nền, rồi
   `chrome --headless=new --user-data-dir=<tmp> --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=<docs/proof/phase-N/img/x.png> "http://localhost:5173/?autostart&lit=3"`
   (`?lit=N` chỉ dùng để chụp ảnh, không ảnh hưởng headless).
4. Cập nhật bảng truy vết `docs/proof/phase-N/README.md`: yêu cầu -> cách kiểm chứng -> bằng chứng -> kết quả.
5. Scenario mới: thêm thư mục `tests/scenarios/NN-ten/` gồm `case.json` (seed, ticks, requirement, expect), `scenario.json`, `inputs.json`. Tính tay số tick kỳ vọng từ tuning trước khi chạy.
