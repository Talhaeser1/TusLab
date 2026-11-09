"""TuşLab PvP — original dynamic score (phase 23, rev. 2).

Seven fully synthesised cues, no samples, no borrowed melodies:
  lobby    90 BPM  A minor   lo-fi / synthwave groove           16.0 s loop
  prep    120 BPM  D minor   filter-rising build-up + snare roll 16.0 s loop
  combat  160 BPM  E minor   driving drums, rolling bass, riff   18.0 s loop
  tension 150 BPM  C# minor  dark, filtered, heartbeat kick      16.0 s loop
  ultimate 180 BPM F minor   brass super-stinger + fast breaks   16.0 s loop
  victory 120 BPM  C major   bright fanfare, ringing end          9.0 s
  defeat   60 BPM  A minor   slow falling chords, tape sag       10.0 s

Loops are rendered *circularly* (note tails wrap to the start, reverb is a
circular convolution) so the last sample flows into the first one.
Output: 22050 Hz, 16-bit, mono WAV. Deterministic (fixed seeds).
Run: python scripts/generate-music.py
"""
from pathlib import Path
import wave

import numpy as np

RATE = 22050
NYQ = RATE / 2
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'music'
OUT.mkdir(parents=True, exist_ok=True)
PEAK = 10 ** (-1 / 20)        # -1 dBFS ceiling
TARGET_RMS_DB = -14.0         # equal-ish loudness across scenes


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- helpers
class Track:
    def __init__(self, seconds, loop=True):
        self.n = int(round(seconds * RATE))
        self.loop = loop
        self.buses = {}

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros(self.n)
        return self.buses[name]

    def add(self, name, at_seconds, sig, gain=1.0):
        buf = self.bus(name)
        start = int(round(at_seconds * RATE))
        if self.loop:
            sig = sig[: self.n]
            idx = (start + np.arange(len(sig))) % self.n
            buf[idx] += sig * gain
        else:
            end = min(self.n, start + len(sig))
            if end > start:
                buf[start:end] += sig[: end - start] * gain


def env(n, a=0.005, d=0.2, s=0.0, r=0.02):
    t = np.arange(n) / RATE
    e = np.minimum(1.0, t / max(a, 1e-4))
    dec = s + (1 - s) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))
    e = np.where(t < a, e, dec)
    rn = min(n, int(r * RATE))
    if rn > 1:
        e[-rn:] *= np.linspace(1, 0, rn)
    return e


def osc(freq, n, cutoff, kind='saw', detune=(0.0,), reso=0.0, vib=0.0, vib_rate=5.5,
        glide=None, rng=None):
    """Band-limited additive oscillator with a time-varying 2-pole low-pass.
    cutoff: scalar or array(n). glide: (start_ratio, time) pitch fall-in."""
    rng = rng or np.random.default_rng(1)
    t = np.arange(n) / RATE
    fc = np.asarray(cutoff, dtype=float)
    if fc.ndim == 0:
        fc = np.full(n, float(fc))
    elif len(fc) != n:
        fc = np.concatenate([fc[:n], np.full(max(0, n - len(fc)), fc[-1])])
    fc = np.maximum(fc, 40.0)
    out = np.zeros(n)
    for cents in detune:
        f = freq * 2 ** (cents / 1200)
        inst = np.full(n, f)
        if vib:
            inst = inst * (1 + vib * np.sin(2 * np.pi * vib_rate * t) * np.minimum(1, t / 0.25))
        if glide:
            ratio, gt = glide
            inst = inst * (1 + (ratio - 1) * np.exp(-t / gt))
        phase = 2 * np.pi * np.cumsum(inst) / RATE + rng.uniform(0, 2 * np.pi)
        kmax = int(min(NYQ * 0.92, float(fc.max()) * 5) / (f * 1.05))
        kmax = max(1, min(kmax, 80))
        for k in range(1, kmax + 1):
            if kind == 'square' and k % 2 == 0:
                continue
            if kind == 'sine' and k > 1:
                break
            if kind == 'tri':
                if k % 2 == 0:
                    continue
                amp = 1 / (k * k)
            else:
                amp = 1 / k
            x = k * inst / fc
            gain = amp / np.sqrt(1 + x ** 4)
            if reso:
                gain = gain + reso * amp * np.exp(-((x - 1) / 0.3) ** 2)
            out += gain * np.sin(k * phase)
    return out / len(detune)


