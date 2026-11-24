// Nişancı (docs/27, DEVIR-PVP 17): çevrimiçi odada sunucu onayı beklenirken (`p.pending`, yazma kutusu kilitli) basılan
// harfler atılıyordu; hızlı yazanda sonraki kelimenin ilk harfi kayboluyordu. Bu tampon o arada basılan tuşları tutar;
// onay (ya da ret) gelip kutu açılınca sırayla yazma kutusuna verilir. Boşluk içeriyorsa yalnız ilk kelime (boşluğuyla)
// gönderilir, kalanı bir sonraki onayı bekler. Kural değişmez: her kelime yine sunucuya tek tek, aynı yoldan gider.

/** Tampona alınacak tuş türü: 'char' | 'backspace' | null (kısayollar, IME, özel tuşlar alınmaz). */
export function pendingKeyAction(event) {
  if (!event || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null;
  if (event.key === 'Backspace') return 'backspace';
  if (typeof event.key === 'string' && [...event.key].length === 1) return 'char';
  return null;
}

/** Onay gelince yazma kutusuna verilecek parça: ilk boşluğa kadar (boşluk dahil) şimdi, kalanı sonra. */
export function splitReplay(text) {
  const s = String(text ?? '');
  const m = /\s/u.exec(s);
  if (!m) return { now: s, rest: '' };
  return { now: s.slice(0, m.index + 1), rest: s.slice(m.index + 1) };
}

export function createPendingBuffer({ max = 64 } = {}) {
  let buf = '';
  return {
    /** event.key ya da 'Backspace'. Dönüş: alındıysa true. */
    push(key) {
      if (key === 'Backspace') { buf = [...buf].slice(0, -1).join(''); return true; }
      if (typeof key !== 'string' || [...key].length !== 1) return false;
      if ([...buf].length >= max) return false;
      // Baştaki boşluk anlamsız (kutu boşken boşluk kelime göndermez).
      if (!buf && /\s/u.test(key)) return true;
      buf += key;
      return true;
    },
    /** Şimdi verilecek parçayı çıkarır; kalan tamponda kalır. */
    takeChunk() {
      const { now, rest } = splitReplay(buf);
      buf = rest;
      return now;
    },
    clear() { buf = ''; },
    get value() { return buf; },
    get size() { return buf.length; },
  };
}
