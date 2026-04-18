// Bewertungs-basierte Schach-Engine auf Basis von chess.js.
// Spielstaerke wird durch Tiefensuche, Evaluations-Rauschen und Patzer-Wahrscheinlichkeit
// geregelt, sodass Spieler mit unterschiedlichen Ratings unterschiedlich gut spielen.

const PIECE_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-Square-Tables (sehr vereinfacht; weiss perspektivisch, fuer schwarz gespiegelt)
const PST = {
  p: [
    0,0,0,0,0,0,0,0,
    5,10,10,-20,-20,10,10,5,
    5,-5,-10,0,0,-10,-5,5,
    0,0,0,20,20,0,0,0,
    5,5,10,25,25,10,5,5,
    10,10,20,30,30,20,10,10,
    50,50,50,50,50,50,50,50,
    0,0,0,0,0,0,0,0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,0,0,0,0,-20,-40,
    -30,0,10,15,15,10,0,-30,
    -30,5,15,20,20,15,5,-30,
    -30,0,15,20,20,15,0,-30,
    -30,5,10,15,15,10,5,-30,
    -40,-20,0,5,5,0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,5,0,0,0,0,5,-10,
    -10,10,10,10,10,10,10,-10,
    -10,0,10,10,10,10,0,-10,
    -10,5,5,10,10,5,5,-10,
    -10,0,5,10,10,5,0,-10,
    -10,0,0,0,0,0,0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
    0,0,0,5,5,0,0,0,
    -5,0,0,0,0,0,0,-5,
    -5,0,0,0,0,0,0,-5,
    -5,0,0,0,0,0,0,-5,
    -5,0,0,0,0,0,0,-5,
    -5,0,0,0,0,0,0,-5,
    5,10,10,10,10,10,10,5,
    0,0,0,0,0,0,0,0
  ],
  q: [
    -20,-10,-10,-5,-5,-10,-10,-20,
    -10,0,0,0,0,0,0,-10,
    -10,0,5,5,5,5,0,-10,
    -5,0,5,5,5,5,0,-5,
    0,0,5,5,5,5,0,-5,
    -10,5,5,5,5,5,0,-10,
    -10,0,5,0,0,0,0,-10,
    -20,-10,-10,-5,-5,-10,-10,-20
  ],
  k: [
    20,30,10,0,0,10,30,20,
    20,20,0,0,0,0,20,20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30
  ],
};

function sqIdxFromFile(file, rank) { return (rank) * 8 + file; }

// chess.js board() liefert 8x8 rows, 0 = rang 8 (oben). Wir evaluieren fuer Weiss,
// und ziehen negatives Vorzeichen ab wenn wir aus Sicht Schwarz evaluieren wollen.
function evalBoard(chess, sideToMoveBonus = 0) {
  const b = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (!p) continue;
      const v = PIECE_VAL[p.type];
      // PST-Index: fuer weiss von unten (rang 1 = row index 7 in chess.js board).
      const idx = p.color === "w"
        ? sqIdxFromFile(f, 7 - r)
        : sqIdxFromFile(f, r);
      const pst = PST[p.type][idx];
      score += (v + pst) * (p.color === "w" ? 1 : -1);
    }
  }
  return score + sideToMoveBonus;
}

// Bewertet ein Move + sofortige beste Gegnerantwort (Depth 2, Material+PST).
// Rueckgabewert: Score aus Sicht der Farbe, die den Move spielen wuerde.
function scoreMove(chess, move, depth) {
  chess.move(move);
  const sign = (chess.turn() === "w") ? 1 : -1; // wir sind jetzt am Zug -> der Zieher war Gegenfarbe
  // Bewerte Position aus Sicht des Zuziehenden:
  if (depth <= 1 || chess.isGameOver()) {
    const v = evalBoard(chess);
    chess.undo();
    // der Zieher war der, der VORHER am Zug war -> Vorzeichen drehen
    return -v;
  }
  // Gegner antwortet bestmoeglich
  const replies = chess.moves({ verbose: true });
  let best = Infinity; // Gegner minimiert unseren Score
  for (const r of replies) {
    chess.move(r);
    const v = evalBoard(chess);
    chess.undo();
    // aus Gegner-Sicht: maximum von -v; fuer uns daher minimum von v
    if (v < best) best = v;
  }
  chess.undo();
  // best ist aus Weiss-Sicht; aus Zieher-Sicht -> * sign_desZiehers
  // sign (oben) = Seite die JETZT am Zug ist = Gegner des Ziehers -> Zieher-Sicht = -sign * best
  return -sign * best;
}

// Waehlt einen Zug fuer die am Zug befindliche Farbe.
// rating = 800..2800 (Elo). Style = "balanced"|"aggressive"|"defensive".
// stamina/form beeinflussen Blunder-Wahrscheinlichkeit.
export function pickMove(chess, params) {
  const rating = clamp(params.rating ?? 1600, 600, 2900);
  const style  = params.style ?? "balanced";
  const form   = clamp(params.form ?? 70, 20, 100);
  const stamina= clamp(params.stamina ?? 80, 10, 100);
  const rng    = params.rng ?? Math.random;

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Blunder-Wahrscheinlichkeit: je schwaecher / muede / schlechte Form, desto haeufiger.
  const blunderBase = clamp((2500 - rating) / 4500, 0, 0.45);
  const fatigue = (100 - stamina) / 200 + (100 - form) / 300;
  const blunderP = clamp(blunderBase + fatigue * 0.5, 0, 0.7);

  // Tiefe 1 oder 2 je nach Rating.
  const depth = rating > 1800 ? 2 : 1;

  // Bewerte alle Zuege.
  const scored = [];
  for (const m of moves) {
    let s = scoreMove(chess, m, depth);

    // Stilmodifikator
    if (style === "aggressive") {
      if (m.captured) s += 40;
      if (m.san && m.san.includes("+")) s += 60;
      if (m.san && m.san.includes("#")) s += 10000;
      if (m.flags && m.flags.includes("p")) s += 20; // Promotion
    } else if (style === "defensive") {
      if (m.captured) s -= 10;
      // Bevorzuge Konsolidierungszuege: keine Kingwalks
      if (m.piece === "k") s -= 20;
    }

    // Rating-Rauschen
    const sd = Math.max(25, (2600 - rating) / 10);
    s += (rng() - 0.5) * sd * 2;

    scored.push({ move: m, score: s });
  }
  scored.sort((a, b) => b.score - a.score);

  // Patzer: zufaelligen legalen Zug nehmen
  if (rng() < blunderP) {
    // nicht voellig beliebig: unter schlechteren Zuegen waehlen
    const worseStart = Math.min(Math.floor(scored.length * 0.3), scored.length - 1);
    const idx = worseStart + Math.floor(rng() * (scored.length - worseStart));
    return scored[idx].move;
  }
  // Normalerweise top-N mit rating-abhaengiger Auswahl
  const topN = Math.max(1, Math.round(clamp(7 - (rating - 800) / 350, 1, 7)));
  const pickFrom = Math.min(topN, scored.length);
  const idx = Math.floor(rng() * pickFrom);
  return scored[idx].move;
}

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

// Einfacher Material-Eval fuer Anzeigen / Zwischenstaende.
export function materialDiff(chess) {
  const b = chess.board();
  let s = 0;
  for (const row of b) for (const p of row) {
    if (!p) continue;
    s += PIECE_VAL[p.type] * (p.color === "w" ? 1 : -1);
  }
  return s;
}

// Elo-Erwartungswert
export function eloExpected(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}
