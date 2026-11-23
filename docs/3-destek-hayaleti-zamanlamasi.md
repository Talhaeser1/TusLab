# 3 — Destek hayaleti raund başlamadan ortadan geçiyordu

Tarih: 23 Kas 2026 · Kapsam: `pvp/arena3d.js`, `pvp/arena3d-assist.js`, yeni test. Sunucu, `pvp/shared/` ve denge değişmedi.

## Kök neden
Bot maçında (`resolveAtEnd`) motor, çözümün olaylarını sahne başında topluca yayınlıyor. Bir sahnedeki vuruşlar 1 ms arayla geliyor, iki destek için `ASSIST_CAST` (sceneSlot 3 ve 4) da bunların arasında. `arena3d.handle()` sonunda çağrılan `forwardToPlugins(event)`, olayı eklentilere hemen iletiyordu. `arena3d-assist.js` → `start()` da yarı saydam partner kopyasını (`createFighterGhost`, opaklık %72) hemen saldıranın arkasından rakibe koşturuyordu. Sonuç: hayalet, görsel kuyrukta kendi sahnesi gelmeden, hatta vuruşlar başlamadan oynuyordu. Aynı koltuğun ikinci desteği de aynı yuvayı (`slots.get(seat)`) baştan başlattığı için birincisini eziyordu.

