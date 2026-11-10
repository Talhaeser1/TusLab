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


# ======================================================= paket 32: fighter SFX
# Character-specific cues (vargr / sira / doran / nyx). Each effect gets its own
# RNG seed (see __main__) so adding or tuning one never changes the others or
# the legacy set. All synthesised; no voice or game samples.
def swoosh(sec, lo=250, hi=3500, peak=0.45, bands=5, sharp=1.6):
    """Air whoosh: noise band whose centre sweeps up to `peak` and back down,
    amplitude swelling towards the passing moment (pass-by)."""
    t = T(sec)
    pos = np.clip(t / sec, 0, 1)
    rise = np.minimum(1, pos / peak)
    fall = np.clip((pos - peak) / (1 - peak), 0, 1)
    centre = rise * (1 - 0.6 * fall)
    edges = np.geomspace(lo, hi, bands + 1)
    out = np.zeros_like(t)
    for i in range(bands):
        w = np.exp(-((centre * (bands - 1) - i) ** 2) / 0.9)
        out += bandnoise(sec, edges[i], edges[i + 1]) * w
    env = np.where(pos < peak, (pos / peak) ** sharp, np.exp(-(pos - peak) / max(1e-3, (1 - peak) * 0.35)))
    return out * env


def metal_ring(sec, hz, decay=0.25, ratios=(1, 2.41, 3.87, 5.13, 6.9), amps=(1, 0.6, 0.4, 0.25, 0.15), beat=1.7):
    """Struck metal: inharmonic partials, each a detuned pair (shimmering beat)."""
    t = T(sec)
    out = np.zeros_like(t)
    for r, a in zip(ratios, amps):
        f = hz * r
        if f < NYQ * 0.95:
            out += a * (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * (f + beat * r) * t))
    return out * np.exp(-t / decay) / 1.6


def rumble(sec, hi=110, tau=0.4, attack=0.01):
    return bandnoise(sec, 22, hi, order=3) * expdec(sec, tau, attack)


def debris(sec, count, lo=700, hi=5500, spread=0.12, gain=(0.2, 0.7)):
    """Scattered short noise grains: splinters, stone chips."""
    out = blank(sec)
    for _ in range(count):
        at = min(sec - 0.03, RNG.exponential(spread))
        c = bandnoise(0.025, lo * RNG.uniform(0.7, 1.4), hi) * expdec(0.025, RNG.uniform(0.002, 0.006), 0.0004)
        place(out, at, c, RNG.uniform(*gain) * (1 - at / sec))
    return out


def growl(sec, f0=78, f1=62, formants=((320, 650), (750, 1250), (1900, 2700))):
    """Roar-like texture: noise through vowel-ish formant bands, gated by a low
    wavering pulse, plus a filtered saw body. Synthetic, not a voice sample."""
    t = T(sec)
    f = f0 * (f1 / f0) ** (t / sec) * (1 + 0.04 * np.sin(2 * np.pi * 5.3 * t))
    pulse = (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(f) / RATE)) ** 2.5
    noise = sum(bandnoise(sec, lo, hi) * g for (lo, hi), g in zip(formants, (1.0, 0.7, 0.35)))
    saw = lowpass(sweep(sec, f0, f1, 'saw'), 900)
    return noise * (0.35 + 0.65 * pulse) + 0.45 * saw * pulse


def spear_buzz(sec, f0=210, f1=150):
    """Shaft vibrating in flight with a doppler drop as it passes."""
    t = T(sec)
    pos = t / sec
    f = f0 + (f1 - f0) / (1 + np.exp(-(pos - 0.5) * 10))
    ph = 2 * np.pi * np.cumsum(f) / RATE
    vib = lowpass(np.sin(ph) + 0.4 * np.sign(np.sin(2.01 * ph)), 2400)
    air = bandnoise(sec, 1500, 5000)
    return (0.6 * vib + 0.4 * air) * np.sin(np.pi * pos) ** 1.4


# ---------------------------------------------------- vargr (heavy axe, fire)
def fx_vargr_q():
    s = blank(0.62)
    place(s, 0, swoosh(0.34, 120, 1800, peak=0.7, sharp=2.2), 0.75)
    place(s, 0.25, thump(0.36, 120, 38, 0.11, 3.2), 1.0)
    place(s, 0.25, bandnoise(0.22, 180, 900) * expdec(0.22, 0.045), 0.65)
    place(s, 0.252, crack(0.05, 1200, 5000, 0.008), 0.35)
    return s


def fx_vargr_e():
    s = blank(0.95)
    for i, at in enumerate((0.0, 0.22, 0.44)):
        place(s, at, swoosh(0.26, 160 + 40 * i, 2600 + 300 * i, peak=0.55, sharp=1.8), 0.55 + 0.08 * i)
    place(s, 0.6, metal_ring(0.34, 540, 0.11), 0.42)
    place(s, 0.6, crack(0.04, 2500, 9000, 0.006), 0.4)
    place(s, 0.6, thump(0.3, 150, 55, 0.07, 2.4), 0.6)
    return s


