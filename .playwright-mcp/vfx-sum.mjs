// İş 15: vfx-out-<id>.json özetleri (oyuncu koltuğu = <id>).
import {readFileSync, existsSync} from 'node:fs';
for (const id of process.argv.slice(2)) {
  const f = `.playwright-mcp/vfx-out-${id}.json`;
  if (!existsSync(f)) { console.log(id, 'yok'); continue; }
  const t = readFileSync(f, 'utf8');
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  const c = j.counts || {};
  console.log(id, JSON.stringify({off: j.off, avgAction: j.avgAction, medAction: j.medAction, nAction: j.nAction, avgFight: j.avgFight, p1casts: (j.casts || []).filter(x => x[1] === 1).map(x => x[2]).join(''), frames: j.frames,
    avgBusy: j.avgBusy, avgIdle: j.avgIdle, medBusy: j.medBusy, medIdle: j.medIdle, over250: j.over250, maxFrame: j.maxFrame,
    linkAt: j.linkAt, longAt: j.longAt, fxUpdAvg: j.fxUpdAvg, fxUpdMax: j.fxUpdMax, links: j.linksInFight, edge: j.edgePulses, shot: j.shot, errs: j.errs}));
  console.log('  ', Object.entries(c).filter(([k]) => k.startsWith(id + '.'))
    .map(([k, v]) => `${k.slice(id.length + 1)}=${v}`).join(' '));
  console.log('  ', Object.entries(j.lastLog || {}).filter(([k]) => k.startsWith(id + '.')).map(([k, v]) => `${k.slice(id.length + 1)}:${v.particles}p/${v.msMax}ms`).join(' '));
}
