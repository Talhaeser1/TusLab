// KESINYAP is 4/5: bot maçında konuşmalı seslerin (replik/*, anons/*, konyali-*.mp3, *-ko) zaman çizelgesi + çakışma sayısı + seri perdeleri.
// Kullanım: node .playwright-mcp/run.mjs .playwright-mcp/ses-cizelge-probe.js '{"f1":"vargr","f2":"nyx","maxMs":70000}'
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 70000}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.addInitScript(() => {
    const T0 = performance.now(); window.__ses = {starts: []};
    const of = window.fetch.bind(window);
    window.fetch = async (...a) => { const res = await of(...a); const url = String(a[0]?.url || a[0]); const ab = res.arrayBuffer.bind(res); res.arrayBuffer = async () => { const b = await ab(); try { b.__url = url; } catch {} return b; }; return res; };
    const dd = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (b, ...r) { const url = b?.__url; return dd.call(this, b, ...r).then(buf => { try { buf.__url = url; } catch {} return buf; }); };
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      const u = this.buffer?.__url || '?';
      const rate = this.playbackRate ? this.playbackRate.value : 1;
      const det = this.detune ? this.detune.value : 0;
      window.__ses.starts.push({t: Math.round(performance.now() - T0), f: u.split('/assets/')[1] || u, d: this.buffer ? +this.buffer.duration.toFixed(2) : 0, loop: !!this.loop, rate: +rate.toFixed(3), det: Math.round(det)});
      return st.apply(this, a);
    };
    const osc = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__ses.starts.push({t: Math.round(performance.now() - T0), f: 'osc:' + this.type, d: 0, loop: false, rate: 1, det: 0, hz: Math.round(this.frequency.value)}); return osc.apply(this, a); };
  });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}`);
  await page.waitForTimeout(4000);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(8000);
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(260);
  }
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => window.__ses.starts);
  const speech = st.filter(x => !x.loop && /replik\/|anons\/|konyali-[qer]\.mp3/.test(x.f)).sort((a, b) => a.t - b.t);
  const overlaps = [];
  for (let i = 0; i < speech.length; i++) for (let j = i + 1; j < speech.length; j++) {
    if (speech[j].t < speech[i].t + speech[i].d * 1000 - 60) overlaps.push([speech[i].f + '@' + speech[i].t + '+' + speech[i].d, speech[j].f + '@' + speech[j].t]);
  }
  const snap = await page.evaluate(() => document.querySelector('#pvp-root')?.className + ' | ' + document.body.innerText.slice(0,160).split(String.fromCharCode(10)).join(' / ')); return {typed, snap, total: st.length, speechCount: speech.length, overlapCount: overlaps.length, overlaps: overlaps.slice(0, 12),
    speech: speech.map(x => `${x.t} ${x.f} ${x.d}s`),
    serial: st.filter(x => /seri|osc:|jingle|tezahurat|word-correct/.test(x.f)).map(x => `${x.t} ${x.f} rate=${x.rate} det=${x.det}${x.hz ? ' hz=' + x.hz : ''}`).slice(0, 60)};
}
