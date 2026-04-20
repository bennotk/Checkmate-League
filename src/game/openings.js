// Compact opening database: longest SAN-prefix match returns ECO + name.
// Subset of common lines across all ECO volumes (A-E), sourced from
// lichess-org/chess-openings (CC0). Extend freely — the lookup is O(n).

const OPENINGS = [
  { eco: "A00", name: "Uncommon Opening",              moves: ["b3"] },
  { eco: "A02", name: "Bird Opening",                  moves: ["f4"] },
  { eco: "A04", name: "Réti Opening",                  moves: ["Nf3"] },
  { eco: "A10", name: "English Opening",               moves: ["c4"] },
  { eco: "A40", name: "Queen's Pawn Game",             moves: ["d4"] },
  { eco: "A45", name: "Indian Defense",                moves: ["d4", "Nf6"] },
  { eco: "B00", name: "King's Pawn Opening",           moves: ["e4"] },
  { eco: "B01", name: "Scandinavian Defense",          moves: ["e4", "d5"] },
  { eco: "B02", name: "Alekhine's Defense",            moves: ["e4", "Nf6"] },
  { eco: "B06", name: "Modern Defense",                moves: ["e4", "g6"] },
  { eco: "B07", name: "Pirc Defense",                  moves: ["e4", "d6"] },
  { eco: "B10", name: "Caro-Kann Defense",             moves: ["e4", "c6"] },
  { eco: "B20", name: "Sicilian Defense",              moves: ["e4", "c5"] },
  { eco: "B22", name: "Sicilian: Alapin Variation",    moves: ["e4", "c5", "c3"] },
  { eco: "B40", name: "Sicilian: French Variation",    moves: ["e4", "c5", "Nf3", "e6"] },
  { eco: "B50", name: "Sicilian: Old Sicilian",        moves: ["e4", "c5", "Nf3", "d6"] },
  { eco: "B56", name: "Sicilian: Classical",           moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3"] },
  { eco: "B90", name: "Sicilian: Najdorf",             moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
  { eco: "C00", name: "French Defense",                moves: ["e4", "e6"] },
  { eco: "C20", name: "King's Pawn Game",              moves: ["e4", "e5"] },
  { eco: "C40", name: "King's Knight Opening",         moves: ["e4", "e5", "Nf3"] },
  { eco: "C41", name: "Philidor Defense",              moves: ["e4", "e5", "Nf3", "d6"] },
  { eco: "C42", name: "Petrov's Defense",              moves: ["e4", "e5", "Nf3", "Nf6"] },
  { eco: "C44", name: "King's Pawn Game",              moves: ["e4", "e5", "Nf3", "Nc6"] },
  { eco: "C45", name: "Scotch Game",                   moves: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { eco: "C50", name: "Italian Game",                  moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C53", name: "Italian: Classical",            moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { eco: "C60", name: "Ruy López",                     moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C65", name: "Ruy López: Berlin Defense",     moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
  { eco: "D00", name: "Queen's Pawn Game",             moves: ["d4", "d5"] },
  { eco: "D02", name: "Queen's Pawn: 2.Nf3",           moves: ["d4", "d5", "Nf3"] },
  { eco: "D06", name: "Queen's Gambit",                moves: ["d4", "d5", "c4"] },
  { eco: "D10", name: "Slav Defense",                  moves: ["d4", "d5", "c4", "c6"] },
  { eco: "D20", name: "Queen's Gambit Accepted",       moves: ["d4", "d5", "c4", "dxc4"] },
  { eco: "D30", name: "Queen's Gambit Declined",       moves: ["d4", "d5", "c4", "e6"] },
  { eco: "D35", name: "QGD: Exchange Variation",       moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5"] },
  { eco: "D70", name: "Neo-Grünfeld Defense",          moves: ["d4", "Nf6", "c4", "g6", "g3"] },
  { eco: "D80", name: "Grünfeld Defense",              moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { eco: "E00", name: "Queen's Pawn: Neo-Indian",      moves: ["d4", "Nf6", "c4", "e6"] },
  { eco: "E20", name: "Nimzo-Indian Defense",          moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { eco: "E60", name: "King's Indian Defense",         moves: ["d4", "Nf6", "c4", "g6"] },
  { eco: "E61", name: "King's Indian: Classical",      moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"] },
];

export function detectOpening(sanMoves) {
  if (!Array.isArray(sanMoves) || sanMoves.length === 0) return null;
  let best = null;
  for (const op of OPENINGS) {
    if (op.moves.length > sanMoves.length) continue;
    let matches = true;
    for (let i = 0; i < op.moves.length; i++) {
      if (op.moves[i] !== sanMoves[i]) { matches = false; break; }
    }
    if (matches && (!best || op.moves.length > best.moves.length)) {
      best = op;
    }
  }
  return best ? { eco: best.eco, name: best.name, depth: best.moves.length } : null;
}
