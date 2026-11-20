# Kết quả kiểm chứng Phase 3 (tự sinh bởi `npm run proof`)

- Contract v1.2 · Commit: `62f69db` · Node v24.16.0 · win32 x64 · AMD Ryzen 5 5600H with Radeon Graphics
- Mọi lần chạy dùng đúng lệnh `headless_cmd` (tiến trình con thật). Output nằm trong `runs/` (bỏ qua các file lớn).

## 1. Scenario headless

| Scenario | Đêm | Yêu cầu | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| `01-pickup-deposit-light` | 1 | R3 nhặt, R4 nạp & thắp lần đầu (+5 mỗi đom đóm nạp, +100 thắp lần đầu)<br>*Đổi ở Phase 2: lantern_cost 3->10, carry 5->10; per_mote tính khi NẠP (10x10+100=200) thay vì khi nhặt* | ✅ event night_start @1 {"night":1}<br>✅ event mote_picked @10 {"carried":8}<br>✅ event mote_picked @30 {"carried":9}<br>✅ event mote_picked @50 {"carried":10}<br>✅ event deposit @91 {"lantern_id":"L1","amount":10,"deposited":10}<br>✅ event lantern_lit @91 {"lantern_id":"L1","relight":false}<br>✅ snapshot@100 lanterns.0.lit == true<br>✅ end {"state":"playing","score":150,"ticks":120} | **ĐẠT** |
| `02-win-all-lit` | 1 | Ticket-03: thắp đủ đèn KHÔNG kết thúc Đêm; thắng ở bình minh (dawn_survived) khi đủ ngưỡng đèn<br>*Đổi ở Phase 2: per_second_left 1->2, per_mote khi nạp, lantern_cost 10* | ✅ event lantern_lit @1 {"lantern_id":"L5","relight":false}<br>✅ event game_over @1 {"result":"won","reason":"dawn_survived"}<br>✅ end {"state":"won","ticks":1,"score":1046} | **ĐẠT** |
| `03-shade-hit-recoil-lose` | 1 | R5 chạm mất lửa, rơi đom đóm ra đất, recoil 2 m/60 tick, bất tử 90; thua no_flames<br>*Đổi ở Phase 2: shade_speed 3.5->4, thêm recoil, đom đóm rơi ra đất thay vì mất* | ✅ event player_hit @136 {"by":"shade","flames":1,"dropped":2}<br>✅ snapshot@140 shades.0.state == "recoil"<br>✅ snapshot@140 motes_active == 2<br>✅ snapshot@140 motes.0.kind == "dropped"<br>✅ event player_hit @226 {"by":"shade","flames":0,"dropped":1}<br>✅ event game_over @226 {"result":"lost","reason":"no_flames"}<br>✅ end {"state":"lost","ticks":226} | **ĐẠT** |
| `04-pulse-stun-push` | 1 | Tỏa Sáng: 3 đom đóm, 3D <= 5 m từ chân+0.8, choáng 120 tick, đẩy 4 m trong 15 tick, +5<br>*Đổi ở Phase 2: pulse_cost 1->3, radius 6->5 (3D), stun 3s->120 tick, đẩy dần 15 tick, per_stun 20->5, cooldown 3 s* | ✅ event pulse @1 {"stunned_ids":["S1"]}<br>✅ snapshot@10 shades.0.pos.0 == 6.667<br>✅ snapshot@10 player.carried == 0<br>✅ snapshot@20 shades.0.pos.0 == 8<br>✅ snapshot@120 shades.0.state == "stunned"<br>✅ snapshot@130 shades.0.state == "chase"<br>✅ snapshot@10 player.pulse_cd_s == 2.85<br>✅ không có event player_hit<br>✅ end {"state":"playing","score":5} | **ĐẠT** |
| `05-safe-zone-block` | 1 | Vùng an toàn 6 m quanh đèn đã sáng chặn Bóng Mực ở mép<br>*Đổi ở Phase 2: safe_radius 5->6* | ✅ không có event player_hit<br>✅ snapshot@1200 shades.0.pos.0 == 6.001<br>✅ end {"state":"playing","ticks":1200} | **ĐẠT** |
| `06-dawn` | 1 | Hết giờ -> thua dawn | ✅ snapshot@60 time_left_s == 1<br>✅ event game_over @120 {"result":"lost","reason":"dawn"}<br>✅ end {"state":"lost","ticks":120,"score":0} | **ĐẠT** |
| `07-default-night1` | 1 | Đêm 1 chuẩn: đèn đúng tọa độ, 20 đom đóm, 2 Bóng Mực ở tick 300 rồi mỗi 480<br>*Đổi ở Phase 2: bản đồ chuẩn, 20 đom đóm, lịch sinh mới* | ✅ snapshot@0 motes_active == 20<br>✅ snapshot@0 lanterns.1.pos == [23.8,0,7.7]<br>✅ snapshot@0 time_left_s == 240<br>✅ snapshot@0 player.flames == 3<br>✅ event shade_spawned @300 {"id":"S1"}<br>✅ event shade_spawned @300 {"id":"S2"}<br>✅ event shade_spawned @780 {"id":"S3"}<br>✅ snapshot@240 motes_active == 21<br>✅ snapshot@360 shades.0.state == "wander" | **ĐẠT** |
| `08-capacity` | 1 | Sức chứa 10<br>*Đổi ở Phase 2: carry 5->10* | ✅ không có event mote_picked<br>✅ snapshot@30 motes_active == 2<br>✅ snapshot@30 player.carried == 10 | **ĐẠT** |
| `09-dash` | 1 | Lướt 14 m/s x 12 tick, hồi 90 tick từ lúc bắt đầu, đứng yên thì theo hướng mặt | ✅ event dash @1 {}<br>✅ event dash @101 {}<br>✅ số event dash == 2<br>✅ snapshot@20 player.pos.2 == 2.8<br>✅ snapshot@20 player.dash_cd_s == 1.183<br>✅ snapshot@120 player.pos.2 == 5.6 | **ĐẠT** |
| `10-fall-respawn` | 1 | Rơi khỏi đảo (Y<-10): -1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh tại xuất phát, bất tử 90 | ✅ event player_hit @64 {"by":"fall","flames":2,"dropped":0,"lost":4}<br>✅ số event player_hit == 1<br>✅ snapshot@130 player.pos == [0,0,0]<br>✅ snapshot@130 player.invuln == true<br>✅ snapshot@130 player.carried == 0 | **ĐẠT** |
| `11-pause` | 1 | Tạm dừng: tick tăng, sim_tick/thời gian đứng yên, state paused | ✅ event paused @11 {}<br>✅ event resumed @41 {}<br>✅ snapshot@20 state == "paused"<br>✅ snapshot@20 sim_tick == 10<br>✅ snapshot@20 time_left_s == 239.833<br>✅ snapshot@20 player.pos.2 == 1<br>✅ snapshot@60 sim_tick == 30<br>✅ snapshot@60 player.pos.2 == 3<br>✅ end {"ticks":60,"state":"playing"} | **ĐẠT** |
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
| `25-win-on-dawn-tick` | 1 | Thắng ở tick bình minh với đủ ngưỡng đèn (Ticket-03: dawn_survived) | ✅ event lantern_lit @1 {"lantern_id":"L5","relight":false}<br>✅ event game_over @1 {"result":"won","reason":"dawn_survived"}<br>✅ end {"state":"won","score":1046} | **ĐẠT** |
| `26-n3-pad-to-L1` | 3 | Đêm 3: lên tầng 2 bằng bục nhảy rồi thắp L1 (0,6,6) | ✅ event deposit @101 {"lantern_id":"L1","amount":10,"deposited":10}<br>✅ event lantern_lit @101 {"lantern_id":"L1","relight":false}<br>✅ snapshot@110 lanterns.0.lit == true | **ĐẠT** |
| `27-refuel-half` | 1 | Ticket-03 mục 1: châm dầu — used = min(đang mang, ceil((100 − fuel)/10)); fuel = min(100, fuel + 10×used) | ✅ event refuel @1 {"lantern_id":"L1","amount":9,"fuel":100}<br>✅ snapshot@5 player.carried == 1<br>✅ end {"state":"playing","score":45,"ticks":5} | **ĐẠT** |
| `28-lantern-out` | 1 | Ticket-03 mục 1: đèn cạn dầu → tắt, deposited = 0, ever_lit = true, sự kiện lantern_out | ✅ event lantern_out @60 {"lantern_id":"L1"}<br>✅ snapshot@70 lanterns.0.lit == false<br>✅ snapshot@70 lanterns.0.ever_lit == true<br>✅ snapshot@70 lanterns.0.fuel == 0 | **ĐẠT** |
| `29-relight-cheap` | 1 | Ticket-03 mục 1: thắp lại đèn ever_lit chỉ cần 5 đom đóm, +40 điểm, relight: true, relit_count++ | ✅ event deposit @1 {"lantern_id":"L1","amount":5,"deposited":5}<br>✅ event lantern_lit @1 {"lantern_id":"L1","relight":true}<br>✅ snapshot@3 lanterns.0.relit_count == 1<br>✅ end {"state":"playing"} | **ĐẠT** |
| `30-drain-low-lantern` | 1 | Ticket-03 mục 2: Bóng Mực wander nhắm đèn yếu (fuel<30) rồi chuyển drain, hút 5/giây | ✅ snapshot@30 shades.0.state == "drain"<br>✅ snapshot@30 shades.0.target_lantern_id == "L1" | **ĐẠT** |
| `31-low-fuel-no-safe-zone` | 1 | Ticket-03 mục 2: đèn có fuel < 30 mất vùng an toàn; Bóng Mực ở 5 m không bị chặn → drain | ✅ snapshot@60 shades.0.state == "drain"<br>✅ snapshot@60 lanterns.0.lit == true | **ĐẠT** |
| `32-dawn-survived` | 1 | Ticket-03 mục 3: thắng khi hết giờ và số đèn sáng ≥ ceil(0.6 × tổng đèn) (Đêm 1: 3/5) | ✅ event game_over @2 {"result":"won","reason":"dawn_survived"}<br>✅ end {"state":"won"} | **ĐẠT** |
| `33-dawn-too-few-lit` | 1 | Ticket-03 mục 3: hết giờ mà dưới ngưỡng (2/5 < 3) → thua dawn | ✅ event game_over @2 {"result":"lost","reason":"dawn"}<br>✅ end {"state":"lost"} | **ĐẠT** |
| `34-capacity-grows` | 1 | Ticket-03 mục 4: sức chứa = 10 + 2 × successful_lights (tối đa 20); đèn đặt sẵn không tính | ✅ event lantern_lit @1 {"lantern_id":"L1","relight":false}<br>✅ snapshot@5 player.capacity == 12<br>✅ snapshot@5 player.carried == 2 | **ĐẠT** |
| `35-safe-zone-at-30` | 1 | Ticket-03 mục 2: đèn fuel = 30 còn vùng an toàn; fuel < 30 mất vùng an toàn | ✅ snapshot@1 shades.0.pos.0 == 6.001<br>✅ snapshot@2 shades.0.pos.0 == 5.934<br>✅ snapshot@1 lanterns.0.fuel == 30 | **ĐẠT** |
| `36-pulse-drain-bonus` | 1 | Ticket-03 mục 5: Tỏa Sáng trúng Bóng Mực đang drain được TỔNG +15 (5 + bonus 10) | ✅ event pulse @1 {"stunned_ids":["S1"]}<br>✅ snapshot@1 shades.0.state == "stunned"<br>✅ end {"state":"playing","score":15} | **ĐẠT** |
| `37-refuel-evict` | 1 | Ticket-03 mục 2: châm dầu lên ≥ 30 khi có Bóng Mực trong 6 m → bị đẩy ra mép trong ≤ 30 tick, không gây sát thương | ✅ event refuel @1 {"lantern_id":"L1","amount":9,"fuel":100}<br>✅ không có event player_hit | **ĐẠT** |
| `38-partial-deposit-patch-by-id` | 1 | Hồi quy P1–P2: scenario.lanterns cập nhật theo id (5 đèn vẫn còn); nạp một phần có deposit, đèn nhớ tiến độ | ✅ snapshot@0 lanterns.length == 5<br>✅ snapshot@0 lanterns.1.pos == [23.8,0,7.7]<br>✅ event deposit @1 {"lantern_id":"L1","amount":4,"deposited":4}<br>✅ số event deposit == 1<br>✅ không có event lantern_lit<br>✅ snapshot@10 lanterns.0.deposited == 4<br>✅ snapshot@10 lanterns.0.lit == false<br>✅ end {"score":20} | **ĐẠT** |

