// "Arena hazırlanıyor…" ipucu. Önceden index.html'de satır içi betikti; CSP (script-src 'self')
// onu her açılışta engelliyordu (konsol hatası + ipucu hiç görünmüyordu). Artık ayrı dosya.
(() => {
  const loading = document.getElementById('pvp-loading');
  if (!loading) return;
  // Güvenlik: bir dosya yüklenemezse ipucu sonsuza kadar ekranda kalmasın (normalde PvP açılınca index.js gizler).
  let guard = null;
  const start = () => {
    loading.hidden = false;
    clearTimeout(guard);
    guard = setTimeout(() => { loading.hidden = true; }, 12000);
  };
  document.addEventListener('click', event => {
    if (event.target.closest?.('.home-pvp-mode,[data-action="pvp-enter"]')) start();
  }, true);
  const q = new URLSearchParams(location.search);
  if (q.has('pvp') || q.has('pvpRoom')) start();
})();
