// ============================================================================
// CHECKMATE LEAGUE - Kommentar-Bibliothek
// ============================================================================
// Regelbasiertes Kommentator-System für Nicht-Schachspieler.
// Generiert narrative Kommentare basierend auf Engine-Evaluation,
// Zugtyp, Spielphase und aktiven Interventionen.
//
// Stil: 1980er-Sportreporter, deutsch, bewusst theatralisch.
// ============================================================================

// ============================================================================
// KOMMENTAR-POOLS
// ============================================================================

// —– ERÖFFNUNGSPHASE (Züge 1-10) —–

const OPENING_NEUTRAL = [
“Die Eröffnung entfaltet sich ruhig.”,
“Beide Spieler entwickeln ihre Figuren nach Schema.”,
“Bekannte Theorie — noch keine Überraschungen.”,
“Standard-Entwicklung. Der Kampf beginnt später.”,
“Die Spieler tasten sich ab.”,
“Ruhiger Eröffnungsbeginn. Beide bleiben in der Theorie.”,
“Klassische Eröffnung. Jetzt wird sich zeigen, wer besser vorbereitet ist.”,
“Beide Seiten spielen schnell — gute Vorbereitung auf beiden Seiten.”
];

const OPENING_AGGRESSIVE = [
“Der Gegner wählt einen scharfen Zug. Er will keine Theorie-Schlacht.”,
“Ungewöhnlich aggressive Eröffnung — das könnte Vorbereitung sein.”,
“Dein Spieler geht früh in die Offensive. Mutig.”,
“Scharfe Eröffnung. Hier wird es schnell konkret.”,
“Beide Spieler greifen früh an. Das wird kein Positionsspiel.”
];

const OPENING_PASSIVE = [
“Passive Eröffnung — der Gegner scheint auf Sicherheit zu spielen.”,
“Dein Spieler baut solide auf, ohne Risiko.”,
“Beide Seiten entwickeln vorsichtig. Der Sturm kommt später.”,
“Ruhige Entwicklung. Niemand will früh Schwächen zeigen.”
];

// —– MITTELSPIEL-DYNAMIK —–

const MIDDLEGAME_TACTICAL = [
“Die Stellung spitzt sich zu. Jeder Zug zählt jetzt.”,
“Kritische Phase — hier entscheidet sich viel.”,
“Die Figuren sind aktiv, die Spannung steigt.”,
“Hochkomplexe Stellung. Beide Spieler müssen präzise rechnen.”,
“Die Partie steht auf der Kippe.”,
“Heiße Phase — Fehler werden jetzt teuer.”
];

const MIDDLEGAME_POSITIONAL = [
“Beide Seiten manövrieren vorsichtig.”,
“Zähes Positionsspiel. Niemand will den ersten Fehler machen.”,
“Strategisches Manövrieren — der große Plan entsteht im Hintergrund.”,
“Ruhige Phase. Beide sammeln Kräfte für den Durchbruch.”,
“Langsame Vorbereitung. Wer findet zuerst den richtigen Plan?”,
“Positionelle Schleichfahrt. Hier entscheidet Geduld.”
];

const MIDDLEGAME_UNCLEAR = [
“Die Stellung ist unklar. Selbst die Experten wären sich uneinig.”,
“Schwer einzuschätzen — hier kann alles passieren.”,
“Komplexes Geflecht von Drohungen auf beiden Seiten.”,
“Die Bewertung schwankt. Der nächste Fehler entscheidet.”
];

// —– EVAL-SPRUNG: BLUNDER EIGEN —–

const BLUNDER_OWN_MINOR = [
“Ungenauigkeit — dein Spieler gibt etwas Vorteil ab.”,
“Nicht der beste Zug. Das wird ärgerlich werden.”,
“Kleiner Fehler. Dein Spieler sollte das wieder einfangen.”,
“Suboptimal — der Gegner bekommt eine Chance.”
];

const BLUNDER_OWN_MAJOR = [
“Schwerer Fehler! Dein Spieler verliert deutlich Material.”,
“Autsch — das war ein Patzer. Die Stellung kippt.”,
“Dein Spieler übersieht etwas Wichtiges. Das tut weh.”,
“Blunder! Jahrelange Vorbereitung, und dann das.”,
“Fataler Zug. Dein Spieler gibt den Vorteil aus der Hand.”,
“Das war nicht der Plan. Jetzt wird es schwer.”
];