def fft_filter(x, lp=None, hp=None, order=2, circular=True):
    n = len(x)
    pad = 0 if circular else min(n, RATE // 2)
    X = np.fft.rfft(np.concatenate([x, np.zeros(pad)]))
    f = np.fft.rfftfreq(n + pad, 1 / RATE)
    g = np.ones_like(f)
    if lp:
        g *= 1 / np.sqrt(1 + (f / lp) ** (2 * order))
    if hp:
        g *= 1 / np.sqrt(1 + (hp / np.maximum(f, 1e-6)) ** (2 * order))
    g[0] = 0
    y = np.fft.irfft(X * g, n + pad)
    return y[:n]


def reverb(x, seconds=1.2, tone=5000, mix=0.25, seed=7, circular=True):
    rng = np.random.default_rng(seed)
    m = int(seconds * RATE)
    t = np.arange(m) / RATE
    ir = rng.standard_normal(m) * np.exp(-t / (seconds / 6.9))
    ir[: int(0.012 * RATE)] = 0           # pre-delay
    ir = fft_filter(ir, lp=tone, circular=False)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    n = len(x)
    if circular:
        h = np.zeros(n)
        h[: min(n, m)] = ir[: min(n, m)]
        wet = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(h), n)
    else:
        L = n + m
        wet = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:n]
    return x + mix * wet


# ---------------------------------------------------------------- drums
DRUM_RNG = np.random.default_rng(2323)


def kick(f0=150, f1=46, decay=0.3, click=0.5, length=0.45, drive=1.6):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    f = f1 + (f0 - f1) * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t / decay)
    body = np.tanh(drive * body) / np.tanh(drive)
    nz = fft_filter(DRUM_RNG.standard_normal(n), hp=1800, lp=9000, circular=False)
    body += click * nz / (np.abs(nz).max() + 1e-9) * np.exp(-t / 0.004)
    return body * env(n, 0.0008, 10, 1, 0.02)


def snare(tone=190, decay=0.16, noise_lp=9000, body=0.55, length=0.38):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    tn = (np.sin(2 * np.pi * tone * t) + 0.5 * np.sin(2 * np.pi * tone * 1.72 * t)) * np.exp(-t / 0.07)
    nz = fft_filter(DRUM_RNG.standard_normal(n), hp=1200, lp=noise_lp, circular=False)
    nz /= np.abs(nz).max() + 1e-9
    s = body * tn + nz * np.exp(-t / decay)
    return s * env(n, 0.0008, 10, 1, 0.03)


def clap(length=0.3):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    nz = fft_filter(DRUM_RNG.standard_normal(n), hp=900, lp=6000, circular=False)
    nz /= np.abs(nz).max() + 1e-9
    e = np.zeros(n)
    for off in (0, 0.009, 0.019, 0.028):
        e += (t >= off) * np.exp(-np.maximum(0, t - off) / (0.012 if off < 0.028 else 0.11))
    return nz * e * env(n, 0.0008, 10, 1, 0.03)


def hat(decay=0.035, length=0.09, lp=13000):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    nz = fft_filter(DRUM_RNG.standard_normal(n), hp=7000, lp=lp, circular=False)
    nz /= np.abs(nz).max() + 1e-9
    return nz * np.exp(-t / decay) * env(n, 0.0005, 10, 1, 0.01)


def crash(length=1.6):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    nz = fft_filter(DRUM_RNG.standard_normal(n), hp=4000, lp=14000, circular=False)
    nz /= np.abs(nz).max() + 1e-9
    return nz * np.exp(-t / 0.45) * env(n, 0.001, 10, 1, 0.1)


def tom(freq=110, length=0.3):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    f = freq * (1 + 0.6 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t / 0.12) * env(n, 0.001, 10, 1, 0.02)


def impact(length=2.2):
    """Big cinematic boom for the ultimate stinger."""
    n = int(length * RATE)
    t = np.arange(n) / RATE
    f = 32 + 90 * np.exp(-t / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t / 0.7)
    nz = fft_filter(DRUM_RNG.standard_normal(n), lp=2500, circular=False)
    nz /= np.abs(nz).max() + 1e-9
    return (np.tanh(1.8 * boom) + 0.45 * nz * np.exp(-t / 0.25)) * env(n, 0.001, 10, 1, 0.3)


# ---------------------------------------------------------------- instruments
def pad(track, at, dur, notes, cutoff=1200, level=0.08, attack=0.35, release=0.5, bus='pad',
        detune=(-9, 0, 8), kind='saw', seed=0):
    n = int((dur + release) * RATE)
    rng = np.random.default_rng(seed)
    for m in notes:
        s = osc(mtof(m), n, cutoff, kind, detune, rng=rng)
        track.add(bus, at, s * env(n, attack, 10, 1, release) * level)


