// Alle Balancing-Werte an einer Stelle. Direkt tuning-freundlich:
// aendere Werte hier, reload der Seite, fertig.
//
// Interventionen und Heat-Schwellen werden beim naechsten Spiel sofort wirksam.

export const CONFIG = {
  // --- Start-Werte pro Partie ---
  startResources: 100,
  startHeat: 0,
  startSkillPlayer: 8,   // Mein Spieler (Weiss)
  startSkillOpponent: 8, // Gegner (Schwarz)

  // --- Heat-System ---
  heatMax: 100,
  heatWarnThreshold: 70,

  // --- Engine ---
  skillMin: 0,
  skillMax: 20,
  // Bedenkzeit je Halbzug in ms. Stockfish Skill 0-20 ist auch davon abhaengig,
  // aber wir halten es kurz um zuegige Partien zu haben.
  movetimeMs: 500,
  // Tiefe fuer Evaluationen (Remis-Formel) unabhaengig von movetime.
  evalDepth: 12,

  // --- Tick-Geschwindigkeit: minimaler Abstand zwischen Halbzuegen (UI-Tempo) ---
  // Entspricht "Pause / 1x / 4x / 16x". Werte sind Ziel-Abstaende in ms pro Halbzug.
  speedIntervalsMs: { 0: 0, 1: 1200, 4: 400, 16: 120 },

  // --- Remis-Formel ---
  // P_accept = clamp(base + slope * eval_pawns_oppView, floor, ceiling)
  // eval_pawns_oppView > 0 bedeutet: Gegner steht besser (fuer ihn).
  // Intuition: ausgeglichen ~0.6, Gegner +2 -> ~0 (clamped), Gegner -2 -> ~0.9 (clamped).
  drawFormula: {
    base: 0.6,
    slope: -0.35,    // je besser der Gegner, desto seltener akzeptiert er
    floor: 0.05,
    ceiling: 0.9,
  },
  // Remis darf frueherstens ab diesem eigenen Zug angeboten werden.
  drawEarliestMove: 20,
  // Remis nur wenn eigene Stellung nicht schlechter als X Bauern ist (aus eigener Sicht).
  // Hier: nicht anbieten, wenn wir mehr als 3 Bauern hinten liegen.
  drawMaxLossToOffer: 3.0,

  // --- Interventionen: alle Parameter koennen frei getunt werden. ---
  interventions: {
    focus: {
      id: "focus",
      label: "Konzentrationsphase",
      desc: "Dein Spieler findet seinen Rhythmus.",
      cost: 15,
      heatAdd: 5,
      durationMoves: 3,       // 3 eigene Zuege
      selfSkillDelta: +4,
      opponentSkillDelta: 0,
      discoverChance: 0,      // keine Zusatz-Entdeckung
      discoveryHeatAdd: 0,
      availableFromMove: 1,
      availableUntilMove: null, // null = immer
      oncePerGame: false,
    },
    waiter: {
      id: "waiter",
      label: "Kellner bestechen",
      desc: "Ein umgeworfenes Glas Wasser nebenan — der Gegner ist abgelenkt.",
      cost: 20,
      heatAdd: 10,
      durationMoves: 3,
      selfSkillDelta: 0,
      opponentSkillDelta: -3,
      discoverChance: 0,
      discoveryHeatAdd: 0,
      availableFromMove: 1,
      availableUntilMove: null,
      oncePerGame: false,
    },
    opening: {
      id: "opening",
      label: "Eröffnungs-Analyse",
      desc: "Die Vorbereitung zahlt sich aus. Du kennst diese Stellung.",
      cost: 25,
      heatAdd: 5,
      durationMoves: 5,
      selfSkillDelta: +5,
      opponentSkillDelta: 0,
      discoverChance: 0,
      discoveryHeatAdd: 0,
      availableFromMove: 1,
      availableUntilMove: 9,   // nur vor dem 10. eigenen Zug (Zug 1..9 erlaubt)
      oncePerGame: true,
    },
    psyops: {
      id: "psyops",
      label: "Psychologische Kriegsführung",
      desc: "Dein Mann im Publikum hustet, wann immer der Gegner nachdenkt.",
      cost: 30,
      heatAdd: 15,
      durationMoves: 4,
      selfSkillDelta: 0,
      opponentSkillDelta: -5,
      discoverChance: 0.30,
      discoveryHeatAdd: 25,
      availableFromMove: 1,
      availableUntilMove: null,
      oncePerGame: false,
    },
    offerDraw: {
      id: "offerDraw",
      label: "Remis anbieten",
      desc: "Du schickst ein diskretes Zeichen.",
      cost: 0,
      heatAdd: 0,
      durationMoves: 0,
      selfSkillDelta: 0,
      opponentSkillDelta: 0,
      discoverChance: 0,
      discoveryHeatAdd: 0,
      availableFromMove: 1,          // early-check via drawEarliestMove unten
      availableUntilMove: null,
      oncePerGame: false,
    },
  },
};
