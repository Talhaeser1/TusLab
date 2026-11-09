// Ekran denetimi (docs/EKRAN-KONTROL-KURALLARI.md, bölüm C). Yalnız geliştirmede tarayıcıda çalışır:
//   const {denetle}=await import('/scripts/ekran-denetim.mjs'); denetle()
// Göz kararı değil, ölçerek bulur: üst üste binen katmanlar, kesik yazı, 12 px altı yazı,
// yatay taşma, küçük karakter görseli. Yayına gitmez (cloudflare/build-assets.mjs listesinde yok).

const KATMAN_SECICI = [
  '.rui-inter', '.rui-summary', '.rui-skill-picker', '.rui-intro', '.rui-flash', '.rui-clash', '.rui-skill-reveal',
  '.aui-prep', '.aui-result', '.aui-resolve', '.rsv-banner', '.htp-panel', '[data-pvp-settings][open] > :not(summary)',
  '[role="dialog"]', '[role="alertdialog"]'
];
const BOLGE_SECICI = {
  'yazma paneli': '.tt-type',
  'kelime şeridi': '.rui-words',
  'üst sayaç': '.rui-bar',
  'oyuncu başlığı': '.pvp2-player-top',
  'HP çubuğu': '.pvp2-health',
  'arena sahnesi': '.pvp2-stage',
  'beceri kartları': '.pvp2-skillrow'
};

const gorunur = el => {
  if (!el || !el.isConnected || el.closest('[hidden]')) return false;
  // Kapalı <details> içeriği ölçülür ama çizilmez (yalnız <summary> görünür).
  const kapali = el.closest('details:not([open])');
  if (kapali && kapali !== el && !el.closest('summary')) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  // Açılış animasyonunun ilk karesinde saydam olan katman yine "görünür" sayılır.
  if (Number(cs.opacity) < 0.05 && !el.getAnimations?.().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
};
const kutu = el => { const r = el.getBoundingClientRect(); return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)}; };
const kesisim = (a, b) => {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
};
const ad = el => (el.getAttribute('aria-label') || String(el.className || el.tagName).split(' ')[0]).slice(0, 40);

// Gizli panede animasyonlar ilerlemez: ölçümden önce hepsi sona sarılır (yanlış konum okunmasın).
export function animasyonlariBitir(kok = document) { for (const a of kok.getAnimations?.() || []) { try { if (a.effect?.getTiming?.().iterations !== Infinity) a.finish(); } catch {} } }

