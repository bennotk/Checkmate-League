// Match-Orchestrator. Verwaltet:
//   - eine chess.js-Instanz fuer Regeln und Notation
//   - zwei Stockfish-Worker (weiss / schwarz), pro Zug Skill aus Champion-Stats
//   - Tick-Loop (abhaengig von state.speed)
//   - Remis-Anfrage-Logik
//
// UI-Updates laufen ueber Callbacks; match.js weiss nichts vom DOM.

import { CONFIG } from "./config.js";
import { StockfishEngine } from "./stockfish-engine.js";
import {
  log, effectiveSkills, engineSkills, decrementBuffsAfterOwnMove, saveState,
} from "./state.js";
import { getCharacterById } from "../src/game/characters.js";
import { getGamePhase } from "../src/game/match-status.js";
import { getCommentary } from "../src/game/commentary.js";
import { detectOpening } from "../src/game/openings.js";

function detectMoveType(san) {
  if (!san) return "normal";
  if (san.startsWith("O-O")) return "castle";
  if (san.endsWith("#")) return "checkmate";
  if (san.endsWith("+")) return "check";
  if (san.includes("=")) return "promotion";
  if (san.includes("x")) return "capture";
  return "normal";
}

let whiteEngine = null;
let blackEngine = null;
let chess = null;
let tickTimer = null;
let listeners = new Set();
let running = false;
let drawPending = false;