def bass(track, at, dur, midi, cutoff=420, level=0.32, sub=0.7, env_amt=900, bus='bass', kind='saw'):
    n = int((dur + 0.03) * RATE)
    fc = cutoff + env_amt * np.exp(-np.arange(n) / RATE / 0.07)
    s = osc(mtof(midi), n, fc, kind, (0,), reso=0.4)
    s = s + sub * np.sin(2 * np.pi * mtof(midi) * np.arange(n) / RATE)
    track.add(bus, at, np.tanh(1.3 * s) * env(n, 0.003, 10, 1, 0.03) * level)


def lead(track, at, dur, midi, cutoff=2600, level=0.12, kind='saw', detune=(-7, 7), decay=0.35,
         sustain=0.55, env_amt=2500, vib=0.0, glide=None, bus='lead', reso=0.3):
    n = int((dur + 0.06) * RATE)
    fc = cutoff + env_amt * np.exp(-np.arange(n) / RATE / 0.09)
    s = osc(mtof(midi), n, fc, kind, detune, reso=reso, vib=vib, glide=glide)
    track.add(bus, at, s * env(n, 0.004, decay, sustain, 0.05) * level)


def pluck(track, at, midi, level=0.1, cutoff=900, length=0.5, kind='square', bus='keys'):
    n = int(length * RATE)
    fc = cutoff + 2800 * np.exp(-np.arange(n) / RATE / 0.05)
    s = osc(mtof(midi), n, fc, kind, (-4, 4))
    track.add(bus, at, s * env(n, 0.002, 0.16, 0.0, 0.04) * level)


def brass(track, at, dur, notes, level=0.1, bright=3200, bus='brass', fall=True, swell=0.0):
    """Brass-like: detuned saws, filter opens on attack, slight pitch fall-in."""
    n = int((dur + 0.15) * RATE)
    t = np.arange(n) / RATE
    fc = 700 + bright * (1 - np.exp(-t / 0.05)) * (0.75 + 0.25 * np.exp(-t / 0.4))
    if swell:
        fc = fc * (0.6 + 0.4 * np.minimum(1, t / swell))
    for m in notes:
        s = osc(mtof(m), n, fc, 'saw', (-10, -3, 4, 11), reso=0.25, vib=0.004, vib_rate=5.2,
                glide=(0.985, 0.04) if fall else None)
        track.add(bus, at, np.tanh(1.4 * s) * env(n, 0.012, 0.5, 0.8, 0.15) * level)


def bell(track, at, midi, level=0.08, length=1.2, bus='keys'):
    n = int(length * RATE)
    t = np.arange(n) / RATE
    f = mtof(midi)
    s = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.25)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.12))
    track.add(bus, at, s * env(n, 0.002, 0.5, 0.0, 0.08) * level)


def riser(track, at, dur, lo=300, hi=7000, level=0.12, bus='fx', seed=3):
    n = int(dur * RATE)
    rng = np.random.default_rng(seed)
    t = np.arange(n) / RATE
    nz = rng.standard_normal(n)
    # sweep a band-pass by mixing progressively brighter low-passed copies
    lo_c = fft_filter(nz, lp=lo, hp=lo / 3, circular=False)
    hi_c = fft_filter(nz, lp=hi, hp=hi / 4, circular=False)
    p = (t / dur) ** 1.5
    s = (1 - p) * lo_c / (np.abs(lo_c).max() + 1e-9) + p * hi_c / (np.abs(hi_c).max() + 1e-9)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2.5 * t / dur)) / RATE) * 0.3
    track.add(bus, at, (s + tone) * p * level * env(n, 0.01, 10, 1, 0.06))


def sidechain(n, kick_times, depth=0.55, rel=0.16, loop=True):
    g = np.ones(n)
    t = np.arange(n) / RATE
    total = n / RATE
    for kt in kick_times:
        d = (t - kt) % total if loop else t - kt
        mask = d >= 0
        g[mask] -= depth * np.exp(-d[mask] / rel) * np.minimum(1, d[mask] / 0.004)
    return np.clip(g, 1 - depth, 1)


# ---------------------------------------------------------------- scenes
def grid(bpm):
    beat = 60 / bpm
    return beat, beat * 4