const BLUNDER_OWN_CATASTROPHIC = [
“KATASTROPHE! Dein Spieler stellt entscheidendes Material ein.”,
“Das war’s — ein Zug, der die Partie ruinieren könnte.”,
“Unfassbar. Selbst Amateure sehen solche Züge.”,
“Totaler Blackout. Dein Spieler braucht jetzt ein Wunder.”
];

// —– EVAL-SPRUNG: BLUNDER GEGNER —–

const BLUNDER_OPP_MINOR = [
“Ungenauigkeit vom Gegner — dein Spieler sollte das nutzen.”,
“Der Gegner spielt nicht präzise. Da ist was zu holen.”,
“Kleiner Patzer. Kein Geschenk, aber eine Chance.”,
“Der Gegner wählt nicht das Beste. Gut für dich.”
];

const BLUNDER_OPP_MAJOR = [
“Fehler des Gegners! Dein Spieler kann jetzt zuschlagen.”,
“Der Gegner patzt — das ist deine Chance!”,
“Ein Geschenk vom Gegner! Dein Spieler muss das jetzt ausnutzen.”,
“Der Gegner bricht ein. Die Tür steht offen.”,
“Großer Fehler auf der anderen Seite — jetzt wird’s konkret.”,
“Der Gegner hat einen schweren Zug gefunden. Zum Glück für dich.”
];

const BLUNDER_OPP_CATASTROPHIC = [
“KATASTROPHE für den Gegner! Er stellt Material ein.”,
“Der Gegner ist zusammengebrochen! Das ist entscheidend.”,
“Unfassbarer Patzer — dein Spieler gewinnt praktisch kampflos.”,
“Der Gegner hat es vermasselt. Jetzt nur noch sauber nach Hause spielen.”
];

// —– EVAL-SPRUNG: BRILLIANZ EIGEN —–

const BRILLIANCE_OWN = [
“Brillanter Zug! Dein Spieler hat etwas gesehen, das alles verändert.”,
“Genialer Fund! Die Partie kippt zu deinen Gunsten.”,
“Dein Spieler ist in Form — großartiger Zug.”,
“Das ist Schach auf höchstem Niveau. Beeindruckend.”,
“Ein Zug wie aus dem Lehrbuch. Dein Spieler brilliert.”,
“Präzision in Reinform — dein Spieler findet den einen richtigen Zug.”
];

// —– MATERIAL-EREIGNISSE —–

const CAPTURE_EQUAL = [
“Figurentausch — beide geben gleichwertiges Material.”,
“Sauberer Abtausch. Die Stellung vereinfacht sich.”,
“Tausch gleicher Figuren. Weniger Komplexität auf dem Brett.”,
“Beide tauschen ab. Die Partie wird übersichtlicher.”
];

const CAPTURE_WIN_MATERIAL = [
“Dein Spieler gewinnt Material!”,
“Materialgewinn — das ist ein echter Vorteil.”,
“Der Gegner verliert Material. Zählbarer Vorteil für dich.”,
“Saubere Beute. Dein Spieler steht jetzt materiell besser.”
];

const CAPTURE_LOSE_MATERIAL = [
“Materialverlust. Das war nicht Plan.”,
“Der Gegner schnappt sich eine Figur.”,
“Dein Spieler verliert Material. Jetzt wird’s schwerer.”,
“Bittere Figur-Einbuße für deinen Spieler.”
];

const SACRIFICE_OWN = [
“Opfer! Dein Spieler gibt Material für Initiative.”,
“Riskantes Opfer — das muss berechnet sein.”,
“Material gegen Angriff — mutige Entscheidung.”,
“Dein Spieler investiert Material in einen Plan. Wir werden sehen, ob es aufgeht.”,
“Gewagtes Opfer! Jetzt muss der Angriff kommen.”,
“Dein Spieler sieht etwas, was wir nicht sehen. Oder es ist ein Fehler.”
];

const SACRIFICE_OPP = [
“Der Gegner opfert Material! Er muss einen Plan haben.”,
“Überraschendes Opfer vom Gegner — was steckt dahinter?”,
“Der Gegner investiert Material. Wachsam bleiben!”,
“Achtung — das Opfer könnte konkrete Drohungen enthalten.”
];

// —– SPEZIAL-ZÜGE —–

const CHECK_DANGEROUS = [
“Schach! Der König ist in Gefahr.”,
“Angriff auf den König — kritischer Moment.”,
“Schach — dein Spieler muss präzise reagieren.”,
“Gefährliches Schach. Hier darf nichts schiefgehen.”
];

