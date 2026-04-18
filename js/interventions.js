// Logik fuer Intervention-Casts. Trennt Regelwerk vom UI.
// Definitionen kommen aus CONFIG; hier nur: kann ich das gerade aktivieren?
// und: was passiert dabei.

import { CONFIG } from "./config.js";
import { log } from "./state.js";

// Kann die Intervention zum aktuellen Zeitpunkt ausgeloest werden?
// Gibt { ok: true } oder { ok: false, reason: "…" }.
export function canCast(state, id) {
  const def = CONFIG.interventions[id];
  if (!def) return { ok: false, reason: "unbekannt" };
  if (state.phase !== "playing") return { ok: false, reason: "kein laufendes Match" };
  // Nur vor eigenem Zug? Wir erlauben Cast jederzeit, solange Partie laeuft,
  // um es responsiver zu machen. Dauer zaehlt ab dem naechsten eigenen Zug.
  if (state.resources < def.cost) return { ok: false, reason: "zu wenig Ressourcen" };
  const casts = state.castLog[id] ?? 0;
  if (def.oncePerGame && casts >= 1) return { ok: false, reason: "nur 1× pro Partie" };

  const myMoveIdx = state.myMovesMade + 1; // naechster eigener Zug
  if (def.availableFromMove && myMoveIdx < def.availableFromMove) {
    return { ok: false, reason: `erst ab Zug ${def.availableFromMove}` };
  }
  if (def.availableUntilMove !== null && def.availableUntilMove !== undefined
      && myMoveIdx > def.availableUntilMove) {
    return { ok: false, reason: `nur bis Zug ${def.availableUntilMove}` };
  }

  // Remis-Anbieten hat Zusatzregeln (drawEarliestMove, nicht verloren).
  if (id === "offerDraw") {
    if (myMoveIdx < CONFIG.drawEarliestMove) {
      return { ok: false, reason: `Remis erst ab Zug ${CONFIG.drawEarliestMove}` };
    }
  }
  return { ok: true };
}

// Aktiviert die Intervention. Rueckgabe: { applied: boolean, events: [...] }.
// Nebenwirkung: aendert state (Resources, Heat, Buffs, CastLog, Log).
// Remis-Anbieten wird separat in match.js behandelt, weil es die Engine-Antwort braucht.
export function applyIntervention(state, id) {
  const def = CONFIG.interventions[id];
  const check = canCast(state, id);
  if (!check.ok) return { applied: false, reason: check.reason };

  // Kosten
  state.resources -= def.cost;
  state.heat = Math.min(CONFIG.heatMax, state.heat + (def.heatAdd || 0));
  state.castLog[id] = (state.castLog[id] ?? 0) + 1;

  const events = [];

  // Buff/Debuff anlegen, wenn Dauer vorhanden
  if (def.durationMoves > 0 && (def.selfSkillDelta || def.opponentSkillDelta)) {
    state.buffs.push({
      id: def.id,
      label: def.label,
      selfSkillDelta: def.selfSkillDelta || 0,
      opponentSkillDelta: def.opponentSkillDelta || 0,
      remaining: def.durationMoves,
      source: id,
    });
  }

  log(state, `${def.label} aktiviert. ${def.desc}`, "info");
  events.push({ type: "cast", id });

  // Entdeckungs-Roll einmalig beim Cast
  if (def.discoverChance > 0) {
    const roll = Math.random();
    if (roll < def.discoverChance) {
      state.heat = Math.min(CONFIG.heatMax, state.heat + def.discoveryHeatAdd);
      log(state, `Die Schiedsrichter haben Verdacht geschöpft! Heat +${def.discoveryHeatAdd}.`, "bad");
      events.push({ type: "discovered", heatAdd: def.discoveryHeatAdd });
    } else {
      log(state, `Niemand hat's bemerkt.`, "dim");
      events.push({ type: "undetected" });
    }
  }

  return { applied: true, events, def };
}
