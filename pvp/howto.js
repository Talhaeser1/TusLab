// Oyun içi "Nasıl oynanır" paneli (U5). Kaynak: docs/OYUN-REHBERI.md (sayılar motordan).
// Paket 32: "Karakterler" sekmesi kadrodan (pvp/shared/fighters.js) üretilir.
// Sağdan açılan panel; sekmeler; Esc kapatır; odak panelde kalır ve kapanınca düğmeye döner.

import {FIGHTERS, FIGHTER_IDS, fighterDefense} from './shared/fighters.js';
import {ROUND_TOTAL, ROUND_HP, ROUND_DURATION_MS, ULTIMATE_MULTIPLIER_CAP, MULTIPLIER_CAP, DEFENSE_AMOUNT, SHIELD_AMOUNT, CHAIN_EVERY, CHAIN_EVERY_LONG} from './shared/match.js';

const num = n => String(n).replace('.', ',');
/** Kullanıcı isteği "ultide de max 2 kombo": motorda ULTIMATE_MULTIPLIER_CAP. Oyuncuya görünen kural metni. */
export const ULTI_RULE_TEXT = `Ulti çarpanı en çok ×${num(ULTIMATE_MULTIPLIER_CAP)}`;

const fighterItems = () => [
  ...FIGHTER_IDS.map(id => {
    const f = FIGHTERS[id], k = f.skills;
    return [`${f.name} · ${f.title} (${f.archetype === 'fire' ? 'Ateş' : 'Rün'})`,
      `Q ${k.q.name} · W ${k.w.name} · E ${k.e.name} (${fighterDefense(id) === 'shield' ? 'kalkan' : 'can'}) · R ${k.r.name} (3 evre; ${ULTI_RULE_TEXT.toLowerCase()}) · S ${k.s.name} (yalnız klasik). ${f.blurb}`]; // KESINYAP 21
  }),
  ['Denge', 'Hasar ve süreler tarafa göre aynıdır: Ateş karakterleri saldırgan, Rün karakterleri savunmacı arketipi kullanır. Karakter; görünüş, animasyon, efekt ve beceri adlarını değiştirir.']
];

export const HOWTO_TABS = Object.freeze([
  {id: 'modlar', title: 'Modlar', items: [
    ['Arena seçimi', 'Bot bölümünde veya oda ayarlarında Neon Kolezyum, Gök Demirhanesi, Rün Bahçesi, Fırtına Limanı ya da Rastgele seç. Odada sahneyi yalnız oda sahibi değiştirir. Sahne hasarı ve kuralları değiştirmez.'],
    ['Klasik', '120 sn, 2000 HP. Maç 10 saniyelik pencerelere bölünür: pencerede yazdığın kelimeler beceri doldurur, pencere bitince saldırılar sırayla (sen, rakip, sen…) oynatılır. Q 2, E 4, R 5 doğru kelimede dolar.'],
    ['Zamana Karşı', `${ROUND_TOTAL} raund, raund ${ROUND_DURATION_MS / 1000} sn, ${ROUND_HP} can raundlar arasında taşınır. Raund bitince saldırılar sırayla çözülür. Raund arasında bir süre becerisi seçebilirsin.`],
    ['Raund Arena', '6 raund (raund 40 sn, hazırlık 15 sn): 5 · 10 · 15 · 15 · 15 · 20 kelime. 3000 HP raundlar arasında taşınır. İlk bitiren raundu kapatır, sonra vuruşlar sırayla uygulanır.'],
    ['Tur sonu ekranı', 'Kazanan, iki oyuncunun doğru / yanlış sayısı, verilen hasarı ve en iyi kombosu yan yana görünür. Pipler tur galibiyetlerini, halka sonraki tura kalan süreyi gösterir. Zamana Karşı tur arasında süre becerisi seç: 1–3 seçer, Enter kilitler, Esc seçmeden geçer.']
  ]},
  {id: 'hasar', title: 'Hasar ve kombo', items: [
    ['Taban hasar', 'Arena: raunda göre doğru kelime başına 100 · 90 · 80 · 80 · 80 · 75.'],
    ['Kombo', '4. ardışık doğru KOMBO ×1,5; 5. ve sonrası FİNAL ×2. Yanlış kelime seriyi sıfırlar.'],
    ['Raund modu serisi', `Seri 3 → Q · 5 → W · 7 → E (kalkan ${SHIELD_AMOUNT} ya da can ${DEFENSE_AMOUNT}) · 10 → R ulti (3 evre) · sonra ${10 + CHAIN_EVERY}. ve her ${CHAIN_EVERY_LONG}. kelime Q. 10. seriden sonra çarpan ×1,5'ten artar, en çok ×${num(MULTIPLIER_CAP)}.`],
    ['Ulti (R)', `${ULTI_RULE_TEXT}: seri ne kadar uzun olursa olsun R'nin üç evresi en fazla iki kat vurur.`],
    ['Yanlış cezası', 'Üst üste yanlışlar sonraki doğrunun hasarını düşürür: 1 yanlış −%10, 2 yanlış −%25, 3 yanlış −%48 (en fazla −%75). Örnek: D Y Y Y D → 5. kelime ×0,52.']
  ]},
  {id: 'esya', title: 'Eşyalar', items: [
    ['🔥 Kombo Yükselteci', 'KOMBO ×1,75, FİNAL ×2,4.'],
    ['🛡️ Arınma Taşı', 'O raund yanlış cezası uygulanmaz.'],
    ['🥊 Ağır Eldiven', 'Taban hasar +%10.'],
    ['⚡ Çelik Kalkan', 'O raund aldığın hasar −%20.'],
    ['Kural', 'Raund öncesi en fazla 1 eşya; her eşya maçta 2 kez.']
  ]},
  {id: 'beceri', title: 'Beceriler', items: [
    ['🔀 Harf Kaosu', 'Rakibin kelimelerinin harfleri karışır (karpuz → zurpak); karışık hâliyle yazmak zorunda.'],
    ['⏰ Zaman Hediyesi', 'Rakip senden önce bitirirse sana +5 sn.'],
    ['🕜 Zaman Hırsızı', 'Rakibin süresinden −5 sn.'],
    ['❄️ Donmuş An', 'Kendi süren 3 sn donar (+3 sn).'],
    ['🌑 Karanlık Saat', 'Rakip o raund süreleri göremez.'],
    ['Kural', 'Raund öncesi en fazla 1 beceri; her beceri maçta 2 kez. Rakibin seçimi raund bitince açıklanır.']
  ]},
  {id: 'karakterler', title: 'Karakterler', items: fighterItems()},
  {id: 'kontrol', title: 'Kontroller', items: [
    ['Yaz + Space', 'Kelimeyi gönderir.'],
    ['1–5 / 6–9', 'Arena hazırlığında beceri / eşya seç.'],
    ['1–3', 'Zamana Karşı tur arasında süre becerisi seç.'],
    ['Enter / Esc', 'Seçimi kilitle / seçmeden geç. Esc açık paneli veya menüyü kapatır.'],
    ['⚙ Ayarlar', 'Müzik, ses, efektleri azalt, 3B arena.'],
    ['Yazım kuralları', 'Lobide "Büyük/küçük harf duyarlı" ve "Noktalama yazılsın ( . , )" ayarlarını açıp kapatabilirsin.']
  ]}
]);

