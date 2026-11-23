# 2 — Raund sonu vuruşları tur arası / yeni raundla karışıyordu (DEVIR-PVP madde 1)

Tarih: 23 Kas 2026 · Kapsam: `pvp/` + `tests/` (sunucu, `pvp/shared/` ve denge değişmedi)

## Kök neden
Bot maçında (`resolveAtEnd`) akış şöyle: `round` → `resolve` (ROUND_RESOLVE) → vuruşlar motor planına göre çözülür → `closeRound` → `intermission` (ROUND_END) → 9 sn → ROUND_START.
Motor vuruşu sahne başında çözer, görsel kuyruk (`pvp/visual-timeline.js`, arena3d içinde) onu kendi temposunda oynatır: ara (`breathMs` 1,3 sn), iki dövüşçünün yerine oturmasını bekleme, hitstop. Bu yüzden görsel kuyruk sunucudan 1–4 sn geride kalabiliyor. Taşmayı üç zamanlayıcı sonraki aşamaya bırakıyordu:
1. `pvp/index.js` ROUND_END → `visualQueue.drain(12000)`: kalan sahnelere 12 sn animasyonlu süre veriyordu. Yorumda da yazıyordu: "gerekirse raund arası kartının arkasında sürer".
2. `pvp/rounds-ui.js` `openIntermission`: `holdTransition` (`whenIdle(4500)`) en çok `ROUND_HOLD_MAX_MS` (3 sn) bekleniyor, sonra panel kuyruk boşalmamış olsa da açılıyordu. Senin 34,6 sn'de gördüğün -200 buydu.
3. ROUND_START → `arena3d.clear()` → `timeline.flush()`: kalan girdiler zorla bitiriliyor, ama `finishEntry(forced)` → `silentDamage` → `playImpactFeedback` → `fx24.damage.handle` yolu her vuruş için yeni bir uçan `pxd-num` sayısı üretiyordu. Bu sayılar "RAUND 2 / 7" görünürken uçuyordu (kullanıcının şikâyeti).

