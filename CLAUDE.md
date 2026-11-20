# CLAUDE.md — Đảo Đèn Lồng

Game 3D (Three.js web) + chế độ headless theo Test Contract (`game.contract.json`). Node >= 20, ES modules, không framework.

## Lệnh
- Cài: `npm install` · Chơi: `npm start` (http://localhost:5173)
- Test (unit + scenario headless + tất định): `npm test`
- Bằng chứng phase: `npm run proof -- --phase N` -> `docs/proof/phase-N/results.md` + `runs/`
- FPS web: `npm start` rồi `npm run fps` -> `docs/proof/phase-2/fps.md`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 [--scenario f] [--inputs f] --ticks N --out f.jsonl`

## Kiến trúc
- `src/core/sim.js`: TOÀN BỘ luật chơi, tất định, không DOM. `step()` đi đúng 12 bước của Ticket-02 (đánh số trong code).
  Số có khóa trong contract đọc từ `game.contract.json`; số chuẩn khác ở `STD`. Không hard-code ở chỗ khác.
- `src/core/maps.js`: bản đồ chuẩn 3 Đêm, `surface(x,z)` (null = rơi). Góc: điểm = (r·cosθ, y, r·sinθ).
- `src/core/bot.js`: bot tìm đường, chỉ dùng cho kiểm chứng (`proof`, `?bench`).
- `src/core/validate.js`: kiểm tra inputs/scenario (sai định dạng -> exit 2).
- `src/headless.js`: CLI theo contract. `web/main.js`: chỉ hiển thị + bàn phím, gọi cùng `step()`.

## Quy tắc
- Ticket mới nhất trong `docs/lab/ticket-0N.md` là luật cao nhất: đọc nguyên văn trước khi sửa luật. Không bịa luật; chỗ mơ hồ thì ghi giả định vào `docs/notes/phase-N.md`.
- Contract: tên event, trạng thái shade (`spawning/wander/chase/recoil/stunned`), làm tròn 3 chữ số; event của bước k ghi tick k+1; `tick` tách khỏi `sim_tick` khi pause.
- Scenario mới: tính tay số tick kỳ vọng TRƯỚC khi chạy, ghi vào `note`. Test cũ bị luật mới thay: sửa và ghi `changed_in_phase2` (hoặc `[P2 đổi]`), không xóa hay tắt.
- Không dùng `Math.random`/`Date.now` trong `src/core` (phá tính tất định). Dùng `mulberry32(seed)`.
- Tính năng sáng tạo chỉ ở `web/`, không được đổi output headless.
- Đổi luật => cập nhật `game.contract.json`, test, và `docs/notes/phase-N.md` (giả định) trong cùng commit.
- Không sửa tay file trong `docs/proof/*/runs/`; luôn sinh lại bằng `npm run proof`.
- Không được kết thúc khi `npm test` đỏ (hook Stop sẽ chặn).
