"""TuşLab PvP — original sound effects (rev. 2, punchier layering).

Every effect is synthesised from oscillators + filtered noise + envelopes;
nothing is sampled or imitated from a commercial game.
Layering idea for impacts: low transient (pitch-dropping sine) + body
(band-passed noise / tone) + short crack (bright noise burst).
Output: 22050 Hz, 16-bit, mono WAV, peak -1 dBFS, 2 ms fade-in / 12+ ms fade-out.
File names follow SFX_NAMES in pvp/sound.js. Deterministic (fixed seed).
Run: python scripts/generate-sfx.py
"""
from pathlib import Path
import wave

import numpy as np

RATE = 22050
NYQ = RATE / 2
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'sfx'
OUT.mkdir(parents=True, exist_ok=True)
PEAK = 10 ** (-1 / 20)
RNG = np.random.default_rng(20261110)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def T(sec):
    return np.arange(int(round(sec * RATE))) / RATE


def bandnoise(sec, lo=None, hi=None, order=2):
    n = int(round(sec * RATE))
    x = RNG.standard_normal(n + 2048)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    g[0] = 0
    y = np.fft.irfft(X * g, len(x))[1024:1024 + n]
    return y / (np.abs(y).max() + 1e-9)


def sweep(sec, f0, f1, kind='sine', curve='exp'):
    t = T(sec)
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (t / sec)
    else:
        f = f0 + (f1 - f0) * t / sec
    ph = 2 * np.pi * np.cumsum(f) / RATE
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    out = np.zeros_like(t)
    for k in range(1, 30):
        if kind == 'square' and k % 2 == 0:
            continue
        mask = (k * f) < NYQ * 0.9
        out += mask * np.sin(k * ph) / k
    return out


def tone(sec, midi_or_hz, partials=((1, 1.0),), decay=0.3, hz=False):
    t = T(sec)
    f = midi_or_hz if hz else mtof(midi_or_hz)
    out = np.zeros_like(t)
    for ratio, amp in partials:
        if ratio * f < NYQ * 0.95:
            out += amp * np.sin(2 * np.pi * f * ratio * t + RNG.uniform(0, 6.28))
    return out * np.exp(-t / decay)


def expdec(sec, tau, attack=0.001):
    t = T(sec)
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / tau)


def thump(sec=0.3, f0=160, f1=45, tau=0.12, drive=2.0):
    t = T(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.025)
    s = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t / tau)
    return np.tanh(drive * s) / np.tanh(drive)


def crack(sec=0.08, lo=2500, hi=10000, tau=0.012):
    return bandnoise(sec, lo, hi) * expdec(sec, tau, 0.0004)


def bell(sec, midi, decay=0.6, inharm=(1, 2.76, 5.4, 8.93), amps=(1, 0.55, 0.3, 0.15)):
    t = T(sec)
    f = mtof(midi)
    out = np.zeros_like(t)
    for r, a in zip(inharm, amps):
        if r * f < NYQ * 0.95:
            out += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (decay / (1 + 0.6 * (r - 1))))
    return out


def place(buf, at, sig, gain=1.0):
    s = int(round(at * RATE))
    e = min(len(buf), s + len(sig))
    if e > s:
        buf[s:e] += sig[: e - s] * gain
    return buf


def blank(sec):
    return np.zeros(int(round(sec * RATE)))


def lowpass(x, hi, order=2):
    X = np.fft.rfft(np.concatenate([x, np.zeros(2048)]))
    f = np.fft.rfftfreq(len(x) + 2048, 1 / RATE)
    y = np.fft.irfft(X / np.sqrt(1 + (f / hi) ** (2 * order)), len(x) + 2048)
    return y[: len(x)]


def crackle(sec, density=60, seed_gain=1.0):
    """Sparse fire crackle: random tiny bright clicks."""
    out = blank(sec)
    count = int(density * sec)
    for _ in range(count):
        at = RNG.uniform(0, sec - 0.01)
        c = crack(0.006, 3000, 11000, 0.0015) * RNG.uniform(0.3, 1.0) * seed_gain
        place(out, at, c)
    return out


def flame(sec, lo0=300, hi0=1200, lo1=900, hi1=5000, tau=None):
    """Whoosh: noise whose band sweeps up then settles; amplitude swell."""
    a = bandnoise(sec, lo0, hi0)
    b = bandnoise(sec, lo1, hi1)
    t = T(sec)
    p = np.sin(np.pi * np.minimum(1, t / sec)) ** 0.8
    mixp = np.minimum(1, t / (sec * 0.45))
    body = (1 - mixp) * a + mixp * b
    if tau:
        p = p * np.exp(-t / tau)
    return body * p