const CHECK_HARMLESS = [
“Schach, aber harmlos. Der König geht einfach zur Seite.”,
“Kurzes Schach — keine echte Drohung.”,
“Schach ohne Folgen. Weiter geht’s.”
];

const CASTLE = [
“Rochade — der König bringt sich in Sicherheit.”,
“Rochiert! Die Königssicherheit ist gewährleistet.”,
“Rochade abgeschlossen. Jetzt kann der Angriff beginnen.”
];

const PROMOTION = [
“Bauernumwandlung! Ein neuer Dame-artiger Drache auf dem Brett.”,
“Der Bauer wird zur Dame — entscheidender Moment.”,
“Umwandlung! Das Material explodiert zugunsten deines Spielers.”,
“Bauer promoviert — jetzt ist die Partie fast gelaufen.”
];

const PROMOTION_OPP = [
“Der Gegner wandelt um! Das ist bitter.”,
“Bauernumwandlung beim Gegner — jetzt wird’s schwer.”,
“Neue Dame für den Gegner. Katastrophe.”
];

// —– ENDSPIEL —–

const ENDGAME_TECHNIQUE = [
“Das Endspiel wird technisch. Präzision entscheidet.”,
“Endspiel-Phase — jeder Zug zählt.”,
“Die Partie hat sich vereinfacht. Jetzt entscheidet die Technik.”,
“Wenig Material, viel Kalkulation — typisches Endspiel.”,
“Im Endspiel zählt jedes Tempo.”
];

const ENDGAME_WINNING = [
“Gewinnendspiel — dein Spieler muss es nur sauber nach Hause bringen.”,
“Die Technik sollte reichen. Ruhe bewahren.”,
“Theoretisch gewonnen. Jetzt bloß keinen Fehler mehr.”,
“Klarer Weg zum Sieg — wenn dein Spieler präzise bleibt.”
];

const ENDGAME_LOSING = [
“Schweres Endspiel für deinen Spieler. Rettung wird schwer.”,
“Theoretisch verloren — ein Wunder müsste passieren.”,
“Dein Spieler muss jetzt auf Fehler des Gegners hoffen.”,
“Verloren, aber noch nicht entschieden. Hartnäckig bleiben.”
];

const ENDGAME_DRAWN = [
“Remis-Verdacht liegt in der Luft.”,
“Das Endspiel tendiert zum Unentschieden.”,
“Schwer zu gewinnen für beide Seiten — Remis wahrscheinlich.”,
“Ausgeglichenes Endspiel. Ein Remisangebot wäre vernünftig.”
];

// —– LANGE PHASEN OHNE EREIGNIS —–

const MANEUVERING_LONG = [
“Beide Seiten manövrieren, ohne sich festzulegen.”,
“Lange Vorbereitungsphase — der Durchbruch kommt später.”,
“Geduldspiel. Wer zuerst blinzelt, verliert.”,
“Schleichender Positionskampf. Spannung unter der Oberfläche.”
];

const TIME_TROUBLE_OWN = [
“Dein Spieler gerät in Zeitnot. Die Uhr tickt gefährlich.”,
“Wenig Zeit für deinen Spieler — jetzt wird’s hektisch.”,
“Zeitdruck! Dein Spieler muss schnell Entscheidungen treffen.”
];

const TIME_TROUBLE_OPP = [
“Der Gegner gerät in Zeitnot — jetzt können Fehler kommen.”,
“Wenig Zeit für den Gegner. Dein Spieler sollte komplizieren.”,
“Zeitdruck beim Gegner — perfekte Phase für eine Falle.”
];

// —– INTERVENTIONS-AKTIVIERUNG (sofort beim Klick) —–

const ACTIVATION_FOCUS = [
“Du gibst deinem Spieler das Zeichen — tief durchatmen, fokussieren.”,
“Konzentration aktiviert. Dein Spieler findet seinen Rhythmus.”,
“Dein Spieler zentriert sich. Die nächsten Züge werden stärker.”,
“Du bringst deinen Spieler in den Flow. Jetzt kommt Präzision.”
];

const ACTIVATION_WAITER = [
“Dein Mann am Nachbartisch erhält das Signal. Ein Glas fällt — der Gegner zuckt zusammen.”,
“Der Kellner ist instruiert. Gleich wird etwas ‘versehentlich’ verschüttet.”,
“Ablenkung bestellt. In wenigen Sekunden geht am Nachbartisch etwas schief.”,
“Du nickst kaum merklich. Sekunden später klirrt Porzellan im Saal.”
];

