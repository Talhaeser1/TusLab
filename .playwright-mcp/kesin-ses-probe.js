// KESINYAP iş 4/5/6/mekanik: konuşma zaman çizelgesi (çakışma), seri perdesi, bitiş repliği, sayılı raund sayacı.
// node .playwright-mcp/run.mjs .playwright-mcp/kesin-ses-probe.js '{"wrongAt":[5,9],"maxMs":150000}'  |  senaryo: "surrender":true
async (page) => {
  const P = Object.assign({w: 1366, h: 768, f1: 'vargr', f2: 'nyx', maxMs: 150000, wrongAt: [5, 9], words: '10', surrender: false, style: 'counted', surrenderAfterMs: 12000}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: P.w, height: P.h});
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.addInitScript(p => {
    try { localStorage.setItem('tuslab-pvp-sfx-muted', 'false'); localStorage.setItem('tuslab-pvp-music-muted', 'true');
      localStorage.setItem('tuslab-pvp-practice-round-style', p.style); localStorage.setItem('tuslab-pvp-practice-round-words', p.words); } catch {}
    const T0 = performance.now(); const S = window.__k = {plays: [], pings: [], clock: []};
    const of = window.fetch.bind(window);
    window.fetch = async (...a) => { const res = await of(...a); const url = String(a[0]?.url || a[0]); const ab = res.arrayBuffer.bind(res);
      res.arrayBuffer = async () => { const b = await ab(); try { b.__url = url; } catch {} return b; }; return res; };
    const dd = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (b, ...r) { const url = b?.__url; return dd.call(this, b, ...r).then(buf => { try { buf.__url = url; } catch {} return buf; }); };
    const sv = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (v, t) { try { this.__v = v; } catch {} return sv.call(this, v, t); };
    const ost = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { if (this.type === 'sine' && this.frequency.__v > 200 && this.frequency.__v < 2100) S.pings.push([Math.round(performance.now() - T0), Math.round(this.frequency.__v * 100) / 100]); return ost.apply(this, a); };
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      const u = (this.buffer?.__url || '?').split('/assets/')[1] || '?'; const d = this.buffer ? this.buffer.duration : 0;
      if (!this.loop) S.plays.push([Math.round(performance.now() - T0), u, +d.toFixed(2)]);
      return st.apply(this, a);
    };
    window.__T0 = T0;
  }, P);
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=${P.f1}&fighter1=${P.f1}&fighter2=${P.f2}`);
  await page.waitForTimeout(2500);
  await page.mouse.click(300, 300);
  const t0 = Date.now(); let typed = 0, wrongDone = new Set(), firstClock = null, surrendered = false, endSeen = false, endAt = null;
  while (Date.now() - t0 < P.maxMs) {
    const s = await page.evaluate(() => { const root = document.querySelector('#pvp-root'); const f = ['rui-inter-open', 'aui-summary-open', 'pvp15-results-open'].filter(x => root?.classList.contains(x));
      return {f, w: (document.querySelector('.rui-word.is-active, .aui-word.is-active')?.textContent || document.querySelector('[data-tt-target]')?.textContent || '').trim(), clock: (document.querySelector('.rui-clock-text')?.textContent || '').trim(), t: Math.round(performance.now() - window.__T0)}; }).catch(() => ({f: [], w: '', clock: ''}));
    if (s.clock && !s.f.length && firstClock === null && /^\d+/.test(s.clock)) firstClock = {clock: s.clock, at: s.t};
    if (P.surrender && !surrendered && firstClock && Date.now() - t0 > P.surrenderAfterMs) {
      surrendered = await page.evaluate(() => { const b = document.querySelector('[data-pvp15-action="surrender"]'); if (b && !b.hidden) { b.click(); return true; } return false; });
      if (surrendered) { await page.waitForTimeout(400); await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/evet|onayla|teslim ol|tamam/i.test(b.textContent) && b.offsetParent && !b.matches('[data-pvp15-action="surrender"]')) { b.click(); break; } }); }
    }
    if (s.f.includes('pvp15-results-open')) { endSeen = true; endAt = s.t; break; }
    if (!s.f.length && s.w && s.w.length > 1 && !/[✓]/.test(s.w)) {
      const wrong = P.wrongAt.includes(typed + 1) && !wrongDone.has(typed + 1);
      if (wrong) wrongDone.add(typed + 1);
      await page.keyboard.type(wrong ? s.w.slice(0, -1) + (s.w.endsWith('x') ? 'y' : 'x') : s.w, {delay: 8}); await page.keyboard.press('Space'); typed++;
    }
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => window.__k);
  const end = await page.evaluate(() => (document.querySelector('.pvp15-results, [class*=result]')?.textContent || '').trim().slice(0, 80));
  // Konuşma = anons/, replik (karakter ses klasörü) — SFX/müzik/seyirci hariç.
  const isSpeech = u => /anons\//.test(u) || /(\/|^)(voices?|ses\/karakter|replik|karakter)/i.test(u) || /(vargr|nyx|sira|doran)-(q|e|r|zafer|savunma|soz)/i.test(u);
  const speech = r.plays.filter(p => isSpeech(p[1])).map(p => ({at: p[0], file: p[1], end: p[0] + Math.round(p[2] * 1000)}));
  const overlaps = []; for (let i = 0; i < speech.length; i++) for (let j = i + 1; j < speech.length; j++) if (speech[j].at < speech[i].end - 30 && speech[i].at < speech[j].end - 30) overlaps.push([speech[i].file, speech[j].file, speech[j].at - speech[i].at]);
  const uniq = {}; for (const p of r.plays) uniq[p[1]] = (uniq[p[1]] || 0) + 1;
  return {endAt, tail: r.plays.slice(-14), typed, endSeen, surrendered, firstClock, end, pings: r.pings, speechCount: speech.length, overlaps, speech, fileCounts: uniq};
}
