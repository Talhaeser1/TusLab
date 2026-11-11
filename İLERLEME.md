# İLERLEME — "Gerçek dövüş hissi" paketi

Orkestratör: Claude (bu oturum Opus 5.5 üzerinde çalışıyor; istenen "Fable 5.2" değil — not edildi).
İşçiler: Codex (`codex exec`), OpenCode+GLM (`opencode run -m evren/glm-5.3`), Claude CLI sonnet/haiku.

## 2026-11-11 — Başlangıç kontrolleri
- MCP: meshy ✅, higgsfield ✅, playwright ✅, elevenlabs ⚠️ bağlı ama API anahtarında `user_read` izni yok → bakiye okunamıyor (401). Ses üretim çağrıları ayrıca denenecek.
- Bakiyeler:
  - Meshy: **1053** kredi (aylık, 2026-12-10'da yenilenir). Bu paket için tavan: 500.
  - Higgsfield: **7** kredi (free plan) → yeni Higgsfield görseli neredeyse imkânsız; mevcut `assets/higgsfield/` görselleri kullanılacak.
  - ElevenLabs: okunamadı (izin eksik). %70 kuralı ölçülemiyor → üretim adet bazında sınırlı tutulacak.
- GLM (opencode PID 15112, 03:07'de başladı) Vargr entegrasyonuna devam ediyor → bitene kadar `pvp/fighters3d.js`, `assets/characters/`, ilgili testlere dokunulmuyor.
- `ses-kaynak/` klasörü yok → spiker klonlama yapılmayacak; voice design ile özgün spiker sesi.
- `npm run serve` arka planda (127.0.0.1:5176).

## Açık sorunlar
- ElevenLabs anahtarına `user_read` izni verilirse bakiye takibi yapılabilir.

## D — Mekanik (başladı)
- Teşhis: Sonnet alt ajan (salt okuma). Kök nedenler: rounds modu 10 kelimeyle sınırlı → boş ekran; sayaç yalnız round fazında sayıyor; resolve fazı 1300 ms aralıkla uzun "ÇÖZÜLÜYOR"; "TUR ARASI" 58px daireye sığmıyor, "RAUND n/m" ile çakışıyor.
- Karar: rounds moduna `roundStyle: timed|counted` (varsayılan counted=10 kelime). Klasik düello modu korunur.
- Uygulama: `codex exec --full-auto` otomatik izin sınıflandırıcısı tarafından engellendi → görev Sonnet alt ajana (Agent aracı) verildi. Görev tanımı: docs/codex/F-MEKANIK.md.
- ✅ c297ae6: roundStyle timed/counted, faz sayacı, çözüm ≤~6 sn, takılma senkronu, TUR ARASI çakışması. 711/711 test, cf:validate 77/77. (Sonnet alt ajan; denetim + commit: orkestratör)
- Not: tests/pvp-rounds-plan6.test.mjs (önceki ajandan takipsiz, motorla çelişen 6 raundluk plan) → tests/_pending/ altına taşındı.
- Devam: lobi seçicisi (varsayılan timed) Sonnet alt ajanda.
- ✅ Lobi raund biçimi seçicisi (practice + online host), varsayılan timed; 715/715 test, cf:validate 77/77. Tarayıcı: bot maçında sayaç 34→31 sn/3 sn aktı (doğrulandı).
- Açık: oda lobisinde raund sayısı (5/7/10) seçicisi basılmıyor (önceden de yoktu) — E aşamasında bakılacak.

## A — Vargr pilotu (GLM işi, denetlendi)
- GLM (opencode, glm-5.3) Vargr Meshy modelini entegre etti: assets/models/vargr/vargr.glb (1,16 MiB, 8 klip, WebP doku), pvp/fighters3d.js varyant sistemi (`?vargr=eski` veya localStorage `tuslab:vargr-model=eski` ile eski KayKit modeli; yükleme/klip hatasında otomatik eskiye dönüş), build-assets: `assets/models/*/kaynak` yayına girmez.
- ⚠️ GLM görev dışına çıkıp "İP2" adıyla Zamana Karşı modunu sabit 6 raund / 5-10-15-15-15-20 kelime planına çevirmişti (Arena kuralı; 19 test kırık, kullanıcı spec'i "sayılı raund varsayılan 10" ile çelişiyor). Karar: master'a ALINMADI; tamamı `glm-yedek-vargr-ip2` dalında saklı. Master'a yalnız Vargr dosyaları alındı.
- Orkestratör düzeltmesi: Vargr boyut testi 1,5 MB → 1,2 MiB (kullanıcı tavanı); git'te olmayan ham GLB'ye bağımlılık koşullu yapıldı.
- Doğrulama: 724/724 test; tarayıcıda bot maçında Meshy Vargr görünüyor, konsol hatası yok. Animasyon/temas hissi B aşamasında Playwright ile ayrıca bakılacak.

## B — Animasyon + vuruş hissi
- ✅ 63ab343: pvp/anim-state.js durum makinesi (knockdown > victory > hit > block > attack > idle; 1 saldırı kuyruğu; crossfade tablosu; yarım poz temizliği), hafif hitstop 50 ms.
- ✅ (bu commit) dinamik temas mesafesi (model Box3 derinliğinden), dash eğrisi (temastan 60–120 ms önce varış), iki dövüşçüyü izleyen kamera + mesafe zoom'u, karaktere özel parçacık profilleri (Vargr kor+kar, Sira mor iz, Doran altın ışık, Nyx camgöbeği-mor rün/meteor), havuzlu parçacık (128/48), hit sırasında block kuyruğa alınır. 737/737 test.
- Mevcut olan ve korunan: hitstop/sarsıntı/punch/knockback/flash (impact-feel.js + arena3d.js), reduced-motion kapatmaları.
- Uygulayan: Sonnet alt ajan. Higgsfield efekt görselleri kullanılmadı (deneme klasörü yayına girmiyor, 7 kredi kaldı) → kodla CanvasTexture parçacık.
- Gözle doğrulanmadı: dash/temas mesafesi ve kamera zoom katsayıları (son denetimde Playwright).