const ACTIVATION_OPENING_PREP = [
“Dein Spieler öffnet ein Kapitel, das er nächtelang studiert hat.”,
“Die Hausaufgaben zahlen sich aus. Bekanntes Terrain.”,
“Vorbereitung aktiviert — dein Spieler kennt jede Variante.”,
“Dein Spieler lächelt kurz. Diese Stellung hatte er vorbereitet.”
];

const ACTIVATION_PSYOPS = [
“Du gibst das Zeichen. Dein Mann im Publikum beginnt zu husten — präzise getimt.”,
“Psychologische Kriegsführung beginnt. Der Gegner wird das spüren.”,
“Drei Reihen hinter dem Gegner kichert jemand leise. Nicht zufällig.”,
“Du aktivierst dein Netzwerk. Der Gegner wird sich bald beobachtet fühlen.”
];

const ACTIVATION_PSYOPS_DETECTED = [
“⚠ ENTDECKT! Der Schiedsrichter schaut herüber. Das war knapp.”,
“⚠ AUFGEFLOGEN! Jemand hat dein Spiel durchschaut.”,
“⚠ WARNUNG! Verdächtige Blicke vom Turnierbüro.”,
“⚠ AUFMERKSAMKEIT! Du hast es übertrieben — der Heat steigt dramatisch.”
];

const ACTIVATION_OFFER_DRAW = [
“Du schickst ein diskretes Zeichen — dein Spieler bietet Remis.”,
“Remisangebot geht raus. Die Entscheidung liegt beim Gegner.”,
“Diskretes Signal — dein Spieler streckt die Hand aus.”,
“Du wählst den sicheren Ausgang. Remisangebot ist auf dem Tisch.”
];

// —– INTERVENTIONS-WIRKUNG (während aktiv) —–

const EFFECT_FOCUS_ACTIVE = [
“[Konzentration] Dein Spieler findet einen präzisen Zug.”,
“[Konzentration] Ruhiger, klarer Zug — die Fokussierung wirkt.”,
“[Konzentration] Dein Spieler spielt wie im Training.”
];

const EFFECT_WAITER_ACTIVE = [
“[Ablenkung] Der Gegner blickt zur Seite — sein Zug wirkt unsicher.”,
“[Ablenkung] Die Konzentration des Gegners bröckelt.”,
“[Ablenkung] Der Gegner rechnet länger als nötig — er ist gestört.”
];

const EFFECT_OPENING_PREP_ACTIVE = [
“[Vorbereitung] Dein Spieler zieht ohne nachzudenken — Hausaufgaben gemacht.”,
“[Vorbereitung] Bekannte Züge, präzise Ausführung.”,
“[Vorbereitung] Dein Spieler führt die Vorbereitung durch.”
];

const EFFECT_PSYOPS_ACTIVE = [
“[Druck] Der Gegner wirkt angespannt — die Nadelstiche wirken.”,
“[Druck] Der Gegner dreht sich um, sucht die Störung.”,
“[Druck] Die Psyche des Gegners zeigt Risse.”
];

// —– INTERVENTIONS-KONSEQUENZ (verknüpft mit Zug) —–
// Werden statt Standard-Kommentar verwendet, wenn Intervention aktiv war

const CONSEQUENCE_FOCUS_HELPED = [
“Starker Zug — die Konzentrationsphase zahlt sich aus.”,
“Präzision dank Fokus. Genau dafür hast du investiert.”,
“Dein Spieler findet die Spitze, weil er im Flow ist.”
];

const CONSEQUENCE_WAITER_HELPED = [
“Der Gegner übersieht etwas — die Ablenkung hat funktioniert.”,
“Unpräziser Zug vom Gegner. Die Störung hat Wirkung gezeigt.”,
“Der Gegner hat den besten Zug nicht gesehen. Danke, Kellner.”
];

const CONSEQUENCE_PSYOPS_HELPED = [
“Der Gegner patzt unter Druck. Deine Taktik hat gewirkt.”,
“Zerrüttete Nerven — der Gegner spielt gegen seine Form.”,
“Die psychologische Zermürbung zeigt Früchte.”
];

const CONSEQUENCE_INTERVENTION_FAILED = [
“Die Intervention hat nicht gegriffen — der Gegner hat trotzdem gefunden, was er suchte.”,
“Deine Investition war umsonst. Der Gegner war zu stark.”,
“Keine Wirkung — manche Spieler sind einfach unerschütterlich.”
];

