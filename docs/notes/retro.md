# Retro — Đảo Đèn Lồng, 4 phase (Day 12 · AI SDLC Lab)

Nguyễn Tuấn Phong · 2A202603712 · 2026-11-20 · Nhật ký chi tiết: [ai-log.md](ai-log.md)

## Evaluation 4 phase

| Phase | Ticket | Điểm chính | Đạt / chưa đạt | Bằng chứng |
|---|---|---|---|---|
| 1 | Bản chơi thử (v1.0) | Lõi tất định, headless CLI, web 3D, 8 scenario tính tay | Đạt; ảnh đầu quá tối phải tăng sáng | [phase-1](../proof/phase-1/README.md) |
| 2 | Ticket-02 Ba hòn đảo (v1.1) | 3 Đêm/bản đồ, lượt, Gió Lạc, Bùa Gió, tạm dừng, 26 scenario | Đạt; bot thua 9/9 ván đầu vì giả định `wander` sai | [phase-2](../proof/phase-2/README.md) |
| 3 | Ticket-03 Đèn cạn dầu (v1.2) | Nhiên liệu, hút dầu, luật thắng mới, điểm mới, mù màu | Đạt; bản đầu có 6 lỗi (3 lỗi làm trượt test ẩn Phase 1–2) do Claude Code rà lại | [phase-3](../proof/phase-3/README.md) |
| 4 | Ticket-04 Bình minh (v1.3) | Bench trên GPU thật, soak, bảng xếp hạng, dễ tiếp cận, đóng gói v1.0.0 | Đạt các ngưỡng đo được; video demo và Release phải làm tay | [phase-4](../proof/phase-4/README.md) |

Số cuối: **110 test đạt**; bench **283.7 FPS / p1 129.2 / load 1198.5 ms**; soak **0 crash, RSS 38→39 MB (×1.026)**; headless Phase 1–3 không đổi.

## Điều hiệu quả khi làm với AI

- **Viết test trước, số tính tay trước.** Phase 1–2 AI tính tick va chạm bằng tay rồi mới chạy; 25/26 scenario khớp ngay lần đầu. Test trở thành "hợp đồng" thay vì lời hứa.
- **Đưa nguyên văn ticket vào repo** (`docs/lab/ticket-0N.md`) để AI đối chiếu từng câu, thay vì nhớ lại yêu cầu trong hội thoại.
- **Bắt AI ghi giả định có mã (B1…B46) + lý do.** Nhờ vậy chỗ mơ hồ (như "ngược chiều kim đồng hồ khi nhìn từ trên xuống") được đọc lại và sửa bằng lý lẽ, không bằng cảm tính.
- **Chạy thật trên máy mình.** Bench và soak do người dùng tự chạy; số báo cáo không phải số AI tưởng tượng.
- **Đo lặp lại.** Chỉ sau 5–8 lần chạy soak mới thấy "đạt" và "không đạt" xen kẽ do V8 cấp trang heap.

## Điều không hiệu quả

- **Tin vào "test xanh".** Phase 3: bản đầu xanh 87/87 nhưng đã sửa kỳ vọng test cũ theo hành vi mới. Phải rà lại theo câu ticket mới bắt được.
- **Tin vào báo cáo "đã xong" của agent.** Phase 4: trang `?demo` văng lỗi khởi tạo, agent vẫn tiếp tục sang bước sau; chỉ ảnh chụp mới lộ ra.
- **Giao việc "làm hết phase" một lượt.** Nhiều lỗi chỉ hiện khi chạy; giao lại theo vòng (test → sửa → đo lại) tốn ít token hơn đọc kết quả sai rồi gỡ.
- **Sửa file bằng PowerShell `Set-Content`** khi file có tiếng Việt: dễ làm hỏng mã hóa; nên dùng công cụ sửa file có kiểm UTF-8.

## Những lần AI sai và cách tôi phát hiện

