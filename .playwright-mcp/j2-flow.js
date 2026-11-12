// J2 akış: lobi etkileşimleri + seçilen karakterin 3 modda maça geçişi + fighter2 botu
async (page) => {
  const out = {};
  await page.setViewportSize({width: 1366, height: 768});
  const open = async (qs) => {
    await page.goto('http://127.0.0.1:5176/index.html' + qs); await page.waitForTimeout(1500);
    await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
    await page.waitForSelector('.lb3-fighter', {timeout: 8000}); await page.waitForTimeout(600);
  };
  // A) lobi etkileşimleri
  await open('');
  await page.hover('[data-fighter-group="lobby"] [data-fighter="sira"]'); await page.waitForTimeout(150);
  out.hoverInfo = await page.evaluate(() => document.querySelector('[data-fighter-info]').innerText.replace(/\s+/g, ' ').slice(0, 120));
  await page.mouse.move(5, 5); await page.waitForTimeout(150);
  out.afterLeave = await page.evaluate(() => document.querySelector('[data-fighter-info]').dataset.shown);
  await page.click('[data-fighter="konyali"]'); await page.waitForTimeout(200);
  out.selected = await page.evaluate(() => [document.querySelector('[data-fighter-group="lobby"] [aria-checked="true"]').dataset.fighter, document.querySelector('[data-fighter-info]').dataset.shown, document.querySelector('[data-fighter-info]').innerText.replace(/\s+/g, ' ').slice(0, 160)]);
  await page.focus('[data-mode-scope="practice"][data-mode="classic"]');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  out.modeAfterArrows = await page.evaluate(() => ({pressed: [...document.querySelectorAll('[data-mode-picker="practice"] [aria-pressed="true"]')].map(b => b.dataset.mode), focus: document.activeElement.dataset.mode, content: document.querySelector('[data-mode-picker="practice"]').dataset.content || null,
    roundsPickerVisible: !!document.querySelector('[data-rounds-picker="practice"]').offsetParent, scrollLeft: Math.round(document.querySelector('[data-mode-picker="practice"] .rui-seg').scrollLeft)}));
  await page.click('[data-difficulty="zor"]'); await page.waitForTimeout(100);
  out.diff = await page.evaluate(() => [...document.querySelectorAll('[data-difficulty][aria-pressed="true"]')].map(b => b.dataset.difficulty));
  await page.click('[data-stage-pick="skyforge"]'); await page.waitForTimeout(400);
  out.stage = await page.evaluate(() => [...document.querySelectorAll('[data-stage-group="practice"] [data-stage-pick]')].map(b => b.dataset.stagePick + ':' + b.style.getPropertyValue('--o') + ':' + b.getAttribute('aria-checked')).join(' '));
  // B) üç modda maça geçiş (fighter2=sira → bot sira); model parlaması izi
  out.modes = {};
  for (const mode of ['classic', 'rounds', 'arena']) {
    await open('?fighter2=sira');
    await page.click(`[data-mode-scope="practice"][data-mode="${mode}"]`);
    await page.click('[data-fighter-group="lobby"] [data-fighter="konyali"]');
    const seen = [];
    await page.click('[data-lobby-action="practice"]');
    const t0 = Date.now();
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(250);
      const s = await page.evaluate(() => { const r = document.getElementById('pvp-root'); const m = window.__tuslabArena3d?._debug?.models?.(); return {pending: r?.classList.contains('pvp-models-pending'), ready3d: r?.classList.contains('pvp26-3d'), models: m ? Object.values(m).map(x => `${x.fighter}:${x.loaded ? 'L' : x.failed ? 'F' : '-'}:${x.planeVisible ? 'plane' : 'noplane'}`).join(',') : null, rigVisible: [...document.querySelectorAll('.pvp3-rig')].some(e => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0)}; });
      seen.push(`${s.pending ? 'P' : '-'}${s.ready3d ? '3' : '-'}${s.rigVisible ? 'R' : '-'}|${s.models}`);
      if (!s.pending && s.models && /L.*L/.test(s.models)) break;
    }
    const txt = await page.evaluate(() => document.body.innerText);
    out.modes[mode] = {trace: [...new Set(seen)].slice(0, 12), skillNames: ['Etli Ekmek', 'Sema', 'Ney Feryad'].filter(n => txt.includes(n)), botLine: (txt.match(/Bot ·[^\n]*/) || [''])[0]};
  }
  return out;
}
