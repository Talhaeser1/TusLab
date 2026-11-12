/**
 * KESINYAP iş 6 — maç sonu konuşma planı (saf).
 * Zafer repliği YALNIZ maçı kazanan YEREL oyuncunun karakterinden gelir. Teslim / yenilgi / berabere / iptal /
 * izleyici durumunda hiçbir karakter "zafer" demez; yenilgide yalnız yenilgi jingle'ı + spiker çalar.
 */
export function endVoicePlan({winnerSeat = null, mySeat = null} = {}) {
  const winner = winnerSeat === 1 || winnerSeat === 2 ? winnerSeat : null;
  const me = mySeat === 1 || mySeat === 2 ? mySeat : null;
  const iWon = winner !== null && me !== null && winner === me;
  return {
    zaferSeat: iWon ? winner : null,
    jingle: winner === null ? null : iWon ? 'victory' : 'defeat',
    announce: winner === null ? null : iWon ? 'spiker-zafer' : 'spiker-yenilgi'
  };
}
