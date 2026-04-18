// Match-Orchestrator. Verwaltet:
//   - eine chess.js-Instanz fuer Regeln und Notation
//   - zwei Stockfish-Worker (mein Spieler / Gegner)
//   - den Tick-Loop (abhaengig von state.speed)
//   - Skill-Updates vor jedem eigenen Zug (basierend auf aktiven Buffs)
//   - Remis-Anfrage-Logik
//
// UI-Updates laufen ueber Callbacks; match.js weiss nichts vom DOM.

import { CONFIG } from "./config.js";
import { StockfishEngine } from "./stockfish-engine.js";
import {
  log, effectiveSkills, decrementBuffsAfterOwnMove, saveState,
} from "./state.js";

let player = null;   // StockfishEngine Weiss
let opponent = null; // StockfishEngine Schwarz
let chess = null;    // chess.js instance
let tickTimer = null;
let listeners = new Set();
let running = false;
let drawPending = false;  // true, waehrend wir auf Entscheidung warten

export function onMatchUpdate(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(evt) { for (const cb of listeners) cb(evt); }

export async function startMatch(state) {
  if (!window.Chess) throw new Error("chess.js nicht geladen");
  await stopMatch(); // cleanup falls noch was laeuft

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
  state.log = [];
  log(state, "Partie startet. Viel Erfolg, Herr Manager.", "ok");

  player = new StockfishEngine({ path: "vendor/stockfish.js", label: "player" });
  opponent = new StockfishEngine({ path: "vendor/stockfish.js", label: "opponent" });

  emit({ type: "starting" });
  await Promise.all([player.ready, opponent.ready]);
  player.newGame();
  opponent.newGame();
  player.setSkillLevel(effectiveSkills(state).self);
  opponent.setSkillLevel(effectiveSkills(state).opponent);
  emit({ type: "ready" });

  running = true;
  scheduleTick(state, 300);
}

export async function stopMatch() {
  running = false;
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  if (player) { player.destroy(); player = null; }
  if (opponent) { opponent.destroy(); opponent = null; }
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

  // Pause?
  if (state.speed === 0) { scheduleTick(state, 200); return; }

  // Heat 100 -> Disqualifikation (sollte vorher schon ausgeloest werden beim Cast,
  // aber als Safety-Net hier auch.)
  if (state.heat >= CONFIG.heatMax) {
    finishMatch(state, { outcome: "dq", reason: "Disqualifiziert — Heat auf 100." });
    return;
  }

  // Game-Over check
  if (chess.isGameOver()) {
    finalizeByBoard(state);
    return;
  }

  const turn = chess.turn(); // 'w' | 'b'
  const myTurn = turn === "w";
  const engine = myTurn ? player : opponent;

  // Skill vor jedem Zug setzen (Buffs koennten sich geaendert haben)
  const skills = effectiveSkills(state);
  if (myTurn) engine.setSkillLevel(skills.self);
  else engine.setSkillLevel(skills.opponent);

  try {
    const bestmove = await engine.go(chess.fen(), CONFIG.movetimeMs);
    if (!bestmove || bestmove === "(none)") {
      // keine Antwort: sollte nur bei GameOver passieren
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
    state.lastMove = { from: result.from, to: result.to, san: result.san, color: result.color };

    if (myTurn) {
      state.myMovesMade++;
      // Buffs laufen nach meinem Zug einen Tick runter
      decrementBuffsAfterOwnMove(state);
    } else {
      state.fullMoveNumber++;
    }

    emit({ type: "move", move: result, myTurn });
    saveState(state);

    if (chess.isGameOver()) {
      finalizeByBoard(state);
      return;
    }

    // Naechster Tick - respektiert Geschwindigkeit
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
    outcome = loserIsWhite ? "loss" : "win";
    reason = loserIsWhite ? "Matt — du verlierst." : "Matt — du gewinnst!";
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
  // Engines laufen wir aus, behalten sie aber fuer Rematch.
  emit({ type: "finished", result });
}

// Remis anbieten: Gegner evaluiert aktuelle Stellung, wir rechnen Acceptance.
// Nicht-blockierend aus Sicht des Spielers (UI zeigt "Warte..." Modal).
export async function offerDraw(state) {
  if (!opponent || !chess) return { accepted: false, reason: "keine Partie" };
  if (state.phase !== "playing") return { accepted: false, reason: "Partie laeuft nicht" };
  if (drawPending) return { accepted: false, reason: "bereits gestellt" };

  drawPending = true;
  emit({ type: "draw-offered" });

  // Evaluation aus Gegner-Sicht ist vorzeichenumgekehrt zum Schwarz-am-Zug-Score.
  // Unabhaengig davon: wir evaluieren und rechnen Remis-Akzeptanz.
  const { cp } = await opponent.evaluate(chess.fen(), CONFIG.evalDepth);
  // Stockfish gibt cp immer aus Sicht der Seite, die am Zug ist.
  const turn = chess.turn();
  // cp aus Weiss-Sicht
  const cpWhite = turn === "w" ? cp : -cp;
  // aus Gegner-Sicht (Schwarz): positives heisst Gegner besser
  const evalPawnsOpp = -cpWhite / 100;

  // Regel: wenn unsere Stellung zu schlecht ist, duerfen wir gar nicht erst anbieten.
  const ourEvalPawns = cpWhite / 100;
  if (ourEvalPawns < -CONFIG.drawMaxLossToOffer) {
    drawPending = false;
    log(state, `Remis-Angebot unterbunden — du stehst klar schlechter.`, "warn");
    emit({ type: "draw-declined", auto: true });
    return { accepted: false, reason: "Stellung zu schlecht fuer Remis-Angebot" };
  }

  // Formel
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

// Zugriff fuer UI, rein lesend.
export function getBoardState() { return chess ? chess.board() : null; }
export function getChess() { return chess; }