# ---------------------------------------------------------------- effects
def fx_hit():
    s = blank(0.32)
    place(s, 0, thump(0.3, 170, 50, 0.09, 2.5), 0.9)
    place(s, 0, bandnoise(0.25, 300, 1800) * expdec(0.25, 0.05), 0.5)
    place(s, 0.002, crack(0.07, 2500, 9000, 0.01), 0.45)
    return s


def fx_critical():
    s = blank(0.6)
    place(s, 0, thump(0.5, 200, 42, 0.16, 3.0), 1.0)
    place(s, 0, bandnoise(0.45, 250, 2500) * expdec(0.45, 0.09), 0.6)
    place(s, 0.0, crack(0.12, 2000, 11000, 0.02), 0.7)
    place(s, 0.03, crack(0.08, 4000, 11000, 0.012), 0.4)
    shine = sweep(0.5, 1800, 3600, 'sine') * expdec(0.5, 0.14, 0.003)
    place(s, 0.02, shine + 0.5 * bell(0.5, 96, 0.25), 0.25)
    return s


def fx_block():
    s = blank(0.3)
    place(s, 0, thump(0.25, 220, 90, 0.05, 2.0), 0.6)
    metal = tone(0.28, 380, ((1, 1), (2.41, 0.6), (3.9, 0.35), (5.2, 0.2)), 0.07, hz=True)
    place(s, 0, metal, 0.55)
    place(s, 0, crack(0.04, 1500, 6000, 0.006), 0.4)
    return s


def fx_shield():
    s = blank(0.7)
    t = T(0.7)
    hum = sweep(0.7, 180, 360, 'saw')
    hum = lowpass(hum, 1600) * np.minimum(1, t / 0.06) * np.exp(-t / 0.35)
    shim = (bell(0.7, 79, 0.5) + bell(0.7, 86, 0.45)) * np.minimum(1, t / 0.02)
    place(s, 0, hum, 0.5)
    place(s, 0.01, shim, 0.25)
    place(s, 0, bandnoise(0.5, 2000, 7000) * np.minimum(1, T(0.5) / 0.08) * np.exp(-T(0.5) / 0.12), 0.18)
    return s


def fx_parry():
    s = blank(0.45)
    ring = tone(0.45, 1250, ((1, 1), (2.03, 0.5), (3.4, 0.35)), 0.16, hz=True)
    place(s, 0, crack(0.05, 3000, 11000, 0.008), 0.7)
    place(s, 0.003, ring, 0.5)
    place(s, 0.04, tone(0.4, 1580, ((1, 1), (2.6, 0.3)), 0.12, hz=True), 0.3)
    place(s, 0, thump(0.15, 260, 140, 0.03, 1.5), 0.35)
    return s


def fx_perfect():
    s = blank(0.75)
    for i, m in enumerate((84, 88, 91, 96)):
        place(s, i * 0.055, bell(0.55, m, 0.35), 0.28)
    place(s, 0, sweep(0.3, 600, 2400, 'tri') * expdec(0.3, 0.12, 0.004), 0.25)
    place(s, 0, crack(0.05, 4000, 11000, 0.008), 0.35)
    return s


def fx_counter():
    s = blank(0.5)
    place(s, 0, lowpass(sweep(0.18, 400, 120, 'saw'), 1500) * expdec(0.18, 0.06), 0.35)
    place(s, 0.08, thump(0.35, 180, 48, 0.1, 2.5), 0.9)
    place(s, 0.08, crack(0.07, 2500, 10000, 0.012), 0.5)
    place(s, 0.08, bandnoise(0.3, 400, 2000) * expdec(0.3, 0.06), 0.4)
    return s


def fx_shatter():
    s = blank(0.9)
    place(s, 0, thump(0.3, 150, 60, 0.07, 2.0), 0.6)
    place(s, 0, crack(0.15, 3000, 11000, 0.04), 0.6)
    for i in range(26):
        at = 0.01 + RNG.exponential(0.12)
        if at > 0.75:
            continue
        m = RNG.uniform(88, 104)
        place(s, at, bell(0.15, m, 0.06), RNG.uniform(0.08, 0.2) * (1 - at))
    return s


