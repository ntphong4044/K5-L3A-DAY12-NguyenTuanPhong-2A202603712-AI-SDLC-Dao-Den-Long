# CLAUDE.md — Đảo Đèn Lồng

Game 3D (Three.js web) + chế độ headless theo Test Contract (`game.contract.json`). Node >= 20, ES modules, không framework.

## Lệnh
- Cài: `npm install` · Chơi: `npm start` (http://localhost:5173)
- Test (unit + scenario headless + tất định): `npm test`
- Bằng chứng phase: `npm run proof` -> ghi `docs/proof/phase-1/results.md` + `runs/`
- Headless: `node src/headless.js --seed 1 --night 1 [--scenario f] [--inputs f] --ticks N --out f.jsonl`

## Kiến trúc
- `src/core/sim.js`: TOÀN BỘ luật chơi, tất định, không DOM. Số tuning đọc từ `game.contract.json` — không hard-code.
- `src/core/validate.js`: kiểm tra inputs/scenario (sai định dạng -> exit 2).
- `src/headless.js`: CLI theo contract. `web/main.js`: chỉ hiển thị + bàn phím, gọi cùng `step()`.

## Quy tắc
- Contract là luật cao nhất: tên event, thứ tự field, làm tròn 3 chữ số, mô hình tick (event của bước k ghi tick k+1).
- Không dùng `Math.random`/`Date.now` trong `src/core` (phá tính tất định). Dùng `mulberry32(seed)`.
- Tính năng sáng tạo chỉ ở `web/`, không được đổi output headless.
- Đổi luật => cập nhật `game.contract.json`, test, và `docs/notes/phase-N.md` (giả định) trong cùng commit.
- Không sửa tay file trong `docs/proof/*/runs/`; luôn sinh lại bằng `npm run proof`.
- Không được kết thúc khi `npm test` đỏ (hook Stop sẽ chặn).
