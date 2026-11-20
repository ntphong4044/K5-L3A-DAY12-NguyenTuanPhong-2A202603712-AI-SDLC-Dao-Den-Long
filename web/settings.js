// Cài đặt phía web: âm lượng, độ nhạy, bảng màu, giảm chuyển động, cỡ chữ, gán phím. Lưu localStorage.
// Module thuần (không DOM) để test được bằng `node --test`; main.js tự áp dụng.

export const DEFAULT_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyQ', pause: 'Escape',
};

// `alt`: phím phụ cố định của phím chính (luôn dùng được, không gán lại được).
export const ACTIONS = [
  { id: 'up', label: 'Đi tới', alt: ['ArrowUp'] },
  { id: 'down', label: 'Đi lui', alt: ['ArrowDown'] },
  { id: 'left', label: 'Đi sang trái', alt: [] },
  { id: 'right', label: 'Đi sang phải', alt: [] },
  { id: 'jump', label: 'Nhảy', alt: [] },
  { id: 'dash', label: 'Lướt', alt: ['ShiftRight'] },
  { id: 'interact', label: 'Tương tác (thắp / châm dầu)', alt: [] },
  { id: 'pulse', label: 'Tỏa sáng', alt: [] },
  { id: 'pause', label: 'Tạm dừng', alt: ['KeyP'] },
];

export const DEFAULTS = { volume: 0.6, sensitivity: 1, reducedMotion: false, fontScale: 1 };

/** Đọc settings từ chuỗi JSON (hỏng/thiếu → mặc định). */
export function loadSettings(text) {
  const s = { ...DEFAULTS, keys: { ...DEFAULT_KEYS }, ...safeParse(text) };
  s.keys = { ...DEFAULT_KEYS, ...(s.keys && typeof s.keys === 'object' ? s.keys : {}) };
  s.volume = clamp(Number(s.volume), 0, 1, DEFAULTS.volume);
  s.sensitivity = clamp(Number(s.sensitivity), 0.2, 3, DEFAULTS.sensitivity);
  s.fontScale = Number(s.fontScale) === 1.25 ? 1.25 : 1;
  s.reducedMotion = !!s.reducedMotion;
  return s;
}

/** Lưu xuống localStorage (module thuần: main.js gọi, test truyền storage giả). */
export function saveSettings(settings, storage = globalThis.localStorage) {
  try { storage.setItem('ddl-settings', JSON.stringify(settings)); return true; } catch { return false; }
}

/** Mã phím từ sự kiện bàn phím, bỏ qua modifier thuần (người dùng vẫn cần gán Shift). */
export function keyCodeFromEvent(e) {
  return e.code || e.key;
}

const clamp = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
function safeParse(text) { try { return JSON.parse(text) || {}; } catch { return {}; } }

/** Mã phím → tên dễ đọc (phụ đề/kiểm chứng trùng phím). */
export function keyLabel(code) {
  if (!code) return '…';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] ?? code;
  return { Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái',
    ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải', Tab: 'Tab', Enter: 'Enter' }[code] ?? code;
}

/** Trùng phím trong các phím chính: trả về [{code, actions: [...]}].  */
export function findConflicts(keys) {
  const byCode = new Map();
  for (const a of ACTIONS) {
    const code = keys?.[a.id];
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(a.id);
  }
  return [...byCode.entries()].filter(([, acts]) => acts.length > 1).map(([code, actions]) => ({ code, actions }));
}

/** Mã phím phụ của phím chính khác đang dùng (ví dụ Shift phải của "lướt" trùng phím chính). */
export function shiftedConflicts(keys) {
  const out = [];
  for (const a of ACTIONS) {
    for (const alt of a.alt) {
      const owner = ACTIONS.find((b) => b.id !== a.id && keys[b.id] === alt);
      if (owner) out.push({ code: alt, actions: [a.id, owner.id] });
    }
  }
  return out;
}

export const isKeyCode = (code) => typeof code === 'string' && /^([A-Z][A-Za-z0-9]*|F\d{1,2})$/.test(code);

/**
 * Gán phím cho một hành động. Trùng phím thì từ chối và báo (mục 4: "phát hiện trùng phím và báo cho người dùng").
 * Trả về { settings } hoặc { error }.
 */
export function assignKey(settings, action, code) {
  if (!isKeyCode(code)) return { error: `Không gán được phím "${code}".` };
  const act = ACTIONS.find((a) => a.id === action);
  if (!act) return { error: `Hành động không hợp lệ: ${action}` };
  const owner = ACTIONS.find((a) => a.id !== action && settings.keys[a.id] === code);
  if (owner) return { error: `Phím ${keyLabel(code)} đã dùng cho "${owner.label}".` };
  const altOwner = ACTIONS.find((a) => a.id !== action && a.alt.includes(code) && settings.keys[a.id] !== code);
  if (altOwner) return { error: `Phím ${keyLabel(code)} là phím phụ (luôn bật) của "${altOwner.label}".` };
  const next = { ...settings, keys: { ...settings.keys, [action]: code } };
  const conflicts = [...findConflicts(next.keys), ...shiftedConflicts(next.keys)];
  if (conflicts.length) return { error: `Trùng phím ${keyLabel(conflicts[0].code)}.` };
  return { settings: next };
}

export function restoreDefaultKeys(settings) {
  return { ...settings, keys: { ...DEFAULT_KEYS } };
}

/** Nhãn nút cho phụ đề/overlay: "E" thay vì mã "KeyE". */
export function keyFor(settings, action) {
  return keyLabel(settings.keys[action]);
}
