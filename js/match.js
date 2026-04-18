// Match-Modul: simuliert ein Match zwischen zwei Teams.
// Fuer das Spieler-Match wird echte Schach-Engine live gerendert (ui/match.js).
// Andere Matches der Spieltage werden per Elo-Modell schnell aufgeloest.

import { pickMove, eloExpected } from "./engine.js";
import { BOARDS_PER_TEAM } from "./data.js";
import { getPlayer, log } from "./state.js";
import { makeRng } from "./data.js";

// Tactic-Modifier
const TACTIC_MOD = {
  aggressive: { ratingAdj: +30, blunderBoost: 0.03, drawReduce: 0.05 },
  balanced:   { ratingAdj: 0,   blunderBoost: 0,    drawReduce: 0 },
  defensive:  { ratingAdj: -20, blunderBoost: -0.02, drawReduce: -0.08 },
};

// Ergibt {whiteScore, blackScore} je Brett (1, 0.5, 0)
function simulateBoard(white, black, rng, wTactic, bTactic) {
  if (!white && !black) return { w: 0.5, b: 0.5, res: "0.5-0.5" };
  if (!white) return { w: 0, b: 1, res: "0-1 (Forfait)" };
  if (!black) return { w: 1, b: 0, res: "1-0 (Forfait)" };
  const wT = TACTIC_MOD[wTactic] || TACTIC_MOD.balanced;
  const bT = TACTIC_MOD[bTactic] || TACTIC_MOD.balanced;
  const wRating = white.rating + wT.ratingAdj + (white.form - 70) * 0.8 - Math.max(0, 100 - white.stamina) * 0.5;
  const bRating = black.rating + bT.ratingAdj + (black.form - 70) * 0.8 - Math.max(0, 100 - black.stamina) * 0.5;
  const ew = eloExpected(wRating, bRating);
  // Einfluss der Differenz auf Remis-Wahrscheinlichkeit
  const diff = Math.abs(wRating - bRating);
  const baseDraw = 0.28 + Math.max(0, (2200 - Math.max(wRating, bRating)) / 5000) * -0.2;
  const drawP = Math.max(0.05, baseDraw - diff / 1400 - wT.drawReduce - bT.drawReduce);
  const r = rng();
  if (r < drawP) return { w: 0.5, b: 0.5, res: "1/2-1/2" };
  // Nicht-Remis: ew -> w Gewinn; sonst schwarz
  const remaining = 1 - drawP;
  const wShare = ew * remaining;
  if (r < drawP + wShare) return { w: 1, b: 0, res: "1-0" };
  return { w: 0, b: 1, res: "0-1" };
}

// Lieferung: result with points + boards.
export function simulateMatch(homeTeam, awayTeam, rngSeed) {
  const rng = makeRng(rngSeed);
  const boards = [];
  let homePts = 0, awayPts = 0;
  for (let i = 0; i < BOARDS_PER_TEAM; i++) {
    // Heim spielt abwechselnd weiss/schwarz (Brett 1 = weiss heim, etc.)
    const hPlayer = playerForBoard(homeTeam, i);
    const aPlayer = playerForBoard(awayTeam, i);
    const homeIsWhite = (i % 2 === 0);
    const w = homeIsWhite ? hPlayer : aPlayer;
    const b = homeIsWhite ? aPlayer : hPlayer;
    const s = simulateBoard(w, b, rng, homeIsWhite ? homeTeam.tactic : awayTeam.tactic,
                                       homeIsWhite ? awayTeam.tactic : homeTeam.tactic);
    const hScore = homeIsWhite ? s.w : s.b;
    const aScore = homeIsWhite ? s.b : s.w;
    homePts += hScore;
    awayPts += aScore;
    boards.push({
      boardNo: i + 1,
      white: w?.name ?? "—", whiteId: w?.id, whiteRating: w?.rating ?? 0,
      black: b?.name ?? "—", blackId: b?.id, blackRating: b?.rating ?? 0,
      result: s.res, wScore: s.w, bScore: s.b,
      homeIsWhite, homeScore: hScore, awayScore: aScore,
    });
  }
  return {
    homeId: homeTeam.id, awayId: awayTeam.id,
    homePts, awayPts,
    boards,
    homeMP: homePts > awayPts ? 2 : (homePts === awayPts ? 1 : 0),
    awayMP: awayPts > homePts ? 2 : (awayPts === homePts ? 1 : 0),
  };
}

export function playerForBoard(team, boardIdx) {
  const pid = team.lineup[boardIdx];
  if (!pid) return null;
  return getPlayer(team, pid);
}

