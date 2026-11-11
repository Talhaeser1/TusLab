"""Split a voice-design take into exactly N lines at the N-1 quietest/longest gaps.
usage: python split_lines.py <dir_with_mp3s> <N> <out_dir> <name1,name2,...>
Picks the take whose weakest chosen gap is the strongest (clearest separation)."""
import subprocess, sys, os, array, glob

SR = 16000
HOP = 160  # 10 ms

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return array.array('h', raw)

def envelope(pcm):
    env = []
    for i in range(0, len(pcm) - HOP, HOP):
        s = 0
        for v in pcm[i:i + HOP]:
            s += v * v
        env.append((s / HOP) ** 0.5)
    return env

def gaps(env):
    peak = max(env) or 1
    thr = peak * 0.06
    quiet = [e < thr for e in env]
    # leading/trailing silence excluded
    first = next(i for i, q in enumerate(quiet) if not q)
    last = len(quiet) - 1 - next(i for i, q in enumerate(reversed(quiet)) if not q)
    out, i = [], first
    while i <= last:
        if quiet[i]:
            j = i
            while j <= last and quiet[j]:
                j += 1
            out.append((j - i, i, j))  # length(frames), start, end
            i = j
        else:
            i += 1
    return out, first, last

def plan(path, n):
    env = envelope(decode(path))
    g, first, last = gaps(env)
    g.sort(reverse=True)
    if len(g) < n - 1:
        return None
    chosen = sorted(g[:n - 1], key=lambda x: x[1])
    score = min(x[0] for x in chosen)
    bounds, start = [], first
    for _, s, e in chosen:
        bounds.append((start, s)); start = e
    bounds.append((start, last + 1))
    return score, bounds

def main():
    src, n, out, names = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4].split(',')
    assert len(names) == n
    best = None
    for p in sorted(glob.glob(os.path.join(src, '*.mp3'))):
        r = plan(p, n)
        print(os.path.basename(p), 'score' if r else 'FAIL', r[0] if r else '')
        if r and (best is None or r[0] > best[1][0]):
            best = (p, r)
    if not best:
        sys.exit('no usable take')
    path, (score, bounds) = best
    print('chosen', os.path.basename(path), 'min gap ms', score * 10)
    os.makedirs(out, exist_ok=True)
    for name, (a, b) in zip(names, bounds):
        t0 = max(0, a * HOP / SR - 0.03); t1 = b * HOP / SR + 0.06
        dst = os.path.join(out, name + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-to', f'{t1:.3f}', '-i', path,
                        '-ac', '1', '-ar', '44100', '-af', 'afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse,loudnorm=I=-16:TP=-1.5',
                        '-b:a', '64k', dst], check=True)
        print(name, f'{t1 - t0:.2f}s', os.path.getsize(dst), 'B')

main()
