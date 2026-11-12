// J2: ok tuşları (mod şeridi · karakterler · arena) gerçek klavyeyle
async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const e = [...document.querySelectorAll('button, a, [role="button"], [data-view], [data-nav]')].find(x => /PvP Modlar/.test(x.textContent)); e?.click(); });
  await page.waitForSelector('.lb3-fighter'); await page.waitForTimeout(600);
  const snap = () => page.evaluate(() => ({focus: document.activeElement?.dataset?.mode || document.activeElement?.dataset?.fighter || document.activeElement?.dataset?.stagePick || document.activeElement?.tagName,
    mode: [...document.querySelectorAll('[data-mode-picker="practice"] [aria-pressed="true"]')].map(b => b.dataset.mode)[0], content: document.querySelector('[data-mode-picker="practice"]').dataset.content || null,
    fighter: document.querySelector('[data-fighter-group="lobby"] [aria-checked="true"]').dataset.fighter, stage: document.querySelector('[data-stage-group="practice"] [aria-checked="true"]').dataset.stagePick,
    info: document.querySelector('[data-fighter-info]').dataset.shown, sl: Math.round(document.querySelector('[data-mode-picker="practice"] .rui-seg').scrollLeft)}));
  const log = {};
  await page.focus('[data-mode-scope="practice"][data-mode="classic"]');
  const modeSeq = [];
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'End', 'Home']) { await page.keyboard.press(k); await page.waitForTimeout(220); const s = await snap(); modeSeq.push(`${k}→${s.focus}/${s.mode}${s.content ? '(' + s.content + ')' : ''}@${s.sl}`); }
  log.mode = modeSeq;
  await page.focus('[data-fighter-group="lobby"] [data-fighter="vargr"]');
  const fSeq = [];
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'End']) { await page.keyboard.press(k); await page.waitForTimeout(150); const s = await snap(); fSeq.push(`${k}→${s.focus}/${s.fighter}/info:${s.info}`); }
  log.fighter = fSeq;
  await page.focus('[data-stage-group="practice"] [data-stage-pick="colosseum"]');
  const stSeq = [];
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft']) { await page.keyboard.press(k); await page.waitForTimeout(150); const s = await snap(); stSeq.push(`${k}→${s.focus}/${s.stage}`); }
  log.stage = stSeq;
  // fare ile kaydırma (sürükleme) → komşu sahne
  const box = await page.locator('[data-stage-group="practice"]').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + 80); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.2, box.y + 84, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(300);
  log.swipe = (await snap()).stage;
  return log;
}