export function howtoButtonHTML() {
  return '<button type="button" class="pvp4-icon-btn htp-open" data-howto-open aria-haspopup="dialog" aria-label="Nasıl oynanır"><span aria-hidden="true">?</span><span class="pvp4-tip" aria-hidden="true">Nasıl oynanır</span></button>';
}

export function attachHowto({root, doc = globalThis.document} = {}) {
  if (!root?.addEventListener || !doc) return {open() {}, close() {}, destroy() {}};
  let panel = null, opener = null, active = HOWTO_TABS[0].id;

  function build() {
    panel = doc.createElement('aside');
    panel.className = 'htp-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'htp-title');
    panel.hidden = true;
    const head = doc.createElement('header'); head.className = 'htp-head';
    const h = doc.createElement('h2'); h.id = 'htp-title'; h.textContent = 'Nasıl oynanır';
    const x = doc.createElement('button'); x.type = 'button'; x.className = 'htp-close'; x.dataset.howtoClose = ''; x.setAttribute('aria-label', 'Paneli kapat'); x.textContent = '✕';
    head.append(h, x);
    const tabs = doc.createElement('div'); tabs.className = 'htp-tabs'; tabs.setAttribute('role', 'tablist');
    const body = doc.createElement('div'); body.className = 'htp-body';
    for (const t of HOWTO_TABS) {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'htp-tab'; b.dataset.howtoTab = t.id;
      b.setAttribute('role', 'tab'); b.id = `htp-tab-${t.id}`; b.setAttribute('aria-controls', `htp-sec-${t.id}`); b.textContent = t.title;
      tabs.appendChild(b);
      const sec = doc.createElement('section'); sec.id = `htp-sec-${t.id}`; sec.className = 'htp-sec'; sec.setAttribute('role', 'tabpanel'); sec.setAttribute('aria-labelledby', b.id);
      const dl = doc.createElement('dl');
      for (const [k, v] of t.items) { const dt = doc.createElement('dt'); dt.textContent = k; const dd = doc.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
      sec.appendChild(dl); body.appendChild(sec);
    }
    panel.append(head, tabs, body);
    root.appendChild(panel);
    select(active);
  }
  function select(id) {
    active = id;
    panel?.querySelectorAll('.htp-tab').forEach(b => { const on = b.dataset.howtoTab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel?.querySelectorAll('.htp-sec').forEach(s => { s.hidden = s.id !== `htp-sec-${id}`; });
  }
  function open(from) {
    if (!panel || !panel.isConnected) build();
    opener = from || doc.activeElement;
    panel.hidden = false;
    panel.querySelector(`[data-howto-tab="${active}"]`)?.focus({preventScroll: true});
  }
  function close() {
    if (!panel || panel.hidden) return false;
    panel.hidden = true;
    opener?.focus?.({preventScroll: true});
    return true;
  }
  const onClick = e => {
    const t = e.target;
    const openBtn = t.closest?.('[data-howto-open]');
    if (openBtn) { e.preventDefault(); open(openBtn); return; }
    if (t.closest?.('[data-howto-close]')) { close(); return; }
    const tab = t.closest?.('[data-howto-tab]');
    if (tab) select(tab.dataset.howtoTab);
  };
  // Yakalama aşamasında: panel açıkken Esc yalnız paneli kapatsın (PvP'den çıkmasın).
  const onKey = e => {
    if (!panel || panel.hidden) return;
    // PvP'nin kendi Esc dinleyicisi de document/capture'da; aynı düğümde durdurmak için Immediate gerekir.
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const ids = HOWTO_TABS.map(t => t.id), i = ids.indexOf(active);
      const next = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      if (e.target?.closest?.('.htp-tabs')) { select(next); panel.querySelector(`[data-howto-tab="${next}"]`)?.focus(); }
      return;
    }
    if (e.key === 'Tab') { // odak tuzağı
      const f = [...panel.querySelectorAll('button')].filter(b => b.tabIndex !== -1);
      if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && doc.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  root.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey, true);
  return {open, close, destroy() { root.removeEventListener('click', onClick); doc.removeEventListener('keydown', onKey, true); panel?.remove?.(); panel = null; }};
}