// —– HEAT-WARNUNGEN —–

const HEAT_LOW = [
“Die Situation ist ruhig. Niemand schaut genauer hin.”
];

const HEAT_MEDIUM = [
“⚠ Das Turnierbüro wirkt aufmerksamer als sonst.”,
“⚠ Du spürst Blicke — der Schiedsrichter ist hellhörig geworden.”
];

const HEAT_HIGH = [
“⚠⚠ Hoher Druck! Weitere Aktionen sind riskant.”,
“⚠⚠ Die Aufsicht beobachtet dich intensiv. Vorsicht jetzt.”,
“⚠⚠ Gefährliches Terrain — noch ein Fehler und du fliegst auf.”
];

const HEAT_CRITICAL = [
“⚠⚠⚠ KRITISCH! Jede weitere Aktion könnte das Ende sein.”,
“⚠⚠⚠ Du bist in der Schusslinie. Zieh dich zurück!”,
“⚠⚠⚠ Die Ermittler sind dir auf den Fersen. Halte still.”
];

// ============================================================================
// DISPATCHER-LOGIK
// ============================================================================

// Mapping von Intervention-Typ zu Aktivierungs-Pool
const ACTIVATION_POOLS = {
focus: ACTIVATION_FOCUS,
waiter: ACTIVATION_WAITER,
openingPrep: ACTIVATION_OPENING_PREP,
psyops: ACTIVATION_PSYOPS,
offerDraw: ACTIVATION_OFFER_DRAW
};

/**

- Haupt-Funktion: Wählt Kommentar basierend auf Kontext.
- 
- @param {Object} context - Kontext-Objekt mit folgenden Feldern:
- - moveNumber: Aktuelle Zugnummer (1-basiert)
- - evalBefore: Stellungsbewertung vor dem Zug (in Bauern-Einheiten)
- - evalAfter: Stellungsbewertung nach dem Zug
- - moveType: ‘normal’ | ‘capture’ | ‘check’ | ‘castle’ | ‘promotion’
- - capturedPiece: null | number (Figurenwert: 1=Bauer, 3=Springer/Läufer, 5=Turm, 9=Dame)
- - wasSacrifice: boolean (Material geopfert ohne kompensierenden Eval-Verlust)
- - isOwnMove: boolean (hat mein Spieler gezogen)
- - activeInterventions: string[] (Namen aktiver Interventionen: ‘focus’, ‘waiter’, ‘psyops’, …)
- - justActivated: string | null (Name einer gerade aktivierten Intervention)
- - interventionDetected: boolean (wurde psyops entdeckt)
- - phase: ‘opening’ | ‘middlegame’ | ‘endgame’
- - heatLevel: number (0-100)
- 
- @returns {string | null} Kommentar-Text oder null (kein Kommentar für diesen Zug)
  */
  function getCommentary(context) {
  const {
  moveNumber,
  evalBefore,
  evalAfter,
  moveType,
  capturedPiece,
  wasSacrifice,
  isOwnMove,
  activeInterventions,
  justActivated,
  interventionDetected,
  phase,
  heatLevel
  } = context;

// Priorität 1: Aktivierung einer Intervention JETZT
if (justActivated) {
if (interventionDetected) {
return pick(ACTIVATION_PSYOPS_DETECTED);
}
const pool = ACTIVATION_POOLS[justActivated];
if (pool) return pick(pool);
}

// Priorität 2: Promotion (immer erwähnen)
if (moveType === ‘promotion’) {
return isOwnMove ? pick(PROMOTION) : pick(PROMOTION_OPP);
}

// Priorität 3: Berechne Eval-Delta
const delta = evalAfter - evalBefore;
const absDelta = Math.abs(delta);

// Dramatische Eval-Sprünge → Blunder oder Brillanz-Kommentar
if (absDelta > 3.0) {
if (isOwnMove) {
return delta > 0
? withInterventionLink(pick(BRILLIANCE_OWN), activeInterventions, ‘own_good’)
: pick(BLUNDER_OWN_CATASTROPHIC);
} else {
return delta < 0
? withInterventionLink(pick(BLUNDER_OPP_CATASTROPHIC), activeInterventions, ‘opp_bad’)
: pick(MIDDLEGAME_TACTICAL);
}
}

if (absDelta > 1.5) {
if (isOwnMove) {
return delta > 0
? pick(BRILLIANCE_OWN)
: pick(BLUNDER_OWN_MAJOR);
} else {
return delta < 0
? withInterventionLink(pick(BLUNDER_OPP_MAJOR), activeInterventions, ‘opp_bad’)
: pick(MIDDLEGAME_TACTICAL);
}
}

if (absDelta > 0.7) {
if (isOwnMove) {
return delta > 0
? pick(CAPTURE_WIN_MATERIAL)
: pick(BLUNDER_OWN_MINOR);
} else {
return delta < 0
? pick(BLUNDER_OPP_MINOR)
: null; // Keine Routine-Unpräzision des Gegners erwähnen
}
}

// Priorität 4: Spezielle Züge ohne großen Eval-Impact
if (moveType === ‘castle’) {
return pick(CASTLE);
}

if (moveType === ‘check’) {
return absDelta > 0.5 ? pick(CHECK_DANGEROUS) : pick(CHECK_HARMLESS);
}

if (wasSacrifice) {
return isOwnMove ? pick(SACRIFICE_OWN) : pick(SACRIFICE_OPP);
}

if (capturedPiece) {
if (isOwnMove && capturedPiece >= 3) {
return pick(CAPTURE_WIN_MATERIAL);
}
if (!isOwnMove && capturedPiece >= 3) {
return pick(CAPTURE_LOSE_MATERIAL);
}
return pick(CAPTURE_EQUAL);
}

// Priorität 5: Routinezüge — sparsam kommentieren (nur alle 4 Züge)
if (moveNumber % 4 !== 0) return null;

if (phase === ‘opening’) {
return pick(OPENING_NEUTRAL);
}
if (phase === ‘endgame’) {
return pick(ENDGAME_TECHNIQUE);
}
return pick(MIDDLEGAME_POSITIONAL);
}