def scene_lobby():
    beat, bar = grid(90)
    tr = Track(6 * bar)
    chords = [([57, 60, 64, 67, 71], 45, 2), ([53, 57, 60, 64, 67], 41, 2),
              ([50, 53, 57, 60, 64], 38, 1), ([52, 55, 59, 62, 64], 40, 1)]
    pos, kicks = 0, []
    swing = 0.09 * beat
    arp_cycle = [0, 2, 4, 3, 1, 3, 4, 2]
    for notes, root, bars in chords:
        at = pos * bar
        pad(tr, at, bars * bar - 0.05, notes, cutoff=1100, level=0.05, attack=0.6, release=0.45, seed=pos)
        for b in range(bars):
            bt = at + b * bar
            for off, d in ((0, 1.4), (1.5, 0.45), (2.5, 1.2), (3.5, 0.4)):
                bass(tr, bt + off * beat, d * beat, root, cutoff=260, level=0.30, sub=0.9, env_amt=300)
            for i in range(8):
                pluck(tr, bt + i * beat / 2 + (swing if i % 2 else 0), notes[arp_cycle[i]] + 12,
                      level=0.05 if i % 2 else 0.065, cutoff=700)
        pos += bars
    for b in range(6):
        bt = b * bar
        for k in (0, 1.75, 2.5):
            tr.add('drums', bt + k * beat, kick(f0=120, f1=48, decay=0.26, click=0.2), 0.75)
            kicks.append(bt + k * beat)
        for s in (1, 3):
            tr.add('drums', bt + s * beat, fft_filter(snare(tone=210, decay=0.11, noise_lp=5000), lp=6000, circular=False), 0.4)
        for i in range(8):
            tr.add('hats', bt + i * beat / 2 + (swing if i % 2 else 0), hat(0.025, lp=9000), 0.12 if i % 2 else 0.2)
    # synthwave motif over bars 2-5 (original)
    motif = [(2, 0, 76, 1.5), (2, 1.5, 74, 0.5), (2, 2, 72, 1), (2, 3, 69, 1), (3, 0, 72, 2), (3, 2.5, 71, 1.5),
             (4, 0, 69, 1), (4, 1, 72, 1), (4, 2, 74, 2), (5, 0, 76, 1), (5, 1.5, 79, 0.5), (5, 2, 76, 2)]
    for b, off, m, d in motif:
        lead(tr, b * bar + off * beat, d * beat * 0.95, m, cutoff=1400, level=0.07, kind='square',
             detune=(-5, 5), sustain=0.7, env_amt=900, vib=0.006, reso=0.1)
    sc = sidechain(tr.n, kicks, depth=0.35, rel=0.2)
    mix = (fft_filter(tr.bus('drums'), lp=9000) + tr.bus('hats') + tr.bus('bass') * sc
           + reverb(tr.bus('pad') * sc + tr.bus('keys') + tr.bus('lead'), 1.8, 4500, 0.45))
    # lo-fi warmth: gentle top roll-off
    return fft_filter(mix, lp=7500, order=1), 90


def scene_prep():
    beat, bar = grid(120)
    tr = Track(8 * bar)
    prog = [([62, 65, 69, 74], 38), ([58, 62, 65, 70], 34), ([55, 58, 62, 67], 31), ([57, 61, 64, 69], 33)]
    kicks = []
    total = tr.n / RATE
    for ci, (notes, root) in enumerate(prog):
        at = ci * 2 * bar
        n = int((2 * bar + 0.3) * RATE)
        t = at + np.arange(n) / RATE
        cutoff = 500 + 3000 * (t / total) ** 1.6
        pad(tr, at, 2 * bar - 0.05, notes, cutoff=cutoff, level=0.05, attack=0.2, release=0.3, seed=ci)
        for i in range(16):
            tt = at + i * beat / 2
            prog_c = 300 + 1500 * (tt / total) ** 1.4
            bass(tr, tt, beat / 2 * 0.8, root + (12 if i % 4 == 3 else 0), cutoff=prog_c, level=0.28,
                 sub=0.8, env_amt=600)
    for b in range(8):
        bt = b * bar
        hits = (0, 2) if b < 4 else (0, 1, 2, 3)
        for k in hits:
            tr.add('drums', bt + k * beat, kick(f0=160, f1=45, decay=0.28, click=0.5), 0.85)
            kicks.append(bt + k * beat)
        if b >= 2 and b < 7:
            for s in (1, 3):
                tr.add('drums', bt + s * beat, clap(), 0.45)
        steps = 8 if b < 4 else 16
        for i in range(steps):
            vel = 0.08 + 0.12 * (b / 8) + (0.06 if i % 2 == 0 else 0)
            tr.add('hats', bt + i * bar / steps, hat(0.02), vel)
    # snare roll in the last bar: 16ths then 32nds, rising
    bt = 7 * bar
    for i in range(8):
        tr.add('drums', bt + i * beat / 4, snare(decay=0.09), 0.18 + 0.2 * i / 8)
    for i in range(16):
        tr.add('drums', bt + 2 * beat + i * beat / 8, snare(decay=0.07), 0.3 + 0.35 * i / 16)
    tr.add('drums', 0.0, crash(), 0.35)
    riser(tr, 4 * bar, 4 * bar - 0.12, level=0.14)
    # pulsing high ostinato (tension) bars 4-7
    for i in range(64):
        pluck(tr, 4 * bar + i * beat / 4, [74, 77, 81, 77][i % 4], level=0.035 + 0.03 * i / 64,
              cutoff=600 + 30 * i, kind='saw', length=0.25)
    sc = sidechain(tr.n, kicks, depth=0.45)
    mix = (tr.bus('drums') + tr.bus('hats') + tr.bus('bass') * sc + tr.bus('fx')
           + reverb(tr.bus('pad') * sc + tr.bus('keys'), 1.4, 5000, 0.35))
    return mix, 120


