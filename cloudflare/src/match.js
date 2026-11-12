/** TuşLab PvP — authoritative match engine entry point for the Worker.
 *
 * The engine itself now lives in `pvp/shared/match.js` so that the exact same
 * rules run in two places:
 *   1. here, inside the Cloudflare Durable Object (room.js imports this file), and
 *   2. in the browser, for the offline "Bota Karşı Antrenman" practice mode
 *      (pvp/practice.js imports the shared file directly).
 *
 * Wrangler/esbuild bundles the relative import below into the Worker, and
 * `cloudflare/build-assets.mjs` copies `pvp/shared/` into the static assets so
 * the browser can load it too. Do NOT add logic here — edit the shared file.
 *
 * Every named export that existed before the move is re-exported explicitly
 * (tests/pvp-practice.test.mjs checks this list stays complete).
 */
export {
  // Rune / talent configuration (phase 22)
  RUNES, RUNE_IDS, TALENT_RULES, validateRune, computeSkillBonus,
  // Core balance constants
  MATCH_DURATION_MS, MATCH_HP, SHIELD_WINDOW_MS, SHIELD_PROBABILITY, SHIELD_DURATION_MS,
  DEFENSE_RULES, COOLDOWNS, DAMAGE, ULTIMATE_PHASES, CYCLE_DAMAGE, MATCH_WORDS,
  // Match life-cycle (pure state transitions)
  createMatch, publicMatch, submitWord, resolveDueAttacks, finishMatch, matchResult,
  surrenderMatch, pauseMatch, resumeMatch, endDisconnectedMatch,
  // Round mode (docs/TUR-SISTEMI.md)
  ROUND_OPTIONS, ROUND_WORDS, ROUND_DURATION_MS, ROUND_WORD_BUDGET_MS, roundDurationMs, ROUND_LAST_CALL_MS, ROUND_SETTLE_MS, ROUND_SUMMARY_MS,
  ROUND_INTRO_MS, ROUND_HP, ROUND_DAMAGE_CAP, ROUND_TOTAL, ROUND_WORD_PLAN, roundWordsFor, streakSkill, SUDDEN_DEATH_MAX, STREAK_SKILLS, MULTIPLIER_START, MULTIPLIER_STEP, MULTIPLIER_CAP,
  ROUND_SCORE, ULTIMATE_RETURN_MS, normalizeRounds, streakMultiplier, roundScore, roundStartPayload,
  advanceMatch, nextDeadline,
  // Protocol guard: message types only the server may emit
  SERVER_ONLY_EVENTS
} from '../../pvp/shared/match.js';

export {
  createArenaMatch, submitArenaPick, submitArenaWord, advanceArenaMatch,
  nextArenaDeadline, arenaPublicMatch, arenaMatchResult, surrenderArenaMatch,
  ARENA_SERVER_ONLY_EVENTS
} from '../../pvp/shared/arena.js';

