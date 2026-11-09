# TuşLab PvP — Canlı Yayın Kabul Listesi

## Yerel olarak tamamlananlar

- [x] 19. iş paketinin çalışan kaynaklarından türetildi.
- [x] Tek oyunculu yazma motoru ve önceki PvP modülleri korundu.
- [x] Staging ve production Worker adları ayrıldı.
- [x] PvPRoom, PvPProfiles ve PvPGuard binding/migration tanımları kontrol edildi.
- [x] Statik yayın klasörü oluşturuldu; tüm HTML CSS/JS referansları bulundu.
- [x] `npm test`: 161/161 test başarılı.
- [x] `npm run cf:validate`: 47/47 kontrol başarılı.
- [x] HTTPS için aynı kökenden `/api/*` ve otomatik WSS yol yapısı mevcut.
- [x] Cloudflare deploy, smoke test ve rollback talimatları yazıldı.

## Hesapta tamamlanması gerekenler

- [ ] Kullanıcı hesabında Wrangler kurulumu ve `wrangler login`.
- [ ] `npm run cf:dry-run` ile Worker bundle doğrulaması.
- [ ] `npm run cf:deploy:staging` ve verilen gerçek URL kaydı.
- [ ] Staging HTTP smoke testi, 2 WebSocket/lobi/maç başlangıcı.
- [ ] İki gerçek farklı cihazla davet, Q/E/R, savunma, maç bitişi, rövanş, reconnect testi.
- [ ] Gizlilik bildirimi, kayıtların silinmesi/retention mekanizması ve KVKK gereksinimleri.
- [ ] 1366×768 / 1920×1080 gerçek tarayıcı FPS ve ses testleri.
- [ ] Canlı kota ve maliyet limitlerinin incelenmesi.
- [ ] `npm run cf:deploy:production` ve production health testi.
- [ ] Gerçek kullanıcı beta testi, servis izleme ve rollback hazır bulundurma.

**DİKKAT:** Yalnızca yerel testlerin geçmesi, ürünün canlı sunucuda eksiksiz doğrulandığı anlamına gelmez.