COMBAT_KICK = [0, 3, 6, 8, 10, 14]


def combat_core(tr, bpm, dark=False):
    beat, bar = grid(bpm)
    s16 = beat / 4
    prog = [40, 40, 36, 38, 40, 40, 36, 38, 45, 36, 35, 35]
    voicing = {40: [52, 55, 59, 64], 36: [48, 52, 55, 60], 38: [50, 54, 57, 62], 45: [57, 60, 64, 69],
               35: [47, 51, 54, 59]}
    kicks = []
    for b, root in enumerate(prog):
        bt = b * bar
        fill = b == len(prog) - 1
        for st in COMBAT_KICK:
            if fill and st > 8:
                continue
            tr.add('drums', bt + st * s16, kick(f0=170, f1=48, decay=0.22, click=0.7, drive=2.2), 0.9)
            kicks.append(bt + st * s16)
        for st in (4, 12):
            if not (fill and st == 12):
                tr.add('drums', bt + st * s16, snare(tone=200, decay=0.15), 0.7)
        for st in range(16):
            if st % 4 == 2:
                tr.add('hats', bt + st * s16, hat(0.11, 0.25), 0.16)
            else:
                tr.add('hats', bt + st * s16, hat(0.025), 0.14 if st % 2 == 0 else 0.08)
        if fill:
            for i, st in enumerate(range(8, 16)):
                tr.add('drums', bt + st * s16, tom(160 - 12 * i), 0.5)
                tr.add('drums', bt + st * s16, snare(decay=0.08), 0.25 + 0.04 * i)
        # rolling 16th bass with octave pops
        for st in range(16):
            m = root + (12 if st in (6, 14) else 0) + (7 if st == 11 else 0)
            bass(tr, bt + st * s16, s16 * 0.85, m, cutoff=380, level=0.26, sub=0.75, env_amt=1400)
        # palm-muted "rock" power chord 8ths
        for st in range(0, 16, 2):
            for iv in (0, 7, 12):
                n = int(s16 * 1.7 * RATE)
                s = osc(mtof(root + 12 + iv), n, 1800, 'saw', (-6, 6))
                tr.add('gtr', bt + st * s16, np.tanh(3.0 * s) * env(n, 0.002, 0.08, 0.3, 0.02) * 0.05)
        pad(tr, bt, bar - 0.04, voicing[root], cutoff=1500, level=0.028, attack=0.05, release=0.2, seed=b)
    tr.add('drums', 0.0, crash(), 0.3)
    tr.add('drums', 8 * bar, crash(), 0.25)
    return kicks


def scene_combat():
    bpm = 160
    beat, bar = grid(bpm)
    s16 = beat / 4
    tr = Track(12 * bar)
    kicks = combat_core(tr, bpm)
    # original lead riff (2-bar cell, transposed per section)
    cell = [(0, 64, 2), (2, 67, 1), (3, 69, 1), (4, 71, 2), (6, 69, 1), (7, 67, 1), (8, 74, 3), (11, 71, 1),
            (12, 69, 2), (14, 67, 2), (16, 64, 1), (17, 64, 1), (18, 67, 2), (20, 71, 2), (22, 72, 2),
            (24, 71, 3), (27, 67, 1), (28, 69, 4)]
    for section, shift in ((0, 12), (4, 12), (8, 9)):
        if section == 8:
            cell_use = [(s, m, d) for s, m, d in cell][:12]
        else:
            cell_use = cell
        for rep in (0, 1):
            if section == 8 and rep == 1:
                break
            for st, m, d in cell_use:
                lead(tr, (section + rep * 2) * bar + st * s16, d * s16 * 0.92, m + shift - 12 + 12,
                     cutoff=2200, level=0.075, detune=(-8, 0, 8), decay=0.25, sustain=0.5, env_amt=3500)
    # answer phrase in bars 8-11
    answer = [(0, 81, 4), (4, 79, 2), (6, 76, 2), (8, 77, 4), (12, 76, 4), (16, 74, 4), (20, 75, 4),
              (24, 78, 8)]
    for st, m, d in answer:
        lead(tr, 9 * bar + st * s16, d * s16 * 0.95, m - 3, cutoff=2600, level=0.06, kind='square',
             detune=(-6, 6), vib=0.005)
    sc = sidechain(tr.n, kicks, depth=0.5, rel=0.12)
    mix = (tr.bus('drums') + tr.bus('hats') + tr.bus('bass') * sc + tr.bus('gtr') * (0.6 + 0.4 * sc)
           + reverb(tr.bus('pad') * sc + tr.bus('lead'), 1.1, 6000, 0.28))
    return mix, bpm


