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
  // Tiefe fuer Evaluationen (Remis-Formel) unabhaengig von movetime.
  evalDepth: 12,

  // --- Dynamische Bedenkzeit ---
  // "Chess-Sekunden" pro Halbzug, abgeleitet aus der Stellungs-Komplexitaet.
  // Durchschnitt ca. 3000 ms bei 1x-Tempo, so dass das Match atmet wie eine
  // echte Partie. Einfache Zuege (Eroeffnungsbuch, wenige Alternativen) sind
  // deutlich schneller; Schlagzuege, Schach, lange Zug-Listen dauern laenger.
  dynamicThinkTime: {
    baseMs: 1800,
    perLegalMoveMs: 40,         // je extra legaler Zug ueber 20 hinaus
    inCheckBonusMs: 800,
    afterCaptureBonusMs: 600,
    evalSwingBonusPerPawnMs: 400,
    phaseBonusMs: { opening: -600, middlegame: 900, endgame: 300 },
    jitter: 0.18,               // +- 18 % Random-Variation
    min: 400,
    max: 6500,
  },
  // Stockfish-Suchzeit wird aus der Bedenkzeit abgeleitet (begrenzt, damit
  // auch sehr lange "Denkzeiten" die Engine nicht ausbremsen oder leerlaufen).
  engineMovetime: { factor: 0.55, min: 150, max: 1400 },

  // --- Blunder-Modell ---
  // Skill-Level steht fuer "ideale" Stellungsbehandlung. Fehler werden durch
  // eine eigene Blunder-Chance modelliert: wir fordern mehrere Zug-Kandidaten
  // von Stockfish (MultiPV) und ersetzen gelegentlich den Top-Zug durch einen
  // schlechteren. Wahrscheinlichkeit + Schaerfe steigen unter Zeitdruck,
  // kurzen Bedenkzeiten und aktiven Debuffs.
  multiPv: 5,
  blunder: {
    // Grund-Chance bei "idealen Umstaenden" je Skill. Zwischenwerte werden
    // linear interpoliert. Skill 20 spielt fast nie daneben, Skill 0 sehr oft.
    baseBySkill: {
      0:  0.22,
      5:  0.10,
      10: 0.05,
      15: 0.02,
      20: 0.005,
    },
    // Zeitdruck-Multiplikator in Abhaengigkeit der verbleibenden Uhr (ms).
    clockTiers: [
      { underMs: 10000,  mul: 4.5 },
      { underMs: 30000,  mul: 2.8 },
      { underMs: 60000,  mul: 1.8 },
      { underMs: 120000, mul: 1.2 },
    ],
    // Bedenkzeit-Effekt: wenig Zeit -> mehr Fehler, viel Zeit -> weniger.
    thinkShortUnderMs: 900,     thinkShortMul:     2.2,
    thinkShortishUnderMs: 1800, thinkShortishMul: 1.35,
    thinkLongOverMs: 4500,      thinkLongMul:     0.35,
    thinkLongishOverMs: 3200,   thinkLongishMul:  0.65,
    // Obergrenze, damit selbst schwerer Druck die Partie nicht total kaputt macht.
    max: 0.92,
  },

  // --- Schachuhr ---
  // Startguthaben je Seite in ms. Jeder Zug zieht die dynamische Bedenkzeit ab.
  // Faellt eine Seite auf 0, verliert sie durch Zeit.
  startClockMs: 10 * 60 * 1000,

  // --- Tempo-Faktor ---
  // Der Manager waehlt 0/1/4/16. Die Wandzeit pro Zug ist dynamicThinkTime
  // dividiert durch diesen Faktor (0 = Pause). Die Uhr selbst tickt in
  // Schachzeit (unabhaengig vom gewaehlten Tempo).
  speedFactor: { 0: 0, 1: 1, 4: 4, 16: 16 },

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
      selfBlunderMul: 0.25,   // starke Reduktion eigener Fehler
      opponentBlunderBonus: 0,
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
      selfBlunderMul: 1,
      opponentBlunderBonus: 0.25,  // +25 %-Punkte Fehlerchance beim Gegner
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
      selfBlunderMul: 0.2,   // im Buch fast keine Fehler
      opponentBlunderBonus: 0,
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
      selfBlunderMul: 1,
      opponentBlunderBonus: 0.55, // zuverlaessig dramatische Fehler erzwingen
      discoverChance: 0.30,
      discoveryHeatAdd: 25,
      availableFromMove: 1,
      availableUntilMove: null,
      oncePerGame: false,
    },
    cheat: {
      id: "cheat",
      label: "Brett manipulieren",
      desc: "Du verrueckst heimlich eine Figur. Das Publikum ist nicht blind.",
      cost: 10,
      heatAdd: 40,
      durationMoves: 0,
      selfSkillDelta: 0,
      opponentSkillDelta: 0,
      selfBlunderMul: 1,
      opponentBlunderBonus: 0,
      discoverChance: 0.70,       // erschreckend hohe Entdeckungschance
      discoveryHeatAdd: 50,
      availableFromMove: 1,
      availableUntilMove: null,
      oncePerGame: true,
      manualTarget: true,         // UI muss Feld-Auswahl einholen
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
