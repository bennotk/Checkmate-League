// ============================================================================
// CHECKMATE LEAGUE - Match Status System
// ============================================================================
// Übersetzt Schach-Metriken (Engine-Eval, Material, Phase) in für
// Nicht-Schachspieler verständliche verbale und grafische Indikatoren.
//
// Hauptzweck: Der Spieler soll jederzeit wissen, wer gerade gewinnt und
// was gerade wichtig ist — ohne Schach-Notation lesen zu müssen.
// ============================================================================

// ============================================================================
// KONFIGURATION
// ============================================================================

// Figurenwerte nach Standard-Konvention
const PIECE_VALUES = {
‘p’: 1,  // Bauer (pawn)
‘n’: 3,  // Springer (knight)
‘b’: 3,  // Läufer (bishop)
‘r’: 5,  // Turm (rook)
‘q’: 9,  // Dame (queen)
‘k’: 0   // König wird nicht gezählt
};

// Figuren-Symbole (Unicode) für Anzeige
const PIECE_SYMBOLS = {
white: { p: ‘♙’, n: ‘♘’, b: ‘♗’, r: ‘♖’, q: ‘♕’, k: ‘♔’ },
black: { p: ‘♟’, n: ‘♞’, b: ‘♝’, r: ‘♜’, q: ‘♛’, k: ‘♚’ }
};

// Eval-Schwellen für verbale Einordnung (in Bauern-Einheiten)
const EVAL_THRESHOLDS = [
{ min: 5.0,    max: Infinity, label: “Praktisch gewonnen”,       tone: “very_good”, winChance: 97 },
{ min: 3.0,    max: 5.0,      label: “Klar auf Gewinn”,          tone: “good”,      winChance: 90 },
{ min: 1.5,    max: 3.0,      label: “Deutlicher Vorteil”,       tone: “good”,      winChance: 78 },
{ min: 0.5,    max: 1.5,      label: “Leichter Vorteil”,         tone: “slight”,    winChance: 62 },
{ min: -0.5,   max: 0.5,      label: “Ausgeglichen”,             tone: “neutral”,   winChance: 50 },
{ min: -1.5,   max: -0.5,     label: “Unter Druck”,              tone: “slight_bad”, winChance: 38 },
{ min: -3.0,   max: -1.5,     label: “In Schwierigkeiten”,       tone: “bad”,       winChance: 22 },
{ min: -5.0,   max: -3.0,     label: “Praktisch verloren”,       tone: “very_bad”,  winChance: 10 },
{ min: -Infinity, max: -5.0,  label: “Hoffnungslos”,             tone: “critical”,  winChance: 3 }
];

// Phasen-Grenzen (Zugnummer)
const PHASE_THRESHOLDS = {
opening: { from: 1, to: 15 },
middlegame: { from: 16, to: 40 },
endgame: { from: 41, to: Infinity }
};

// ============================================================================
// STELLUNGSBEWERTUNG (EVAL → VERBAL)
// ============================================================================

/**

- Übersetzt Engine-Eval in verbale Einordnung.
- Aus Sicht deines eigenen Spielers (positiv = dein Vorteil).
- 
- @param {number} evalPawns - Engine-Eval in Bauern-Einheiten
- @returns {Object} { label, tone, winChance }
  */
  function getPositionAssessment(evalPawns) {
  for (const threshold of EVAL_THRESHOLDS) {
  if (evalPawns >= threshold.min && evalPawns < threshold.max) {
  return {
  label: threshold.label,
  tone: threshold.tone,
  winChance: threshold.winChance,
  evalValue: evalPawns
  };
  }
  }
  // Fallback
  return EVAL_THRESHOLDS[4]; // “Ausgeglichen”
  }

/**

- Erzeugt einen ASCII-Balken, der die Stellungsbewertung darstellt.
- Skala: -5 bis +5. Mitte = ausgeglichen.
- 
- @param {number} evalPawns - Engine-Eval
- @param {number} width - Breite des Balkens in Zeichen (Standard: 20)
- @returns {string} ASCII-Balken
  */
  function renderEvalBar(evalPawns, width = 20) {
  const min = -5;
  const max = 5;
  const clamped = Math.max(min, Math.min(max, evalPawns));

const normalized = (clamped - min) / (max - min); // 0..1
const filledChars = Math.round(normalized * width);
const emptyChars = width - filledChars;

const filled = ‘█’.repeat(filledChars);
const empty = ‘░’.repeat(emptyChars);

return `[${filled}${empty}]`;
}

