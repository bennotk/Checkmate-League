// Globaler Match-Zustand. Eine Instanz pro Partie; bei "Neue Partie" wird
// alles geresettet.

import { CONFIG } from "./config.js";
import { getCharacterById, getAllCharacters } from "../src/game/characters.js";
import { getGamePhase } from "../src/game/match-status.js";

export const STORAGE_KEY = "checkmate-league-match-v2";

export function createInitialState() {
  return {
    version: 2,
    phase: "pregame",
    result: null,
    speed: 1,

    // Beide Champions stehen vor dem Match fest; Farbe wird bei startMatch ausgelost.
    leftChampionId: "volkov",     // "Mein Spieler" aus Manager-Sicht
    rightChampionId: "petrov",    // Gegner

    // Wird bei startMatch gesetzt.
    managerIsWhite: true,
    whiteChampionId: null,
    blackChampionId: null,

    resources: CONFIG.startResources,
    heat: CONFIG.startHeat,

    buffs: [],
    castLog: {},

    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    movesSan: [],
    movesUci: [],
    fullMoveNumber: 1,
    myMovesMade: 0,
    lastMove: null,

    evalPawns: 0,
    evals: [],
    openingEco: null,
    openingName: null,

    log: [],

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

// --------- Save/Load ---------
export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 2) return null;
    // Backfill fields added after the v2 schema shipped; saves that predate
    // these features would otherwise crash the tick loop with undefined.
    parsed.leftChampionId ??= parsed.selectedChampionId ?? "volkov";
    parsed.rightChampionId ??= pickDifferentChampion(parsed.leftChampionId);
    parsed.managerIsWhite ??= true;
    parsed.whiteChampionId ??= null;
    parsed.blackChampionId ??= null;
    parsed.evalPawns ??= 0;
    parsed.evals ??= [];
    parsed.openingEco ??= null;
    parsed.openingName ??= null;
    return parsed;
  } catch { return null; }
}
export function deleteSave() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

function pickDifferentChampion(notId) {
  const all = getAllCharacters();
  return (all.find((c) => c.id !== notId) ?? all[0]).id;
}

// --------- Derived Skill ---------
// Champion-Stat (0..100) -> Stockfish Skill (0..20) mit linearer Abbildung.
function statToSkill(stat) {
  const s = typeof stat === "number" ? stat : 50;
  return Math.max(CONFIG.skillMin, Math.min(CONFIG.skillMax, Math.round(s / 5)));
}

// Basis-Skill eines Champions fuer die aktuelle Spielphase.
function championBaseSkill(champ, phase) {
  if (!champ) return Math.round((CONFIG.startSkillPlayer ?? 8));
  const key = phase === "middlegame" ? "middlegame"
           : phase === "endgame"   ? "endgame"
           :                          "opening";
  return statToSkill(champ.stats?.[key]);
}

// Manager-orientierte Sicht: self = unser Champion, opponent = Gegner-Champion.
// Buffs wirken auf self/opponent. Phase wird aus fullMoveNumber abgeleitet.
export function effectiveSkills(state) {
  const phase = getGamePhase(state.fullMoveNumber ?? 1);
  const self = getCharacterById(state.leftChampionId);
  const opp  = getCharacterById(state.rightChampionId);
  let selfSkill = championBaseSkill(self, phase);
  let oppSkill  = championBaseSkill(opp,  phase);
  for (const b of state.buffs) {
    selfSkill += b.selfSkillDelta || 0;
    oppSkill  += b.opponentSkillDelta || 0;
  }
  const clamp = (v) => Math.max(CONFIG.skillMin, Math.min(CONFIG.skillMax, v));
  return { self: clamp(selfSkill), opponent: clamp(oppSkill), phase };
}

// Engine-orientierte Sicht: Stockfish-Instanz pro Farbe. Mappt die
// Manager-Skills ({self, opponent}) auf {white, black} anhand managerIsWhite.
export function engineSkills(state) {
  const s = effectiveSkills(state);
  const managerIsWhite = state.managerIsWhite !== false;
  return managerIsWhite
    ? { white: s.self,    black: s.opponent, phase: s.phase }
    : { white: s.opponent, black: s.self,    phase: s.phase };
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