## Değişiklikler
- `pvp/arena3d.js:2`: `ASSIST_FX` import edildi. `arena3d-assist.js` başka modül içe aktarmıyor, döngüsel bağımlılık oluşmuyor.
- `pvp/arena3d.js:1890-1895`: `assistWaiting` (koltuk başına bekleyen ASSIST_CAST'ler, FIFO) ve `assistCues` (`{cast, damage, gen}`). `clear()`'dan önce tanımlı, TDZ sorunu yok.
- `pvp/arena3d.js:4117`: `handle()` içinde `handleCore`'dan sonra `if (deferAssistCast(event)) return;` geldi. `resolve:true` olan ASSIST_CAST eklentilere iletilmez, bekler. `handleCore` yine çalışır, yani sceneSlot 0'daki "yalnız destek" sahnesi (koltuğun q sahnesi) eskisi gibi kuyruğa girer. Hareket azaltmada ve canlı modda (resolve yok) erteleme yapılmaz.
- `pvp/arena3d.js:4101`: destek hasarı (`DAMAGE_APPLIED` `assist:true`) bir sahne vuruşuna bağlanınca (`boundEvents`) `cueAssist()` çağrılır. Koltuğun sıradaki bekleyen ASSIST_CAST'i bu hasara eşlenir. Motor destek olayı ile hasarını aynı sırayla yolladığı için FIFO eşleme doğru çalışır.
- `pvp/arena3d.js:4106`: hasar hiçbir sahneye bağlanamazsa (model yok) hayalet eski davranışla hemen oynar (`releaseAssistNow`).
- `pvp/arena3d.js:4119-4171`: `ASSIST_LEAD_MS = round(totalMs × dashEnd)` = 238 ms. `pumpAssistCues()` her karede çalışır (`:4590`, `timeline.tick` sonrası), ayrıca bağlanma anında bir kez çağrılır. İpucunun eklentiye iletildiği koşullar:
  - bağlı girdi oynuyor (`entry.started`) ve `handle.elapsed ≥ temasMs − 238`. Böylece hayaletin vuruş anı (`dashEnd`) hasarın temas karesine denk gelir;
  - ya da temas zaten olmuşsa (geç kaldıysa) hemen iletilir.

  Girdi temassız biterse (zorla bitirme ya da düşme) veya nesil (`visualGen`) değiştiyse ipucu sessizce düşer. Bağ `boundEvents` üzerinden okunduğu için `compactForDrain` hasarı başka sahneye taşısa bile hayalet de onunla birlikte taşınır.
- `pvp/arena3d.js:4210-4211`: `clear()` (dolayısıyla `settle()` de) `assistWaiting`'i ve `assistCues`'u boşaltır. Oynamakta olan hayaleti eklentinin `clear()` kancası durdurur. Tur arasında da, yeni raundda da eski hayalet doğmaz.
- `pvp/arena3d.js:3715-3721`: yeni `api.assistShown(info)` eklendi. Yalnız `?animprobe=1` açıkken `window.__tuslabAssistLog`'a `{t, fromSeat, sceneSlot, resolve}` ekler (en çok 200 satır) ve probe işareti `assistShown` koyar. Ek probe işaretleri: `assistHold`, `assistPlay` (`late` alanıyla).
- `pvp/arena3d-assist.js:195-210`: çözüm olayı (`resolve:true`) geldiğinde koltuğun hayaleti hâlâ oynuyorsa yeni hayalet öncekini ezmez. Yuvanın `waiting` listesine girer (en çok 3) ve öncekisi bitince başlar (`:222-228`). Canlı modda davranış eskisi gibi: hemen (yeniden) başlar.
- `pvp/arena3d-assist.js:136-151`: hayalet gerçekten görünür olduğu anda (model kopyası ya da düzlem) `api.assistShown?.(…)` çağrılır. `clear()` bekleme listesini de boşaltır. Hareket azaltma açıksa bekleme listesi atılır, yalnız flaş kalır. `stats()` yanıtına `waiting` sayısı eklendi.

## Şöyle yorumladım
- "Sahne başı mı, temas karesi mi?" sorusunda temas karesini seçtim. Hayalet temastan 238 ms önce çıkar, rakibe vardığı an (`dashEnd`) destek hasarının sayısı/sarsıntısı ile aynı karedir. Sahnenin ilk teması 238 ms'den kısaysa hayalet sahne başında başlar, vuruşu biraz geç kalır.
- Aynı koltuğun iki desteği genelde aynı vuruşa (katlanan son vuruş) ya da art arda vuruşlara bağlanır. İkinci hayalet birincisinin 700 ms'lik oynatımı bitince başlar. Bu yüzden ikincisinin vuruşu kendi hasar sayısından en çok ~0,7 sn sonra gelebilir. Aynı koltuk için iki hayaleti üst üste oynatmayı seçmedim: hem "ezme" sorununu geri getirir hem de ek çizim çağrısı ister.

## Testler
Yeni dosya: `tests/pvp-destek-hayaleti.test.mjs` (8 test). Gerçek `createArena3D`, sahte rig/GLB, gerçek `createArena3DAssist` ve bir gözcü eklentiyle çalışır:
1. resolve'lu ASSIST_CAST hemen iletilmez. Öbür koltuğun sahnesi sürerken de iletilmez. Kendi sahnesinde, ilk temastan önce (`phase: 'approach'`) iletilir. Hayaletin başlangıcı ile destek hasarının temas karesi arası 238 ± 40 ms.
2. İki destek (slot 3, 4): ilki oynarken ikincisi bekler, ilerleme sıfırlanmaz (ezme yok), sonra ikincisi de oynar.
3. Motor sırası: Q (yuva 0, 40 ms sahne tamponu, gerçek zamanlayıcı) ve iki destek (yuva 1, 2) topluca gelir. İkisi de koltuk 2 sahnesi oynarken, yuva sırasıyla iletilir. Destek hasarları sahneli gösterilir.
4. `settle()` ve `clear()` bekleyen hayaleti iptal eder (8 sn sonra bile iletilmez). Oynayan hayalet ile eklentide bekleyen de durur.
5. Canlı mod (resolve yok): hayalet hemen başlar.
6. Hareket azaltma: çözüm olayı da hemen işlenir, yalnız flaş gösterilir, siluet olmaz.
7. `?animprobe=1`: `__tuslabAssistLog` yalnız görünür olunca satır alır (`{fromSeat:1, sceneSlot:3, resolve:true}`). Bayrak yoksa dizi tanımlı değildir.
8. Kaynak kontrolü: erteleme `forwardToPlugins`'ten önce geliyor, `clear()` iki listeyi boşaltıyor, TDZ yok.

**Gerçek sayılar:** `node --test tests/*.test.mjs` → **tests 1062 / pass 1045 / fail 17**.
- 17 hatanın hepsi kadro ve karakter testleri: "5 karakter", lobi kartları, ses dosyaları, klip tabloları, bot havuzu. Nedeni aynı checkout'taki öteki oturumun `pvp/shared/fighters.js` değişikliği (`import {buildPadisahlar} from './padisahlar.js'`, 18:43). Bu dosyalara dokunmadım, düzeltmedim.
- Benim dokunduğum testler hepsi geçiyor: `pvp-destek-hayaleti` 8/8, `pvp-assist31`, `pvp-raund-sonu-vuruslari`, `pvp-dovus-duzeltme3` (toplam 42/42).
- `npm run cf:validate` → "Ön dağıtım kontrolü başarılı: 79/79".

## Denemediklerim
- Tarayıcıda hiç bakmadım, ekran görüntüsü yok, gerçek bot maçı oynamadım.
- Gerçek GLB'lerle hayaletin temasla gözle çakışıp çakışmadığını görmedim. Testte rig sahte, temas zamanları sentetik.
- Çevrimiçi oda (8787) denenmedi. Orada olaylar `resolve` taşımaz, kod yolu eskisiyle aynı.
- K.O. anında (`onMatchEnd` → `clear(false)`, eklentiye haber verilmez) bekleyen ipuçları siliniyor. O an oynamakta olan bir hayalet ise eski yaşam döngüsüyle sonuna kadar oynar.

## Tarayıcıda nasıl doğrulanır
1. `http://127.0.0.1:5177/index.html?animprobe=1` → bot maçı, Zamana karşı (rounds). Destek açık olsun, bot desteği kullansın.
2. Konsolda (raund çözümünden önce):
   ```js
   const L=[];addEventListener('tuslab:pvp-combat',e=>{const d=e.detail;if(d?.type==='ASSIST_CAST'||(d?.type==='DAMAGE_APPLIED'&&d.assist))L.push({t:Math.round(performance.now()),type:d.type,slot:d.sceneSlot,q:__tuslabVisualQueue.snapshot().activeSeat});});
   ```
3. Raund bitince `L` ile `__tuslabAssistLog` karşılaştırılır:
   - ASSIST_CAST'lerin `t`'si "RAUND N SONUCU" başı olmalı;
   - `__tuslabAssistLog` satırlarının `t`'si daha geç olmalı, her satırın kendi sceneSlot'u olmalı;
   - aynı koltuğun iki satırı arasında ≥ 700 ms olmalı.
4. `__tuslabAnimProbe.start()` ile probe açılırsa `events` içinde `assistHold` → `assistPlay` → `assistShown` sırası ve `contact` işaretleri görülür. `assistPlay` ile ilgili `contact` arası ~240 ms olmalı, `late:true` olmamalı.
5. Gözle bakılacaklar: çözüm başında ortadan geçen yarı saydam kopya olmamalı. Hayalet saldıranın sahnesinde, vuruşla birlikte görünmeli. Tur arası panelinde ve yeni raundun başında hayalet görünmemeli.