## 2. Tính tất định và hiệu năng (một Đêm đầy đủ 21.600 tick)

| Đêm | sha256 lần 1 | sha256 lần 2 | Giống hệt | Thời gian chạy | <= 30 s |
|---|---|---|---|---|---|
| 1 | `19ad4070a478f249` | `19ad4070a478f249` | ✅ | 0.10 s / 0.10 s | ✅ |
| 2 | `cd760407ea11de59` | `cd760407ea11de59` | ✅ | 0.12 s / 0.13 s | ✅ |
| 3 | `95522f77d868869f` | `95522f77d868869f` | ✅ | 0.14 s / 0.14 s | ✅ |

Lệnh: `node src/headless.js --seed 2024 --night N --inputs tests/fixtures/long-inputs.json --ticks 21600 --out <f>` (đo cả thời gian khởi động Node).

## 3. Bot chơi trọn từng Đêm (tìm đường + né), phát lại inputs qua headless

Bot (`src/core/bot.js`) là công cụ kiểm chứng "chơi được từ đầu tới cuối", **không phải** yêu cầu. Kết quả thua được ghi đúng như thực tế.

| Đêm | Seed | Kết quả | Điểm | Tick | Đèn đã thắp | Phát lại headless khớp |
|---|---|---|---|---|---|---|
| 1 | 1 | **thắng** | 1174 | 14400 | L2 L3 L5 (3/5) | ✅ |
| 1 | 7 | **thắng** | 1306 | 14400 | L1 L3 L4 (3/5) | ✅ |
| 1 | 42 | **thắng** | 1154 | 14400 | L2 L4 L5 (3/5) | ✅ |
| 2 | 1 | thua (dawn) | 585 | 16200 | L1 L2 L3 (3/6) | ✅ |
| 2 | 7 | thua (dawn) | 415 | 16200 | L2 L3 (2/6) | ✅ |
| 2 | 42 | thua (dawn) | 565 | 16200 |  (0/6) | ✅ |
| 3 | 1 | thua (dawn) | 425 | 18000 | L4 (1/7) | ✅ |
| 3 | 7 | thua (dawn) | 295 | 18000 |  (0/7) | ✅ |
| 3 | 42 | thua (dawn) | 605 | 18000 | L2 L3 (2/7) | ✅ |

## Tổng kết: **TẤT CẢ ĐẠT**
