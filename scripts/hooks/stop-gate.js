// Hook "Stop" của Claude Code: chặn agent kết thúc khi test đang đỏ.
// Đọc JSON từ stdin; nếu stop_hook_active thì cho qua để tránh vòng lặp vô hạn.
import { spawnSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch {}
  if (input.stop_hook_active) process.exit(0);
  const r = spawnSync(process.execPath, ['--test'], { encoding: 'utf8' });
  if (r.status === 0) process.exit(0);
  const tail = (r.stdout + r.stderr).split('\n').filter((l) => /✖|not ok|fail/i.test(l)).slice(0, 15).join('\n');
  process.stderr.write(`npm test đang ĐỎ — sửa trước khi kết thúc:\n${tail}\n`);
  process.exit(2);
});
