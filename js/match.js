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
  effectiveBlunderChance,
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

// Predicts how long the side-to-move should "think" about this position.
// Returns a chess-seconds (ms) budget. Average ~3000 ms. Drives both the
// Stockfish search budget and the chess-clock deduction.
function computeThinkTime(state) {
  const c = CONFIG.dynamicThinkTime;
  const legalMoves = chess.moves();
  const inCheck = typeof chess.inCheck === "function"
    ? chess.inCheck()
    : (typeof chess.in_check === "function" ? chess.in_check() : false);

  const prevEval = state.evals[state.evals.length - 2] ?? 0;
  const curEval  = state.evals[state.evals.length - 1] ?? 0;
  const evalSwing = Math.abs(curEval - prevEval);
  const phase = getGamePhase(state.fullMoveNumber ?? 1);
  const lastWasCapture = !!state.lastMove?.captured;

  let t = c.baseMs;
  t += Math.max(0, legalMoves.length - 20) * c.perLegalMoveMs;
  if (inCheck) t += c.inCheckBonusMs;
  if (lastWasCapture) t += c.afterCaptureBonusMs;
  t += Math.min(5, evalSwing) * c.evalSwingBonusPerPawnMs;
  t += c.phaseBonusMs?.[phase] ?? 0;

  const jitter = 1 + (Math.random() * 2 - 1) * c.jitter;
  t *= jitter;

  return Math.max(c.min, Math.min(c.max, Math.round(t)));
}

function engineMovetimeFor(thinkMs) {
  const e = CONFIG.engineMovetime;
  return Math.max(e.min, Math.min(e.max, Math.round(thinkMs * e.factor)));
}

function deductClock(state, movingColor, thinkMs) {
  if (movingColor === "w") state.whiteClockMs = Math.max(0, state.whiteClockMs - thinkMs);
  else state.blackClockMs = Math.max(0, state.blackClockMs - thinkMs);
  state.lastThinkMs = thinkMs;
}

function flagged(state) {
  return state.whiteClockMs <= 0 || state.blackClockMs <= 0;
}

