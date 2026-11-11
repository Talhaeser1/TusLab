// Görev S ses ölçümü: ağdaki ses dosyaları (200/404), sayfa hataları, play (AudioBufferSource.start) sayacı ve cast/temas olaylarıyla zaman ilişkisi.
// Kullanım: node .playwright-mcp/run.mjs .playwright-mcp/ses-probe.js '{"f1":"vargr","f2":"konyali","muted":false}'
async (page) => {
  const P = Object.assign({mode: 'rounds', w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 60000, muted: false}, globalThis.__P || {}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: P.w, height: P.h});
  const net = [], errs = [];
  page.on('response', r => { const u = r.url(); if (/\.(mp3|wav)(\?|$)/.test(u)) net.push([r.status(), u.split('/assets/')[1] || u]); });
  page.on('requestfailed', r => { const u = r.url(); if (/\.(mp3|wav)/.test(u)) net.push(['FAIL', u.split('/assets/')[1] || u]); });
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(muted => {
    try { localStorage.setItem('tuslab-pvp-sfx-muted', String(muted)); localStorage.setItem('tuslab-pvp-music-muted', String(muted)); } catch {}
    const T0 = performance.now();
    window.__ses = {starts: [], ev: []};
    const of = window.fetch.bind(window);
    window.fetch = async (...a) => {
      const res = await of(...a);
      const url = String(a[0]?.url || a[0]);
      const ab = res.arrayBuffer.bind(res);
      res.arrayBuffer = async () => { const b = await ab(); try { b.__url = url; } catch {} return b; };
      return res;
    };
    const dd = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (b, ...r) {
      const url = b?.__url;
      return dd.call(this, b, ...r).then(buf => { try { buf.__url = url; } catch {} return buf; });
    };
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      const u = this.buffer?.__url || ('?dur' + (this.buffer ? this.buffer.duration.toFixed(1) : ''));
      window.__ses.starts.push([Math.round(performance.now() - T0), (u.split('/assets/')[1] || u), this.loop ? 'loop' : '']);
      return st.apply(this, a);
    };
    {
      const root = document;
      for (const n of ['tuslab:pvp-cast', 'tuslab:pvp-strike', 'tuslab:pvp-impact']) root?.addEventListener(n, e => {
        const d = e.detail || {}; window.__ses.ev.push([Math.round(performance.now() - T0), n.slice(11), d.seat ?? d.fromSeat ?? '', d.skill ?? '', d.index ?? '']);
      });
    }
  }, P.muted);
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}&animprobe=1`);
  await page.waitForTimeout(2500);
  await page.mouse.click(300, 300); // ilk kullanıcı etkileşimi
  const t0 = Date.now(); let typed = 0;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x)); return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim()}; }).catch(() => ({f: [], w: ''}));
    if (s.f.includes('pvp15-results-open')) break;
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) { await page.keyboard.type(s.w, {delay: 8}); await page.keyboard.press('Space'); typed++; }
    await page.waitForTimeout(260);
  }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => window.__ses);
  const count = {};
  for (const [, u, l] of r.starts) { const k = u.replace(/\?.*/, '') + (l ? '(loop)' : ''); count[k] = (count[k] || 0) + 1; }
  const bad = net.filter(n => n[0] !== 200 && n[0] !== 304);
  return {typed, muted: P.muted, netTotal: net.length, netBad: bad, netUniq: [...new Set(net.map(n => n[0] + ' ' + n[1]))].sort(),
    startsTotal: r.starts.length, count, errs: errs.slice(0, 5),
    timeline: P.full ? [...r.starts.map(x => [x[0], 'PLAY', x[1]]), ...r.ev.map(x => [x[0], ...x.slice(1)])].sort((a, b) => a[0] - b[0]).slice(0, 120) : undefined};
}
