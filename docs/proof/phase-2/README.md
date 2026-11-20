# Bằng chứng Phase 2: bảng truy vết

Chạy lại: `npm test` → `npm run proof` (sinh [results.md](results.md) và `runs/`) → `npm start` + `npm run fps` (sinh [fps.md](fps.md)).
Yêu cầu, tiêu chí nghiệm thu và giả định: [docs/notes/phase-2.md](../../notes/phase-2.md).

| Yêu cầu Ticket-02 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Số chuẩn (Phần 1) | Unit so `game.contract.json` với ticket; scenario dùng số cứng | unit "Số chuẩn"; scenario 01–08 | Đạt |
| Thứ tự 12 bước / thắng-thua | Scenario đặt các sự kiện cùng tick | 24 (đẩy khỏi vùng an toàn trước khi chạm), 25 (all_lit thắng đúng tick hết giờ); unit AC-W1 | Đạt |
| Regression Phase 1 | 8 scenario cũ sửa theo số chuẩn (lý do trong `changed_in_phase2`) | 01–08 | Đạt |
| Đêm 1 chuẩn hóa | Tọa độ đèn, 20 đom đóm, lịch Bóng Mực | 07, 22, 23; unit AC-N1 | Đạt |
| Đêm 2: cầu, bục nhảy | Đáp đảo B; rơi khỏi cầu | 16, 17 | Đạt |
| Đêm 3: vách, dốc, bục, gió | Bị chặn ở r = 12; lên dốc tới Y = 3; bục lên Y = 6; gió đẩy 10 m | 18, 19, 20, 21, 26 | Đạt |
| Lướt | 2.8 m, cooldown 90 tick, hướng mặt, giữ độ cao | 09; unit AC-M4 | Đạt |
| Rơi khỏi đảo + hồi sinh | tick 64 tính tay; hồi sinh ở (0,0,0), bất tử | 10 | Đạt |
| Tạm dừng | tick ≠ sim_tick, state paused | 11 | Đạt |
| Gió Lạc | cướp ở tick 33 (tính tay), flee → removed, pulse thả đồ / đuổi đi | 12, 13, 14; unit AC-D1, AC-D2 | Đạt |
| Bùa Gió | 7.2 m/s, lướt không hồi chiêu, respawn 2700 | 15; unit AC-C1, AC-C2 | Đạt |
| Bóng Mực: 5 trạng thái, recoil, phát hiện 12/18 | tick 136 / 226 tính tay | 03, 04, 23; unit AC-S1..S3 | Đạt |
| Đom đóm rơi (TTL 480, nhặt từ tick sau) | | 03; unit AC-P2 | Đạt |
| Contract v1.1: trường snapshot, scenario, input, event mới, tên trạng thái | Test định dạng + exit 2 khi trạng thái sai | `tests/headless.test.js` | Đạt |
| Tất định (3 Đêm) | sha256 hai lần chạy 21.600 tick | results.md mục 2 | Đạt |
| Headless ≤ 30 s / Đêm | Đo thời gian thật | results.md mục 2 (khoảng 0.11 s) | Đạt |
| Chơi được từng Đêm | Bot tìm đường chơi trọn, phát lại inputs qua headless | results.md mục 3 | Đêm 1: 3/3 thắng; Đêm 2: 1/3; **Đêm 3: 0/3** (giới hạn của bot, xem notes) |
| Web ≥ 30 FPS @1280×720 | `scripts/fps-bench.js`: Chrome + GPU thật, bot tự chơi 22 s mỗi Đêm | [fps.md](fps.md) (khoảng 140 FPS) | Đạt |
| Chuỗi 3 Đêm, menu, kết quả, Bình Minh | Ảnh + thao tác tay | [img/menu.png](img/menu.png) | Ảnh menu: đạt. Luồng đầy đủ: kiểm tra tay, sẽ quay video |
| HUD đầy đủ, mũi tên, bảng màu, ambient | Ảnh bản web thật | [img/n2.png](img/n2.png), [img/n3-lit.png](img/n3-lit.png), [img/n1.png](img/n1.png), [img/n3.png](img/n3.png) | Đạt (nhìn ảnh) |
| Tạm dừng web, Cài đặt lưu, Âm thanh | Thao tác tay | `web/main.js`, `web/audio.js` | Chưa có bằng chứng tự động; sẽ cho thấy trong video |

Ảnh được chụp bằng Chrome headless từ bản web thật. `?demo=N` cho bot chơi; `?autostart=N&lit=k` thắp sẵn k đèn **chỉ ở phía web** để chụp ảnh.
