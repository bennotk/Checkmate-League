// Rule-based match commentary in 1980s German sportscaster tone.
// Each pool is an array of German lines. getCommentary(context) picks a pool
// based on the context and returns one random line, or null if nothing fits.

const POOLS = {
  opening_neutral: [
    "Die Eröffnung entfaltet sich ruhig, beide tasten sich ab.",
    "Bekannte Theorie — noch keine Überraschungen am Brett.",
    "Klassische Eröffnung, das Publikum hält den Atem an.",
    "Ruhiger Beginn, die Uhren laufen gleichmäßig.",
    "Beide Seiten entwickeln nach Schema, alles solide.",
  ],
  opening_aggressive: [
    "Scharfer Eröffnungszug — hier wird früh attackiert!",
    "Keine Theorie-Schlacht, sondern sofortige Konfrontation.",
    "Ungewöhnlich aggressives Vorgehen in der Eröffnung.",
    "Schon im ersten Drittel fliegen die Späne.",
    "Das wird kein Positionsspiel — beide wollen es jetzt wissen.",
  ],
  middlegame_tactical: [
    "Die Stellung spitzt sich zu, jeder Zug zählt jetzt.",
    "Kritische Phase — hier entscheidet sich viel.",
    "Die Spannung ist mit Händen zu greifen.",
    "Hochkomplexe Lage, beide müssen präzise rechnen.",
    "Fehler werden jetzt sofort bestraft.",
  ],
  middlegame_positional: [
    "Beide Seiten manövrieren vorsichtig.",
    "Zähes Positionsspiel, niemand will den ersten Fehler machen.",
    "Strategisches Manövrieren, der große Plan wird gesponnen.",
    "Geduldsprobe am Brett, die Zuschauer warten.",
    "Langsame Vorbereitung eines Durchbruchs.",
  ],
  endgame_winning: [
    "Gewinnendspiel — das muss jetzt sauber nach Hause gebracht werden.",
    "Die Technik sollte reichen, bloß keine Unachtsamkeit mehr.",
    "Theoretisch gewonnen, jetzt nur Ruhe bewahren.",
    "Klarer Weg zum Sieg, wenn die Hand nicht zittert.",
  ],
  endgame_losing: [
    "Schweres Endspiel — Rettung wird schwer.",
    "Theoretisch verloren, nur ein Wunder kann noch helfen.",
    "Unser Mann muss auf Fehler des Gegners hoffen.",
    "Die Lage ist düster, aber noch nicht entschieden.",
  ],
  endgame_drawn: [
    "Remis-Verdacht liegt in der Luft.",
    "Das Endspiel tendiert klar zum Unentschieden.",
    "Schwer zu gewinnen für beide Seiten, Remis wahrscheinlich.",
    "Ausgeglichene Struktur, hier ist kein Durchkommen mehr.",
  ],
  blunder_own: [
    "Autsch! Das war ein schwerer Patzer unseres Mannes.",
    "Unfassbar — unser Spieler übersieht etwas Wichtiges!",
    "Schwerer Fehler, die Stellung kippt auf einen Schlag.",
    "Das war nicht der Plan. Jetzt wird es schwer.",
    "Jahrelange Vorbereitung, und dann so ein Zug.",
  ],
  blunder_opp: [
    "Großer Fehler auf der anderen Seite — jetzt muss zugeschlagen werden!",
    "Ein Geschenk vom Gegner, die Tür steht sperrangelweit offen.",
    "Der Gegner patzt, das ist die Gelegenheit!",
    "Unglaublicher Bock beim Gegner — Chance nutzen!",
    "Der Gegner bricht ein, die Partie kippt.",
  ],
  brilliance_own: [
    "Brillanter Zug! Unser Spieler hat etwas gesehen, das alles verändert.",
    "Genialer Fund, die Partie kippt zu unseren Gunsten.",
    "Das ist Schach auf höchstem Niveau — beeindruckend.",
    "Präzision in Reinform, wie aus dem Lehrbuch.",
    "Ein Zug wie aus einem anderen Universum.",
  ],
  capture_equal: [
    "Sauberer Abtausch, die Stellung vereinfacht sich.",
    "Tausch gleicher Figuren, weniger Komplexität am Brett.",
    "Beide geben gleichwertiges Material ab.",
    "Üblicher Figurentausch, die Partie wird übersichtlicher.",
  ],
  capture_advantage: [
    "Materialgewinn — das ist ein echter Vorteil.",
    "Saubere Beute, unser Spieler steht jetzt besser.",
    "Zählbarer Vorteil, der Gegner verliert eine Figur.",
    "Materialvorteil herausgespielt, jetzt konsequent weiter.",
  ],
  check: [
    "Schach! Der König ist in Gefahr.",
    "Angriff auf den König — kritischer Moment.",
    "Schach, jetzt muss präzise reagiert werden.",
    "Gefährliches Schach, hier darf nichts schiefgehen.",
  ],
  castle: [
    "Rochade — der König bringt sich in Sicherheit.",
    "Rochiert! Die Königssicherheit ist gewährleistet.",
    "Rochade abgeschlossen, jetzt kann der Angriff beginnen.",
    "Der König zieht um, höchste Zeit.",
  ],
  promotion: [
    "Bauernumwandlung! Eine neue Dame auf dem Brett.",
    "Der Bauer promoviert — entscheidender Moment.",
    "Umwandlung! Das Material explodiert auf dem Brett.",
    "Aus dem Bauern wird eine Dame — Partie fast gelaufen.",
  ],
};

function pickPool(context) {
  const {
    phase,
    evalDelta = 0,
    moveType,
    isOwnMove,
    eval: evalPawns,
  } = context ?? {};
  const abs = Math.abs(evalDelta);

  if (moveType === "promotion") return "promotion";
  if (moveType === "castle") return "castle";
  if (moveType === "check") return "check";

  if (abs >= 1.5) {
    if (isOwnMove) return evalDelta > 0 ? "brilliance_own" : "blunder_own";
    return evalDelta < 0 ? "blunder_opp" : null;
  }

  if (moveType === "capture") {
    return abs >= 0.5 ? "capture_advantage" : "capture_equal";
  }

  if (phase === "endgame") {
    const e = typeof evalPawns === "number" ? evalPawns : evalDelta;
    if (e > 1.0) return "endgame_winning";
    if (e < -1.0) return "endgame_losing";
    return "endgame_drawn";
  }

  if (abs < 0.2) return null;

  if (phase === "opening") return abs >= 0.5 ? "opening_aggressive" : "opening_neutral";
  if (phase === "middlegame") return abs >= 0.5 ? "middlegame_tactical" : "middlegame_positional";

  return null;
}

export function getCommentary(context) {
  const key = pickPool(context);
  if (!key) return null;
  const pool = POOLS[key];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
