// Art arda 3 bot maçı: ilk kelimeler (hedef + sıradakiler). Tüm içerikler + classic/arena.
async (page) => {
  await page.setViewportSize({width: 640, height: 420});
  const out = {};
  const cfgs = [['kelime', 'mode=rounds'], ['atasozu', 'icerik=atasozu'], ['siir', 'icerik=siir'], ['osmanlica', 'icerik=osmanlica'], ['classic', 'mode=classic'], ['arena', 'mode=arena']];
  for (const [name, qs] of cfgs) {
    out[name] = [];
    for (let i = 0; i < 3; i++) {
      await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&${qs}&bot=easy`);
      await page.waitForSelector('[data-tt-target]', {timeout: 30000}).catch(() => {});
      await page.waitForFunction(() => (document.querySelector('[data-tt-target]')?.textContent || '').trim().length > 0 && !/ÇÖZÜLÜYOR|HAZIR/.test(document.querySelector('[data-tt-mode]')?.textContent || ''), null, {timeout: 25000}).catch(() => {});
      out[name].push(await page.evaluate(() => {
        const t = s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim();
        return (t('[data-tt-target]') + ' | ' + t('[data-tt-next]')).slice(0, 90);
      }));
    }
  }
  return out;
}
