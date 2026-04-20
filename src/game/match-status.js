// Translates engine eval (in pawn units) into plain-language match status.
// Used by the manager UI so non-chess-players can read the position at a glance.

const THRESHOLDS = [
  { min: 3.0, max: Infinity, label: "Klar auf Gewinn", winChance: 90, tone: "very_good" },
  { min: 1.5, max: 3.0, label: "Deutlicher Vorteil", winChance: 78, tone: "good" },
  { min: 0.5, max: 1.5, label: "Leichter Vorteil", winChance: 62, tone: "slight_good" },
  { min: -0.5, max: 0.5, label: "Ausgeglichen", winChance: 50, tone: "neutral" },
  { min: -1.5, max: -0.5, label: "Unter Druck", winChance: 38, tone: "slight_bad" },
  { min: -3.0, max: -1.5, label: "In Schwierigkeiten", winChance: 22, tone: "bad" },
  { min: -Infinity, max: -3.0, label: "Praktisch verloren", winChance: 10, tone: "very_bad" },
];

export function getPositionAssessment(evalPawns) {
  for (const t of THRESHOLDS) {
    if (evalPawns >= t.min && evalPawns < t.max) {
      return { label: t.label, winChance: t.winChance, tone: t.tone };
    }
  }
  return { label: "Ausgeglichen", winChance: 50, tone: "neutral" };
}

const PHASE_LABELS = {
  opening: "Eröffnung",
  middlegame: "Mittelspiel",
  endgame: "Endspiel",
};

export function getGamePhase(moveNumber) {
  if (moveNumber <= 15) return "opening";
  if (moveNumber <= 40) return "middlegame";
  return "endgame";
}

export function buildStatusLine(gameState) {
  const { evalPawns = 0, moveNumber = 1 } = gameState ?? {};
  const phase = getGamePhase(moveNumber);
  const { label, winChance } = getPositionAssessment(evalPawns);
  return `${PHASE_LABELS[phase]}, Zug ${moveNumber} — ${label} (${winChance}%)`;
}
