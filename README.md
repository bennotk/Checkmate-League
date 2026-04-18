# Checkmate League

Ein browser-basiertes Idle-Manager-Spiel, das die Mechaniken klassischer Fußball-Manager-Spiele auf die Welt des Schachs überträgt. Alle Partien werden mit echter Schachlogik (chess.js) gespielt — der Spieler nimmt Einfluss wie in Fußballsimulationen: über Taktik, Aufstellung, Transfers und Manager-Tools.

## Starten

```
# lokalen Webserver starten (beliebiger reicht aus)
python3 -m http.server 8080
# dann http://localhost:8080 im Browser oeffnen
```

Das Spiel lädt `chess.js` per ESM-CDN (`jsdelivr`). Einmalige Internetverbindung nötig.

## Konzept

- **4 Ligen** (Amateur → Königsliga) mit jeweils 8 Teams.
- **Mannschaftsschach**: 5 Bretter spielen parallel gegen die Bretter des Gegners.
- **Saison** = 14 Spieltage Doppelrunde. Top 2 auf, Bottom 2 ab.
- **Transfermarkt** im Transferfenster zu Saisonbeginn (schließt nach 1. Spieltag).
- **Live-Match**: das eigene Spiel wird Brett-für-Brett in Echtzeit gespielt (echtes Schach). Andere Begegnungen der Runde werden via Elo simuliert.
- **Idle**: Geschwindigkeit mit Pause / 1× / 4× / 16× regelbar.

## Analogien zum Fußball

| Fußball | Checkmate League |
|---|---|
| Taktischer Foul / Gelbe Karte | Aggressive Mannschaftstaktik erhöht Risiko einer Taktik-Verwarnung (3 gelbe = 1 Spiel Sperre) |
| Video-Referee (VAR) | Einmal pro Brett / Seite ein eigener Zug zurücknehmen und neu spielen |
| Verletzungen | Zufällige Pause von 1–3 Spielen |
| Formkurve & Stamina | Beeinflussen Spielstärke (Patzerrate) |
| Transfergerüchte / Scouting | Scout gezielt nach Ligalevel (kostet Geld) |
| Preisgelder / Sponsoren | Abhängig von Ligaebene und Saisonplatz |

## Dateien

- `index.html` – Einstiegspunkt, lädt chess.js per CDN + Module
- `css/main.css` – Styles
- `js/data.js` – Namen, Klubs, Liga-Konfiguration, RNG
- `js/engine.js` – Rating-basierte Schach-Engine (shallow minimax + Patzer-Modell)
- `js/state.js` – Spielzustand, Spieler-/Team-Generierung, Save/Load
- `js/match.js` – Live-Match-Ablauf + Elo-Simulation anderer Partien
- `js/season.js` – Spielplan, Saisonende, Auf-/Abstieg, Finanzen
- `js/transfer.js` – Transfermarkt, Scout
- `js/ui.js` – Rendering aller Views
- `js/main.js` – Bootstrap, Eventhandler, Idle-Loop

## Hinweise

- Der Spielstand wird in `localStorage` unter `checkmate-league-save-v1` gespeichert.
- Die Schach-Engine ist bewusst flach (Depth 1–2 mit Rating-Rauschen); Ziel ist Atmosphäre und Tempo, nicht Spielstärke.