// Live-Match Runner fuer das Spieler-Match. Asynchron; emittet Updates.
// Strukturiert als eine kleine Zustandsmaschine: jedes Brett hat eigene chess-Instanz.
export function createLiveMatch(homeTeam, awayTeam, opts = {}) {
  const Chess = window.Chess;
  if (!Chess) throw new Error("chess.js nicht geladen");
  const boards = [];
  for (let i = 0; i < BOARDS_PER_TEAM; i++) {
    const homeIsWhite = (i % 2 === 0);
    const hP = playerForBoard(homeTeam, i);
    const aP = playerForBoard(awayTeam, i);
    const whitePlayer = homeIsWhite ? hP : aP;
    const blackPlayer = homeIsWhite ? aP : hP;
    const whiteTeamId = homeIsWhite ? homeTeam.id : awayTeam.id;
    const chess = new Chess();
    boards.push({
      boardNo: i + 1,
      chess,
      homeIsWhite,
      white: whitePlayer, black: blackPlayer,
      whiteTactic: homeIsWhite ? homeTeam.tactic : awayTeam.tactic,
      blackTactic: homeIsWhite ? awayTeam.tactic : homeTeam.tactic,
      whiteTeamId,
      blackTeamId: homeIsWhite ? awayTeam.id : homeTeam.id,
      moves: [],
      resultText: null,
      done: false,
      wScore: 0, bScore: 0,
      lastMove: null,
      var_used_w: false, var_used_b: false, // Video Referee einmal je Seite
    });
  }
  const rng = makeRng(opts.seed ?? Math.floor(Math.random() * 1e9));

  return {
    homeTeam, awayTeam, boards, rng,
    homePts: 0, awayPts: 0,
    finished: false,
    listeners: new Set(),
    onUpdate(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); },
    _emit(type, data) { for (const cb of this.listeners) cb({ type, ...data }); },
    // Einen "Tick" ausfuehren: jedes offene Brett macht einen Halbzug.
    tick() {
      if (this.finished) return;
      for (const board of this.boards) {
        if (board.done) continue;
        tickBoard(this, board);
      }
      const openBoards = this.boards.some(b => !b.done);
      if (!openBoards) this._finalize();
      this._emit("tick");
    },
    forceFinish() {
      // Abschluss von offenen Brettern via Simulation mit Ratings-Verhaeltnis
      for (const board of this.boards) {
        if (board.done) continue;
        const r = this.rng();
        const w = board.white, b = board.black;
        // Material + Rating
        let ew;
        if (!w && !b) ew = 0.5;
        else if (!w) ew = 0;
        else if (!b) ew = 1;
        else ew = eloExpected(w.rating, b.rating);
        let wScore, bScore, res;
        if (r < 0.22) { wScore = 0.5; bScore = 0.5; res = "1/2-1/2"; }
        else if (r < 0.22 + ew * 0.78) { wScore = 1; bScore = 0; res = "1-0"; }
        else { wScore = 0; bScore = 1; res = "0-1"; }
        board.wScore = wScore; board.bScore = bScore;
        board.resultText = res;
        board.done = true;
      }
      this._finalize();
    },
    _finalize() {
      let homePts = 0, awayPts = 0;
      for (const board of this.boards) {
        const hScore = board.homeIsWhite ? board.wScore : board.bScore;
        const aScore = board.homeIsWhite ? board.bScore : board.wScore;
        homePts += hScore; awayPts += aScore;
      }
      this.homePts = homePts; this.awayPts = awayPts;
      this.finished = true;
      this._emit("finished");
    },
    // VAR: letzter Zug eines unserer Bretter wird zurueckgenommen und neu gespielt.
    useVAR(boardNo) {
      const board = this.boards.find(b => b.boardNo === boardNo);
      if (!board || board.done) return false;
      // welche Seite gehoert uns
      const mySide = this.homeTeam.isPlayer ? "home" : "away";
      const myIsWhite = (mySide === "home") ? board.homeIsWhite : !board.homeIsWhite;
      if (myIsWhite && board.var_used_w) return false;
      if (!myIsWhite && board.var_used_b) return false;
      // Letzten Zug derselben Seite zurueckrollen bedeutet: ggf. zwei Halbzuege zuruecknehmen
      // Wir nehmen den letzten unserer Halbzuege zurueck und neu spielen.
      const hist = board.chess.history({ verbose: true });
      if (hist.length === 0) return false;
      const last = hist[hist.length - 1];
      const lastWasMine = (last.color === "w") === myIsWhite;
      if (!lastWasMine) {
        // letzter war Gegner -> nimm zwei zurueck (unser Zug + Gegenantwort)
        if (hist.length < 2) return false;
        board.chess.undo();
        board.chess.undo();
        board.moves.splice(-2, 2);
      } else {
        board.chess.undo();
        board.moves.pop();
      }
      if (myIsWhite) board.var_used_w = true; else board.var_used_b = true;
      board.lastMove = null;
      this._emit("var", { boardNo });
      return true;
    },
  };
}

