// KRİTİK arka plan düzlemi: konum/derinlik + ekran görüntüsü.
async (page) => {
  await page.setViewportSize({width: 1366, height: 768});
  await page.goto('http://127.0.0.1:5176/index.html?pvp=practice&mode=rounds&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx&animprobe=1');
  await page.waitForFunction(() => window.__tuslabArena3d?._debug?.models?.()[2]?.loaded, null, {timeout: 70000}).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const a = window.__tuslabArena3d, d = a._debug; d.showCrit(1);
    await new Promise(res => setTimeout(res, 300));
    const m = a.api.scene.getObjectByName('pvp4-crit-backdrop');
    const cam = a.api.camera.position;
    return {crit: d.crit(), mesh: m && {x: m.position.x, y: m.position.y, z: m.position.z, sx: m.scale.x}, cam: {x: cam.x, y: cam.y, z: cam.z},
      a1: a.api.seatAnchor(1), a2: a.api.seatAnchor(2), dom: !!document.querySelector('#pvp-root.pvp26-3d')};
  });
  await page.screenshot({path: '.playwright-mcp/crit-3d.jpg', type: 'jpeg', quality: 70});
  return r;
}
