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
