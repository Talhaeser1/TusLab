# 00 — Oku Beni

Son güncelleme: 13 Kasım 2026

## Kullanıcının kuralı
Kullanıcının kendi notları (12 Kasım 2026 gecesi) ilgili belgelerin başına aynen alıntılandı: atmosfer ve harita notu 01 ve 08'de, yetenek notu 03'te, oyun kuralı 04'te, karakter notu 12'de. Çelişki olursa kullanıcının kuralı geçerlidir.

Kullanıcının istediği (aynen): "md'ler klasörü oluşturmanı istiyorum; bu klasörde oyun atmosferi, karakter özellikleri, seçim ekranı, karakter skilleri, oyun kuralları vs. — bunlara da sen karar ver — bu sistemi böyle parçalara bölerek md'ler oluştur. Ben oradan bakacağım neler yapmışsınız; sen de mesela yeni bir karakter oluştururken oraya bakacaksın, ona göre oluşturacaksın."

## Bu klasör ne
Oyunun tasarım kayıtları. İki okuyucusu var:
- **Kullanıcı:** oyunda neyin nasıl olduğunu ve nelerin yapıldığını buradan görür.
- **Ajanlar:** yeni karakter, yetenek, arena veya ekran eklerken buradaki kurallara uyar.

## Hangi belgede ne var
| Belge | İçerik |
|---|---|
| 01-oyun-atmosferi | görsel ve duygu yönü, renk, yazı, ton |
| 02-karakterler | beş karakterin kimlik kartları |
| 03-karakter-yetenekleri | Q/E/R ve savunma; planlanan dört yetenek |
| 04-oyun-kurallari | modlar, can, raund, seri, hasar, kazanma |
| 05-secim-ekrani-lobi | lobi sahnesi, seçimler, klavye, telefon |
| 06-mac-ekrani | maç içi arayüz parçaları |
| 07-ara-ekranlar | VS, raund arası, sonuç |
| 08-arenalar | haritalar ve hava |
| 09-dovus-ve-animasyon | dövüş sırası, süreler, efektler |
| 10-ses-ve-anons | replikler, spiker, seri sesi |
| 11-yazi-icerikleri | yazılan içerik modları |
| 12-yeni-karakter-rehberi | adım adım rehber + boş şablon |
| 13-yapilanlar-ve-kalanlar | durum sayfası |

Her belgede sıra: Kullanıcının kuralı → Şu an oyunda olan → Planlanan → Yeni bir şey eklerken uyulacaklar → Kodda nerede.

## Nasıl güncellenir
- Kod değişince ilgili belge de aynı işte güncellenir.
- "Şu an oyunda olan" yalnız koddan doğrulanmış şeyi içerir; emin değilsen "doğrulanmadı" yaz.
- Planlanan bir şey koda girince "Planlanan"dan "Şu an oyunda olan"a taşınır.
- Her belgenin ilk satırındaki tarih güncellenir.

## Ajanlar için kural
- Yeni karakter, yetenek, arena veya ekran işinden ÖNCE ilgili belgeyi oku.
- İşten SONRA aynı belgeyi (ve 13'ü) güncelle.
- Kullanıcının kuralı ile bu belgeler çelişirse kullanıcının kuralı geçerlidir.
- Yazı: sade Türkçe, tablo ve madde; dosya yolu yalnız "Kodda nerede" bölümünde.

## Yeni bir şey eklerken uyulacaklar
- [ ] İlgili belgeyi okudum.
- [ ] Atmosfere (01) ve ekran kurallarına uydum.
- [ ] İş bitince belgeyi ve 13'ü güncelledim.

## Kodda nerede
- Kalıcı kurallar: `KESINYAP.md`; ilerleme günlüğü: `İLERLEME.md`
- Hasar: `docs/HASAR-KURALLARI.md`; ekran: `docs/EKRAN-KONTROL-KURALLARI.md`; işçi kuralları: `docs/codex/00-ORTAK.md`
