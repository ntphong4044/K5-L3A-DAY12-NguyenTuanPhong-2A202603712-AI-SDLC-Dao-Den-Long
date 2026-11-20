---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (unit, scenario headless, tất định, bot chơi trọn màn, ảnh chụp) và lưu bằng chứng vào docs/proof. Dùng sau mỗi thay đổi luật chơi và trước khi gắn tag phase.
---

# Kiểm chứng một phase

1. `npm test` — phải 0 fail. Nếu fail: đọc assertion, sửa CODE (không sửa kỳ vọng) trừ khi ticket đổi luật; khi đổi kỳ vọng phải ghi lý do trong `docs/notes/phase-N.md`.
2. `npm run proof -- --phase N` — sinh `docs/proof/phase-N/results.md` (scenario, tất định + thời gian 21.600 tick cho 3 Đêm, bot chơi trọn Đêm). Thoát mã 1 = có mục chưa đạt; ghi trung thực, không sửa tay output.
2b. FPS (khi đổi phần web): `npm start` ở nền rồi `npm run fps` (Chrome + GPU qua DevTools, viewport ép 1280×720) -> `docs/proof/phase-N/fps.md`.
3. Ảnh hiển thị (khi đổi phần web): chạy `npm start` ở nền, rồi
   `chrome --headless=new --user-data-dir=<tmp> --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=<docs/proof/phase-N/img/x.png> "http://localhost:5173/?autostart&lit=3"`
   (`?autostart=N` vào thẳng Đêm N, `?demo=N` cho bot chơi, `?lit=k` thắp sẵn k đèn — chỉ phía web, không ảnh hưởng headless).
4. Cập nhật bảng truy vết `docs/proof/phase-N/README.md`: yêu cầu -> cách kiểm chứng -> bằng chứng -> kết quả.
5. Scenario mới: thêm thư mục `tests/scenarios/NN-ten/` gồm `case.json` (night, seed, ticks, requirement, note, expect), `scenario.json`, `inputs.json`. Tính tay số tick kỳ vọng trước khi chạy. Kiểu kỳ vọng: `event`, `no_event`, `count`, `snapshot`+`equals`/`between`, `dist_xz`, `end` (xem `tests/lib/scenarios.js`). **Lưu ý v1.2:** `scenario.lanterns` thay thế danh sách đèn mặc định → phải khai báo đủ đèn của Đêm (đèn tắt khai báo `{ "id": "Lx" }`), nếu không `winThreshold` sẽ tính sai tổng đèn.
6. Mutation nhanh: đổi một số trong `game.contract.json`, `npm test` phải đỏ; khôi phục bằng `git checkout -- game.contract.json` **chỉ khi thay đổi là tạm thời**. Nếu đó là thay đổi thật của phase, dùng `git stash` trước và `git stash pop` sau — không `git checkout` file đang sửa dở.
7. Phase 3: kiểm 11 scenario mới `27…37` (refuel, lantern_out, relight, drain, low-fuel, dawn_survived, dawn-too-few, capacity, safe-zone-30, pulse-drain, refuel-evict). Lỗi cấu hình đã biết: `score.per_stun_bonus` đang 25 (ghi +30 thay vì +15); sửa 25→10 và test 36/AC-DR4 nếu trợ giảng xác nhận "tổng +15".