def fx_vargr_r():
    s = blank(1.45)
    t = T(0.9)
    place(s, 0, growl(0.9) * np.minimum(1, t / 0.12) * np.exp(-np.maximum(0, t - 0.55) / 0.15), 0.6)
    place(s, 0.55, swoosh(0.4, 120, 2200, peak=0.8, sharp=2.0), 0.5)
    place(s, 0.9, thump(0.55, 110, 30, 0.22, 3.4), 1.0)
    place(s, 0.9, rumble(0.55, 120, 0.22), 0.9)
    place(s, 0.92, debris(0.5, 22, 500, 3500, 0.1), 0.6)
    place(s, 0.9, crack(0.07, 900, 5000, 0.015), 0.4)
    return s


# ------------------------------------------------- sira (thrown spear, fire)
def fx_sira_q():
    s = blank(0.8)
    place(s, 0, swoosh(0.16, 900, 7000, peak=0.35, sharp=1.2), 0.6)
    place(s, 0.1, spear_buzz(0.46), 0.42)
    place(s, 0.56, thump(0.2, 260, 90, 0.04, 2.6), 0.75)
    place(s, 0.56, bandnoise(0.12, 400, 2200) * expdec(0.12, 0.018), 0.55)
    place(s, 0.565, tone(0.2, 180, ((1, 1), (2.7, 0.4)), 0.05, hz=True), 0.35)
    return s


def fx_sira_e():
    s = blank(0.46)
    for at, hz in ((0.0, 2350), (0.12, 2780)):
        place(s, at, swoosh(0.08, 1500, 8000, peak=0.6, sharp=1.0), 0.4)
        place(s, at + 0.06, crack(0.03, 3500, 11000, 0.004), 0.55)
        place(s, at + 0.062, metal_ring(0.22, hz, 0.06, ratios=(1, 1.53, 2.31), amps=(1, 0.5, 0.3), beat=6), 0.4)
    return s


def fx_sira_r():
    s = blank(1.15)
    for i, at in enumerate((0.0, 0.21, 0.42)):
        place(s, at, swoosh(0.12, 1000, 7500, peak=0.4, sharp=1.2), 0.5)
        place(s, at + 0.07, spear_buzz(0.32, 230 + 25 * i, 160 + 20 * i), 0.28)
        place(s, at + 0.38, thump(0.18, 280, 95, 0.035, 2.4), 0.6)
        place(s, at + 0.38, crack(0.04, 1500, 6000, 0.008), 0.35)
    return s


# ---------------------------------------------- doran (sword & shield, rune)
def fx_doran_q():
    s = blank(0.58)
    place(s, 0, swoosh(0.16, 500, 5000, peak=0.6, sharp=1.4), 0.4)
    place(s, 0.12, crack(0.04, 3000, 11000, 0.006), 0.6)
    place(s, 0.12, metal_ring(0.44, 880, 0.17), 0.55)
    place(s, 0.12, thump(0.18, 210, 90, 0.04, 2.0), 0.4)
    return s


def fx_doran_e():
    s = blank(0.82)
    place(s, 0, thump(0.3, 180, 70, 0.07, 2.8), 0.85)
    place(s, 0, metal_ring(0.32, 205, 0.09, ratios=(1, 1.59, 2.14, 2.95), amps=(1, 0.7, 0.45, 0.3), beat=3), 0.65)
    place(s, 0.14, crack(0.06, 1800, 9000, 0.012), 0.55)
    place(s, 0.14, debris(0.6, 30, 900, 7000, 0.09, (0.25, 0.8)), 0.55)
    for _ in range(7):
        at = 0.16 + RNG.exponential(0.1)
        if at < 0.7:
            place(s, at, metal_ring(0.08, RNG.uniform(1400, 3000), 0.02, beat=8), 0.12)
    return s


def fx_doran_r():
    s = blank(1.32)
    place(s, 0, swoosh(0.3, 200, 2500, peak=0.3, sharp=1.0), 0.35)
    place(s, 0, thump(0.12, 160, 90, 0.03, 1.6), 0.3)
    place(s, 0.3, swoosh(0.45, 150, 1800, peak=0.9, sharp=2.6), 0.5)
    place(s, 0.74, thump(0.55, 120, 32, 0.2, 3.4), 1.0)
    place(s, 0.74, rumble(0.5, 130, 0.2), 0.75)
    place(s, 0.75, crack(0.12, 700, 4500, 0.03), 0.5)
    place(s, 0.76, debris(0.52, 28, 500, 4000, 0.12, (0.25, 0.75)), 0.55)
    place(s, 0.74, metal_ring(0.3, 330, 0.09), 0.2)
    return s


