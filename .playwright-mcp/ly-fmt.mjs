// yerlesim-probe çıktısını sıkıştırır (stdin → özet)
let s = ''; process.stdin.on('data', d => s += d).on('end', () => {
  const i = s.indexOf('\nPAGEERRORS'); const body = i > 0 ? s.slice(0, i) : s;
  const j = JSON.parse(body);
  const issues = new Map(); const states = new Set();
  for (const r of j.rows) {
    if (r.stateSeen) { states.add(r.stateSeen); continue; }
    for (const k of ['small', 'over', 'off', 'ov']) for (const x of (r[k] || [])) issues.set(`${r.state} ${k}: ${x}`, 1);
  }
  const hp = j.hp.map(x => x.replace(/\s/g, '')).join(' ');
  const rr = j.rows.find(r => (r.ov || []).some(x => /role|banner|callout|combo/.test(x)) && r.rects);
  console.log(JSON.stringify({floaters: j.crystal && j.crystal.floaters.length, ovRects: rr && rr.rects, resInfo: j.resInfo, mode: j.mode, vp: j.vp, secs: j.secs, res: j.res, reason: j.reason, tones: j.tones, hpNow: j.hpNow, states: [...states], errs: j.errs, bad: j.bad, hpTail: hp.slice(-160), issues: [...issues.keys()]}, (k, v) => Array.isArray(v) && v.length && v.every(x => typeof x === 'number') ? v.join(',') : v, 1));
  if (i > 0) console.log(s.slice(i));
});
