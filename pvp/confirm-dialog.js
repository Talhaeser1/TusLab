// Oyun içi onay kutusu (Denetçi, docs/14-pvp-denetim.md).
// Neden: "Teslim ol" / maçtan çıkış window.confirm kullanıyordu. Gömülü tarayıcılarda (ör. uygulama içi pencere,
// bazı WebView'lar) confirm() hiç görünmeden false döner → düğme "tepki vermiyor"du. Tam ekranda yerel kutu da
// tam ekrandan çıkarıyor ve oyun döngüsünü donduruyordu. Bu kutu #pvp-root içinde açılır (tam ekranda da görünür).

let open = null; // { dialog, finish }

/** Açık bir onay kutusu var mı? (keydown yakalayıcısı tuşları ona bırakır) */
export function confirmOpen() { return !!open; }

/**
 * @param {HTMLElement} root  #pvp-root
 * @param {{title?:string,message:string,confirmLabel?:string,cancelLabel?:string,danger?:boolean}} opts
 * @returns {Promise<boolean>}
 */
export function askConfirm(root, { title = 'Emin misin?', message = '', confirmLabel = 'Evet', cancelLabel = 'Vazgeç', danger = true } = {}) {
  const host = root || document.body;
  if (!host?.ownerDocument) return Promise.resolve(false);
  if (open) open.finish(false);
  const doc = host.ownerDocument;
  const previous = doc.activeElement;
  const dialog = doc.createElement('dialog');
  dialog.className = 'pvp-confirm' + (danger ? ' is-danger' : '');
  dialog.setAttribute('aria-labelledby', 'pvp-confirm-title');
  dialog.setAttribute('aria-describedby', 'pvp-confirm-msg');
  dialog.innerHTML = '<form method="dialog" class="pvp-confirm-card">'
    + '<h2 id="pvp-confirm-title" class="pvp-confirm-title"></h2>'
    + '<p id="pvp-confirm-msg" class="pvp-confirm-msg"></p>'
    + '<div class="pvp-confirm-actions">'
    + '<button type="button" class="pvp-confirm-no" data-confirm="no"></button>'
    + '<button type="button" class="pvp-confirm-yes" data-confirm="yes"></button>'
    + '</div></form>';
  dialog.querySelector('.pvp-confirm-title').textContent = title;
  dialog.querySelector('.pvp-confirm-msg').textContent = message;
  dialog.querySelector('.pvp-confirm-no').textContent = cancelLabel;
  dialog.querySelector('.pvp-confirm-yes').textContent = confirmLabel;
  host.appendChild(dialog);

  return new Promise(resolve => {
    let done = false;
    const finish = (value) => {
      if (done) return; done = true;
      if (open?.dialog === dialog) open = null;
      try { if (dialog.open) dialog.close(); } catch { /* yok */ }
      dialog.remove();
      try { if (previous && previous !== doc.body && previous.isConnected) previous.focus({ preventScroll: true }); } catch { /* yok */ }
      resolve(value);
    };
    open = { dialog, finish };
    dialog.addEventListener('click', e => {
      const b = e.target.closest('[data-confirm]');
      if (b) { e.preventDefault(); finish(b.dataset.confirm === 'yes'); return; }
      if (e.target === dialog) finish(false); // arka plana tık = vazgeç
    });
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(false); });
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
    // Varsayılan odak "Vazgeç": Enter/Space ile yanlışlıkla teslim olunmaz.
    dialog.querySelector('.pvp-confirm-no')?.focus({ preventScroll: true });
  });
}

/** Klavye yakalayıcısı için: açık kutuda Escape kapatır, diğer tuşlar kutuya kalır. true → olay tüketildi. */
export function confirmHandleKey(event) {
  if (!open) return false;
  if (event.key === 'Escape') { event.preventDefault(); open.finish(false); return true; }
  return true; // kutu açıkken oyun kısayolları (1-3, Q/W/E/R, Enter kilit) çalışmaz; düğmeler kendi olaylarını alır
}
