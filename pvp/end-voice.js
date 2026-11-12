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

/**
 * İş 1, 3. tur — maç sonu konuşma SIRASI (saf): önce bekleyen düşük öncelikli replikler atılır, sonra
 * kazananın zafer repliği (varsa, öncelik 4), ardından bitiş spikeri (öncelik 3). Spiker bayatlık (2,5 sn)
 * kuralından muaftır: zafer repliği uzun sürse de düşmez.
 */
export function endVoiceSteps(plan = {}) {
  const steps = [{kind: 'drop'}];
  if (plan.zaferSeat) steps.push({kind: 'speak', seat: plan.zaferSeat, key: 'zafer', opts: {priority: 4, ttlMs: 2500}});
  if (plan.announce) steps.push({kind: 'announce', name: plan.announce, opts: {priority: 3, ttlMs: 12000, noStale: true}});
  return steps;
}