## Değişiklikler
- `pvp/index.js:245-256` `settleRoundVisuals()`: kuyruk meşgulse `arena3d.clear()` çağrılır (kalan vuruşlar animasyonsuz uygulanır, pozlar idle'a döner). Ardından uçan hasar sayıları silinir (`fx24.damage.clear()`) ve gösterilen can bekletmesi bırakılır (`shownHp.model.release()` + `sync()`), böylece bar sunucu değerine oturur. Sunucu durumu (can, skor) hiç değişmez. Sekme arka plana geçince doğan sessiz sayılar da silinir (`:255`).
- `pvp/index.js:261, 271`: rounds-ui ve arena-ui'ye `settleVisuals` verilir; `whenIdle(4500)` yerine `whenIdle(ROUND_HOLD_MAX_MS)` kullanılır.
- `pvp/index.js:1064-1070`: ROUND_END artık `drain(12000)` değil, `drain(ROUND_HOLD_MAX_MS)` yapıyor. Bekleyen sahneler koltuk başına tek sahneye katlanır, aralar kısalır. ROUND_START'taki `arena3d.clear()` yerinde kaldı (kalkan balonu ve pozlar sıfırlanıyor).
- `pvp/index.js:948`: ARENA_ROUND_START'ta önce `settleRoundVisuals()`, sonra `clear()`.
- `pvp/rounds-ui.js:164-170`: saf `roundResultTitle()` ve `isResultPhase()` eklendi; `roundsViewModel(..., {resultHold})`.
- `pvp/rounds-ui.js:211-214, 229`: settling/resolve fazlarında ve tur arasının vuruş bekleme kısmında başlık "RAUND N SONUCU" (ani ölümde "ANİ ÖLÜM SONUCU"); sayaç metni, birimi, halkası ve yan saatler boş, `vm.result=true`.
- `pvp/rounds-ui.js:509-511, 634`: tur arası kapısı açılmadan hemen ÖNCE `settle('intermission')` çağrılır. Bu, kuyruk erken boşaldığında da, 3 sn tavanında da olur. "RAUND N+1" bandı, özet ve beceri paneli ancak bundan sonra görünür.
- `pvp/rounds-ui.js:650-656, 666, 731-733`: tick/render kapının durumunu görünüm modeline geçirir; madalyonda `is-result` sınıfı. `:775`: ROUND_START'ta da `settle('round-start')`.
- `pvp/rounds-ui.css:91-92`: `.rui-medal.is-result .rui-clock{visibility:hidden}`. Daire yer tutar, üst şerit kaymaz.
- `pvp/arena-ui.js:318, 641-653`: arena özet kapısı açılırken aynı `settleVisuals('summary')` çağrılır.
- `pvp/cinematic.js:30-36, 191-209`: yeni `roundResolveText()` eklendi; bant ROUND_RESOLVE'da (yazma bitince, çözümün başında) oynar.

## Sayaç ve "SÜRE!" bandı
- **Sayaç:** `.rui-secs` resolve fazında `round.resolveEndsAt - şimdi` değerini sayıyordu (`phaseDeadline`). Bu değer, motorun çözüm planının bitişidir: `scheduleAlternating` → `resolveUntil` = giriş 0,5 sn + sahneler + 0,6 sn kuyruk, en çok 20 sn. Settling'de `settleUntil` sayılıyordu. Yani "kart açılana kadar kalan süre"ydi, oyuncu için bir anlamı yoktu. Artık gösterilmiyor (değer modelde `timer.remaining` olarak duruyor, takılma algısı `phaseOverdueMs` aynı).
- **"SÜRE!" bandı:** `cinematic.js` bandı ROUND_END'de çalıyordu. Bot maçında ROUND_END çözümün SONUNDA gelir, bant bu yüzden vuruşlardan sonra çıkıyordu. Bant gerekli, çünkü yazmanın bittiğini söyleyen tek açık işaret o. Bu yüzden kaldırmadım, ROUND_RESOLVE'a (yazma süresi bitince) taşıdım. Zamana karşıda "SÜRE! · Vuruşlar sırayla geliyor" (vuruş yoksa "Vuruş yok") yazar, kelime raundunda "RAUND N BİTTİ". Yazma paneli aşağı inişi (`cin-round-end`) de oraya taşındı. ROUND_END'de bant yalnız K.O.'da çıkıyor, bir de o raund için ROUND_RESOLVE görülmediyse. İkincisi çevrimiçi odanın durumu: orada vuruşlar yazarken çözülür, ROUND_RESOLVE yoktur. ROUND_END yazma bitişinden en çok 1 sn sonra gelir, o yüzden eski davranış kaldı.

## Şöyle yorumladım
- Ölçüt 2'deki "tur arası paketi" anını, tur arası panelinin açıldığı an olarak ele aldım. ROUND_END geldiğinde son vuruşlar en çok `ROUND_HOLD_MAX_MS` (3 sn) daha animasyonlu oynayabilir. Bu sürede panel, "RAUND N+1" ve geri sayım görünmez, başlık "RAUND N SONUCU" der. Tavan dolunca kalanlar animasyonsuz biter, panel ondan sonra açılır. ROUND_END'de hemen kesmek, gecikmeli son vuruşları hiç göstermemek olurdu.
- Arena modunun madalyonu çözümde zaten geri saymıyordu (⚔), başlığı değiştirmedim. Yalnız özet kapısına aynı temizliği ekledim.

## Testler
- Yeni dosya `tests/pvp-raund-sonu-vuruslari.test.mjs` (11 test). Kapsadıkları:
  - saf başlık ve faz kuralı;
  - resolve/settling'de "RAUND 2 SONUCU" ile sayaç ve yan saatlerin boş olması (counted ve ani ölüm dahil);
  - tur arasında bekleme sırasında sonuç başlığı, kapı açılınca "TUR ARASI";
  - DOM'da tavan anında `settleVisuals` çağrısının paneli, bandı ve özeti açmadan ÖNCE ve yalnız bir kez gelmesi;
  - kuyruk erken boşalınca da temizliğin yapılması, ROUND_START'ta da `settle`;
  - `visual-timeline` `drain` + `flush` ile sahnelerin zorla bitmesi ve `whenIdle`'ın çözülmesi;
  - sinematikte SÜRE!'nin ROUND_RESOLVE'da çıkması, ROUND_END'de tekrar çıkmaması, K.O.'nun ve çevrimiçi akışın korunması;
  - arena özetinde `settle`'ın özetten önce gelmesi;
  - index.js bağlantıları (12 sn boşaltmanın kalkması) ve CSS kuralı.
- Güncellenen: `tests/pvp-mechanics-f.test.mjs` F2 ve F4. Eski beklentiler "ÇÖZÜLÜYOR" ve resolve/settling geri sayımıydı, yeni davranışa çevrildi.
- Sonuç (1. tur): tests 1051 / pass 1051. Güncel sayı aşağıda (2. tur). `npm run cf:validate` → "Ön dağıtım kontrolü başarılı: 79/79".

## Denemediklerim
- Tarayıcıda hiç bakmadım: ekran görüntüsü yok, gerçek bot maçı oynamadım. Kontrol etmediğim noktalar:
  - "RAUND N SONUCU" yazısı 58 px dairenin üstüne sığıyor mu;
  - boş dairenin görünüşü;
  - `arena3d.clear()` panel açılırken bir an poz sıçraması ya da kamera oturması yapıyor mu.
- Çevrimiçi oda (8787) ve arena modu gerçek maçta denenmedi, yalnız birim testleri var.
- K.O. bandı hâlâ ROUND_END anında çıkıyor. Kuyruk gerideyse K.O. yazısı, K.O. vuruşunun görselinden önce gelebilir (bu işte değiştirmedim).
- `DEVIR-PVP.md` madde 1'i silmedim, `İLERLEME.md`'ye yazmadım. Tarayıcı doğrulamasından sonra orkestratör yapacak.

## 2. tur — panel açıldıktan ~1,4 sn sonra doğan eski sayı (koordinatörün tarayıcı bulgusu)
Bulgu: 1. raundda panel t=47105'te açıldı (`isBusy()===false`). t=48516–49600 arasında, başlık "TUR ARASI" iken bir `.pxd-num` göründü.

Kök neden: 1. turdaki `settleRoundVisuals` yalnız `visualQueue.isBusy()` iken `arena3d.clear()` çağırıyordu. Ama görsel kuyruk boşalsa da arena3d'de kuyruk DIŞINDA gecikmeli teslim yolları kalıyor:
- `impactFeel` bekleyen listesi: temas beklenen hasar, ya `ready()` ile ya da tavanla (9 sn, ulti 5 sn, öteki 2,4 sn) teslim edilir;
- ulti zinciri `ult`/`processUltimate`: ulti girdisi kuyruktan, fırlatma bitince çıkar; zincirin sonraki fazı temas karesinde `markContact` → `impactFeel.flush` → sayı üretir;
- ertelenmiş ulti olayları (`pendingUltEvents`), zamanlanmış tepkiler (`cues`) ve 40 ms'lik sahne tamponu (`sceneHold` setTimeout).

Bunlar `clear()` çağrılmayınca kare döngüsünde (`impactFeel.flush()`, `loop`) panel açıkken teslim ediliyor, `playImpactFeedback` → `fx24.damage.handle` yeni sayı doğuruyordu. Hangi yolun tam o sayıyı ürettiğini tarayıcıda ayırt etmedim; düzeltme hepsini kapsıyor.

Düzeltme (iki kat):
- `pvp/arena3d.js:4119-4133` yeni `settle()` eklendi (`:4720`'de dışa açık). Sırası: `timeline.flush()`, ertelenmiş ulti ve sahne tamponu hasarı sessiz teslim, `impactFeel.flush(true)`, ardından `clear()`. Kuyruk boş olsa da her raund geçişinde çağrılıyor.
- `clear()` (`:4136-4138`) nesil sayacını artırıp tamponu boşaltıyor. `holdSceneEvent` zamanlayıcısı nesil değiştiyse kendini yok sayıyor (`:4035-4037`). `sceneHold` ve `visualGen` TDZ olmasın diye `:1887-1888`'e taşındı.
- `pvp/impact-feel.js:102-104` `flush(force)`: temas beklemeden hepsini sahnesiz teslim ediyor. `:110` `pending` sayacı eklendi.
- `pvp/impact-feel.js:115-133` saf `createSettleGate()` eklendi. Settle'dan sonra maç `intermission` / `summary` / `prep` fazındayken kapı kapalı kalır, çünkü o fazlarda sunucu hasar uygulamaz ve gelen her gösterim eskidir. Maç yazma ya da çözüm fazına geçince kapı kendiliğinden açılır; maç bitince de açılır.
- `pvp/index.js:245-258`: `settleRoundVisuals` her seferinde `arena3d.settle()` çağırıyor (yoksa `clear()`), sonra `impactGate.close()`, sayı temizliği ve can bırakma geliyor.
- `pvp/index.js:785`: `playImpactFeedback`'in ilk satırı `if(!impactGate.allows(network.match))return;`. Hangi gecikmeli yoldan gelirse gelsin eski vuruş sayı, ses ya da tepki doğuramaz.

Yeni testler (aynı dosyada, toplam 14):
- `flush(true)` hepsini bir kez sahnesiz teslim eder, sonradan ikinci sayı doğmaz;
- settle kapısının faz kuralları;
- arena3d `settle`/`clear` nesil kimliği ve tanım sırası (kaynak kontrolü);
- index.js'te kapının bağlantısı.

**Gerçek sayılar:** `node --test tests/*.test.mjs` → **tests 1056 / pass 1056 / fail 0**. `npm run cf:validate` → 79/79.

Denemediklerim (2. tur):
- Tarayıcıda yeniden bakmadım.
- `settle()` artık kuyruk boşken de `clear()` yapıyor. Panel açılırken pozlar idle'a oturuyor, kamera genel plana dönüyor, kalkan balonu tur arasında siliniyor (ROUND_START'ta zaten siliniyordu). Bunların görünüşüne bakılmalı.