def fx_clash():
    s = blank(0.5)
    place(s, 0, thump(0.3, 200, 70, 0.07, 2.2), 0.6)
    place(s, 0, tone(0.48, 620, ((1, 1), (1.52, 0.8), (2.71, 0.5), (4.13, 0.3)), 0.18, hz=True), 0.45)
    place(s, 0, crack(0.06, 2500, 11000, 0.01), 0.6)
    return s


# fire: flaming whoosh + crackle
def fx_fire_q():
    s = blank(0.55)
    place(s, 0, flame(0.5, 250, 1000, 800, 4500), 0.6)
    place(s, 0, crackle(0.5, 50), 0.35)
    place(s, 0.18, thump(0.3, 140, 55, 0.08, 2.0), 0.45)
    return s


def fx_fire_e():
    s = blank(0.7)
    place(s, 0, flame(0.66, 200, 900, 600, 3500), 0.6)
    place(s, 0, lowpass(sweep(0.6, 90, 220, 'saw'), 900) * np.sin(np.pi * T(0.6) / 0.6), 0.35)
    place(s, 0.05, crackle(0.6, 70), 0.4)
    return s


def fx_fire_r():
    s = blank(1.4)
    t = T(1.0)
    build = flame(1.0, 150, 700, 900, 6000) * (t / 1.0) ** 1.2
    place(s, 0, build, 0.55)
    place(s, 0, lowpass(sweep(1.0, 60, 240, 'saw'), 1200) * (t / 1.0), 0.35)
    place(s, 0.95, thump(0.45, 140, 38, 0.2, 3.0), 1.0)
    place(s, 0.95, flame(0.45, 300, 2500, 200, 1200, tau=0.15), 0.6)
    place(s, 0.95, crack(0.1, 2000, 10000, 0.02), 0.5)
    place(s, 0.1, crackle(1.25, 70), 0.35)
    return s


# rune: crystal / bell tones
def fx_rune_q():
    s = blank(0.6)
    for i, m in enumerate((81, 88, 93)):
        place(s, i * 0.04, bell(0.5, m, 0.3), 0.3)
    place(s, 0, sweep(0.2, 3000, 6000, 'sine') * expdec(0.2, 0.05, 0.002), 0.15)
    place(s, 0.12, thump(0.2, 220, 120, 0.04, 1.4), 0.25)
    return s


def fx_rune_e():
    s = blank(0.8)
    t = T(0.8)
    glass = sum(bell(0.8, m, 0.55) for m in (76, 83, 88)) / 2
    trem = 1 + 0.35 * np.sin(2 * np.pi * 11 * t)
    place(s, 0, glass * trem, 0.3)
    place(s, 0, bandnoise(0.6, 4000, 9000) * np.minimum(1, T(0.6) / 0.1) * np.exp(-T(0.6) / 0.15), 0.12)
    return s


def fx_rune_r():
    s = blank(1.5)
    for i, m in enumerate((69, 76, 81, 84, 88, 93)):
        place(s, i * 0.12, bell(0.9, m, 0.5), 0.17 + 0.02 * i)
    t = T(0.9)
    place(s, 0, sweep(0.9, 220, 880, 'tri') * (t / 0.9) ** 2, 0.15)
    place(s, 0.9, thump(0.5, 180, 40, 0.18, 2.5), 0.85)
    place(s, 0.9, sum(bell(0.6, m, 0.4) for m in (81, 88, 93, 100)) / 2, 0.35)
    place(s, 0.9, crack(0.08, 4000, 11000, 0.012), 0.4)
    return s


def fx_key():
    s = blank(0.06)
    place(s, 0, bandnoise(0.05, 1500, 5000) * expdec(0.05, 0.006, 0.0005), 0.6)
    place(s, 0, tone(0.05, 900, ((1, 1),), 0.008, hz=True), 0.4)
    return s


def fx_word_correct():
    s = blank(0.35)
    place(s, 0, tone(0.2, 79, ((1, 1), (2, 0.3), (3, 0.12)), 0.08), 0.4)
    place(s, 0.07, tone(0.28, 84, ((1, 1), (2, 0.3), (3, 0.12)), 0.12), 0.45)
    place(s, 0, crack(0.02, 3000, 9000, 0.004), 0.2)
    return s


def fx_word_wrong():
    s = blank(0.4)
    for at, m in ((0, 52), (0.13, 51)):
        b = lowpass(sweep(0.2, mtof(m), mtof(m) * 0.94, 'square'), 1400)
        place(s, at, b * expdec(0.2, 0.09, 0.003), 0.4)
    place(s, 0, bandnoise(0.12, 200, 900) * expdec(0.12, 0.03), 0.2)
    return s