def scene_tension():
    bpm = 150
    beat, bar = grid(bpm)
    s16 = beat / 4
    tr = Track(10 * bar)
    prog = [(37, [49, 52, 56, 61]), (37, [49, 52, 56, 62]), (38, [50, 54, 57, 62]), (37, [49, 52, 55, 61]),
            (33, [45, 49, 52, 56])]
    kicks = []
    for i, (root, notes) in enumerate(prog):
        at = i * 2 * bar
        pad(tr, at, 2 * bar - 0.05, notes, cutoff=700, level=0.06, attack=0.5, release=0.6, seed=10 + i)
        n = int((2 * bar + 0.04) * RATE)
        t = np.arange(n) / RATE
        drone = osc(mtof(root - 12), n, 180 + 120 * np.sin(2 * np.pi * t / (2 * bar)) ** 2, 'saw', (-5, 5), reso=0.6)
        drone += 0.8 * np.sin(2 * np.pi * mtof(root - 12) * t)
        tr.add('bass', at, drone * env(n, 0.05, 10, 1, 0.05) * 0.3)
    for b in range(10):
        bt = b * bar
        for k in (0, 2):              # heartbeat: lub-dub
            tr.add('drums', bt + k * beat, kick(f0=95, f1=42, decay=0.32, click=0.08, drive=1.3), 0.95)
            tr.add('drums', bt + k * beat + 0.27 * beat * 2 / 2, kick(f0=85, f1=40, decay=0.25, click=0.05, drive=1.2), 0.6)
            kicks += [bt + k * beat]
        tr.add('drums', bt + 3 * beat, fft_filter(snare(tone=170, decay=0.22), lp=3500, circular=False), 0.45)
        for st in range(16):
            tr.add('hats', bt + st * s16, hat(0.012, lp=8000), 0.07 if st % 4 else 0.12)
    # filtered, darker echo of the combat riff idea (low register)
    frag = [(0, 61, 2), (2, 64, 1), (3, 66, 1), (4, 68, 3), (8, 67, 4), (12, 64, 2), (14, 61, 2)]
    for b in (2, 4, 6, 8):
        for st, m, d in frag:
            lead(tr, b * bar + st * s16, d * s16 * 0.9, m - 12 + (1 if b == 8 else 0), cutoff=900, level=0.08,
                 detune=(-10, 10), env_amt=600, decay=0.3, sustain=0.6)
    # distant metallic ticks
    for b in range(0, 10, 2):
        bell(tr, b * bar + 3.5 * beat, 85, level=0.025, length=1.0)
    sc = sidechain(tr.n, kicks, depth=0.4, rel=0.2)
    mix = (tr.bus('drums') + tr.bus('hats') + tr.bus('bass') * sc
           + reverb(tr.bus('pad') + tr.bus('lead') + tr.bus('keys'), 2.2, 3000, 0.5))
    return fft_filter(mix, lp=4200), bpm


