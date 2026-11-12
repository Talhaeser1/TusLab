// İçerik modları (atasözü/şiir/Osmanlıca) bot antrenmanı probu: etiket, ipucu, hedef kelime, seçici düğmeleri.
async (page) => {
  const out = {};
  for (const c of ['atasozu', 'siir', 'osmanlica']) {
    await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&icerik=${c}&bot=easy`);
    await page.waitForSelector('[data-tt-target]', {timeout: 20000});
    await page.waitForFunction(() => /RAUND/.test(document.querySelector('[data-tt-mode]')?.textContent || ''), null, {timeout: 25000}).catch(() => {});
    const read = () => page.evaluate(() => ({
      mode: document.querySelector('[data-tt-mode]')?.textContent,
      label: document.querySelector('[data-tt-label]')?.textContent,
      target: document.querySelector('[data-tt-target]')?.textContent,
      next: document.querySelector('[data-tt-next]')?.textContent,
      px: parseFloat(getComputedStyle(document.querySelector('[data-tt-label]')).fontSize)
    }));
    const first = await read();
    // ilk kelimeyi yaz → ilerleme + yeni ipucu
    const word = first.target.trim();
    await page.fill('[data-tt-input]', word);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    out[c] = {first, afterTyped: await read()};
  }
  // lobi seçici
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=arena');
  await page.waitForTimeout(1500);
  return out;
}