/**

- Alternative: vertikaler Balken mit Gradient (für Retro-Terminal-Stil).
- 
- @param {number} evalPawns
- @returns {string[]} Array von Zeilen (von oben nach unten)
  */
  function renderVerticalEvalBar(evalPawns) {
  const lines = [];
  const clamped = Math.max(-5, Math.min(5, evalPawns));

// 11 Zeilen: +5 bis -5
for (let v = 5; v >= -5; v–) {
const isCurrent = Math.abs(v - Math.round(clamped)) < 0.5;
const label = v > 0 ? `+${v}` : `${v}`;
const marker = isCurrent ? ’ ◀ ’ : ’   ’;
const bar = v === 0 ? ‘═══’ : (v > 0 ? ‘▓▓▓’ : ‘░░░’);
lines.push(`${label.padStart(3)} ${bar}${marker}`);
}

return lines;
}

// ============================================================================
// MATERIAL-BALANCE
// ============================================================================

/**

- Berechnet Material-Balance aus FEN oder Board-Array.
- 
- @param {string | Object} position - FEN-String oder chess.js-board()-Output
- @returns {Object} { white: { p, n, b, r, q, total }, black: {…}, diff }
  */
  function calculateMaterial(position) {
  const counts = {
  white: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  black: { p: 0, n: 0, b: 0, r: 0, q: 0 }
  };

// FEN-String parsen
if (typeof position === ‘string’) {
const boardPart = position.split(’ ’)[0];
for (const char of boardPart) {
if (char === ‘/’ || /\d/.test(char)) continue;
const lower = char.toLowerCase();
if (PIECE_VALUES[lower] !== undefined && lower !== ‘k’) {
const color = char === char.toUpperCase() ? ‘white’ : ‘black’;
counts[color][lower]++;
}
}
} else if (Array.isArray(position)) {
// chess.js-Format: 2D-Array von {type, color} oder null
for (const row of position) {
for (const cell of row) {
if (!cell || cell.type === ‘k’) continue;
const color = cell.color === ‘w’ ? ‘white’ : ‘black’;
counts[color][cell.type]++;
}
}
}

// Summen berechnen
const totalWhite = Object.entries(counts.white)
.reduce((sum, [piece, count]) => sum + count * PIECE_VALUES[piece], 0);
const totalBlack = Object.entries(counts.black)
.reduce((sum, [piece, count]) => sum + count * PIECE_VALUES[piece], 0);

return {
white: { …counts.white, total: totalWhite },
black: { …counts.black, total: totalBlack },
diff: totalWhite - totalBlack
};
}

/**

- Erzeugt eine Anzeige-Zeile mit Figuren-Unicode-Symbolen.
- 
- @param {Object} materialSide - { p, n, b, r, q } counts
- @param {string} color - ‘white’ oder ‘black’
- @returns {string} z.B. “♕ ♖♖ ♗ ♘♘ + 5 Bauern”
  */
  function renderMaterialLine(materialSide, color) {
  const symbols = PIECE_SYMBOLS[color];
  const parts = [];

// Große Figuren zuerst (Dame, Türme, Läufer, Springer)
if (materialSide.q > 0) parts.push(symbols.q.repeat(materialSide.q));
if (materialSide.r > 0) parts.push(symbols.r.repeat(materialSide.r));
if (materialSide.b > 0) parts.push(symbols.b.repeat(materialSide.b));
if (materialSide.n > 0) parts.push(symbols.n.repeat(materialSide.n));

let line = parts.join(’ ’);
if (materialSide.p > 0) {
line += ` + ${materialSide.p} Bauer${materialSide.p !== 1 ? 'n' : ''}`;
}

return line.trim() || ‘—’;
}

