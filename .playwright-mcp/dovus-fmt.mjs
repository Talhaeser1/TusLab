// dovus-probe çıktısını kısa satırlara döker: node .playwright-mcp/dovus-fmt.mjs <çıktı.json> [satır]
import {readFileSync} from 'node:fs';
const t = readFileSync(process.argv[2], 'utf8');
const end = t.lastIndexOf('\n}');
let r;
try { r = JSON.parse(t.slice(t.indexOf('{'), end + 2)); } catch { console.log(t.slice(0, 4000)); process.exit(1); }
const {phases = [], marks = [], ev = [], hp = [], ...rest} = r;
const rows = [...marks.map(m => [parseInt(m), 'M ' + m]), ...ev.map(m => [parseInt(m), m]), ...hp.map(h => [h[0], h[0] + ' HP ' + h[1]]), ...phases.map(p => [p[0], p.join(' | ')])].sort((a, b) => a[0] - b[0]);
console.log(JSON.stringify(rest, null, 0));
const from = Number(process.argv[3]) || 0, to = Number(process.argv[4]) || 1e9;
for (const [t, line] of rows) if (t >= from && t <= to) console.log(line);
console.log(t.slice(end + 2).trim());