def fx_round_start():
    s = blank(1.0)
    t = T(0.5)
    place(s, 0, lowpass(sweep(0.5, 220, 880, 'saw'), 2500) * (t / 0.5) ** 1.5, 0.3)
    place(s, 0, bandnoise(0.5, 1500, 8000) * (t / 0.5) ** 2, 0.2)
    chord = sum(lowpass(sweep(0.5, mtof(m), mtof(m), 'saw'), 3500) for m in (62, 69, 74, 78)) / 3
    place(s, 0.5, chord * expdec(0.5, 0.2, 0.005), 0.45)
    place(s, 0.5, thump(0.4, 170, 45, 0.15, 2.6), 0.9)
    place(s, 0.5, crack(0.08, 2500, 10000, 0.015), 0.4)
    return s


def fx_prep():
    s = blank(0.9)
    for i in range(4):
        place(s, i * 0.18, tone(0.15, 69 + (5 if i == 3 else 0), ((1, 1), (3, 0.2)), 0.05), 0.3 + 0.05 * i)
        place(s, i * 0.18, thump(0.12, 120, 60, 0.03, 1.5), 0.25)
    place(s, 0, bandnoise(0.85, 400, 2500) * (T(0.85) / 0.85) ** 2 * np.exp(-T(0.85) / 0.6), 0.15)
    return s


def fx_skill_lock():
    s = blank(0.45)
    place(s, 0, tone(0.08, 1800, ((1, 1), (2.3, 0.4)), 0.02, hz=True), 0.5)
    place(s, 0.06, tone(0.35, 300, ((1, 1), (2.01, 0.5), (3.4, 0.3)), 0.09, hz=True), 0.4)
    place(s, 0.06, thump(0.2, 200, 90, 0.04, 2.0), 0.4)
    return s


def fx_scramble():
    s = blank(0.6)
    for i in range(12):
        m = RNG.integers(70, 95)
        b = lowpass(sweep(0.05, mtof(m), mtof(m) * RNG.uniform(0.7, 1.4), 'square'), 3000)
        place(s, i * 0.042, b * expdec(0.05, 0.015, 0.001), 0.25)
    place(s, 0, bandnoise(0.55, 800, 5000) * np.abs(np.sin(2 * np.pi * 18 * T(0.55))) * np.exp(-T(0.55) / 0.3), 0.15)
    return s


def fx_time_thief():
    s = blank(0.8)
    t = T(0.7)
    place(s, 0, lowpass(sweep(0.7, 1200, 150, 'saw'), 2000) * np.exp(-t / 0.35), 0.35)
    for i in range(6):
        place(s, i * 0.11, tone(0.05, 2400 - 250 * i, ((1, 1),), 0.012, hz=True), 0.3)
    place(s, 0, bandnoise(0.7, 500, 3000) * np.sin(np.pi * t / 0.7), 0.15)
    return s


def fx_time_freeze():
    s = blank(1.0)
    t = T(1.0)
    place(s, 0, sweep(1.0, 900, 300, 'sine') * np.exp(-t / 0.5), 0.2)
    for i, m in enumerate((96, 91, 88, 84)):
        place(s, i * 0.07, bell(0.8, m, 0.55, inharm=(1, 2.32, 4.25, 6.8)), 0.22)
    place(s, 0, bandnoise(0.9, 5000, 11000) * np.minimum(1, T(0.9) / 0.05) * np.exp(-T(0.9) / 0.3), 0.12)
    place(s, 0, crack(0.06, 3000, 11000, 0.01), 0.3)
    return s


def fx_blind_clock():
    s = blank(0.8)
    for i in range(4):
        tick = tone(0.04, 3200 if i % 2 == 0 else 2400, ((1, 1), (1.5, 0.4)), 0.006, hz=True)
        place(s, i * 0.16, tick, 0.5)
        place(s, i * 0.16, bandnoise(0.02, 2000, 8000) * expdec(0.02, 0.003), 0.2)
    t = T(0.6)
    place(s, 0.15, lowpass(sweep(0.6, 140, 70, 'saw'), 700) * np.sin(np.pi * t / 0.6), 0.3)
    return s


def fx_attack_turn():
    s = blank(0.5)
    t = T(0.25)
    place(s, 0, bandnoise(0.25, 800, 6000) * (t / 0.25) ** 1.5, 0.3)
    place(s, 0.2, tone(0.28, 74, ((1, 1), (2, 0.4), (3, 0.2)), 0.1), 0.35)
    place(s, 0.2, tone(0.28, 81, ((1, 1), (2, 0.4)), 0.1), 0.3)
    place(s, 0.2, thump(0.25, 190, 60, 0.07, 2.2), 0.6)
    return s


