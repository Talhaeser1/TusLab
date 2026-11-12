// KESINYAP is 6: teslimde hangi replik/anons çalıyor. Kullanım: node .playwright-mcp/run.mjs .playwright-mcp/teslim-probe.js '{"f1":"vargr","f2":"nyx","force":true}'
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', force: true}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: P.w, height: P.h});
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => {
    const T0 = performance.now(); window.__ses = {starts: []};
    const of = window.fetch.bind(window);
    window.fetch = async (...a) => { const res = await of(...a); const url = String(a[0]?.url || a[0]); const ab = res.arrayBuffer.bind(res); res.arrayBuffer = async () => { const b = await ab(); try { b.__url = url; } catch {} return b; }; return res; };
    const dd = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (b, ...r) { const url = b?.__url; return dd.call(this, b, ...r).then(buf => { try { buf.__url = url; } catch {} return buf; }); };
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { const u = this.buffer?.__url || '?'; window.__ses.starts.push([Math.round(performance.now() - T0), u.split('/assets/')[1] || u, this.loop ? 'loop' : '']); return st.apply(this, a); };
  });
  const f = P.force ? `&fighter1=${P.f1}&fighter2=${P.f2}` : `&fighter1=${P.f1}`;
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}${f}`);
  await page.waitForTimeout(4000);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(7000);
  const mark = await page.evaluate(() => window.__ses.starts.length);
  const sb = await page.evaluate(() => { const b = document.querySelector('[data-pvp15-action="surrender"]'); if (b) { b.hidden = false; b.click(); return true; } return false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => window.__ses.starts);
  const loaded = r.filter(x => /replik\/.*-(q|e|r|savunma|zafer|soz)/.test(x[1])).length;
  return {clicked: sb, before: mark, afterSurrender: r.slice(mark).map(x => x.join(' ')), repliksPlayed: loaded};
}