/**

- Verbale Einordnung des Material-Unterschieds.
- 
- @param {number} diff - Material-Differenz (positiv = Weiß führt)
- @param {boolean} weAreWhite - Bist du Weiß?
- @returns {string}
  */
  function describeMaterialDiff(diff, weAreWhite = true) {
  const ourDiff = weAreWhite ? diff : -diff;

if (ourDiff === 0) return “Material ist ausgeglichen”;
if (ourDiff > 0) {
if (ourDiff === 1) return “Du hast einen Bauern mehr”;
if (ourDiff <= 2) return `Du führst mit ${ourDiff} Bauern`;
if (ourDiff <= 4) return `Deutlicher Materialvorteil (+${ourDiff})`;
if (ourDiff <= 7) return `Großer Materialvorteil (+${ourDiff})`;
return `Überwältigender Materialvorteil (+${ourDiff})`;
} else {
const absDiff = Math.abs(ourDiff);
if (absDiff === 1) return “Du hast einen Bauern weniger”;
if (absDiff <= 2) return `Du liegst ${absDiff} Bauern zurück`;
if (absDiff <= 4) return `Deutlicher Materialnachteil (-${absDiff})`;
if (absDiff <= 7) return `Großer Materialnachteil (-${absDiff})`;
return `Überwältigender Materialnachteil (-${absDiff})`;
}
}

// ============================================================================
// SPIELPHASE
// ============================================================================

/**

- Ermittelt die Spielphase anhand Zugnummer und optional Material.
- 
- @param {number} moveNumber - Aktuelle Zugnummer
- @param {Object} [material] - Optional: Material-Objekt von calculateMaterial()
- @returns {Object} { name, label, description }
  */
  function getGamePhase(moveNumber, material = null) {
  // Material-basierte Korrektur: Wenig Material = Endspiel, auch wenn früh
  if (material) {
  const totalMaterial = material.white.total + material.black.total;
  if (totalMaterial < 20 && moveNumber >= 20) {
  return {
  name: ‘endgame’,
  label: ‘Endspiel’,
  description: ‘Wenig Material, jeder Zug zählt’
  };
  }
  }

if (moveNumber <= PHASE_THRESHOLDS.opening.to) {
return {
name: ‘opening’,
label: ‘Eröffnung’,
description: ‘Die ersten Züge — Figuren werden entwickelt’
};
}
if (moveNumber <= PHASE_THRESHOLDS.middlegame.to) {
return {
name: ‘middlegame’,
label: ‘Mittelspiel’,
description: ‘Die heiße Phase — Taktik entscheidet’
};
}
return {
name: ‘endgame’,
label: ‘Endspiel’,
description: ‘Reduziertes Material — Technik zählt’
};
}

// ============================================================================
// SPIELER-STÄRKE (Stat → Laien-Begriff)
// ============================================================================

// Übersetzung von ELO-Range in verbale Klasse
const ELO_CLASSES = [
{ min: 0,    max: 1000, label: “Anfänger”,             short: “Einsteiger” },
{ min: 1000, max: 1400, label: “Amateur”,              short: “Freizeit” },
{ min: 1400, max: 1800, label: “Vereinsspieler”,       short: “Verein” },
{ min: 1800, max: 2000, label: “Starker Vereinsspieler”, short: “Stark” },
{ min: 2000, max: 2200, label: “Regional stark”,       short: “Regional” },
{ min: 2200, max: 2400, label: “Nationale Klasse”,     short: “National” },
{ min: 2400, max: 2500, label: “Internationaler Meister”, short: “IM” },
{ min: 2500, max: 2700, label: “Großmeister”,          short: “GM” },
{ min: 2700, max: 2800, label: “Super-Großmeister”,    short: “Super-GM” },
{ min: 2800, max: Infinity, label: “Weltklasse”,       short: “Weltklasse” }
];

/**

- Übersetzt ELO-Wert in verbale Klasse.
  */
  function getPlayerClass(elo) {
  for (const c of ELO_CLASSES) {
  if (elo >= c.min && elo < c.max) return c;
  }
  return ELO_CLASSES[0];
  }

/**

- Übersetzt Stockfish-Skill-Level (0-20) in approximierte ELO.
- Näherungswerte basierend auf gängigen Einschätzungen.
  */
  function stockfishSkillToElo(skill) {
  const clamped = Math.max(0, Math.min(20, skill));
  // Grobe lineare Näherung: Skill 0 ≈ 1200, Skill 20 ≈ 2900
  return Math.round(1200 + (clamped / 20) * 1700);
  }