def fx_victory():
    s = blank(1.6)
    for i, (at, m) in enumerate(((0, 72), (0.11, 76), (0.22, 79))):
        place(s, at, lowpass(sweep(0.18, mtof(m), mtof(m), 'saw'), 3500) * expdec(0.18, 0.1, 0.004), 0.3)
    chord = sum(lowpass(sweep(1.2, mtof(m), mtof(m), 'saw'), 4000) for m in (72, 76, 79, 84)) / 3
    t = T(1.2)
    place(s, 0.34, chord * np.minimum(1, t / 0.01) * np.exp(-t / 0.5), 0.4)
    place(s, 0.34, thump(0.4, 160, 50, 0.15, 2.2), 0.7)
    for i, m in enumerate((91, 96, 100)):
        place(s, 0.4 + 0.08 * i, bell(0.9, m, 0.5), 0.15)
    return s


def fx_defeat():
    s = blank(1.6)
    for i, m in enumerate((64, 62, 60, 57)):
        b = lowpass(sweep(0.42, mtof(m), mtof(m) * 0.985, 'saw'), 1400)
        place(s, i * 0.28, b * expdec(0.42, 0.2, 0.01), 0.35)
    t = T(0.8)
    low = sum(np.sin(2 * np.pi * np.cumsum(np.full(len(t), mtof(m)) * (1 - 0.05 * t / 0.8)) / RATE)
              for m in (45, 52, 57))
    place(s, 0.8, low * np.minimum(1, t / 0.03) * np.exp(-t / 0.35), 0.3)
    place(s, 0.8, thump(0.4, 110, 38, 0.18, 1.6), 0.6)
    return s


EFFECTS = {
    'fire-q': fx_fire_q, 'fire-e': fx_fire_e, 'fire-r': fx_fire_r,
    'rune-q': fx_rune_q, 'rune-e': fx_rune_e, 'rune-r': fx_rune_r,
    'shield': fx_shield, 'block': fx_block, 'hit': fx_hit, 'critical': fx_critical,
    'victory': fx_victory, 'defeat': fx_defeat, 'key': fx_key, 'perfect': fx_perfect,
    'parry': fx_parry, 'counter': fx_counter, 'shatter': fx_shatter, 'prep': fx_prep,
    'skill-lock': fx_skill_lock, 'round-start': fx_round_start, 'scramble': fx_scramble,
    'time-thief': fx_time_thief, 'time-freeze': fx_time_freeze, 'blind-clock': fx_blind_clock,
    'clash': fx_clash, 'attack-turn': fx_attack_turn, 'word-correct': fx_word_correct,
    'word-wrong': fx_word_wrong,
}


def finish(x):
    x = x - x.mean()
    fi = int(0.002 * RATE)
    fo = max(int(0.012 * RATE), int(len(x) * 0.06))
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo) ** 2
    peak = np.abs(x).max() + 1e-12
    x = PEAK * np.tanh(1.25 * x / peak) / np.tanh(1.25)   # gentle saturation = punch
    w = np.ones(len(x))
    w[:fi] = np.linspace(0, 1, fi)
    w[-fo:] = np.linspace(1, 0, fo) ** 2
    x -= w * (x.mean() / w.mean())                          # DC -> 0, edges stay at 0
    x *= PEAK / (np.abs(x).max() + 1e-12)
    return x


def write_wav(path, y):
    pcm = np.round(y * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    return pcm


if __name__ == '__main__':
    total = 0
    print(f"{'name':12} {'sec':>5} {'peak':>6} {'rms':>6} {'dc':>8} {'first':>5} {'last':>5} {'bytes':>7}")
    for name, fn in EFFECTS.items():
        y = finish(fn())
        path = OUT / f'{name}.wav'
        pcm = write_wav(path, y)
        x = pcm / 32768
        size = path.stat().st_size
        total += size
        print(f"{name:12} {len(x) / RATE:5.2f} {20 * np.log10(np.abs(x).max()):6.2f} "
              f"{20 * np.log10(np.sqrt(np.mean(x ** 2))):6.2f} {x.mean():8.5f} {pcm[0]:5d} {pcm[-1]:5d} {size:7d}")
    print(f'total sfx bytes: {total} ({total / 1e6:.2f} MB)')
