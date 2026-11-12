// KESINYAP iş 4: doğru kelime serisinde osilatör perdeleri (Hz), yanlışta sıfırlanma, 5. seride seyirci/anons.
// Kullanım: node .playwright-mcp/run.mjs .playwright-mcp/seri-probe.js '{"correct":7,"wrongAfter":4}'
async (page) => {
  const P = Object.assign({f1: 'vargr', f2: 'nyx', correct: 7, wrongAfter: 4, mode: 'rounds'}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: 1366, height: 768});
  await page.addInitScript(() => {
    const T0 = performance.now(); window.__ses = {starts: []};
    const of = window.fetch.bind(window);
    window.fetch = async (...a) => { const res = await of(...a); const url = String(a[0]?.url || a[0]); const ab = res.arrayBuffer.bind(res); res.arrayBuffer = async () => { const b = await ab(); try { b.__url = url; } catch {} return b; }; return res; };
    const dd = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (b, ...r) { const url = b?.__url; return dd.call(this, b, ...r).then(buf => { try { buf.__url = url; } catch {} return buf; }); };
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { window.__ses.starts.push({t: Math.round(performance.now() - T0), f: (this.buffer?.__url || '?').split('/assets/')[1] || '?', d: this.buffer ? +this.buffer.duration.toFixed(2) : 0}); return st.apply(this, a); };
    const co = BaseAudioContext.prototype.createOscillator;
    BaseAudioContext.prototype.createOscillator = function (...a) {
      const o = co.apply(this, a); const sv = o.frequency.setValueAtTime.bind(o.frequency);
      o.frequency.setValueAtTime = (v, t) => { o.__hz = v; return sv(v, t); };
      return o;
    };
    const os = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__ses.starts.push({t: Math.round(performance.now() - T0), f: 'osc', hz: Math.round(this.__hz ?? this.frequency.value), type: this.type}); return os.apply(this, a); };
  });
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}`);
  await page.waitForTimeout(4000);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(9000);
  const word = () => page.evaluate(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim());
  const log = [];
  let done = 0, wrongDone = false;
  const t0 = Date.now();
  while (done < P.correct + 3 && Date.now() - t0 < 60000) {
    const w = await word();
    if (!w || w.length < 2) { await page.waitForTimeout(200); continue; }
    if (!wrongDone && done === P.wrongAfter) { await page.keyboard.type('qqq', {delay: 10}); await page.keyboard.press('Space'); wrongDone = true; log.push(['WRONG@', done]); await page.waitForTimeout(700); continue; }
    await page.keyboard.type(w, {delay: 10}); await page.keyboard.press('Space'); done++; log.push([done, w]);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => window.__ses.starts);
  const chime = st.filter(x => x.f === 'osc' && x.hz >= 400);              // kalp atışı (62/52 Hz) hariç
  const fund = chime.filter((x, i) => i % 3 === 0);                        // her çınlama = temel + 2x + 3x bileşen
  const oscAll = st.filter(x => x.f === 'osc');
  return {oscTotal: oscAll.length, typed: log.map(x => x.join(':')).join(' '), fundamentalsHz: fund.map(x => x.hz).join(' '), fileSounds: st.filter(x => x.f !== 'osc' && x.f !== '?').map(x => `${x.t} ${x.f}`).join(' | ')};
}
