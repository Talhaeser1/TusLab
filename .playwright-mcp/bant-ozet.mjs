// node .playwright-mcp/bant-ozet.mjs '<json>'  → bant-probe.js çıktısını (stdin) özetler; kullanım: run.mjs ... | node bant-ozet.mjs
let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  const i = s.indexOf('{');
  if (i < 0) { console.log(s.slice(0, 400)); return; }
  const body = s.slice(i).split('\nPAGEERRORS')[0];
  let j; try { j = JSON.parse(body); } catch (e) { console.log('JSON?', body.slice(0, 300)); return; }
  console.log('opened', j.opened, 'style', j.style);
  for (const r of j.runs || []) {
    if (r.band === null) { console.log('BAND YOK'); continue; }
    console.log(JSON.stringify({vp: r.vp, rect: r.rect, inside: r.inside, w: r.width, bandScroll: r.bandScroll, page: r.pageScroll, rails: r.rails, cv: r.cv,
      players: r.players?.map(p => `${p.who}|${p.dmg}|${p.cap ? 'TAVAN' : '-'}|${p.detail}`), pips: r.pips, next: r.next, hint: r.hint, cd: r.countdown, hpLine: r.hpLine,
      cardsRow: r.cardsOneRow, cards: r.cards?.map(c => `${c.key}:${c.w}x${c.h}:${c.uses}`), btns: r.pickerBtns, narrow: r.narrow, multi: r.multi, small: r.small, clipped: r.clipped, contrast: r.minContrast, over: r.overlaps, intro: r.introVisible}));
  }
  if (j.keys) console.log('KEYS', JSON.stringify(j.keys));
  console.log(s.includes('PAGEERRORS') ? s.slice(s.indexOf('PAGEERRORS')) : 'sayfa hatası yok');
});
