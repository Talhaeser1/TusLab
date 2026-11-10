// TuşLab görsel katmanı: vuruş anında boyalı efekt görselini bindirir (yalnız görsel).
// Oyun durumu okumaz/yazmaz; pvp/index.js'in yayınladığı 'tuslab:pvp-impact' olayını dinler.
(() => {
  const BASE = './assets/higgsfield/final/';
  const MAX_ACTIVE = 6;
  const active = new Set();
  const calm = root => root.classList.contains('pvp4-reduced') ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Olay ayrıntısından görsel seçimi: saf fonksiyon (testte de kullanılır).
  function pickImpact(detail) {
    const side = detail.fromSeat === 2 ? 'run' : 'ates';
    const amount = Number(detail.amount) || 0;
    if (detail.blocked) return {file: `efekt-${side}-kivilcim`, size: 0.16, ms: 300};
    if (detail.skill === 'r') return {file: `efekt-${side}-ulti`, size: 0.46, ms: 620};
    if (detail.critical || amount >= 100) return {file: `efekt-${side}-vurus`, size: 0.36, ms: 480};
    if (amount <= 0) return null;
    return {file: `efekt-${side}-vurus`, size: 0.26, ms: 400};
  }
  window.__veImpactPick = pickImpact;

  // Efekt görsellerini önceden indir ki ilk vuruşta gecikmesin.
  let warmed = false;
  function warm() {
    if (warmed) return; warmed = true;
    for (const side of ['ates', 'run']) for (const kind of ['vurus', 'kivilcim', 'ulti']) {
      const img = new Image(); img.decoding = 'async'; img.src = `${BASE}efekt-${side}-${kind}.webp`;
    }
  }
  document.addEventListener('tuslab:pvp-enter', warm);

  document.addEventListener('tuslab:pvp-impact', event => {
    const root = document.getElementById('pvp-root');
    const stage = root && root.querySelector('.pvp2-stage');
    const detail = event.detail || {};
    const spec = stage && pickImpact(detail);
    if (!spec || document.hidden) return;
    warm();
    const rect = stage.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    if (active.size >= MAX_ACTIVE) { const oldest = active.values().next().value; oldest.remove(); active.delete(oldest); }
    const size = Math.round(Math.max(72, Math.min(rect.width, rect.height * 1.6) * spec.size));
    const node = document.createElement('div');
    node.className = calm(root) ? 've-impact ve-calm' : 've-impact';
    node.setAttribute('aria-hidden', 'true');
    node.style.width = node.style.height = `${size}px`;
    node.style.left = `${Math.round(rect.left + rect.width * (detail.toSeat === 1 ? 0.34 : 0.66))}px`;
    node.style.top = `${Math.round(rect.top + rect.height * 0.56)}px`;
    node.style.backgroundImage = `url(${BASE}${spec.file}.webp)`;
    node.style.setProperty('--ve-impact-ms', `${spec.ms}ms`);
    node.style.setProperty('--ve-rot', `${Math.round((Math.random() - 0.5) * 50)}deg`);
    const done = () => { node.remove(); active.delete(node); };
    node.addEventListener('animationend', done, {once: true});
    setTimeout(done, spec.ms + 200);
    active.add(node); root.appendChild(node);
  });
})();
