// Âm thanh tự tổng hợp bằng WebAudio (không dùng file ngoài): nhạc nền đêm + hiệu ứng.
export class Sound {
  constructor() { this.ctx = null; this.master = null; this.volume = 0.6; this.musicTimer = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    return true;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  tone(freq, dur = 0.15, type = 'sine', gain = 0.25, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur = 0.4, gain = 0.15, freq = 800) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master); src.start();
  }
  sfx(name) {
    switch (name) {
      case 'pick': this.tone(1320, 0.08, 'sine', 0.15); this.tone(1760, 0.1, 'sine', 0.12, 0.05); break;
      case 'deposit': this.tone(660, 0.12, 'triangle', 0.15); break;
      case 'lit': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.18, i * 0.08)); break;
      case 'pulse': this.tone(440, 0.5, 'sine', 0.3, 0, 2.2); this.noise(0.3, 0.08, 2000); break;
      case 'hit': this.tone(180, 0.35, 'sawtooth', 0.22, 0, 0.5); break;
      case 'jump': this.tone(520, 0.12, 'square', 0.08, 0, 1.6); break;
      case 'dash': this.noise(0.18, 0.18, 1500); break;
      case 'shade': this.tone(110, 0.6, 'sawtooth', 0.12, 0, 0.7); break;
      case 'steal': this.tone(900, 0.25, 'triangle', 0.15, 0, 0.4); break;
      case 'charm': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.15, i * 0.06)); break;
      case 'tick': this.tone(1000, 0.05, 'square', 0.1); break;
      case 'wind': this.noise(1.6, 0.12, 500); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.18, i * 0.12)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.18, i * 0.18)); break;
      default: break;
    }
  }
  // Nhạc nền: nốt ngũ cung chậm trên nền trầm
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220, 247, 294, 330, 392, 440, 494, 587];
    let i = 0;
    this.musicTimer = setInterval(() => {
      if (i % 8 === 0) this.tone(110, 3.5, 'sine', 0.06);
      const f = scale[(i * 5 + (i >> 2)) % scale.length];
      this.tone(f, 1.2, 'triangle', 0.035);
      i += 1;
    }, 700);
  }
  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; }
}
