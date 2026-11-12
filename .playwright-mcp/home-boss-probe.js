// KESINYAP iş 9: ana ekranda 3B canvas yok, eski görsel (arena-king.webp) görünür. Kullanım: node .playwright-mcp/run.mjs .playwright-mcp/home-boss-probe.js '{"w":1366,"h":768}'
async (page) => {
  const P = Object.assign({w: 1366, h: 768}, JSON.parse(process.argv[3] || '{}'));
  await page.setViewportSize({width: P.w, height: P.h});
  await page.goto('http://127.0.0.1:5176/index.html');
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const bd = document.querySelector('#panel-arena .arena-backdrop');
    const img = bd?.querySelector('img');
    const rect = e => { const b = e?.getBoundingClientRect(); return b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null; };
    const cs = img ? getComputedStyle(img) : null;
    return {canvasCount: document.querySelectorAll('canvas.home-boss3d-canvas, .arena-backdrop canvas').length, readyClass: bd?.classList.contains('home-boss3d-ready') ?? null,
      backdrop: !!bd, backdropRect: rect(bd), img: img ? {src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, rect: rect(img), opacity: cs.opacity, display: cs.display} : null,
      leaderboardOrBadges: /Liderlik Tablosu|Başarımlar/.test(document.body.innerText)};
  });
  await page.screenshot({path: `.playwright-mcp/home-eski-${P.w}.png`});
  return r;
}
