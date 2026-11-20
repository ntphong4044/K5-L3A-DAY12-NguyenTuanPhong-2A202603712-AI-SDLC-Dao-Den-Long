# CLAUDE.md — Đảo Đèn Lồng

Game 3D (Three.js web) + chế độ headless theo Test Contract (`game.contract.json`). Node >= 20, ES modules, không framework.

## Lệnh
- Cài: `npm install` · Chơi: `npm start` (http://localhost:5173)
- Test (unit + scenario headless + tất định + Phase 4): `npm test`
- Bằng chứng phase: `npm run proof -- --phase N` -> `docs/proof/phase-N/results.md` + `runs/`
- FPS web: `npm start` rồi `npm run fps` -> `docs/proof/phase-2/fps.md`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 [--scenario f] [--inputs f] --ticks N --out f.jsonl`
- Benchmark (Phase 4, cần Chrome): `npm run bench -- --seconds 30 --seed 42 --out bench.json` -> `bench.json`;
  không có trình duyệt: `npm run bench:cpu` (ghi `mode: "headless-cpu"`, số FPS không phải của GPU)
- Soak: `npm run soak -- --seed 7 --nights 10 --out soak.json` (không có tham số thì dùng đúng lệnh chuẩn)
- Bảng xếp hạng: `npm start -- --export-leaderboard out.json` · Kiểm UI + ảnh: `npm run shots` · Đóng gói: `npm run release`

## Kiến trúc
- `src/core/sim.js`: TOÀN BỘ luật chơi, tất định, không DOM. `step()` đi đúng 12 bước của Ticket-02 (đánh số trong code),
  bổ sung của Ticket-03: bước 2 trừ dầu (`applyFuelStep`) rồi tắt đèn cạn; bước 11 xét thắng/thua mới (`dawn_survived`).
  Số có khóa trong contract đọc từ `game.contract.json`; số chuẩn khác ở `STD`. Không hard-code ở chỗ khác.
- **Dầu**: lưu `lantern.fuel100` (đơn vị nguyên 1/60; `100 dầu = 6000`). Hao `fuel_decay_per_s` mỗi giây → mỗi tick
  `Math.round(fuel_decay_per_s * 60 / 60)` = 1 đơn vị. Hút `drain_per_s` tương tự (5 → 5 đơn vị). Tick 1 (steps = 1)
  dùng cờ `first` để không hao — nếu không, đèn scenario `fuel: X` sẽ bị lùi 1/60 ngay khi bắt đầu.
- **Vùng an toàn** phụ thuộc dầu: `keepOutOfSafe` / `insideSafe` **bỏ qua đèn có fuel < `low_fuel_threshold`**.
  Đèn `fuel ≥ 30` vẫn chặn Bóng Mực như Phase 2.
- **Luật thắng**: `flames <= 0` → `no_flames`; hết giờ và `litCount >= ceil(win_ratio × tổng đèn)` → `dawn_survived`;
  ngược lại → `dawn`. **Không còn** `all_lit`.
- **Scenario `lanterns`** (Contract v1.2) **thay thế** danh sách đèn mặc định (giống `drifters`, `charms` ở v1.1).
  Scenario cũ phải khai báo đủ đèn.
- `src/core/maps.js`: bản đồ chuẩn 3 Đêm, `surface(x,z)` (null = rơi). Góc: điểm = (r·cosθ, y, r·sinθ).
- `src/core/bot.js`: bot tìm đường, chỉ dùng cho kiểm chứng (`proof`, `?bench`).
- `src/core/validate.js`: kiểm tra inputs/scenario (sai định dạng -> exit 2).
- `src/headless.js`: CLI theo contract. `web/main.js`: chỉ hiển thị + bàn phím, gọi cùng `step()`.
- **Cảnh bench (Phase 4)** chỉ mở qua `createBenchGame()` trong `src/core/bench.js`. Nó bật cờ `s.bench` (bỏ hao dầu +
  kết thúc Đêm), sức chứa tạm 0 và `benchStep()` giữ `player.invuln ≥ 1` TRƯỚC mỗi `step()` (vì lõi giảm 1 ở bước 2 rồi
  mới xét chạm). Không đặt bất biến cảnh bench trong `step()` ngoài nhánh `if (s.bench)`; game thường không được đổi.
- `src/core/soak.js`: soak nhiều Đêm; `src/core/leaderboard.js`: bảng xếp hạng thuần; `web/settings.js`: gán phím.
  Không import ba module này vào `sim.js`.

## Quy tắc
- Ticket mới nhất trong `docs/lab/ticket-0N.md` là luật cao nhất: đọc nguyên văn trước khi sửa luật. Không bịa luật; chỗ mơ hồ thì ghi giả định vào `docs/notes/phase-N.md`.
- Contract: tên event, trạng thái shade (`spawning/wander/chase/recoil/stunned/drain`), làm tròn 3 chữ số; event của bước k ghi tick k+1; `tick` tách khỏi `sim_tick` khi pause.
- Chỉ được đổi kỳ vọng của test cũ khi ticket ĐÁNH DẤU [THAY THẾ] luật đó; ghi câu trích ticket vào `changed_in_phaseN`. Không nới `equals` thành `between`, không xóa kỳ vọng điểm.
- Kiểm chứng bench/soak/export bằng ĐÚNG lệnh trong `game.contract.json` (bench_cmd, soak_cmd, run_cmd + cờ), không dùng lệnh "tương đương" như `npm run …`. Ngưỡng lấy nguyên văn ticket, không thêm phần bù.
- Không để mã debug (`process.env`, `console.*`) trong `src/core`: lõi chạy cả trên trình duyệt.
- Scenario mới: tính tay số tick kỳ vọng TRƯỚC khi chạy, ghi vào `note`. Test cũ bị luật mới thay: sửa và ghi `changed_in_phaseN` (hoặc `[PN đổi]`), không xóa hay tắt.
- Sự kiện mới của Phase 3: `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`, `fuel_drain {lantern_id, shade_id, fuel}` (mỗi 60 tick). `lantern_lit` có `relight: true|false`. `deposit` không còn.
- Không dùng `Math.random`/`Date.now` trong `src/core` (phá tính tất định). Dùng `mulberry32(seed)`.
- Tính năng sáng tạo chỉ ở `web/`, không được đổi output headless.
- Đổi luật => cập nhật `game.contract.json`, test, `docs/notes/phase-N.md` (giả định), ADR (nếu đổi mô hình trạng thái hoặc luật thắng) và `CHANGELOG.md` trong cùng commit.
- Không sửa tay file trong `docs/proof/*/runs/`; luôn sinh lại bằng `npm run proof`.
- Không được kết thúc khi `npm test` đỏ (hook Stop sẽ chặn).
- Đo hiệu năng/chạy lâu: báo số **thật** (kèm lệnh và máy), không ước lượng. `bench.json` và `soak.json` luôn sinh bằng lệnh, không sửa tay.
  Số bộ nhớ có giải thích (RSS là trang heap của V8 + dung sai trang + trần tuyệt đối; xem `docs/notes/phase-4.md` B38–B40).
- Sửa file tiếng Việt bằng công cụ sửa có kiểm UTF-8, không `Set-Content`/`Out-File` qua PowerShell (dễ hỏng dấu).
