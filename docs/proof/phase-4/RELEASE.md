# Phát hành v1.0.0 — các bước

Kiểm trước khi tag (phải xanh hết):

```bash
npm install
npm test                              # 110/110
node scripts/bench.js --seed 42 --duration 30 --out bench.json                         # bench.json đạt ngưỡng
node --jitless --max-semi-space-size=1 src/soak.js --seed 7 --nights 10 --out soak.json                          # soak.json: crashes 0
npm run release                       # dist/dao-den-long-web.zip
node -e "const b=require('./bench.json'); const s=require('./soak.json'); if (!(b.avg_fps>=60 && b.p1_low_fps>=30 && b.load_ms<=10000)) throw 1; if (s.crashes!==0) throw 2; console.log('bench + soak OK')"
```

## Tag và Release

```bash
git add -A
git commit -m "Phase 4: bench, soak, leaderboard, accessibility, release v1.0.0"
git tag -a phase-4 -m "Phase 4 - Ticket-04"
git tag -a v1.0.0 -m "Dao Den Long v1.0.0"
git push origin main --tags
gh release create v1.0.0 dist/dao-den-long-web.zip docs/demo/demo.mp4 ^
  --title "Đảo Đèn Lồng v1.0.0" --notes-file docs/proof/phase-4/release-notes.md
```

Nếu chưa có `gh`/token: tạo Release trên GitHub, gắn:
- `dist/dao-den-long-web.zip` (bản phát hành chính)
- `docs/demo/demo.mp4` (video demo)
- `bench.json`, `soak.json` (kèm theo cho tiện đối chiếu)

## Kịch bản video demo (dưới 5 phút)

| Thời lượng | Nội dung |
|---|---|
| 0:00–0:20 | Giới thiệu: repo, `npm install` → `npm start`, mở http://localhost:5173 |
| 0:20–1:20 | Chơi Đêm 1: đi nhặt đom đóm, `E` thắp đèn, `Q` tỏa sáng; chỉ ra phụ đề, mũi tên mép, ⚠ trên đèn |
| 1:20–1:50 | Cài đặt: gán phím trùng (báo lỗi), Khôi phục mặc định, giảm chuyển động, chữ lớn |
| 1:50–2:20 | Thua/thắng một Đêm → Lưu điểm → nhập tên → Bảng xếp hạng → `node scripts/serve.js --export-leaderboard out.json` |
| 2:20–3:20 | `npm test` (110 test), `node src/headless.js ...` (chạy headless) |
| 3:20–4:20 | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (cảnh chuẩn 1280×720, mở `bench.json`), `node --jitless --max-semi-space-size=1 src/soak.js --seed 7 --nights 10 --out soak.json` (mở `soak.json`) |
| 4:20–4:50 | Giải nén `dist/dao-den-long-web.zip`, `node serve.mjs`, chơi bản phát hành |

Ghi hình bằng OBS (Windows) ở **1280×720, 30 fps**, lưu `docs/demo/demo.mp4` (H.264). Nếu video dài quá 5 phút, cắt phần 4:20.