/**

- Verknüpft Kommentar mit aktiver Intervention, wenn passend.
- Ersetzt generischen Kommentar durch Konsequenz-Kommentar,
- der die Verknüpfung zur Intervention explizit macht.
  */
  function withInterventionLink(baseCommentary, activeInterventions, context) {
  if (!activeInterventions || activeInterventions.length === 0) {
  return baseCommentary;
  }

if (context === ‘opp_bad’) {
if (activeInterventions.includes(‘waiter’)) return pick(CONSEQUENCE_WAITER_HELPED);
if (activeInterventions.includes(‘psyops’)) return pick(CONSEQUENCE_PSYOPS_HELPED);
}
if (context === ‘own_good’) {
if (activeInterventions.includes(‘focus’)) return pick(CONSEQUENCE_FOCUS_HELPED);
}

return baseCommentary;
}

/**

- Liefert einen Heat-Warnungs-Kommentar basierend auf aktuellem Heat-Level.
- Wird separat vom Haupt-Kommentar verwendet, z.B. zwischen Zügen eingeblendet.
- 
- @param {number} heatLevel - Aktueller Heat-Wert (0-100)
- @returns {string | null} Warnung oder null (kein Warnungs-Bedarf)
  */
  function getHeatWarning(heatLevel) {
  if (heatLevel >= 90) return pick(HEAT_CRITICAL);
  if (heatLevel >= 70) return pick(HEAT_HIGH);
  if (heatLevel >= 50) return pick(HEAT_MEDIUM);
  return null; // Kein Warnungs-Bedarf
  }

/**

- Liefert einen Wirkungs-Kommentar für eine aktive Intervention.
- Wird verwendet, wenn ein Zug während einer aktiven Intervention stattfindet,
- aber der Zug selbst nicht dramatisch war (kein großer Eval-Sprung).
- 
- @param {string} interventionName - Name der aktiven Intervention
- @returns {string | null}
  */
  function getEffectCommentary(interventionName) {
  const pools = {
  focus: EFFECT_FOCUS_ACTIVE,
  waiter: EFFECT_WAITER_ACTIVE,
  openingPrep: EFFECT_OPENING_PREP_ACTIVE,
  psyops: EFFECT_PSYOPS_ACTIVE
  };
  const pool = pools[interventionName];
  return pool ? pick(pool) : null;
  }

// ============================================================================
// UTILITIES
// ============================================================================

function pick(array) {
return array[Math.floor(Math.random() * array.length)];
}

// ============================================================================
// EXPORT
// ============================================================================

// Falls als ES-Modul geladen:
if (typeof module !== ‘undefined’ && module.exports) {
module.exports = {
getCommentary,
getHeatWarning,
getEffectCommentary
};
}

// Falls als Browser-Script geladen, sind die Funktionen global verfügbar.
