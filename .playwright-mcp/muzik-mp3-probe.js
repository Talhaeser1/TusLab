// Müzik .mp3'leri tarayıcıda çözülüyor mu, süre .wav ile aynı mı (döngüde boşluk yok mu), sunucu doğru tür veriyor mu.
async (page) => {
  await page.goto('http://127.0.0.1:5176/index.html');
  return await page.evaluate(async () => {
    const ctx = new AudioContext(); const out = [];
    for (const s of ['lobby', 'prep', 'combat', 'tension', 'ultimate', 'victory', 'defeat']) {
      const row = {s};
      for (const ext of ['mp3', 'wav']) {
        const r = await fetch('./assets/music/' + s + '.' + ext); const b = await r.arrayBuffer();
        const a = await ctx.decodeAudioData(b); const d = a.getChannelData(0);
        let bas = 0, son = 0; for (let i = 0; i < 400; i++) { bas = Math.max(bas, Math.abs(d[i])); son = Math.max(son, Math.abs(d[d.length - 1 - i])); }
        row[ext] = {kb: Math.round(b.byteLength / 1024), tur: r.headers.get('content-type'), sn: +a.duration.toFixed(4), bas: +bas.toFixed(3), son: +son.toFixed(3)};
      }
      out.push(JSON.stringify(row));
    }
    return out;
  });
}
