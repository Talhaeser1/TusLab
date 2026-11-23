/* TuşLab ana sayfa sesleri. Dosya yoksa / çalınamazsa WebAudio ile kısa bip yedeği.
 * Ses yalnız ilk kullanıcı etkileşiminden sonra çalar; ilk etkileşimde bir kez voice('welcome'). */
const BASE = new URL('../assets/sfx/', import.meta.url).href;
const FILES = {
  welcome: 'home/welcome.mp3', great: 'home/great.mp3', lesson: 'home/lesson.mp3',
  record: 'home/record.mp3', chime: 'home/chime.mp3', fanfare: 'home/fanfare.mp3', key: 'key.mp3',
};
const VOLUME = { key: 0.18, chime: 0.5, fanfare: 0.55 };

function readEnabled() {
  try { const d = JSON.parse(localStorage.getItem('tuslab-home-v1') || '{}'); return d.sound !== false; } catch { return true; }
}

let enabled = readEnabled();
let unlocked = false;
let welcomed = false;
let actx = null;
const missing = new Set();   // yüklenemeyen dosyalar → doğrudan yedek
const pools = new Map();     // ad → Audio[]

function ac() {
  if (actx) return actx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  try { actx = new C(); } catch { actx = null; }
  return actx;
}

function tone(freq, dur, { type = 'sine', gain = 0.08, when = 0, slide = 0 } = {}) {
  const c = ac();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* sessiz */ }
}

const FALLBACK = {
  key: () => tone(1700 + Math.random() * 300, 0.035, { type: 'triangle', gain: 0.03 }),
  error: () => tone(190, 0.14, { type: 'square', gain: 0.045, slide: -60 }),
  chime: () => { tone(880, 0.25, { gain: 0.06 }); tone(1318.5, 0.35, { gain: 0.05, when: 0.09 }); },
  fanfare: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.16, { type: 'triangle', gain: 0.07, when: i * 0.1 })),
  welcome: () => [392, 523.25, 659.25].forEach((f, i) => tone(f, 0.3, { gain: 0.06, when: i * 0.12 })),
  great: () => [659.25, 987.77].forEach((f, i) => tone(f, 0.3, { gain: 0.06, when: i * 0.11 })),
  lesson: () => [523.25, 783.99].forEach((f, i) => tone(f, 0.25, { gain: 0.05, when: i * 0.1 })),
  record: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.06, when: i * 0.08 })),
};

function pool(name) {
  let p = pools.get(name);
  if (p) return p;
  p = [];
  const size = name === 'key' ? 4 : 1;
  for (let i = 0; i < size; i++) {
    const a = new Audio(BASE + FILES[name]);
    a.preload = 'auto';
    a.volume = VOLUME[name] ?? 0.8;
    a.addEventListener('error', () => missing.add(name), { once: true });
    p.push(a);
  }
  pools.set(name, p);
  return p;
}

function play(name) {
  if (!enabled || !unlocked) return;
  const fb = FALLBACK[name];
  if (!FILES[name] || missing.has(name)) { fb?.(); return; }
  try {
    const p = pool(name);
    const a = p.find(x => x.paused || x.ended) || p[0];
    if (a.error) { missing.add(name); fb?.(); return; }
    a.currentTime = 0;
    const r = a.play();
    if (r && typeof r.catch === 'function') {
      r.catch(err => {
        // Dosya yok / desteklenmiyor → yedek. Otomatik oynatma engeli (NotAllowedError) → sessiz.
        if (err && err.name !== 'NotAllowedError' && err.name !== 'AbortError') { missing.add(name); fb?.(); }
      });
    }
  } catch { missing.add(name); fb?.(); }
}

function unlock() {
  if (unlocked) return;
  unlocked = true;
  document.removeEventListener('pointerdown', unlock, true);
  document.removeEventListener('keydown', unlock, true);
  const c = ac();
  try { if (c && c.state === 'suspended') c.resume(); } catch { /* yok */ }
  if (!welcomed) { welcomed = true; setTimeout(() => play('welcome'), 60); }
}
document.addEventListener('pointerdown', unlock, true);
document.addEventListener('keydown', unlock, true);

export const sfx = {
  key() { play('key'); },
  error() { play('error'); },
  win() { play('fanfare'); },
  chime() { play('chime'); },
  voice(name) { if (FILES[name] || FALLBACK[name]) play(name); },
  setEnabled(on) {
    enabled = !!on;
    if (!enabled) pools.forEach(p => p.forEach(a => { try { a.pause(); } catch { /* yok */ } }));
  },
  get enabled() { return enabled; },
};