# ----------------------------------------------------- nyx (rune magic, rune)
def fx_nyx_q():
    s = blank(0.72)
    for i, m in enumerate((86, 91, 98)):
        place(s, i * 0.03, bell(0.5, m, 0.28, inharm=(1, 2.0, 3.01, 4.2)), 0.22)
    t = T(0.5)
    place(s, 0.08, sweep(0.5, 1900, 900, 'tri') * np.sin(np.pi * t / 0.5) ** 1.2, 0.2)
    place(s, 0.08, swoosh(0.5, 2500, 9000, peak=0.5, sharp=1.2), 0.3)
    place(s, 0.52, bell(0.2, 100, 0.07), 0.25)
    place(s, 0.52, crack(0.04, 4000, 11000, 0.006), 0.25)
    return s


def fx_nyx_e():
    s = blank(1.1)
    t = T(0.85)
    hum = lowpass(sweep(0.85, 48, 115, 'saw'), 700) * (t / 0.85) ** 1.3
    place(s, 0, hum * (1 + 0.25 * np.sin(2 * np.pi * 7 * t)), 0.55)
    place(s, 0, rumble(0.85, 90, 1.0, 0.3) * (t / 0.85), 0.5)
    place(s, 0.7, bell(0.4, 67, 0.5, inharm=(1, 2.01, 2.76, 4.07, 5.4), amps=(1, 0.5, 0.5, 0.3, 0.2)), 0.45)
    place(s, 0.7, bell(0.4, 79, 0.4), 0.22)
    place(s, 0.7, thump(0.3, 140, 50, 0.1, 2.2), 0.5)
    return s


def fx_nyx_r():
    s = blank(1.55)
    t = T(0.85)
    place(s, 0, sweep(0.85, 700, 2600, 'sine') * (t / 0.85) ** 1.6, 0.22)
    place(s, 0, bandnoise(0.85, 800, 6000) * (t / 0.85) ** 2.2, 0.35)
    place(s, 0, crackle(0.85, 40) * (t / 0.85), 0.25)
    place(s, 0.85, thump(0.65, 100, 26, 0.26, 3.6), 1.0)
    place(s, 0.85, rumble(0.68, 160, 0.28), 1.0)
    place(s, 0.85, bandnoise(0.6, 200, 3000) * expdec(0.6, 0.12), 0.55)
    place(s, 0.86, debris(0.6, 26, 600, 6000, 0.14), 0.45)
    place(s, 0.85, sum(bell(0.6, m, 0.3) for m in (74, 81, 86)) / 2, 0.16)
    return s


# --------------------------------------------- per-character hit / knock-out
def fx_vargr_hit():      # leather + fur, heavy body
    s = blank(0.3)
    place(s, 0, thump(0.28, 140, 45, 0.08, 2.6), 0.9)
    place(s, 0, bandnoise(0.16, 250, 1400) * expdec(0.16, 0.03), 0.6)
    place(s, 0.003, bandnoise(0.05, 1200, 4000) * expdec(0.05, 0.008), 0.3)
    return s


def fx_sira_hit():       # light leather slap
    s = blank(0.24)
    place(s, 0, thump(0.18, 230, 90, 0.04, 2.0), 0.55)
    place(s, 0, bandnoise(0.1, 900, 5000) * expdec(0.1, 0.012, 0.0004), 0.8)
    place(s, 0.03, bandnoise(0.08, 400, 2000) * expdec(0.08, 0.02), 0.25)
    return s


def fx_doran_hit():      # armoured plate
    s = blank(0.34)
    place(s, 0, thump(0.25, 190, 70, 0.05, 2.2), 0.6)
    place(s, 0, metal_ring(0.32, 470, 0.08, ratios=(1, 1.71, 2.62, 3.9), amps=(1, 0.7, 0.4, 0.25), beat=4), 0.6)
    place(s, 0, crack(0.04, 2500, 10000, 0.006), 0.5)
    return s


def fx_nyx_hit():        # cloth + magic ward flicker
    s = blank(0.3)
    place(s, 0, thump(0.18, 200, 80, 0.04, 1.8), 0.45)
    place(s, 0, bandnoise(0.12, 600, 3000) * expdec(0.12, 0.025), 0.45)
    place(s, 0.01, sweep(0.22, 2400, 700, 'sine') * expdec(0.22, 0.06, 0.002), 0.3)
    place(s, 0.01, bell(0.25, 93, 0.08), 0.15)
    return s