export function denetle({kok = document.querySelector('#pvp-root') || document.body, minYazi = 12, minKarakter = 250} = {}) {
  const sorunlar = [];
  // 1) Katmanlar: birbirleriyle ve ana bölgelerle çakışma; aynı anda birden fazla katman.
  const katmanlar = [...new Set(KATMAN_SECICI.flatMap(s => [...kok.querySelectorAll(s)]))].filter(gorunur)
    .filter(el => !katmanlar_ic_ice(el));
  function katmanlar_ic_ice(el) { return KATMAN_SECICI.some(s => el.parentElement?.closest(s)); }
  if (katmanlar.length > 1) sorunlar.push({tur: 'çoklu katman', ayrinti: katmanlar.map(ad).join(' + ')});
  for (let i = 0; i < katmanlar.length; i++) for (let j = i + 1; j < katmanlar.length; j++) {
    const k = kesisim(kutu(katmanlar[i]), kutu(katmanlar[j]));
    if (k > 400) sorunlar.push({tur: 'katman çakışması', ayrinti: `${ad(katmanlar[i])} × ${ad(katmanlar[j])} (${k} px²)`});
  }
  // Arkası tam ekran karartılan (modal) pencere, içeriği kapatmak için vardır: çakışma sayılmaz.
  const karartma = [...kok.querySelectorAll('[class*="backdrop"]')].some(b => gorunur(b) && b.getBoundingClientRect().width >= innerWidth * 0.9 && b.getBoundingClientRect().height >= innerHeight * 0.9);
  for (const katman of katmanlar) {
    if (karartma && (katman.getAttribute('aria-modal') === 'true' || katman.getAttribute('role') === 'dialog')) continue;
    const kb = kutu(katman);
    for (const [bolgeAd, secici] of Object.entries(BOLGE_SECICI)) {
      for (const bolge of kok.querySelectorAll(secici)) {
        if (!gorunur(bolge) || katman.contains(bolge) || bolge.contains(katman)) continue;
        const k = kesisim(kb, kutu(bolge));
        // Bilinçli istisna: kısa süreli durum etiketleri sahnenin boş orta çizgisinde durabilir (yalnız 'arena sahnesi').
        if (bolgeAd === 'arena sahnesi' && katman.matches?.('.rsv-banner, .rui-skill-reveal, .rui-flash')) continue;
        if (k > 1500) sorunlar.push({tur: 'içeriği kapatıyor', ayrinti: `${ad(katman)} → ${bolgeAd} (${k} px²)`});
      }
    }
  }
  // 2) Kesik yazı ve küçük yazı (yalnız görünen, doğrudan metni olan öğeler).
  const kesik = new Map(), kucuk = new Map();
  for (const el of kok.querySelectorAll('*')) {
    const metin = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    if (!metin || !gorunur(el)) continue;
    const cs = getComputedStyle(el);
    // font-size:0 bilerek gizlenmiş metindir (ör. dar ekranda "Çık" etiketiyle değiştirilen yazı).
    if (parseFloat(cs.fontSize) > 0 && parseFloat(cs.fontSize) < minYazi) kucuk.set(ad(el) + "|" + metin.slice(0, 24), `${cs.fontSize} "${metin.slice(0, 24)}"`);
    const tasiyor = el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX);
    if (tasiyor || (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)) kesik.set(ad(el) + "|" + metin.slice(0, 30), `"${metin.slice(0, 30)}" (${el.clientWidth}/${el.scrollWidth} px)`);
  }
  for (const [k, v] of kesik) sorunlar.push({tur: 'kesik yazı', ayrinti: `${k}: ${v}`});
  for (const [k, v] of kucuk) sorunlar.push({tur: `${minYazi} px altı yazı`, ayrinti: `${k}: ${v}`});
  // 2b) Ezilmiş kart: içinde yazı olan düğme/kart 120 px'ten dar ya da yazı alanı 70 px'ten dar.
  for (const kart of kok.querySelectorAll('.aui-card, .sk-card')) {
    if (!gorunur(kart)) continue;
    const w = kart.getBoundingClientRect().width, kopya = kart.querySelector('.aui-card-copy');
    const kw = kopya ? kopya.getBoundingClientRect().width : w;
    if (w < 120 || kw < 70) sorunlar.push({tur: 'ezilmiş kart', ayrinti: `${ad(kart)} ${Math.round(w)} px (yazı ${Math.round(kw)} px)`});
  }
  // 2c) VS dairesi etiketlere binmesin.
  const vs = [...kok.querySelectorAll('.pvp2-vs, [class*="vs-badge"]')].find(gorunur);
  if (vs) for (const et of kok.querySelectorAll('.pvp3-motion-label, .pvp2-role, .pvp2-hero-tag')) {
    if (gorunur(et) && kesisim(kutu(vs), kutu(et)) > 50) sorunlar.push({tur: 'VS çakışması', ayrinti: `${ad(et)} "${et.textContent.trim().slice(0, 20)}"`});
  }
  // 3) Yatay taşma.
  if (document.documentElement.scrollWidth > innerWidth + 1) sorunlar.push({tur: 'yatay taşma', ayrinti: `${document.documentElement.scrollWidth} > ${innerWidth}`});
  // 4a) Arena sahnesi ezilmiş mi (karakter hiç görünmüyorsa görsel sayılmaz; sahneyi ölç).
  for (const sahne of kok.querySelectorAll('.pvp2-stage')) {
    const sh = sahne.getBoundingClientRect().height;
    if (sahne.closest('[hidden]') || getComputedStyle(sahne).display === 'none') continue;
    if (sh < minKarakter * 0.6) sorunlar.push({tur: 'arena ezilmiş', ayrinti: `sahne ${Math.round(sh)} px`});
  }
  // 4) Karakter görselleri.
  const karakterler = [...kok.querySelectorAll('img')].filter(i => /assets\/rig\//.test(i.src) && gorunur(i));
  const enBuyuk = karakterler.reduce((m, i) => Math.max(m, i.getBoundingClientRect().height), 0);
  if (karakterler.length && enBuyuk < minKarakter) sorunlar.push({tur: 'karakter küçük', ayrinti: `en büyük ${Math.round(enBuyuk)} px < ${minKarakter}`});
  for (const i of karakterler) if (!i.complete || !i.naturalWidth) sorunlar.push({tur: 'resim yüklenmedi', ayrinti: i.src.split('/').pop()});
  return {ekran: `${innerWidth}×${innerHeight}`, katmanlar: katmanlar.map(el => ({ad: ad(el), ...kutu(el)})), sorunSayisi: sorunlar.length, sorunlar};
}