def scene_ultimate():
    bpm = 180
    beat, bar = grid(bpm)
    s16 = beat / 4
    tr = Track(12 * bar)
    # super stinger at the top: huge brass chord + boom
    tr.add('fx', 0.0, impact(), 0.9)
    brass(tr, 0.0, 2 * bar - 0.2, [53, 60, 65, 68, 72], level=0.07, bright=3800)
    kicks = []
    prog = [41, 41, 44, 46, 41, 41, 37, 39, 41, 44, 39, 39]
    for b, root in enumerate(prog):
        bt = b * bar
        if b >= 2:
            for st in (0, 10):
                tr.add('drums', bt + st * s16, kick(f0=180, f1=47, decay=0.2, click=0.8, drive=2.4), 0.9)
                kicks.append(bt + st * s16)
            for st in (4, 12):
                tr.add('drums', bt + st * s16, snare(tone=220, decay=0.14), 0.75)
            for st in (7, 14):
                tr.add('drums', bt + st * s16, snare(decay=0.05), 0.18)
            for st in range(0, 16, 2):
                tr.add('hats', bt + st * s16, hat(0.03), 0.16)
            for st in range(1, 16, 2):
                tr.add('hats', bt + st * s16, hat(0.015), 0.07)
        else:
            # timpani-like rolls under the stinger
            for i in range(16 if b == 1 else 0):
                tr.add('drums', bt + i * s16, tom(70 + 2 * i, 0.25), 0.15 + 0.02 * i)
        # reese bass
        n = int((bar + 0.02) * RATE)
        t = np.arange(n) / RATE
        if b >= 2:
            s = osc(mtof(root - 12), n, 500 + 350 * np.sin(2 * np.pi * t * 1.5) ** 2, 'saw', (-14, 14), reso=0.3)
            s += 0.7 * np.sin(2 * np.pi * mtof(root - 12) * t)
            tr.add('bass', bt, np.tanh(1.5 * s) * env(n, 0.005, 10, 1, 0.02) * 0.24)
    # brass stab figures & heroic line (original)
    for b in (4, 8):
        for off, dur in ((0, 0.5), (0.75, 0.5), (1.5, 1.5)):
            brass(tr, b * bar + off * beat, dur * beat, [53, 60, 65, 68] if b == 4 else [56, 63, 68, 72],
                  level=0.06, bright=3000)
    line = [(2, 0, 65, 2), (2, 2, 68, 1), (2, 3, 72, 1), (3, 0, 75, 3), (3, 3, 73, 1), (6, 0, 72, 2), (6, 2, 70, 2),
            (7, 0, 68, 1.5), (7, 1.5, 70, 0.5), (7, 2, 72, 2), (10, 0, 75, 2), (10, 2, 77, 2), (11, 0, 80, 4)]
    for b, off, m, d in line:
        brass(tr, b * bar + off * beat, d * beat * 0.95, [m, m - 12], level=0.05, bright=2600, fall=False)
    tr.add('drums', 2 * bar, crash(), 0.35)
    tr.add('drums', 8 * bar, crash(), 0.3)
    riser(tr, 10 * bar, 2 * bar - 0.1, level=0.1, seed=9)
    sc = sidechain(tr.n, kicks, depth=0.45, rel=0.12)
    mix = (tr.bus('drums') + tr.bus('hats') + tr.bus('bass') * sc + tr.bus('fx')
           + reverb(tr.bus('brass'), 1.6, 6500, 0.35))
    return mix, bpm


def scene_victory():
    bpm = 120
    beat, bar = grid(bpm)
    tr = Track(9.0, loop=False)
    # rising pickup into a major hit, then a bright held chord
    run = [(0, 60), (0.5, 64), (1, 67), (1.5, 72)]
    for off, m in run:
        brass(tr, off * beat, 0.45 * beat, [m, m + 12], level=0.06, bright=3500)
        tr.add('drums', off * beat, snare(decay=0.08), 0.25 + 0.1 * off)
    hits = [(2, [60, 67, 72, 76], 1.0), (3, [62, 69, 74, 77], 0.5), (3.5, [64, 71, 76, 79], 0.5),
            (4, [65, 72, 77, 81], 1.5), (5.5, [67, 74, 79, 83], 0.5), (6, [60, 64, 67, 72, 76, 79], 5.0)]
    for off, notes, d in hits:
        brass(tr, off * beat, d * beat, notes, level=0.045, bright=4200)
        tr.add('drums', off * beat, kick(f0=140, f1=50, decay=0.4), 0.7)
        tr.add('drums', off * beat, tom(90, 0.6), 0.35)
    tr.add('drums', 2 * beat, crash(2.0), 0.35)
    tr.add('drums', 6 * beat, crash(2.6), 0.4)
    for i in range(12):                 # snare roll swell before the final chord
        tr.add('drums', 4.5 * beat + i * beat / 8, snare(decay=0.06), 0.12 + 0.03 * i)
    for i, m in enumerate([84, 88, 91, 96, 91, 88, 91, 96]):
        bell(tr, 6 * beat + i * beat / 4, m, level=0.04, length=1.5)
    pad(tr, 6 * beat, 5.0, [48, 55, 64, 67], cutoff=2000, level=0.04, attack=0.05, release=1.0, seed=99)
    for off in (0, 2, 4, 6):
        bass(tr, off * beat, 0.9 * beat if off < 6 else 4.0, 36 if off != 4 else 41, cutoff=500, level=0.25)
    mix = tr.bus('drums') + tr.bus('bass') + reverb(tr.bus('brass') + tr.bus('keys') + tr.bus('pad'),
                                                    2.0, 7000, 0.4, circular=False)
    return mix, bpm