// Gewichtete Auswahl aus den Kandidaten, sortiert schlechter-nach-rechts.
// severity ∈ [0,1]: 0 = leichte Ungenauigkeit (bevorzugt vordere), 1 = haerterer
// Fehlgriff (bevorzugt hintere Eintraege).
function pickWorsePv(candidates, severity) {
  if (!candidates.length) return null;
  const n = candidates.length;
  const weights = candidates.map((_, i) => {
    const rank = (i + 1) / n;
    return Math.pow(rank, 1 + severity * 3);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[n - 1];
}

// Praefix fuer Blunder-Logs (SAN + Kommentar).
function annotateBlunderSan(san, severity) {
  if (severity >= 0.7) return `${san}??`;
  if (severity >= 0.35) return `${san}?`;
  return `${san}?!`;
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
  state.whiteClockMs = CONFIG.startClockMs;
  state.blackClockMs = CONFIG.startClockMs;
  state.lastThinkMs = 0;
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
    // Dynamisches Timing: Bedenkzeit aus Stellung ableiten, Engine-Suchzeit
    // daraus abgeleitet, Wandzeit durch den Speed-Regler geteilt.
    const thinkMs = computeThinkTime(state);
    const engineMs = engineMovetimeFor(thinkMs);
    const factor = CONFIG.speedFactor?.[state.speed] ?? 1;
    const wallTotalMs = factor > 0 ? (thinkMs / factor) : 0;
    emit({ type: "thinking", side: turn, thinkMs, wallTotalMs });

    const startWall = performance.now();
    const goRes = await engine.go(chess.fen(), { movetimeMs: engineMs, multiPv: CONFIG.multiPv });
    const { bestmove, pvs = [] } = goRes;
    if (!bestmove || bestmove === "(none)") {
      finalizeByBoard(state);
      return;
    }

    // Blunder-Layer: Chance + Schaerfe aus Skill, Uhr, Bedenkzeit, aktiven Buffs.
    const moverClockMs = whiteTurn ? state.whiteClockMs : state.blackClockMs;
    const moverSide = isManagerPlayersMove ? "self" : "opponent";
    const bl = effectiveBlunderChance(state, moverSide, {
      thinkMs, clockMs: moverClockMs,
    });
    let chosenUci = bestmove;
    let chosenCp = goRes.cp ?? 0;
    let chosenMate = goRes.mate ?? null;
    let blundered = false;

    // Nur PVs in Betracht ziehen, die schlechter sind als der vom Engine-Skill
    // bereits gewaehlte bestmove. So werden Blunder nie versehentlich zu
    // Verbesserungen, wenn Stockfish wegen niedriger Skill-Stufe bereits einen
    // nicht-optimalen Zug bevorzugt hat.
    const bestRank = Math.max(0, pvs.findIndex((pv) => pv.move === bestmove));
    const worseCandidates = pvs.slice(bestRank + 1);
    if (worseCandidates.length > 0 && Math.random() < bl.chance) {
      const pick = pickWorsePv(worseCandidates, bl.severity);
      if (pick && pick.move) {
        chosenUci = pick.move;
        chosenCp = pick.cp ?? chosenCp;
        chosenMate = pick.mate ?? null;
        blundered = true;
      }
    }

    const result = chess.move({
      from: chosenUci.slice(0, 2),
      to: chosenUci.slice(2, 4),
      promotion: chosenUci.length > 4 ? chosenUci[4] : undefined,
    });
    if (!result) {
      log(state, `Ungueltiger Engine-Zug "${chosenUci}". Partie abgebrochen.`, "bad");
      finishMatch(state, { outcome: "dq", reason: "Engine-Fehler." });
      return;
    }

    // Saubere SAN in der Historie lassen, damit Eroeffnungserkennung greift.
    // Blunder werden stattdessen via log/toast/lastMove.blunder sichtbar.
    state.movesSan.push(result.san);
    state.movesUci.push(chosenUci);
    state.fen = chess.fen();
    state.lastMove = {
      from: result.from, to: result.to, san: result.san,
      color: result.color, captured: result.captured ?? null,
      blunder: blundered, blunderSeverity: blundered ? bl.severity : 0,
    };

    // Schachuhr der ziehenden Seite abziehen.
    deductClock(state, result.color, thinkMs);

    // Eval white-relative. Stockfish liefert cp aus Sicht der Seite,
    // die gerade gezogen hat.
    const prevEval = state.evals[state.evals.length - 1] ?? 0;
    let evalPawns;
    if (chosenMate != null) {
      const cpWhiteMate = (whiteTurn ? 1 : -1) * (chosenMate > 0 ? 10000 : -10000);
      evalPawns = cpWhiteMate / 100;
    } else {
      const cpWhite = whiteTurn ? chosenCp : -chosenCp;
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

    if (blundered) {
      const who = isManagerPlayersMove ? "Dein Spieler" : "Der Gegner";
      const severityLabel = bl.severity >= 0.7 ? "patzt grob!"
        : bl.severity >= 0.35 ? "macht einen Fehler."
        : "greift ungenau.";
      const annotated = annotateBlunderSan(result.san, bl.severity);
      log(state,
        `${who} ${severityLabel} (${annotated}, P=${Math.round(bl.chance * 100)}%)`,
        isManagerPlayersMove ? "bad" : "ok");
    }

    emit({
      type: "move",
      move: result,
      myTurn: isManagerPlayersMove,
      blunder: blundered,
      blunderSide: blundered ? moverSide : null,
      blunderSeverity: blundered ? bl.severity : 0,
    });
    saveState(state);

    // Zeitueberschreitung pruefen: Uhr auf 0 -> Niederlage fuer diese Seite.
    if (flagged(state)) {
      const whiteFlagged = state.whiteClockMs <= 0;
      const managerLost = whiteFlagged === state.managerIsWhite;
      finishMatch(state, {
        outcome: managerLost ? "loss" : "win",
        reason: `Zeit abgelaufen — ${whiteFlagged ? "Weiß" : "Schwarz"} faellt durch Zeit.`,
      });
      return;
    }

    if (chess.isGameOver()) {
      finalizeByBoard(state);
      return;
    }

    // Restliche Wandzeit zwischen Zuegen warten, damit sich das Match atmend
    // anfuehlt (aber nie weniger als 30 ms, um den Tick nicht zu starven).
    const engineElapsed = performance.now() - startWall;
    const remainingWall = factor > 0 ? Math.max(0, wallTotalMs - engineElapsed) : 0;
    scheduleTick(state, Math.max(30, Math.round(remainingWall)));
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
