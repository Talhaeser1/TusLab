async (page) => {
  await page.setViewportSize({width: 375, height: 812});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=classic&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx');
  await page.waitForTimeout(8000);
  return await page.evaluate(() => {
    const e = document.querySelector('.pvp4-toggle'); if (!e) return 'yok';
    const chain = []; for (let p = e; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p), r = p.getBoundingClientRect(); chain.push(`${p.tagName}.${p.className.toString().split(' ')[0]} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}] pos:${c.position} ov:${c.overflowX} op:${c.opacity} vis:${c.visibility} tr:${c.transform.slice(0, 30)} hidden:${p.hidden}`); }
    const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(Math.min(r.left + 20, innerWidth - 2), r.top + 10);
    return {hit: hit && (hit.className.toString().slice(0, 30) + ' ' + hit.tagName), chain: chain.slice(0, 7)};
  });
}
