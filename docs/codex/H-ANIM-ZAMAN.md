# Şerit H — Animasyon zamanlaması (ışınlanma yok, doğal hız, görsel kuyruk)

Önce `docs/codex/00-ORTAK.md` kurallarını oku. Kullanıcı şikâyeti: karakterler ışınlanıyor, animasyonlar çok hızlı ve kırpılmış, ne yaptıkları anlaşılmıyor.

## Sahip olduğun dosyalar
pvp/fighters3d.js, pvp/arena3d.js, pvp/anim-state.js, pvp/impact-feel.js, pvp/fight-motion.js, pvp/arena3d-fx.js,
pvp/visual-timeline.js (yeni), scripts/optimize-vargr-meshy.py (veya yeni scripts/merge-vargr-clips.py), assets/models/vargr/vargr.glb,
tests/pvp-anim-timing-h.test.mjs (yeni), tests/pvp-vargr-meshy.test.mjs ve ilgili anim testleri (gerekçeyle güncelle).

## YASAK
pvp/shared/** (hasar/kural), cloudflare/**, pvp/network.js, pvp/practice.js, pvp/rounds-ui.*, pvp/cinematic.js, pvp/fight-hud.js, index.html (raund ekranında başka ajan çalışıyor).

## İstenen
1. **Yolculuk:** Saldıran rakibe gerçekten koşsun/atılsın: 300–500 ms, yumuşak hızlanma (ease-in-out, sonda hafif fren). Işınlanma (tek karede konum sıçraması) YASAK: herhangi bir karede kök konum değişimi ≤ (yolculuk mesafesi × 0,25) olsun. Yolculukta koşu klibi oynasın.
   - Vargr (Meshy): yeni klipler `assets/models/vargr/kaynak/vargr-meshy-kosu.glb` içinde (Meshy "Standard_Forward_Charge_inplace" ve "Walk_Fight_Back_inplace", aynı iskelet). Bu iki animasyonu vargr.glb'ye ekle (kemik/düğüm adlarıyla kanalları yeniden hedefle; doku/mesh eklenmesin). Klip adlarını mevcut kurala uydur (örn. `Run_Charge`, `Walk_Back`) ve MODEL_VARIANTS/klip tablosuna ekle. vargr.glb ≤ 1 258 291 B kalsın.
   - KayKit modelleri: kendi koşu/yürüme kliplerini kullan (GLB'de varsa: Running_A/Running_B/Walking_Backwards vb.; yoksa Dodge_Forward + kayma).
2. **Doğal hız:** saldırı klipleri timeScale 1 (en fazla 1.2). Hazırlık, vuruş, toparlanma görünsün — klibi kesip yalnız vuruş anını oynatma (startAt/offset ile ortadan başlatma yok).
3. **Gerçek temas karesi:** vuruş efekti, hitstop, sarsıntı, hasar sayısı ve hit reaction klibin gerçek temas karesinde (peakMs / ölçülen zirve hız anı) tetiklensin. Sonra karakter yerine geri yürüsün (Walk_Back) ya da geri sıçrasın (≈350–500 ms).
4. **Görsel kuyruk (pvp/visual-timeline.js):** sunucu/motor olayları (hasar, combat event) geldiği an değil, görsel zaman çizelgesine sıraya alınarak oynatılsın: her saldırı = yolculuk + klip(temasa kadar) + toparlanma + dönüş. Hasar/HP gösterimi temas karesine ertelenir; hasar hesabı ve ağ mantığı DEĞİŞMEZ. Kayma sınırı: kuyruk birikimi > 2,5 s olursa sonraki saldırılarda yolculuk/dönüş kısaltılır (dönüş atlanır, sonraki saldırı oradan başlar) ve gerekirse timeScale 1.2'ye çıkar; raund sonu/KO/zafer olayında kuyruk en geç 1,5 s içinde boşalır (HP son değere oturur). Raund geçişi kuyruk bitmeden başlarsa son durumu anında uygula.
5. **Ulti sinematik:** R/ulti başında 250–400 ms yavaş çekim (timeScale 0,35–0,5 sadece görsel), kamera yakınlaşma (saldırana odak, sonra temas noktası), uzun klibin anlamlı kısmı kesilmeden (çok evreli kliplerde her evre en az %80 süresiyle). Reduced-motion'da yavaş çekim ve zoom yok.
6. **Ölçüm ve kanıt (zorunlu):** Playwright MCP ile (ToolSearch "playwright") http://127.0.0.1:5176/?pvp=practice&karakter=vargr bot maçı aç. Yazmayı `browser_press_key` ile tek tek yap (oyunun girdi kodunu değiştirme) ya da botun saldırılarını bekle. `browser_evaluate` ile requestAnimationFrame döngüsünde saldıranın kök x konumu, aktif klip adı, clip.time, timeScale ve temas olay zamanlarını 60 karede/sn kaydet (bunun için arena3d'de yalnız `window.__tuslabAnimProbe` gibi okuma amaçlı, varsayılan kapalı bir hata ayıklama kancası ekleyebilirsin; `?animprobe=1` ile açılsın). Ölç: yolculuk süresi (300–500 ms mi), en büyük tek kare sıçraması, timeScale ≤1.2, temas olayı ile klip zirve anı farkı (≤ 1 kare), ulti yavaş çekim süresi. 3–4 kare dizisi ekran görüntüsü al (hazırlık/vuruş/toparlanma/dönüş) ve şuraya kaydet: C:/Users/TALHAE~1/AppData/Local/Temp/claude/2e1362527dc05f2f/82c15e65-830a-4909-8f49-2cf9410ff9c3/scratchpad/shots/anim-*.png
7. **Testler:** tests/pvp-anim-timing-h.test.mjs — görsel kuyruk (sıra, kayma sınırı, raund sonu boşaltma, hasar gösteriminin temasa ertelenmesi), yolculuk eğrisi (süre aralığı, tek kare sıçrama sınırı), timeScale sınırı, ulti yavaş çekim reduced-motion. `node --test tests/*.test.mjs` tamamı + `npm run cf:validate` geçmeli.

## Rapor
Türkçe ≤450 kelime: YAPILANLAR (dosya:satır), ÖLÇÜMLER (tablo: metrik → değer → hedef → geçti/kaldı), TEST SONUCU, ekran görüntüsü yolları, KALAN SORUNLAR.
