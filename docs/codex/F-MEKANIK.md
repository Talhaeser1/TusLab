# Şerit F — Raund ve yazı mekanikleri (Codex)

Önce `docs/codex/00-ORTAK.md` kurallarını oku ve uy (index.html yasak, ağ yok, LF koru, git checkout/reset/stash yok).

## Sahip olduğun dosyalar (yalnız bunlara yaz)
pvp/shared/match.js, pvp/shared/words.js, pvp/shared/typing-rules.js, pvp/shared/assist-rules.js,
cloudflare/src/room.js, cloudflare/src/match.js, pvp/practice.js, pvp/network.js, pvp/index.js,
pvp/rounds-ui.js, pvp/rounds-ui.css, pvp/skillbar.js, pvp/fight-hud.js,
tests/pvp-rounds-*.test.mjs, tests/pvp-practice-rounds.test.mjs, tests/pvp-mechanics-f.test.mjs (yeni), tests/pvp-skillbar.test.mjs.
Lobi mod seçimi gerekiyorsa ilgili lobi JS dosyası (sadece seçenek ekleme).

## YASAK
pvp/fighters3d.js, assets/characters/**, assets/models/** ve 3D/animasyon dosyaları (başka ajan çalışıyor), index.html.

## Arka plan (teşhis)
- Tek kural motoru pvp/shared/match.js; sunucu (cloudflare/src/match.js → room.js) ve practice.js aynısını kullanır. Bunu koru.
- "rounds" modu bugün 10 kelime (ROUND_WORDS) + 40 sn ile sınırlı; 10 kelime bitince oyuncu boş ekranda bekliyor.
- rounds-ui.js timerOf yalnız phase==='round' iken sayıyor; diğer fazlarda 0 görünüyor. resolve fazı birikmiş saldırıları 1300 ms arayla oynatıyor → uzun "ÇÖZÜLÜYOR".
- "TUR ARASI" (.rui-secs-unit) 58px daireye sığmıyor ve .rui-title ("RAUND n/m") ile çakışıyor (rounds-ui.css:78-86).
- wordIndex raund başında sıfırlanmıyor (resetForRound) — raund 2+ için WORD_INDEX_MISMATCH riski; doğrula.

## Yapılacaklar
1. rounds moduna `roundStyle: 'timed' | 'counted'` seçeneği ekle (varsayılan: 'counted' = mevcut davranış, 10 kelime; `roundWords` 5..20 arası, varsayılan 10).
   - counted: tüm kelimeler bitince raund biter (rakip de bitirince ya da süre dolunca — mevcut kural).
   - timed: süre dolana kadar kelime akar; kuyruk biterse aynı deterministik tohumla yeni kelimeler eklenir; ekran asla boş kalmaz. roundDone yalnızca süreyle.
   - Sunucu yeni alanları izinli liste/aralıkla doğrular; snapshot küçük kalsın (MAX_BYTES 4096): tüm kuyruğu değil, yalnız görünen pencereyi (ör. mevcut+4) gönder.
2. Sayaç: her fazda doğru göster (round: kalan süre; intermission/resolve: sonraki faza kalan süre veya ilerleme), freeze/timethief sonrası halka doğru. "ÇÖZÜLÜYOR" en fazla makul süre (ör. ≤6 sn) sürsün: resolve aralığını sıkıştır (saldırı sayısına göre aralığı kısalt, alt sınır ~350 ms) ve istemci tarafında faz takılırsa (deadline + 2 sn geçti) son snapshot'tan yeniden senkron iste ya da practice'te zorla ilerlet.
3. Raund geçişleri, Q/E/R kelime ilerlemesi ve "Hazır" durumları, süper/destek barları, can/hasar akışını uçtan uca test et; bulduğun hataları düzelt. Eşikleri tek kaynaktan al (skillbar.js kopya sabit yerine match.js'den export).
4. "TUR ARASI" / "RAUND" çakışmasını gider (intermission'da başlık ya da birim yazısı tek görünsün; yazı ≥12px).
5. Her düzeltme için test yaz (tests/pvp-mechanics-f.test.mjs). `node --test tests/*.test.mjs` tamamı geçmeli; `npm run cf:validate` geçmeli.

## Rapor
00-ORTAK.md'deki rapor başlıklarıyla, Türkçe.