def fx_vargr_ko():
    s = blank(1.15)
    t = T(0.55)
    place(s, 0, growl(0.55, 70, 44, ((250, 520), (600, 1000), (1500, 2200))) * np.minimum(1, t / 0.05) * np.exp(-t / 0.3), 0.55)
    place(s, 0.5, thump(0.5, 110, 32, 0.18, 3.0), 1.0)
    place(s, 0.5, rumble(0.5, 110, 0.18), 0.6)
    place(s, 0.72, thump(0.3, 90, 40, 0.1, 2.0), 0.45)
    place(s, 0.62, metal_ring(0.4, 300, 0.12), 0.2)
    return s


def fx_sira_ko():
    s = blank(0.95)
    place(s, 0, bandnoise(0.3, 600, 4000) * expdec(0.3, 0.06), 0.35)
    place(s, 0.32, thump(0.4, 170, 50, 0.12, 2.4), 0.85)
    place(s, 0.32, bandnoise(0.2, 300, 2000) * expdec(0.2, 0.04), 0.45)
    for at, hz in ((0.46, 2600), (0.58, 3100), (0.66, 2900)):
        place(s, at, metal_ring(0.18, hz, 0.04, ratios=(1, 1.53, 2.31), amps=(1, 0.5, 0.3), beat=7), 0.25)
    return s


def fx_doran_ko():
    s = blank(1.2)
    place(s, 0, metal_ring(0.4, 260, 0.12), 0.35)
    place(s, 0.35, thump(0.5, 130, 34, 0.18, 3.0), 1.0)
    place(s, 0.35, crack(0.08, 1500, 8000, 0.015), 0.45)
    for _ in range(9):
        at = 0.37 + RNG.exponential(0.12)
        if at < 1.0:
            place(s, at, metal_ring(0.15, RNG.uniform(500, 1600), 0.04, beat=5), RNG.uniform(0.1, 0.25))
    place(s, 0.6, metal_ring(0.5, 205, 0.18, ratios=(1, 1.59, 2.14), amps=(1, 0.6, 0.4)), 0.35)
    return s


def fx_nyx_ko():
    s = blank(1.2)
    for i, m in enumerate((93, 88, 84, 79, 74)):
        place(s, i * 0.1, bell(0.5, m, 0.3), 0.18)
    t = T(0.8)
    place(s, 0, sweep(0.8, 1600, 220, 'tri') * np.exp(-t / 0.35), 0.22)
    place(s, 0, bandnoise(0.8, 3000, 9000) * np.exp(-t / 0.25), 0.15)
    place(s, 0.45, thump(0.4, 150, 45, 0.13, 2.0), 0.7)
    place(s, 0.45, bandnoise(0.25, 300, 2000) * expdec(0.25, 0.05), 0.35)
    return s


FIGHTER_EFFECTS = {
    'vargr-q': fx_vargr_q, 'vargr-e': fx_vargr_e, 'vargr-r': fx_vargr_r,
    'sira-q': fx_sira_q, 'sira-e': fx_sira_e, 'sira-r': fx_sira_r,
    'doran-q': fx_doran_q, 'doran-e': fx_doran_e, 'doran-r': fx_doran_r,
    'nyx-q': fx_nyx_q, 'nyx-e': fx_nyx_e, 'nyx-r': fx_nyx_r,
    'vargr-hit': fx_vargr_hit, 'sira-hit': fx_sira_hit, 'doran-hit': fx_doran_hit, 'nyx-hit': fx_nyx_hit,
    'vargr-ko': fx_vargr_ko, 'sira-ko': fx_sira_ko, 'doran-ko': fx_doran_ko, 'nyx-ko': fx_nyx_ko,
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
    import sys
    # `--fighters` regenerates only the paket-32 character set; legacy files stay untouched.
    # A full run reproduces the legacy files byte-for-byte (legacy RNG stream runs first, unchanged).
    only_fighters = '--fighters' in sys.argv
    groups = [('fighter', FIGHTER_EFFECTS)] if only_fighters else [('legacy', EFFECTS), ('fighter', FIGHTER_EFFECTS)]
    print(f"{'name':12} {'sec':>5} {'peak':>6} {'rms':>6} {'dc':>8} {'first':>5} {'last':>5} {'bytes':>7}")
    for group, effects in groups:
        total = 0
        for idx, (name, fn) in enumerate(effects.items()):
            if group == 'fighter':
                RNG = np.random.default_rng(32_000 + idx)   # isolated seed per fighter effect
            y = finish(fn())
            path = OUT / f'{name}.wav'
            pcm = write_wav(path, y)
            x = pcm / 32768
            size = path.stat().st_size
            total += size
            print(f"{name:12} {len(x) / RATE:5.2f} {20 * np.log10(np.abs(x).max()):6.2f} "
                  f"{20 * np.log10(np.sqrt(np.mean(x ** 2))):6.2f} {x.mean():8.5f} {pcm[0]:5d} {pcm[-1]:5d} {size:7d}")
        print(f'total {group} sfx bytes: {total} ({total / 1e6:.2f} MB)')