export function onMatchUpdate(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(evt) { for (const cb of listeners) cb(evt); }

export async function startMatch(state) {
  if (!window.Chess) throw new Error("chess.js nicht geladen");
  await stopMatch();

  chess = new window.Chess();
  state.fen = chess.fen();
  state.phase = "playing";
  state.result = null;
  state.movesSan = [];
  state.movesUci = [];
  state.fullMoveNumber = 1;
  state.myMovesMade = 0;
  state.lastMove = null;
  state.buffs = [];
  state.castLog = {};
  state.resources = CONFIG.startResources;
  state.heat = CONFIG.startHeat;
  state.evalPawns = 0;
  state.evals = [];
  state.openingEco = null;
  state.openingName = null;
  state.log = [];

  // Farbwahl per Muenzwurf.
  state.managerIsWhite = Math.random() < 0.5;
  state.whiteChampionId = state.managerIsWhite ? state.leftChampionId : state.rightChampionId;
  state.blackChampionId = state.managerIsWhite ? state.rightChampionId : state.leftChampionId;
  const myChamp  = getCharacterById(state.leftChampionId);
  const oppChamp = getCharacterById(state.rightChampionId);
  log(state, `Auslosung: dein Spieler spielt ${state.managerIsWhite ? "Weiß" : "Schwarz"}.`, "info");
  log(state, `${myChamp?.name ?? "Mein Spieler"} vs ${oppChamp?.name ?? "Gegner"} — Partie startet.`, "ok");

  whiteEngine = new StockfishEngine({ path: "vendor/stockfish.js", label: "white" });
  blackEngine = new StockfishEngine({ path: "vendor/stockfish.js", label: "black" });

  emit({ type: "starting" });
  await Promise.all([whiteEngine.ready, blackEngine.ready]);
  whiteEngine.newGame();
  blackEngine.newGame();
  const skills = engineSkills(state);
  whiteEngine.setSkillLevel(skills.white);
  blackEngine.setSkillLevel(skills.black);
  emit({ type: "ready" });

  running = true;
  scheduleTick(state, 300);
}

export async function stopMatch() {
  running = false;
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  if (whiteEngine) { whiteEngine.destroy(); whiteEngine = null; }
  if (blackEngine) { blackEngine.destroy(); blackEngine = null; }
  chess = null;
  drawPending = false;
}

function scheduleTick(state, delayMs) {
  if (tickTimer) clearTimeout(tickTimer);
  tickTimer = setTimeout(() => tick(state), delayMs);
}

async function tick(state) {
  if (!running) return;
  if (state.phase !== "playing") return;
  if (drawPending) { scheduleTick(state, 200); return; }

  if (state.speed === 0) { scheduleTick(state, 200); return; }

  if (state.heat >= CONFIG.heatMax) {
    finishMatch(state, { outcome: "dq", reason: "Disqualifiziert — Heat auf 100." });
    return;
  }

  if (chess.isGameOver()) {
    finalizeByBoard(state);
    return;
  }

  const turn = chess.turn(); // 'w' | 'b'
  const whiteTurn = turn === "w";
  const engine = whiteTurn ? whiteEngine : blackEngine;
  const isManagerPlayersMove = whiteTurn === state.managerIsWhite;

  // Skill pro Zug neu setzen: Champion-Stats skalieren mit der Phase,
  // Buffs aendern sich durch Casts. Beide Seiten aktualisieren.
  const skills = engineSkills(state);
  whiteEngine.setSkillLevel(skills.white);
  blackEngine.setSkillLevel(skills.black);

  try {
    const { bestmove, cp, mate } = await engine.go(chess.fen(), CONFIG.movetimeMs);
    if (!bestmove || bestmove === "(none)") {
      finalizeByBoard(state);
      return;
    }
    const result = chess.move({
      from: bestmove.slice(0, 2),
      to: bestmove.slice(2, 4),
      promotion: bestmove.length > 4 ? bestmove[4] : undefined,
    });
    if (!result) {
      log(state, `Ungueltiger Engine-Zug "${bestmove}". Partie abgebrochen.`, "bad");
      finishMatch(state, { outcome: "dq", reason: "Engine-Fehler." });
      return;
    }

    state.movesSan.push(result.san);
    state.movesUci.push(bestmove);
    state.fen = chess.fen();
    state.lastMove = { from: result.from, to: result.to, san: result.san, color: result.color, captured: result.captured ?? null };

    // Eval white-relative. Stockfish liefert cp aus Sicht der Seite,
    // die gerade gezogen hat.
    const prevEval = state.evals[state.evals.length - 1] ?? 0;
    let evalPawns;
    if (mate != null) {
      const cpWhiteMate = (whiteTurn ? 1 : -1) * (mate > 0 ? 10000 : -10000);
      evalPawns = cpWhiteMate / 100;
    } else {
      const cpWhite = whiteTurn ? cp : -cp;
      evalPawns = cpWhite / 100;
    }
    state.evals.push(evalPawns);
    state.evalPawns = evalPawns;
    const evalDelta = +(evalPawns - prevEval).toFixed(2);

    if (isManagerPlayersMove) {
      state.myMovesMade++;
      decrementBuffsAfterOwnMove(state);
    }
    if (!whiteTurn) {
      state.fullMoveNumber++;
    }

    // Eroeffnungserkennung waehrend der Buch-Phase.
    if (state.movesSan.length <= 25) {
      const op = detectOpening(state.movesSan);
      if (op && op.name !== state.openingName) {
        state.openingName = op.name;
        state.openingEco = op.eco;
        log(state, `Eröffnung: ${op.eco} — ${op.name}`, "info");
      }
    }

    const commentary = getCommentary({
      phase: getGamePhase(state.fullMoveNumber),
      evalDelta,
      moveType: detectMoveType(result.san),
      isOwnMove: isManagerPlayersMove,
      eval: evalPawns,
    });
    if (commentary) log(state, commentary, "dim");

    emit({ type: "move", move: result, myTurn: isManagerPlayersMove });
    saveState(state);

    if (chess.isGameOver()) {
      finalizeByBoard(state);
      return;
    }

    const delay = CONFIG.speedIntervalsMs[state.speed] ?? 800;
    scheduleTick(state, Math.max(30, delay));
  } catch (err) {
    console.error(err);
    log(state, "Fehler in Engine-Kommunikation.", "bad");
    scheduleTick(state, 800);
  }
}

function finalizeByBoard(state) {
  let outcome = "draw";
  let reason = "Remis nach Regel.";
  if (chess.isCheckmate()) {
    const loserIsWhite = chess.turn() === "w";
    const managerLost = loserIsWhite === state.managerIsWhite;
    outcome = managerLost ? "loss" : "win";
    reason = managerLost ? "Matt — du verlierst." : "Matt — du gewinnst!";
  } else if (chess.isStalemate()) reason = "Patt.";
  else if (chess.isThreefoldRepetition()) reason = "Dreifache Stellungswiederholung.";
  else if (chess.isInsufficientMaterial()) reason = "Unzureichendes Material.";
  else if (chess.isDraw()) reason = "Remis nach 50-Züge-Regel.";
  finishMatch(state, { outcome, reason });
}

export function finishMatch(state, result) {
  state.phase = "finished";
  state.result = result;
  running = false;
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  log(state, `Partie beendet: ${result.reason}`, result.outcome === "win" ? "ok" : (result.outcome === "loss" || result.outcome === "dq" ? "bad" : "warn"));
  saveState(state);
  emit({ type: "finished", result });
}

// Remis-Anfrage: der Gegner-Engine evaluiert die Stellung.
export async function offerDraw(state) {
  const opponentEngine = state.managerIsWhite ? blackEngine : whiteEngine;
  if (!opponentEngine || !chess) return { accepted: false, reason: "keine Partie" };
  if (state.phase !== "playing") return { accepted: false, reason: "Partie laeuft nicht" };
  if (drawPending) return { accepted: false, reason: "bereits gestellt" };

  drawPending = true;
  emit({ type: "draw-offered" });

  const { cp } = await opponentEngine.evaluate(chess.fen(), CONFIG.evalDepth);
  const turn = chess.turn();
  const cpWhite = turn === "w" ? cp : -cp;

  // Unsere Stellung aus Weiss-Sicht, dann auf Manager-Sicht mappen.
  const ourEvalPawns = (state.managerIsWhite ? 1 : -1) * cpWhite / 100;
  if (ourEvalPawns < -CONFIG.drawMaxLossToOffer) {
    drawPending = false;
    log(state, `Remis-Angebot unterbunden — du stehst klar schlechter.`, "warn");
    emit({ type: "draw-declined", auto: true });
    return { accepted: false, reason: "Stellung zu schlecht fuer Remis-Angebot" };
  }

  // Gegner-Sicht: positiv = Gegner besser. Das ist -ourEvalPawns.
  const evalPawnsOpp = -ourEvalPawns;
  const f = CONFIG.drawFormula;
  const p = Math.max(f.floor, Math.min(f.ceiling, f.base + f.slope * evalPawnsOpp));
  const roll = Math.random();
  const accepted = roll < p;
  drawPending = false;

  log(state, `Remis-Angebot (P ≈ ${(p*100)|0}%) — Gegner ${accepted ? "nimmt an" : "lehnt ab"}.`, accepted ? "ok" : "warn");
  emit({ type: accepted ? "draw-accepted" : "draw-declined", probability: p });

  if (accepted) {
    finishMatch(state, { outcome: "draw", reason: "Gegner akzeptiert Remis." });
    return { accepted: true, probability: p };
  }
  return { accepted: false, probability: p };
}

export function getBoardState() { return chess ? chess.board() : null; }
export function getChess() { return chess; }