function tickBoard(match, board) {
  const { chess } = board;
  if (chess.isGameOver()) {
    finalizeBoard(board);
    return;
  }
  const sideToMove = chess.turn(); // 'w' | 'b'
  const player = sideToMove === "w" ? board.white : board.black;
  const tactic = sideToMove === "w" ? board.whiteTactic : board.blackTactic;
  if (!player) {
    // Forfait
    board.wScore = sideToMove === "w" ? 0 : 1;
    board.bScore = sideToMove === "w" ? 1 : 0;
    board.resultText = "Forfait";
    board.done = true;
    return;
  }
  const move = pickMove(chess, {
    rating: player.rating,
    style: player.style,
    form: player.form,
    stamina: player.stamina,
    rng: match.rng,
  });
  if (!move) {
    finalizeBoard(board);
    return;
  }
  chess.move(move);
  board.moves.push(move.san);
  board.lastMove = move;
  if (chess.isGameOver()) finalizeBoard(board);
}

function finalizeBoard(board) {
  const { chess } = board;
  if (chess.isCheckmate()) {
    const loserIsWhite = chess.turn() === "w";
    board.wScore = loserIsWhite ? 0 : 1;
    board.bScore = loserIsWhite ? 1 : 0;
    board.resultText = loserIsWhite ? "0-1 Matt" : "1-0 Matt";
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    board.wScore = 0.5; board.bScore = 0.5;
    board.resultText = "1/2-1/2";
  } else {
    // maximale Zuege sicherheitshalber
    const matDiff = materialDiffLight(chess);
    if (matDiff > 300) { board.wScore = 1; board.bScore = 0; board.resultText = "1-0 (Aufgabe)"; }
    else if (matDiff < -300) { board.wScore = 0; board.bScore = 1; board.resultText = "0-1 (Aufgabe)"; }
    else { board.wScore = 0.5; board.bScore = 0.5; board.resultText = "1/2-1/2 (Einigung)"; }
  }
  board.done = true;
}

function materialDiffLight(chess) {
  const vals = { p:1, n:3, b:3, r:5, q:9, k:0 };
  const b = chess.board();
  let s = 0;
  for (const row of b) for (const p of row) {
    if (!p) continue; s += vals[p.type] * (p.color === "w" ? 1 : -1);
  }
  return s;
}

// Wendet Match-Ergebnis auf State an: Tabelle, Spielerstats, Ermuedung, Verletzungen, Gehalt.
export function applyMatchResult(state, matchResult, homeTeam, awayTeam) {
  // Tabellen-Eintraege
  const hs = homeTeam.seasonStats, as = awayTeam.seasonStats;
  hs.played++; as.played++;
  hs.bp += matchResult.homePts; hs.bpAgainst += matchResult.awayPts;
  as.bp += matchResult.awayPts; as.bpAgainst += matchResult.homePts;
  if (matchResult.homePts > matchResult.awayPts) {
    hs.w++; as.l++; hs.pts += 3;
  } else if (matchResult.homePts < matchResult.awayPts) {
    as.w++; hs.l++; as.pts += 3;
  } else {
    hs.d++; as.d++; hs.pts++; as.pts++;
  }

  // Spielerstats + Ermuedung + Verletzung
  const teams = [homeTeam, awayTeam];
  for (const team of teams) {
    for (let i = 0; i < BOARDS_PER_TEAM; i++) {
      const pid = team.lineup[i];
      const p = pid ? getPlayer(team, pid) : null;
      if (!p) continue;
      p.games++;
      p.stamina = Math.max(30, p.stamina - (12 + Math.round(Math.random() * 10)));
      // Entwicklung: bei Einsatz leichte Rating-Dynamik abhaengig von Potential
      const drift = p.potential > p.rating ? 1 : -1;
      if (Math.random() < 0.15) p.rating = Math.max(700, Math.min(2900, p.rating + drift * (Math.random() * 6 | 0)));
      // Verletzung?
      if (Math.random() < 0.02) {
        p.injury = 1 + Math.floor(Math.random() * 3);
        log(state, `${team.name}: ${p.name} verletzt (Pausiert ${p.injury} Spiele).`, "warn");
      }
      // Board-Ergebnis
      const board = matchResult.boards[i];
      const myScore = (team.id === homeTeam.id ? board.homeScore : board.awayScore);
      if (myScore === 1) { p.wins++; p.form = Math.min(100, p.form + 4); p.morale = Math.min(100, p.morale + 3); }
      else if (myScore === 0) { p.losses++; p.form = Math.max(20, p.form - 4); p.morale = Math.max(20, p.morale - 3); }
      else { p.draws++; }
      // Taktische Fouls: nur bei aggressivem Stil kann eine Gelbe Karte entstehen
      if (team.tactic === "aggressive" && Math.random() < 0.06) {
        p.yellow = (p.yellow || 0) + 1;
        if (p.yellow >= 3) {
          p.yellow = 0; p.banned = 1;
          log(state, `${team.name}: ${p.name} nach drittem Taktik-Foul gesperrt.`, "bad");
        }
      }
    }
    // Einnahmen: Ticket-Erloese fuer Heim etc. werden in finances behandelt.
  }
}