/**

- Berechnet effektiven Skill aus Stats basierend auf Spielphase.
- Stats sind auf 0-100 skaliert, Stockfish-Level auf 0-20.
- 
- @param {Object} stats - { opening, middlegame, endgame } (je 0-100)
- @param {string} phase - ‘opening’ | ‘middlegame’ | ‘endgame’
- @returns {number} Stockfish-Skill-Level (0-20)
  */
  function calculateEffectiveSkill(stats, phase) {
  const statValue = stats[phase] || 50;
  return Math.floor(statValue / 5);
  }

// ============================================================================
// KONTEXTUELLE STATUS-ZEILE
// ============================================================================

/**

- Erzeugt eine kontextuelle Empfehlung basierend auf Eval und Phase.
- Der “innere Trainer” gibt strategische Hinweise.
  */
  function getStrategicAdvice(evalPawns, phase, moveNumber) {
  const assessment = getPositionAssessment(evalPawns);

// Endspiel-spezifisch
if (phase.name === ‘endgame’) {
if (assessment.winChance >= 85) return “Du solltest das nach Hause bringen. Keine Fehler mehr!”;
if (assessment.winChance >= 60) return “Technische Phase — sauber weiterspielen.”;
if (assessment.winChance >= 40) return “Ausgeglichenes Endspiel. Auf Gelegenheiten warten.”;
if (assessment.winChance >= 20) return “Schwieriges Endspiel. Auf Fehler des Gegners hoffen.”;
return “Fast verloren. Nur ein Wunder oder eine Falle kann retten.”;
}

// Mittelspiel
if (phase.name === ‘middlegame’) {
if (assessment.winChance >= 85) return “Du dominierst — spiel konkret auf Gewinn.”;
if (assessment.winChance >= 60) return “Im Vorteil. Initiative halten.”;
if (assessment.winChance >= 40) return “Kritische Phase. Kein Fehler jetzt.”;
if (assessment.winChance >= 20) return “Du brauchst einen Plan. Komplizieren hilft.”;
return “Schwierige Lage. Risiko gehen — du hast nichts zu verlieren.”;
}

// Eröffnung
if (phase.name === ‘opening’) {
if (moveNumber < 5) return “Ruhig in die Partie kommen.”;
if (assessment.winChance >= 60) return “Guter Start — Entwicklung fortsetzen.”;
if (assessment.winChance >= 40) return “Normale Entwicklung. Der Kampf beginnt später.”;
return “Schon früh unter Druck. Solide weiterspielen.”;
}

return “Weiterspielen.”;
}

// ============================================================================
// HAUPT-STATUS-OBJEKT
// ============================================================================

/**

- Erzeugt ein vollständiges Status-Objekt für eine Partie.
- Das Herz des Status-Systems: alle relevanten Infos in einem Aufruf.
- 
- @param {Object} gameState - Aktueller Spielzustand
- - position: FEN-String oder chess.js-board
- - evalPawns: Engine-Evaluation
- - moveNumber: aktuelle Zugnummer
- - ownPlayer: { name, stats, elo } - dein Spieler
- - opponent: { name, stats, elo } - Gegner
- - weAreWhite: boolean
- @returns {Object} Vollständiger Status
  */
  function buildMatchStatus(gameState) {
  const {
  position,
  evalPawns = 0,
  moveNumber = 1,
  ownPlayer = {},
  opponent = {},
  weAreWhite = true
  } = gameState;

// Aus Sicht des eigenen Spielers orientieren
const ownEval = weAreWhite ? evalPawns : -evalPawns;

const material = calculateMaterial(position);
const phase = getGamePhase(moveNumber, material);
const assessment = getPositionAssessment(ownEval);
const advice = getStrategicAdvice(ownEval, phase, moveNumber);

const ownMaterial = weAreWhite ? material.white : material.black;
const oppMaterial = weAreWhite ? material.black : material.white;
const materialDescription = describeMaterialDiff(material.diff, weAreWhite);

return {
// Phase
phase: {
name: phase.name,
label: phase.label,
description: phase.description,
moveNumber: moveNumber
},

```
// Stellungsbewertung
position: {
  evalValue: ownEval,
  evalBar: renderEvalBar(ownEval),
  verticalBar: renderVerticalEvalBar(ownEval),
  label: assessment.label,
  tone: assessment.tone,
  winChance: assessment.winChance
},

// Material
material: {
  ownTotal: ownMaterial.total,
  oppTotal: oppMaterial.total,
  diff: weAreWhite ? material.diff : -material.diff,
  ownDisplay: renderMaterialLine(ownMaterial, weAreWhite ? 'white' : 'black'),
  oppDisplay: renderMaterialLine(oppMaterial, weAreWhite ? 'black' : 'white'),
  description: materialDescription
},

// Strategischer Rat
advice: advice,

// Spieler-Infos
players: {
  own: {
    name: ownPlayer.name || 'Dein Spieler',
    class: ownPlayer.elo ? getPlayerClass(ownPlayer.elo).label : 'Unbekannt',
    elo: ownPlayer.elo || null
  },
  opponent: {
    name: opponent.name || 'Gegner',
    class: opponent.elo ? getPlayerClass(opponent.elo).label : 'Unbekannt',
    elo: opponent.elo || null
  }
}
```

};
}

