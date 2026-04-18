# Checkmate League — Manager-Prototyp

**Prototyp v2.** Eine einzelne Schachpartie, Stockfish gegen Stockfish. Du bist *nicht* der Schachspieler — du bist sein Manager. Du greifst während der Partie durch taktische und manipulative Aktionen ein, ohne selbst schachen zu können.

**Design-Frage, die dieser Prototyp beantworten soll:**
> Macht es Spaß, eine echte Schachpartie im Hintergrund ablaufen zu sehen und sie durch Manager-Eingriffe zu beeinflussen, ohne selbst Schach zu spielen?

## Online spielen

Nach dem nächsten Push deployt der Pages-Workflow automatisch auf `https://bennotk.github.io/Checkmate-League/` (Repo muss Public sein, Pages in den Repo-Settings aktiviert).

## Lokal starten

```
git clone https://github.com/bennotk/Checkmate-League.git
cd Checkmate-League
python3 -m http.server 8080
# dann http://localhost:8080
```

Die Seite lädt `chess.js` per jsdelivr-ESM (Internet nötig beim ersten Laden).
Stockfish liegt im Repo (`vendor/stockfish.{js,wasm}`) — keine externe Abhängigkeit zur Laufzeit.

## Konzept

- **Eine Partie** zwischen „Mein Spieler" (Weiß) und „Gegner" (Schwarz).
- **Beide sind Stockfish**-Instanzen mit einstellbarem Skill Level 0–20. Start: beide auf 8.
- **Automatischer Ablauf**, regelbar via Pause / 1× / 4× / 16×.
- **100 Ressourcen** — harter Pool, keine Regeneration. Trade-offs sind gewollt.
- **Heat 0–100** — jeder Eingriff erhöht die Heat. Bei 100 → Disqualifikation.

## Interventionen

| Intervention | Kosten | Heat | Effekt | Einschränkung |
|---|---:|---:|---|---|
| Konzentrationsphase | 15 | +5 | Eigener Skill +4 für 3 Züge | — |
| Kellner bestechen | 20 | +10 | Gegner-Skill −3 für 3 Züge | — |
| Eröffnungs-Analyse | 25 | +5 | Eigener Skill +5 für 5 Züge | nur bis Zug 9, 1×/Partie |
| Psychologische Kriegsführung | 30 | +15 | Gegner-Skill −5 für 4 Züge | 30% Entdeckungsrisiko (+25 Heat) |
| Remis anbieten | 0 | 0 | Gegner entscheidet nach Stellung | ab Zug 20, nicht in verlorener Stellung |

*Dauer „3 Züge" bedeutet: die nächsten 3 Züge meines Spielers.*

## Entscheidungen und Offene Punkte

- **Echter Stockfish** (v10 asm.js + WASM, ~450 KB) statt gemappte Engine. Grund: echte Skill-Levels und echte Evaluation für die Remis-Formel. Zwei separate Worker-Instanzen.
- **Harter Ressourcen-Pool** (keine Regeneration) — der eigentliche Spielreiz ist das knappe Budgetieren.
- **Retro-Terminal-Look** — passt zum späteren Thema und hält das UI funktional.
- **Alle Balancing-Werte** liegen in `js/config.js` (Kosten, Heat, Dauern, Skill-Deltas, Remis-Formel-Koeffizienten). Werte anpassen, Seite neu laden, fertig.
- **Save-State** ist vorhanden (`localStorage` key `checkmate-league-match-v2`), wird aber bei laufender Partie nach Reload auf Pregame zurückgesetzt, da Engine-Worker nicht persistierbar sind.

## Dateistruktur

```
index.html              Eintrittspunkt, lädt chess.js über CDN + startet main.js
css/main.css            Retro-Terminal-Styles
vendor/
  stockfish.js          Stockfish 10 UCI-Worker (WASM-Loader)
  stockfish.wasm        Stockfish-Engine-Binary
js/
  config.js             alle Balancing-Werte (edit hier!)
  stockfish-engine.js   Wrapper um den UCI-Worker (Skill, go, evaluate)
  state.js              Match-Zustand, Buffs, Heat, Ressourcen, Save/Load
  interventions.js      canCast + applyIntervention
  match.js              Orchestrator: chess.js + zwei Engines + Tick-Loop
  ui.js                 Rendering (Pregame / Live / Result) + Partial-Updates
  main.js               Bootstrap, Event-Delegation, Routing
.github/workflows/pages.yml   Auto-Deploy auf GitHub Pages bei jedem Push
```

## Bekannte Vorbehalte für den Prototyp

- Stockfish-Skill-Level ist auf dieser Engine-Version nicht linear in ELO. Die Deltas (+4 / −5 usw.) sind als Tuning-Ausgangspunkt zu verstehen.
- Das Design hat noch keine Persönlichkeiten, keinen Skill-Progression-Tree, keinen Turnier-Kontext — genau das, was außerhalb der zu testenden Kern-Frage liegt.
- Bei sehr niedrigen Move-Time-Werten (z.B. 16× Turbo + Skill 20) kann Stockfish unter 500 ms nicht alle Tiefen erreichen. Geschwindigkeit priorisieren wir derzeit über Stärke.

## Wiederverwendung aus dem alten Team-Chess-Prototyp

| übernommen | Detail |
|---|---|
| HTML-Shell, Topbar, Speed-Pills, Toasts, Modal | direkt |
| CSS-Architektur, Board-Rendering, Unicode-Figuren, Last-Move-Highlight | direkt (Retro-Theme drübergelegt) |
| Save/Load-Pattern (`localStorage`), Log-System, Event-Delegation, Tick-Loop | direkt |
| Eigene Minimax-Engine (`engine.js`) | **ersetzt durch Stockfish** |
| Team-/Liga-/Transfer-Module (`data.js`, `season.js`, `transfer.js`) | **entfernt** |

Der alte Stand liegt im Git-Log auf derselben Branch (Commit `eb6e6e0`), falls wir Teile zurückholen wollen.
