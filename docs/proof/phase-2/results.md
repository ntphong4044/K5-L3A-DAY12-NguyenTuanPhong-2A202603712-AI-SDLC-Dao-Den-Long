# Kết quả kiểm chứng Phase 2 (tự sinh bởi `npm run proof`)

- Contract v1.1 · Commit: `dd3acb9` · Node v24.16.0 · win32 x64 · AMD Ryzen 5 5600H with Radeon Graphics
- Mọi lần chạy dùng đúng lệnh `headless_cmd` (tiến trình con thật). Output nằm trong `runs/` (bỏ qua các file lớn).

## 1. Scenario headless

| Scenario | Đêm | Yêu cầu | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| `01-pickup-deposit-light` | 1 | R3 nhặt, R4 nạp & thắp, +10 mỗi đom đóm NẠP<br>*Đổi ở Phase 2: lantern_cost 3->10, carry 5->10; per_mote tính khi NẠP (10x10+100=200) thay vì khi nhặt* | ✅ event night_start @1 {"night":1}<br>✅ event mote_picked @10 {"carried":8}<br>✅ event mote_picked @30 {"carried":9}<br>✅ event mote_picked @50 {"carried":10}<br>✅ event deposit @91 {"lantern_id":"L1","amount":10,"deposited":10}<br>✅ event lantern_lit @91 {"lantern_id":"L1"}<br>✅ snapshot@100 lanterns.0.lit == true<br>✅ end {"state":"playing","score":200,"ticks":120} | **ĐẠT** |
| `02-win-all-lit` | 1 | R6 thắng khi thắp hết; thưởng x2/giây<br>*Đổi ở Phase 2: per_second_left 1->2, per_mote khi nạp, lantern_cost 10* | ✅ event game_over @1 {"result":"won","reason":"all_lit"}<br>✅ end {"state":"won","ticks":1,"score":548} | **ĐẠT** |
| `03-shade-hit-recoil-lose` | 1 | R5 chạm mất lửa, rơi đom đóm ra đất, recoil 2 m/60 tick, bất tử 90; thua no_flames<br>*Đổi ở Phase 2: shade_speed 3.5->4, thêm recoil, đom đóm rơi ra đất thay vì mất* | ✅ event player_hit @136 {"by":"shade","flames":1,"dropped":2}<br>✅ snapshot@140 shades.0.state == "recoil"<br>✅ snapshot@140 motes_active == 2<br>✅ snapshot@140 motes.0.kind == "dropped"<br>✅ event player_hit @226 {"by":"shade","flames":0,"dropped":1}<br>✅ event game_over @226 {"result":"lost","reason":"no_flames"}<br>✅ end {"state":"lost","ticks":226} | **ĐẠT** |
| `04-pulse-stun-push` | 1 | Tỏa Sáng: 3 đom đóm, 3D <= 5 m từ chân+0.8, choáng 120 tick, đẩy 4 m trong 15 tick, +5<br>*Đổi ở Phase 2: pulse_cost 1->3, radius 6->5 (3D), stun 3s->120 tick, đẩy dần 15 tick, per_stun 20->5, cooldown 3 s* | ✅ event pulse @1 {"stunned_ids":["S1"]}<br>✅ snapshot@10 shades.0.pos.0 == 6.667<br>✅ snapshot@10 player.carried == 0<br>✅ snapshot@20 shades.0.pos.0 == 8<br>✅ snapshot@120 shades.0.state == "stunned"<br>✅ snapshot@130 shades.0.state == "chase"<br>✅ snapshot@10 player.pulse_cd_s == 2.85<br>✅ không có event player_hit<br>✅ end {"state":"playing","score":5} | **ĐẠT** |
| `05-safe-zone-block` | 1 | Vùng an toàn 6 m quanh đèn đã sáng chặn Bóng Mực ở mép<br>*Đổi ở Phase 2: safe_radius 5->6* | ✅ không có event player_hit<br>✅ snapshot@1200 shades.0.pos.0 == 6.001<br>✅ end {"state":"playing","ticks":1200} | **ĐẠT** |
| `06-dawn` | 1 | Hết giờ -> thua dawn | ✅ snapshot@60 time_left_s == 1<br>✅ event game_over @120 {"result":"lost","reason":"dawn"}<br>✅ end {"state":"lost","ticks":120,"score":0} | **ĐẠT** |
| `07-default-night1` | 1 | Đêm 1 chuẩn: đèn đúng tọa độ, 20 đom đóm, 2 Bóng Mực ở tick 300 rồi mỗi 480<br>*Đổi ở Phase 2: bản đồ chuẩn, 20 đom đóm, lịch sinh mới* | ✅ snapshot@0 motes_active == 20<br>✅ snapshot@0 lanterns.1.pos == [23.8,0,7.7]<br>✅ snapshot@0 time_left_s == 300<br>✅ snapshot@0 player.flames == 3<br>✅ event shade_spawned @300 {"id":"S1"}<br>✅ event shade_spawned @300 {"id":"S2"}<br>✅ event shade_spawned @780 {"id":"S3"}<br>✅ snapshot@240 motes_active == 21<br>✅ snapshot@360 shades.0.state == "wander" | **ĐẠT** |
| `08-capacity` | 1 | Sức chứa 10<br>*Đổi ở Phase 2: carry 5->10* | ✅ không có event mote_picked<br>✅ snapshot@30 motes_active == 2<br>✅ snapshot@30 player.carried == 10 | **ĐẠT** |
| `09-dash` | 1 | Lướt 14 m/s x 12 tick, hồi 90 tick từ lúc bắt đầu, đứng yên thì theo hướng mặt | ✅ event dash @1 {}<br>✅ event dash @101 {}<br>✅ số event dash == 2<br>✅ snapshot@20 player.pos.2 == 2.8<br>✅ snapshot@20 player.dash_cd_s == 1.183<br>✅ snapshot@120 player.pos.2 == 5.6 | **ĐẠT** |
| `10-fall-respawn` | 1 | Rơi khỏi đảo (Y<-10): -1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh tại xuất phát, bất tử 90 | ✅ event player_hit @64 {"by":"fall","flames":2,"dropped":0,"lost":4}<br>✅ số event player_hit == 1<br>✅ snapshot@130 player.pos == [0,0,0]<br>✅ snapshot@130 player.invuln == true<br>✅ snapshot@130 player.carried == 0 | **ĐẠT** |
| `11-pause` | 1 | Tạm dừng: tick tăng, sim_tick/thời gian đứng yên, state paused | ✅ event paused @11 {}<br>✅ event resumed @41 {}<br>✅ snapshot@20 state == "paused"<br>✅ snapshot@20 sim_tick == 10<br>✅ snapshot@20 time_left_s == 299.833<br>✅ snapshot@20 player.pos.2 == 1<br>✅ snapshot@60 sim_tick == 30<br>✅ snapshot@60 player.pos.2 == 3<br>✅ end {"ticks":60,"state":"playing"} | **ĐẠT** |
| `12-drifter-steal` | 2 | Gió Lạc: idle->chase khi mang >=5 & <=15 m, 7 m/s, chạm 1.2 m cướp min(3,mang), flee 240 tick rồi removed | ✅ snapshot@10 drifters.0.state == "chase"<br>✅ event drifter_steal @33 {"drifter_id":"D1","amount":3,"carried":3}<br>✅ snapshot@270 drifters.0.state == "flee"<br>✅ snapshot@280 drifters.0.state == "removed"<br>✅ snapshot@280 drifters.0.stolen == 3<br>✅ không có event player_hit | **ĐẠT** |
| `13-drifter-pulse-drop` | 2 | Tỏa Sáng trúng Gió Lạc đang flee có đồ -> thả lại thành đom đóm rơi, biến mất sau 120 tick | ✅ event drifter_drop @1 {"drifter_id":"D1","amount":3}<br>✅ event pulse @1 {"stunned_ids":[]}<br>✅ snapshot@10 motes_active == 3<br>✅ snapshot@10 motes.0.kind == "dropped"<br>✅ snapshot@10 motes.0.ttl_s == 7.85<br>✅ snapshot@120 drifters.0.state == "flee"<br>✅ snapshot@130 drifters.0.state == "removed" | **ĐẠT** |
| `14-drifter-pulse-chase` | 2 | Tỏa Sáng trúng Gió Lạc đang chase -> flee không cướp | ✅ snapshot@10 drifters.0.state == "flee"<br>✅ không có event drifter_steal<br>✅ snapshot@10 drifters.0.stolen == 0 | **ĐẠT** |
| `15-charm` | 2 | Bùa Gió: nhặt như đom đóm, 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, hồi lại sau 2700 tick | ✅ event charm_picked @10 {"charm_id":"C1","charm_ticks":600}<br>✅ snapshot@40 player.pos.0 == 36.45<br>✅ snapshot@40 player.charm_s == 9.5<br>✅ snapshot@40 charms.0.available == false<br>✅ snapshot@40 charms.0.respawn_s == 44.5<br>✅ event dash @41 {}<br>✅ event dash @61 {}<br>✅ snapshot@90 player.pos.0 == 42.05 | **ĐẠT** |
| `16-n2-jump-pad` | 2 | Bục nhảy Đêm 2: bắn lên 14 m/s, 24 m/s về tâm đảo kia, đáp trong đảo B | ✅ snapshot@120 player.grounded == true<br>✅ snapshot@120 player.pos.1 == 0<br>✅ snapshot@120 player.pos.0 trong [42,98]<br>✅ snapshot@40 player.grounded == false<br>✅ không có event player_hit | **ĐẠT** |
| `17-n2-bridge-fall` | 2 | Cầu tre không lan can: bước ra khỏi cầu thì rơi | ✅ event player_hit {"by":"fall"}<br>✅ snapshot@10 player.grounded == true | **ĐẠT** |
| `18-n3-wall` | 3 | Đêm 3: mép tầng là vách đứng, không đi lên được | ✅ snapshot@60 player.pos.2 trong [11.85,12]<br>✅ snapshot@60 player.pos.1 == 0<br>✅ snapshot@60 player.grounded == true | **ĐẠT** |
| `19-n3-ramp` | 3 | Đêm 3: dốc 30° từ r=30 (Y=0) lên r=24 (Y=3) rồi lên tầng 1 | ✅ snapshot@60 player.pos.1 trong [2.4,2.6]<br>✅ snapshot@120 player.pos.1 == 3<br>✅ snapshot@120 player.grounded == true | **ĐẠT** |
| `20-n3-jump-pad` | 3 | Đêm 3: bục (0,3,13) bắn 12 m/s lên, 8 m/s về -Z, đáp tầng 2 (Y=6) | ✅ snapshot@120 player.pos.1 == 6<br>✅ snapshot@120 player.grounded == true<br>✅ snapshot@120 player.pos.2 trong [5.5,7.5] | **ĐẠT** |
| `21-n3-wind` | 3 | Gió mạnh Đêm 3: mỗi 30 s, kéo dài 5 s, đẩy 2 m/s | ✅ snapshot@1800 wind.active == true<br>✅ snapshot@2160 wind.active == false<br>✅ snapshot@1790 wind.active == false<br>✅ snapshot@2160 khoảng cách XZ player.pos tới [0,0,-30] ≈ 10 | **ĐẠT** |
| `22-mote-schedule` | 1 | Đom đóm: 20 điểm khác nhau lúc đầu, +1 mỗi 240 tick vào điểm trống, hết điểm thì bỏ lượt | ✅ snapshot@0 motes_active == 20<br>✅ snapshot@240 motes_active == 21<br>✅ snapshot@960 motes_active == 24<br>✅ snapshot@1200 motes_active == 24 | **ĐẠT** |
| `23-shade-schedule` | 1 | Bóng Mực: 2 con tick 300, rồi mỗi 480 tick, tối đa 6; spawning -> wander | ✅ event shade_spawned @300 {"id":"S2"}<br>✅ event shade_spawned @1260 {"id":"S4"}<br>✅ event shade_spawned @2220 {"id":"S6"}<br>✅ số event shade_spawned == 6<br>✅ snapshot@310 shades.0.state == "spawning"<br>✅ snapshot@360 shades.0.state == "wander" | **ĐẠT** |
| `24-safe-zone-evict` | 1 | Đèn vừa thắp: Bóng Mực bên trong bị đẩy ra mép trong 30 tick, không gây sát thương | ✅ event lantern_lit @1 {}<br>✅ không có event player_hit<br>✅ snapshot@30 shades.0.pos.0 == 1.898<br>✅ snapshot@30 shades.0.pos.2 == 5.693 | **ĐẠT** |
| `25-win-on-dawn-tick` | 1 | Thắng đúng tick hết giờ vẫn là thắng (all_lit ưu tiên hơn dawn) | ✅ event game_over @1 {"result":"won","reason":"all_lit"}<br>✅ end {"state":"won","score":350} | **ĐẠT** |
| `26-n3-pad-to-L1` | 3 | Đêm 3: lên tầng 2 bằng bục nhảy rồi thắp L1 (0,6,6) | ✅ event deposit @101 {"lantern_id":"L1","amount":10,"deposited":10}<br>✅ event lantern_lit @101 {"lantern_id":"L1"}<br>✅ snapshot@110 lanterns.0.lit == true | **ĐẠT** |

