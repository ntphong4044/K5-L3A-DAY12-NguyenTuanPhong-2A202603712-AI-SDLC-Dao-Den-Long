# Đảo Đèn Lồng v1.0.0

Game 3D góc nhìn thứ ba qua 3 Đêm, 3 hòn đảo: gom đom đóm để thắp và **giữ lửa** các Đèn Lồng Lớn tới bình minh trong khi Bóng Mực hút dầu các đèn yếu. Bản v1.0.0 gộp 4 phase của Day 12 AI SDLC Lab và đủ điều kiện phát hành.

## Tải và chạy

1. Tải `dao-den-long-web.zip` bên dưới, giải nén.
2. Trong thư mục vừa giải nén: `node serve.mjs` (cần Node.js ≥ 20).
3. Mở http://localhost:5173 trong Chrome / Edge / Firefox (có WebGL2).

Hoặc từ repo: `npm install && npm start`.

## Có gì trong bản này

- **Ba Đêm** với luật đầy đủ: nhiên liệu đèn hao dần, Bóng Mực hút dầu, Gió Lạc, Bùa Gió, lướt, rơi — đúng Test Contract **v1.3**.
- **Benchmark**: cảnh chuẩn 1280×720, tắt vsync, 200 Bóng Mực + 100 đom đóm, camera 15 s/vòng. Tự đo: **283.7 FPS trung bình, p1 129.2 FPS, load 1198.5 ms** (ngưỡng 60 / 30 / 10.000).
- **Soak**: 10 Đêm liên tiếp, **0 crash**, bộ nhớ 38 → 39 MB (×1.026); thêm mẫu 500 Đêm không rò rỉ.
- **Bảng xếp hạng** top 10 lưu trên máy (chữ Việt có dấu), màn hình từ menu chính, xuất JSON.
- **Dễ tiếp cận**: đổi mọi phím (báo trùng, khôi phục mặc định), phụ đề và mũi tên chỉ hướng, giảm chuyển động, chữ 18 px / chữ lớn ×1.25.
- **110 test** đạt; output headless Phase 1–3 không đổi.

## Bằng chứng

- `bench.json`, `soak.json` — số tự đo trên AMD Ryzen 5 5600H + Radeon iGPU, Windows 10.
- `docs/proof/phase-4/` — bảng truy vết, ảnh chụp, `ui-report.json`, `soak-500.json`.
- Video demo: `demo.mp4`.

## Giấy phép

MIT. Chi tiết asset và công cụ AI: `CREDITS.md` trong repo.
