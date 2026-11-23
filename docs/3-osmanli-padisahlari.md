# 3 — Osmanlı padişahları (Yazma içeriği, ilk 10)

**İstek:** "Osmanlı padişahlarını oyuna ekle, her birini baştan ekle", ardından "10 tane ekle".

## Karar: PvP karakteri değil, yazma içeriği
- PvP dövüşçüleri (`pvp/shared/fighters.js`) her biri için ayrı bir 3B model (`assets/models/<id>/<id>.glb`), animasyon klipleri, portre ve Q/W/E/R/S becerileri ister. Padişahlar için bu varlıklar projede yok. Uydurma görsel üretilmedi.
- Bu yüzden padişahlar ana ekrandaki yazma içeriğine eklendi: Yazma Arenası'nda **👑 Padişah** kipi, Şiir & Atasözü sayfasında **Padişahlar** kartı.
- PvP karakteri yapmak için gerekenler: her padişaha bir .glb model (KayKit iskeletiyle uyumlu ya da Meshy çıktısı gibi kendi klipleriyle), portre görseli, beceri adları/efektleri ve denge kontrolü (`scripts/pvp-denge-sim.mjs`).

## Ne eklendi
- `home/data/sultans.js` (yeni): ilk 10 padişah, sıra numarası, saltanat yılları ve her biri için 3 bilgi cümlesi (toplam 30 metin). Osman Gazi, Orhan Gazi, I. Murad, I. Bayezid, I. Mehmed, II. Murad, II. Mehmed, II. Bayezid, I. Selim, I. Süleyman.
- `home/arena.js`: `padisah` modu. Bu mod **karıştırılmaz**; Osman Gazi'den başlayıp sırayla gelir, sona varınca baştan başlar (`ORDERED_MODES`).
- `home/literature.js`: Padişahlar kartı. `home/home.js`: Performans'taki mod adı.
- Testler: `tests/home-padisah.test.mjs` (yeni, 2 test); `home-metin-akisi` ve `home-typing-akis` testlerinde mod/kart sayısı güncellendi.

## Tarih notları
- Osman Gazi'nin saltanat bitişi kaynaklarda 1324 ile 1326 arasında değişiyor; "yak. 1299–1324" yazıldı. Orhan Gazi 1324–1362.
- II. Murad ve II. Mehmed iki kez tahta çıktı; iki dönem de yazıldı.
- Tarihi kesin olmayan bilgiler (ör. Edirne'nin alınış yılı) yazılmadı.

## Doğrulama
- `node --test tests/*.test.mjs`: 1053/1053.
- Tarayıcı (`127.0.0.1:5177`): Padişah kipi seçildi, ilk metin "Osman Gazi, Ertuğrul Gazi'nin oğludur…" geldi; yazılınca ikinci Osman Gazi metni geldi. Şiir & Atasözü'nde Padişahlar kartı "30 metin" gösteriyor. Konsolda hata yok.
- Denenmedi: telefon genişliği, 30 metnin hepsini yazıp tur dönüşünü tarayıcıda görmek (testte var).

## Sıradaki
- 11. II. Selim'den devam (`home/data/sultans.js` sonuna aynı biçimde).