def scene_defeat():
    bpm = 60
    beat, bar = grid(bpm)
    tr = Track(10.0, loop=False)
    chords = [(0, [57, 60, 64, 69], 45), (2, [55, 59, 62, 67], 43), (4, [53, 57, 60, 65], 41),
              (6, [52, 56, 59, 64], 40)]
    for off, notes, root in chords:
        pad(tr, off * beat, 2 * beat + 0.2, notes, cutoff=1300 - off * 90, level=0.07, attack=0.25,
            release=0.9, seed=off)
        bass(tr, off * beat, 1.9 * beat, root - 12, cutoff=300, level=0.3, sub=1.0, env_amt=200)
        tr.add('drums', off * beat, fft_filter(kick(f0=90, f1=38, decay=0.5, click=0.05), lp=900, circular=False), 0.7)
    # falling sigh motif
    for off, m in ((0.5, 76), (1.5, 74), (2.5, 74), (3.5, 72), (4.5, 72), (5.5, 69), (6.5, 68)):
        lead(tr, off * beat, 0.9 * beat, m, cutoff=1100, level=0.06, kind='tri', detune=(0,), vib=0.004,
             env_amt=300, sustain=0.6, glide=(1.02, 0.08))
    # final low A minor sinking (tape-sag pitch fall) and fading
    n = int(3.6 * RATE)
    t = np.arange(n) / RATE
    sag = 1 - 0.06 * (t / t[-1]) ** 2
    s = np.zeros(n)
    for m in (45, 52, 57, 60):
        ph = 2 * np.pi * np.cumsum(mtof(m) * sag) / RATE
        s += np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    tr.add('pad', 8 * beat, s * env(n, 0.3, 10, 1, 1.5) * 0.06)
    mix = tr.bus('drums') + tr.bus('bass') + reverb(tr.bus('pad') + tr.bus('lead'), 2.6, 3500, 0.5,
                                                    circular=False)
    return mix, bpm


SCENES = {'lobby': scene_lobby, 'prep': scene_prep, 'combat': scene_combat, 'tension': scene_tension,
          'ultimate': scene_ultimate, 'victory': scene_victory, 'defeat': scene_defeat}
LOOPING = {'lobby', 'prep', 'combat', 'tension', 'ultimate'}


# ---------------------------------------------------------------- mastering
def soft_limit(x):
    return PEAK * np.tanh(x / PEAK)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def master(x, loop):
    x = x - x.mean()
    if not loop:
        fade_in = int(0.004 * RATE)
        fade_out = int(0.6 * RATE)
        x[:fade_in] *= np.linspace(0, 1, fade_in)
        x[-fade_out:] *= np.linspace(1, 0, fade_out) ** 2
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-12) * 10 ** (TARGET_RMS_DB / 20)
    g = 1.0
    for _ in range(12):                       # compensate limiter loss
        y = soft_limit(x * g)
        g *= 10 ** ((TARGET_RMS_DB - rms_db(y)) / 20)
    y = soft_limit(x * g)
    y = y - y.mean()
    y = np.clip(y, -PEAK, PEAK)
    if loop:
        # rotate by a few samples so the loop starts on a quiet zero crossing
        # (keeps the circular signal intact; grid shift <= 50 ms)
        span = int(0.05 * RATE)
        cand = np.arange(-span, span)
        score = np.maximum(np.abs(y[cand]), np.abs(y[cand - 1]))
        y = np.roll(y, -int(cand[np.argmin(score)]))
    return y


def write_wav(path, y):
    pcm = np.round(y * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    return pcm


def measure(pcm, loop):
    x = pcm.astype(float) / 32768
    w = int(0.02 * RATE)
    d = np.abs(np.diff(x))
    jump = abs(x[0] - x[-1])
    return dict(
        sec=len(x) / RATE,
        peak_db=20 * np.log10(np.abs(x).max() + 1e-12),
        rms_db=rms_db(x),
        dc=float(x.mean()),
        head_db=rms_db(x[:w]),
        tail_db=rms_db(x[-w:]),
        seam_jump=jump,
        seam_vs_p99=jump / (np.percentile(d, 99) + 1e-12),
        first=int(pcm[0]),
        last=int(pcm[-1]),
    )


if __name__ == '__main__':
    total = 0
    print(f"{'scene':9} {'bpm':>4} {'sec':>5} {'peak':>6} {'rms':>6} {'dc':>8} {'head20':>7} {'tail20':>7} "
          f"{'seam':>7} {'seam/p99':>8} {'first':>6} {'last':>6} {'bytes':>8}")
    for name, fn in SCENES.items():
        loop = name in LOOPING
        mix, bpm = fn()
        y = master(mix, loop)
        path = OUT / f'{name}.wav'
        pcm = write_wav(path, y)
        m = measure(pcm, loop)
        size = path.stat().st_size
        total += size
        print(f"{name:9} {bpm:4d} {m['sec']:5.2f} {m['peak_db']:6.2f} {m['rms_db']:6.2f} {m['dc']:8.5f} "
              f"{m['head_db']:7.1f} {m['tail_db']:7.1f} {m['seam_jump']:7.4f} {m['seam_vs_p99']:8.3f} "
              f"{m['first']:6d} {m['last']:6d} {size:8d}")
    print(f'total music bytes: {total} ({total / 1e6:.2f} MB)')