// ============================================================================
// RENDERING-HELFER FÜR RETRO-TERMINAL-STIL
// ============================================================================

/**

- Rendert den kompletten Status als ASCII-Block für Retro-Anzeige.
- Gibt einen mehrzeiligen String zurück.
  */
  function renderStatusBlock(status) {
  const lines = [];

lines.push(‘╔══════════════════════════════════════════╗’);
lines.push(`║  ${status.phase.label.toUpperCase().padEnd(12)} · Zug ${String(status.phase.moveNumber).padStart(3)}${' '.repeat(16)}║`);
lines.push(‘╠══════════════════════════════════════════╣’);
lines.push(‘║                                          ║’);
lines.push(`║  STELLUNG:                               ║`);
lines.push(`║  ${status.position.evalBar}  ${String(status.position.evalValue.toFixed(1)).padStart(5)}       ║`);
lines.push(`║  ${status.position.label.padEnd(38)}  ║`);
lines.push(`║  Gewinnchance: ${String(status.position.winChance).padStart(3)}%                   ║`);
lines.push(‘║                                          ║’);
lines.push(`║  MATERIAL:                               ║`);
lines.push(`║  Du:      ${status.material.ownDisplay.padEnd(30)} ║`);
lines.push(`║  Gegner:  ${status.material.oppDisplay.padEnd(30)} ║`);
lines.push(`║  ${status.material.description.padEnd(38)}  ║`);
lines.push(‘║                                          ║’);
lines.push(`║  TIPP:                                   ║`);

// Advice auf mehrere Zeilen aufteilen wenn nötig
const adviceLines = wrapText(status.advice, 38);
for (const line of adviceLines) {
lines.push(`║  ${line.padEnd(38)}  ║`);
}

lines.push(‘║                                          ║’);
lines.push(‘╚══════════════════════════════════════════╝’);

return lines.join(’\n’);
}

/**

- Bricht Text auf maximale Zeilenbreite um.
  */
  function wrapText(text, maxWidth) {
  const words = text.split(’ ’);
  const lines = [];
  let currentLine = ‘’;

for (const word of words) {
if ((currentLine + ’ ’ + word).trim().length <= maxWidth) {
currentLine = (currentLine + ’ ’ + word).trim();
} else {
if (currentLine) lines.push(currentLine);
currentLine = word;
}
}
if (currentLine) lines.push(currentLine);
return lines;
}

/**

- Kompakte Einzeiler-Variante für schmale UIs.
  */
  function renderStatusCompact(status) {
  const phase = status.phase.label;
  const eval_ = status.position.evalValue.toFixed(1);
  const label = status.position.label;
  const chance = status.position.winChance;

return `${phase} · ${label} (${eval_ > 0 ? '+' : ''}${eval_}) · ${chance}% Gewinnchance`;
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== ‘undefined’ && module.exports) {
module.exports = {
// Hauptfunktion
buildMatchStatus,

```
// Einzelne Komponenten
getPositionAssessment,
calculateMaterial,
getGamePhase,
getPlayerClass,
calculateEffectiveSkill,
stockfishSkillToElo,
getStrategicAdvice,
describeMaterialDiff,

// Renderer
renderEvalBar,
renderVerticalEvalBar,
renderMaterialLine,
renderStatusBlock,
renderStatusCompact,

// Konstanten (für Tests oder Konfiguration)
PIECE_VALUES,
PIECE_SYMBOLS,
EVAL_THRESHOLDS,
ELO_CLASSES
```

};
}
