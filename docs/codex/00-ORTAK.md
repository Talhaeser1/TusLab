# Codex şeritleri — ortak kurallar (her şerit önce bunu okur)

Proje kökü: bu depo (TuşLab PvP — tarayıcıda 1v1 "yazarak dövüş" oyunu). Node 22+, test: `node --test tests/*.test.mjs`,
derleme kontrolü: `npm run cf:validate`. Dev sunucu yok sayılır (tarayıcı doğrulamasını orkestratör yapar).

## Ortam
- three.js r160 yerel: `pvp/vendor/three.module.min.js` (+ GLTFLoader.js, SkeletonUtils.js, BufferGeometryUtils.js). CDN YOK.
- Karakterler: `pvp/shared/fighters.js` (vargr, sira, doran, nyx), modeller `assets/characters/*.glb`, koreografi `pvp/fighters3d.js`.
- Sahne verisi: `pvp/shared/stages.js` (STAGES, STAGE_IDS, normalizeStage, DEFAULT_STAGE='colosseum'; sahneler colosseum, skyforge, runegarden, harbor).
- Önceki (durdurulmuş) ajanlar bazı dosyalarda YARIM değişiklik bıraktı. BAŞLAMADAN `git diff --stat` ve kendi dosyalarının `git diff`'ini oku;
  mantıklı olanı koru ve tamamla, bozuk/yarım olanı düzelt. `git checkout`/`git reset`/`git stash` KULLANMA (başka şeritlerin işini siler).

## Kesin kurallar
1. YALNIZ şeridinin "Sahip olduğun dosyalar" listesindeki dosyalara yaz. Başka dosyaya dokunman gerekirse yapma; raporda "GEREKEN DEĞİŞİKLİK: dosya → ne" diye yaz.
2. `index.html`'e dokunma. Satır sonlarını koru (LF dosyayı CRLF yapma).
   İstisna (2026-11-10, kullanıcı onayı): yalnızca visual-enrich.css <link> ve visual-enrich.js <script defer> satırları eklendi; compact-height.css son sırada kalır.
   Aynı istisna devamindex.html için de geçerli (CLAUDE.md): yalnız o 2 satır (bir <link>, bir <script defer>); başka satıra dokunulmaz.
   İstisna (2026-11-23, kullanıcı isteği "ana sayfayı baştan yap"): yalnız home/home.css <link> (compact-height.css'ten önce) ve home/home.js <script defer> satırları eklendi. Başka satıra dokunulmadı; compact-height.css son sırada. Ayrıntı: docs/codex/ANASAYFA-SOZLESME.md.
3. Paket indirme yok, ağ yok (npm install yok).
4. Hiçbir ticari oyunun (Street Fighter, 2XKO vb.) adını, karakterini, görselini, sahnesini kopyalama; özgün TuşLab neon kimliği.
5. Erişilebilirlik: görünen yazı ≥ 12 px; `prefers-reduced-motion: reduce` ve `#pvp-root.pvp4-reduced` altında animasyon yok/sade; odak halkası görünür.
6. Sunucu güvenliği: istemciden gelen her yeni alan sunucuda doğrulanır (izinli kimlik listesi / boolean). `cloudflare/src/room.js` MAX_BYTES 4096 — snapshot'ı şişirme.
7. Her adımdan sonra `node --test tests/*.test.mjs` çalıştır; düşen test SENİN değişikliğinden ise düzelt; başka şeridin dosyasından ise dokunma, raporla.
8. Bitince `npm run cf:validate` çalıştır.
9. Bitmeyen işi "bitti" diye yazma.

## Rapor (son çıktın, Türkçe, bu başlıklarla)
- YAPILANLAR (madde madde, dosya:satır aralığı)
- KABUL KONTROLLERİ (şeridin her kabul ölçütü için: geçti/kaldı + kanıt: test adı veya komut çıktısı)
- TEST SONUCU (`ℹ tests N / pass N / fail N` satırları) ve cf:validate sonucu
- GEREKEN DEĞİŞİKLİKLER (başka şeridin dosyalarında)
- KALAN SORUNLAR