## 2. Tính tất định và hiệu năng (một Đêm đầy đủ 21.600 tick)

| Đêm | sha256 lần 1 | sha256 lần 2 | Giống hệt | Thời gian chạy | <= 30 s |
|---|---|---|---|---|---|
| 1 | `2e421dd4609ecadc` | `2e421dd4609ecadc` | ✅ | 0.12 s / 0.12 s | ✅ |
| 2 | `e5148f6c7ba0d074` | `e5148f6c7ba0d074` | ✅ | 0.12 s / 0.13 s | ✅ |
| 3 | `312bbd421f1c577f` | `312bbd421f1c577f` | ✅ | 0.11 s / 0.11 s | ✅ |

Lệnh: `node src/headless.js --seed 2024 --night N --inputs tests/fixtures/long-inputs.json --ticks 21600 --out <f>` (đo cả thời gian khởi động Node).

## 3. Bot chơi trọn từng Đêm (tìm đường + né), phát lại inputs qua headless

Bot (`src/core/bot.js`) là công cụ kiểm chứng "chơi được từ đầu tới cuối", **không phải** yêu cầu. Kết quả thua được ghi đúng như thực tế.

| Đêm | Seed | Kết quả | Điểm | Tick | Đèn đã thắp | Phát lại headless khớp |
|---|---|---|---|---|---|---|
| 1 | 1 | **thắng** | 1253 | 17134 | L1 L2 L3 L4 L5 (5/5) | ✅ |
| 1 | 7 | **thắng** | 1321 | 13264 | L1 L2 L3 L4 L5 (5/5) | ✅ |
| 1 | 42 | **thắng** | 1412 | 10139 | L1 L2 L3 L4 L5 (5/5) | ✅ |
| 2 | 1 | thua (dawn) | 855 | 19800 | L1 L2 L3 L4 (4/6) | ✅ |
| 2 | 7 | thua (dawn) | 435 | 19800 | L1 L2 (2/6) | ✅ |
| 2 | 42 | **thắng** | 1319 | 19646 | L1 L2 L3 L4 L5 L6 (6/6) | ✅ |
| 3 | 1 | thua (no_flames) | 295 | 10984 | L2 (1/7) | ✅ |
| 3 | 7 | thua (no_flames) | 760 | 21181 | L2 L5 L6 (3/7) | ✅ |
| 3 | 42 | thua (dawn) | 1125 | 21600 | L2 L3 L4 L5 L7 (5/7) | ✅ |

## Tổng kết: **TẤT CẢ ĐẠT**
