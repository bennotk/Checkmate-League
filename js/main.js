// Bootstrap: State, UI, Event-Wiring. Haelt match.js an der UI zusammen.
// Schlank gehalten - die Gameplay-Logik lebt in match.js / interventions.js.

import {
  createInitialState, loadState, saveState, deleteSave, log,
} from "./state.js";
import { CONFIG } from "./config.js";
import {
  renderTopbar, renderPreGame, renderLiveMatch, renderResult,
  patchLive, toast, openModal, closeModal,
} from "./ui.js";
import { startMatch, stopMatch, offerDraw, onMatchUpdate } from "./match.js";
import { applyIntervention, canCast } from "./interventions.js";

let state = loadState() ?? createInitialState();
// Nach harten Reloads: wenn vorher "playing" war, setzen wir zurueck auf pregame,
// da die Engine-Worker nicht perisstiert werden konnten.
if (state.phase === "playing") {
  state.phase = "pregame";
  state.result = null;
}

renderTopbar(state);
routeRender();

// Einen gemeinsamen Listener fuer alle Match-Events.
onMatchUpdate((evt) => {
  if (!state) return;
  if (evt.type === "move" || evt.type === "starting" || evt.type === "ready"
      || evt.type === "thinking"
      || evt.type === "draw-offered" || evt.type === "draw-accepted" || evt.type === "draw-declined") {
    renderTopbar(state);
    if (state.phase === "playing") patchLive(state);
  }
  if (evt.type === "move" && evt.blunder) {
    const mySide = evt.blunderSide === "self";
    const hard = evt.blunderSeverity >= 0.7;
    const msg = mySide
      ? (hard ? "Dein Spieler patzt grob!" : "Dein Spieler vertut sich.")
      : (hard ? "Der Gegner patzt grob!" : "Der Gegner wird ungenau.");
    toast(msg, mySide ? "bad" : "ok");
  }
  if (evt.type === "finished") {
    renderTopbar(state);
    routeRender();
  }
});

// Event-Delegation
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-action], [data-speed], [data-modal-close]");
  if (!t) return;

  if (t.matches("[data-modal-close]")) { closeModal(); return; }

  if (t.dataset.speed != null) {
    state.speed = Number(t.dataset.speed);
    saveState(state);
    renderTopbar(state);
    return;
  }

  const action = t.dataset.action;
  switch (action) {
    case "start-match": {
      try {
        t.disabled = true;
        await startMatch(state);
        renderLiveMatch(state);
      } catch (err) {
        console.error(err);
        toast("Stockfish konnte nicht geladen werden. Siehe Konsole.", "bad");
        t.disabled = false;
      }
      break;
    }
    case "new-match": {
      const keepLeft  = state?.leftChampionId;
      const keepRight = state?.rightChampionId;
      state = createInitialState();
      if (keepLeft)  state.leftChampionId  = keepLeft;
      if (keepRight) state.rightChampionId = keepRight;
      saveState(state);
      renderTopbar(state);
      renderPreGame(state);
      break;
    }
    case "select-champion": {
      const side = t.dataset.side;
      const id = t.dataset.id;
      if (side === "left")  state.leftChampionId  = id;
      if (side === "right") state.rightChampionId = id;
      saveState(state);
      renderPreGame(state);
      break;
    }
    case "cast": {
      const id = t.dataset.id;
      if (id === "offerDraw") {
        const check = canCast(state, "offerDraw");
        if (!check.ok) { toast(check.reason, "warn"); return; }
        state.castLog["offerDraw"] = (state.castLog["offerDraw"] ?? 0) + 1;
        openModal(`<h3>Remis-Angebot...</h3><p class="dim">Wartet auf Entscheidung des Gegners.</p>`);
        try {
          const res = await offerDraw(state);
          closeModal();
          if (!res.accepted) {
            toast(`Remis abgelehnt (P ≈ ${Math.round((res.probability ?? 0) * 100)}%).`, "warn");
          }
        } catch (err) {
          closeModal();
          console.error(err);
        }
        patchLive(state);
        break;
      }
      const res = applyIntervention(state, id);
      if (!res.applied) { toast(res.reason ?? "nicht möglich", "warn"); break; }
      // Heat-Check nach Cast
      if (state.heat >= CONFIG.heatMax) {
        log(state, "Heat-Meter 100 erreicht. Disqualifikation!", "bad");
        import("./match.js").then(({ finishMatch }) => {
          finishMatch(state, { outcome: "dq", reason: "Heat-Meter maximal — Schiedsrichter schreitet ein." });
          renderTopbar(state);
          routeRender();
        });
        break;
      }
      saveState(state);
      patchLive(state);
      if (res.events.find((e) => e.type === "discovered")) {
        toast("Entdeckt! Heat deutlich gestiegen.", "bad");
      }
      break;
    }
  }
});

// Router
function routeRender() {
  if (!state) { renderPreGame(); return; }
  if (state.phase === "pregame") renderPreGame(state);
  else if (state.phase === "playing") renderLiveMatch(state);
  else if (state.phase === "finished") renderResult(state);
}

window.addEventListener("beforeunload", () => { stopMatch(); saveState(state); });
