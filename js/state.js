// Globaler Match-Zustand. Kein Liga/Transfer-Kram mehr.
// Eine Instanz fuer eine laufende Partie; bei "Neue Partie" wird alles geresettet.

import { CONFIG } from "./config.js";

export const STORAGE_KEY = "checkmate-league-match-v2";

export function createInitialState() {
  return {
    version: 2,
    phase: "pregame",       // "pregame" | "playing" | "finished"
    result: null,           // { outcome: "win"|"loss"|"draw"|"dq", reason: string } bei phase "finished"
    speed: 1,               // 0 | 1 | 4 | 16

    // Ressourcen / Heat
    resources: CONFIG.startResources,
    heat: CONFIG.startHeat,

    // Buffs auf beiden Seiten. Jeder Eintrag:
    // { id, source, selfSkillDelta, opponentSkillDelta, remaining (eigene Zuege), label }
    buffs: [],

    // Cast-Historie fuer "oncePerGame"-Checks
    castLog: {},            // { [interventionId]: count }

    // Schachzustand
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    movesSan: [],           // full SAN list
    movesUci: [],           // full UCI list (fuer "position fen ... moves ..." waere moeglich)
    fullMoveNumber: 1,      // 1-basiert
    myMovesMade: 0,         // wie viele Zuege mein Spieler schon gemacht hat
    lastMove: null,         // { from, to, san, color }

    // Log-Eintraege fuer UI ("Narration")
    log: [],

    // RNG-Seed fuer deterministische "Entdeckung"-Rolls (optional, rein zufaellig ok)
    _seed: Math.floor(Math.random() * 1e9),
  };
}

// --------- Logging ---------
export function log(state, text, kind = "info") {
  state.log.unshift({
    id: Date.now() + Math.random(),
    move: state.myMovesMade,
    text, kind,
  });
  if (state.log.length > 60) state.log.pop();
}

// --------- Save/Load (optional) ---------
export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 2) return null;
    return parsed;
  } catch { return null; }
}
export function deleteSave() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

// --------- Derived Skill ---------
// Effektiver Skill beider Seiten nach Buffs. Clamped auf [0, 20].
export function effectiveSkills(state) {
  let self = CONFIG.startSkillPlayer;
  let opp = CONFIG.startSkillOpponent;
  for (const b of state.buffs) {
    self += b.selfSkillDelta || 0;
    opp += b.opponentSkillDelta || 0;
  }
  const clamp = (v) => Math.max(CONFIG.skillMin, Math.min(CONFIG.skillMax, v));
  return { self: clamp(self), opponent: clamp(opp) };
}

// Nur aktive Buffs verbleiben; tickt Dauer nach einem eigenen Zug.
export function decrementBuffsAfterOwnMove(state) {
  const kept = [];
  for (const b of state.buffs) {
    const rem = (b.remaining ?? 0) - 1;
    if (rem > 0) kept.push({ ...b, remaining: rem });
    else log(state, `${b.label} läuft aus.`, "dim");
  }
  state.buffs = kept;
}