| Lần | AI sai gì | Phát hiện bằng |
|---|---|---|
| Phase 1 | Vòng lặp bash `"$P\$n.png"` ghi đè ảnh | `ls` thấy tên file lạ |
| Phase 1 | Cảnh quá tối | Nhìn ảnh chụp |
| Phase 2 | Giả định `wander` trôi về phía Mây → Bóng Mực dồn cục | Bot thua 9/9 ván |
| Phase 2 | Lệch 1 tick `recoil`, Mây "đáp đất từ dưới lên" | Unit test AC-W1 |
| Phase 3 | Trừ dầu 2 lần ở tick 1; hao dầu sai 60 lần | Scenario AC-F1, đèn `fuel: 0.5` tắt tick 2 |
| Phase 3 | `per_stun_bonus` 25 thay vì 10 (tổng +30 ≠ "+15") | Đọc lại câu ticket; sửa ở lượt rà |
| Phase 4 | `qs` dùng trước khai báo → không hiện cảnh 3D | Ảnh chụp vẫn là menu + log trình duyệt |
| Phase 4 | Cảnh bench mất Ngọn Lửa dù đã "tắt sát thương" | Unit test AC-BENCH3 (flames 0 ≠ 3) |
| Phase 4 | `seed` gán sau khi tạo game → bảng xếp hạng ghi sai seed | `console.warn` tạm + đối chiếu `localStorage` |
| Phase 4 | Test "ngược chiều kim đồng hồ" kỳ vọng sai dấu trục | Tự kiểm bằng công thức khung tay phải |

## Harness nào giúp nhiều nhất

1. **`npm test` + scenario headless** — chặn hồi quy giữa phase; bắt được lỗi bench và luật.
2. **`scripts/shots.js` (Chrome + DevTools, ảnh + `ui-report.json`)** — thay tôi "bấm" từng màn hình và kiểm nút; phát hiện `qs`, AudioContext.
3. **Skill `verify-phase` + hook Stop (`scripts/hooks/stop-gate.js`)** — buộc chạy test và proof trước khi kết thúc phiên; tránh "báo xong khi đỏ".
4. **`CLAUDE.md` ngắn** với quy tắc "không sửa test cho xanh", "mọi giả định phải có mã" — chi phí đọc nhỏ, hiệu quả lớn.
5. **Bench/soak lặp lại** — công cụ đo chứ không phải harness hội thoại, nhưng là thứ duy nhất chứng minh "chạy lâu không sao".

## Token / chi phí (ước tính)

| Phase | Công cụ | Chi phí | Ghi chú |
|---|---|---|---|
| 1 | Claude Code | **$4.18** (số thật từ `/cost`) | 6.0M token đọc từ cache, 89k output |
| 2 | Claude Code | cùng session Phase 1 | — |
| 3 | DeepSeek (bản đầu) + Claude Code rà lại | không có số chính xác | — |
| 4 | Kilo Code (DeepSeek-V4.1-Flash) | **ước tính $3–6**, ~150 lượt gọi, ~2.5–3.5M token vào, ~150k token ra | Không có `/cost`; ước theo độ dài hội thoại |

Tổng ước tính cả 4 phase: **~$10–15**.

Cách tôi tiết kiệm token:
- Đọc tài liệu lớn một lần, trích số ra file (không đọc lại repo mỗi bước).
- Gom lệnh: một lệnh chạy test + lọc lỗi thay vì hỏi từng bước.
- Giữ `CLAUDE.md` ngắn; skill chỉ chứa checklist.
- Ảnh chứng cứ kèm JSON máy đọc được để không phải mô tả lại.
- Không dùng subagent/session song song cho việc tuần tự.

## Nếu làm lại, tôi sẽ đổi gì

1. **Viết test "bất biến" cho từng yêu cầu đo được ngay từ đầu phase**, trước khi viết tính năng (bench, soak, bảng xếp hạng). Đo lặp lại ngay từ lần đầu thay vì phát hiện muộn.
2. **Kiểm UI bằng script chạy thật (shots) trước khi viết nhiều tính năng giao diện**, vì lỗi khởi tạo như `qs` làm mọi nỗ lực sau vô nghĩa.
3. **Không sửa file tiếng Việt bằng lệnh shell**; dùng công cụ sửa có kiểm mã hóa.
4. **Tách "số liệu môi trường" khỏi "luật"**: ngay từ Phase 4 viết rõ ngưỡng bộ nhớ có dung sai trang V8 và trần tuyệt đối trong `soak.json`, thay vì phải trình bày lại sau khi thấy số không ổn định.
5. **Quay video demo song song** khi làm UI, thay vì để cuối cùng (video không thể tạo tự động trong môi trường này).
