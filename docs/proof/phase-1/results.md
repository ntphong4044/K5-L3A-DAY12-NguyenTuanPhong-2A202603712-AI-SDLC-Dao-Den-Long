# Kết quả kiểm chứng Phase 1 (tự sinh bởi `npm run proof`)

- Commit: `fe5f278` · Node v24.16.0 · win32 x64 · AMD Ryzen 5 5600H with Radeon Graphics         
- Mọi lần chạy dùng đúng lệnh `headless_cmd` trong `game.contract.json` (tiến trình con thật). File output nằm trong `runs/`.

## 1. Scenario headless

| Scenario | Yêu cầu | Kỳ vọng | Kết quả |
|---|---|---|---|
| `01-pickup-deposit-light` | R3 nhặt đom đóm, R4 nạp và thắp đèn, R7 điểm | ✅ event mote_picked @10 {"carried":1}<br>✅ event mote_picked @30 {"carried":2}<br>✅ event mote_picked @50 {"carried":3}<br>✅ event deposit @91 {"lantern_id":"L1","amount":3,"deposited":3}<br>✅ event lantern_lit @91 {"lantern_id":"L1"}<br>✅ snapshot@100 lanterns.0.lit == true<br>✅ end {"state":"playing","score":130,"ticks":120} | **ĐẠT** |
| `02-win-all-lit` | R6 thắng khi thắp hết đèn, R7 điểm thưởng | ✅ event lantern_lit @1 {"lantern_id":"L5"}<br>✅ event game_over @1 {"result":"won","reason":"all_lit"}<br>✅ end {"state":"won","ticks":1,"score":349} | **ĐẠT** |
| `03-shade-hit-lose` | R5 Bóng Mực đuổi và gây mất máu, R6 thua khi hết máu | ✅ event player_hit @155 {"by":"shade","flames":1,"dropped":2}<br>✅ event player_hit @245 {"by":"shade","flames":0,"dropped":1}<br>✅ event game_over @245 {"result":"lost","reason":"no_flames"}<br>✅ end {"state":"lost","ticks":245} | **ĐẠT** |
| `04-pulse-stun` | R5b tỏa sáng xua Bóng Mực, tốn ánh sáng | ✅ event pulse @1 {"stunned_ids":["S1"]}<br>✅ snapshot@10 shades.0.state == "stunned"<br>✅ snapshot@10 shades.0.pos.0 == 9<br>✅ snapshot@10 player.carried == 0<br>✅ snapshot@190 shades.0.state == "chase"<br>✅ không có event player_hit<br>✅ end {"state":"playing","score":20} | **ĐẠT** |
| `05-safe-zone` | R5c Bóng Mực sợ đèn (safe_radius quanh đèn đã thắp) | ✅ không có event player_hit<br>✅ snapshot@1200 shades.0.pos.0 == 5.01<br>✅ end {"state":"playing","ticks":1200} | **ĐẠT** |
| `06-dawn` | R6 thua khi hết đêm (dawn) | ✅ snapshot@60 time_left_s == 1<br>✅ event game_over @120 {"result":"lost","reason":"dawn"}<br>✅ end {"state":"lost","ticks":120,"score":0} | **ĐẠT** |
| `07-default-night` | R1 màn Đêm 1 mặc định: 5 đèn, đom đóm rải rác, Bóng Mực xuất hiện | ✅ snapshot@0 motes_active == 30<br>✅ snapshot@0 lanterns.length == 5<br>✅ snapshot@0 time_left_s == 300<br>✅ snapshot@0 player.flames == 3<br>✅ event shade_spawned @300 {"id":"S1"}<br>✅ end {"state":"playing","ticks":600} | **ĐẠT** |
| `08-capacity` | R3b giới hạn carry_capacity | ✅ không có event mote_picked<br>✅ snapshot@30 motes_active == 2<br>✅ snapshot@30 player.carried == 5 | **ĐẠT** |

## 2. Tính tất định (chạy 2 lần, so từng byte)

Lệnh: `node src/headless.js --seed 2024 --night 1 --inputs tests/fixtures/long-inputs.json --ticks 6000 --out <f>`

- run1 sha256: `3c5e1e7c97ab55b6`
- run2 sha256: `3c5e1e7c97ab55b6`
- **ĐẠT: giống hệt**

## 3. Chơi trọn Đêm 1 mặc định (bot tham lam, phát lại qua headless)

| Seed | Kết quả bot (lõi) | Phát lại qua headless | Khớp |
|---|---|---|---|
| 1 | won (all_lit), điểm 1082, 1668 tick | won, điểm 1082, 1668 tick · 5 đèn, 16 đom đóm, 0 pulse, 0 lần bị chạm | ✅ |
| 7 | won (all_lit), điểm 1084, 1559 tick | won, điểm 1084, 1559 tick · 5 đèn, 16 đom đóm, 0 pulse, 0 lần bị chạm | ✅ |
| 42 | won (all_lit), điểm 1092, 1649 tick | won, điểm 1092, 1649 tick · 5 đèn, 17 đom đóm, 0 pulse, 0 lần bị chạm | ✅ |

## Tổng kết: **TẤT CẢ ĐẠT**
