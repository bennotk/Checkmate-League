// Reines UI-Rendering. Kein Schach-Logik-Zugriff ausser ueber match.js oder state.js.
//
// Rendering-Strategie: grobe Layouts per innerHTML, fuer Live-Updates greifen wir
// gezielt auf einzelne Knoten zu, damit Klicks nicht den Kontext verlieren.

import { CONFIG } from "./config.js";
import { effectiveSkills } from "./state.js";
import { canCast } from "./interventions.js";
import { getChess } from "./match.js";
import { getAllCharacters, getCharacterById } from "../src/game/characters.js";
import { buildStatusLine, getPositionAssessment } from "../src/game/match-status.js";
import { renderIsoBoardHTML, renderIsoBoardPlaceholder, bindIsoFullscreen } from "./iso-board.js";

function evalBarGeom(evalPawns) {
  const clamped = Math.max(-5, Math.min(5, evalPawns));
  const pct = Math.abs(clamped) / 5 * 50;
  const left = clamped >= 0 ? 50 : 50 - pct;
  const tone = getPositionAssessment(evalPawns).tone;
  const cls = tone.includes("bad") ? "bad" : tone === "neutral" ? "neutral" : "";
  const value = (evalPawns >= 0 ? "+" : "") + evalPawns.toFixed(1);
  return { left, width: pct, cls, value };
}

function buildStatusBarText(state) {
  const mn = Math.max(1, state.fullMoveNumber ?? 1);
  return buildStatusLine({ evalPawns: state.evalPawns ?? 0, moveNumber: mn });
}

function openingLineText(state) {
  if (state.openingName) return `${state.openingEco} — ${state.openingName}`;
  return "Eröffnung noch offen";
}

// mm:ss for a chess clock. Under 20 s we show one decimal so the final
// seconds feel like a real flag-fall.
function formatClock(ms) {
  if (ms == null || !isFinite(ms) || ms < 0) ms = 0;
  if (ms < 20000) {
    const s = ms / 1000;
    return `0:${s.toFixed(1).padStart(4, "0")}`;
  }
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Which clock belongs to the manager's side vs the opponent's side.
function managerClockMs(state) {
  return state.managerIsWhite ? state.whiteClockMs : state.blackClockMs;
}
function opponentClockMs(state) {
  return state.managerIsWhite ? state.blackClockMs : state.whiteClockMs;
}

// Which side is about to move next (based on move count since White starts).
function sideToMove(state) {
  return (state.movesSan?.length ?? 0) % 2 === 0 ? "w" : "b";
}
function clockCls(state, side) {
  const ms = side === "w" ? state.whiteClockMs : state.blackClockMs;
  if (ms <= 0) return "bad";
  if (ms < 30000) return "warn";
  return "";
}
function isThinking(state, side) {
  return state.phase === "playing" && sideToMove(state) === side;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

export function toast(text, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function openModal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").classList.remove("is-hidden");
}
export function closeModal() {
  $("#modal").classList.add("is-hidden");
  $("#modalContent").innerHTML = "";
}

// ---- Topbar ----
export function renderTopbar(state) {
  const phase = state?.phase ?? "pregame";
  const title = phase === "playing" ? `PARTIE LÄUFT · Zug ${state.myMovesMade + (phase === "playing" && state.lastMove?.color === "w" ? 0 : 0)}`
              : phase === "finished" ? "PARTIE BEENDET"
              : "CHECKMATE LEAGUE";
  $("#statClub").textContent = title;
  $("#statMoney").textContent = phase === "playing" ? `R:${state.resources} · H:${state.heat}` : "";
  $("#statDate").textContent = "";
  $$("#app .clock .pill").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.speed) === (state?.speed ?? 1));
    // Clock nur im Live-Match sinnvoll
    btn.disabled = phase !== "playing";
  });
  const nav = $("#mainNav");
  nav.innerHTML = `<span class="term-prompt">checkmate@manager:~$ <span class="blink">_</span></span>`;
}

// ---- Pre-Game ----
export function renderPreGame(state) {
  const leftId  = state?.leftChampionId  ?? getAllCharacters()[0].id;
  const rightId = state?.rightChampionId ?? getAllCharacters()[1]?.id ?? leftId;

  const cardHtml = (c, side, activeId) => `
    <button class="champion-card${c.id === activeId ? " is-active" : ""}"
            data-action="select-champion" data-side="${side}" data-id="${esc(c.id)}">
      <div class="champion-head">
        <span class="champion-name">${esc(c.name)}</span>
        <span class="champion-role">${esc(c.role)} · ${c.age}</span>
      </div>
      <div class="champion-stats">
        <span>OP ${c.stats.opening}</span>
        <span>MG ${c.stats.middlegame}</span>
        <span>EG ${c.stats.endgame}</span>
        <span>NRV ${c.stats.nerves}</span>
        <span>PRS ${c.stats.presence}</span>
        <span>LOY ${c.loyalty}</span>
      </div>
      <div class="champion-meta small dim">
        + ${esc(c.traits.join(", ") || "—")}<br/>
        − ${esc(c.flaws.join(", ") || "—")}
      </div>
    </button>`;

  const cards = getAllCharacters();
  const leftRow  = cards.map((c) => cardHtml(c, "left",  leftId)).join("");
  const rightRow = cards.map((c) => cardHtml(c, "right", rightId)).join("");

  $("#view").innerHTML = `
    <div class="term">
      <h1>♛ CHECKMATE LEAGUE</h1>
      <div class="dim">&gt; loading manager protocol v2.0 ...</div>
      <div class="dim">&gt; subject: single match, first prototype</div>
      <div class="hr"></div>
      <p>Du bist nicht der Schachspieler. Du bist sein <span class="hl">Manager</span>.</p>
      <p>Wähle deinen Champion und einen Gegner. Die Farbverteilung wird beim Start ausgelost.</p>

      <h3 class="section-title">Dein Spieler</h3>
      <div class="champion-cards">${leftRow}</div>

      <h3 class="section-title">Gegner</h3>
      <div class="champion-cards">${rightRow}</div>

      <div class="hr"></div>
      <div class="kv">
        <div>Skill-Modell</div><div>Champion-Stats × Phase (0..100 → Skill 0..20)</div>
        <div>Ressourcen</div><div>${CONFIG.startResources}</div>
        <div>Heat-Limit</div><div>${CONFIG.heatMax}</div>
      </div>
      <ul class="term-list">
        <li>Eröffnungs-/Mittelspiel-/Endspiel-Stat deines Champions steuert die Engine-Stärke in der jeweiligen Phase.</li>
        <li>Heat steigt bei jedem Eingriff. Bei ${CONFIG.heatMax} wirst du disqualifiziert.</li>
        <li>Ab Zug ${CONFIG.drawEarliestMove} kannst du ein Remis anbieten.</li>
      </ul>
      <div class="hr"></div>
      <button class="btn primary" data-action="start-match">[ START MATCH ]</button>
      <span class="dim small">&nbsp;&nbsp;(lädt Stockfish beim ersten Klick; kann einen Moment dauern)</span>
    </div>`;
}

// ---- Live Match ----
export function renderLiveMatch(state) {
  const skills = effectiveSkills(state);
  const heatPct = Math.min(100, state.heat);
  const heatCls = state.heat >= CONFIG.heatMax ? "bad" : state.heat >= CONFIG.heatWarnThreshold ? "warn" : "ok";
  const myChamp  = getCharacterById(state.leftChampionId);
  const oppChamp = getCharacterById(state.rightChampionId);
  const myName   = myChamp?.name  ?? "Mein Spieler";
  const oppName  = oppChamp?.name ?? "Gegner";
  const myColor  = state.managerIsWhite ? "Weiß" : "Schwarz";
  const oppColor = state.managerIsWhite ? "Schwarz" : "Weiß";
  const eb = evalBarGeom(state.evalPawns ?? 0);

  $("#view").innerHTML = `
    <div class="match-grid">
      <section class="panel player-panel">
        <h3>${esc(myName.toUpperCase())} · ${myColor}</h3>
        <div class="small dim">${esc(myChamp?.role ?? "")}</div>
        <div class="clock-display ${isThinking(state, state.managerIsWhite ? "w" : "b") ? "is-thinking" : ""}" id="pnMyClockBox">
          <span class="dim small">Bedenkzeit</span>
          <b class="clock-time ${clockCls(state, state.managerIsWhite ? "w" : "b")}" id="pnMyClock">${formatClock(managerClockMs(state))}</b>
        </div>
        <div class="stat"><span id="pnSkillLabel">Skill (${skills.phase})</span><b id="pnSkill">${skills.self}</b><span class="small dim">/20</span></div>
        <div class="stat"><span>Ressourcen</span><b id="pnRes">${state.resources}</b></div>
        <div class="stat"><span>Heat</span><b id="pnHeat" class="${heatCls}">${state.heat}</b></div>
        <div class="meter"><i id="pnHeatBar" class="${heatCls}" style="width:${heatPct}%"></i></div>
        <div class="hr"></div>
        <h3>AKTIVE EINGRIFFE</h3>
        <div id="pnBuffs">${renderBuffs(state)}</div>
      </section>

      <section class="board-panel">
        <div class="status-strip">
          <div class="status-line" id="pnStatusLine">${esc(buildStatusBarText(state))}</div>
          <div class="eval-bar">
            <div class="eval-bar-track">
              <div class="eval-bar-mid"></div>
              <div class="eval-bar-fill ${eb.cls}" id="pnEvalFill" style="left:${eb.left}%;width:${eb.width}%"></div>
            </div>
            <div class="eval-bar-label">
              <span>← Schwarz</span>
              <b id="pnEvalValue">${eb.value}</b>
              <span>Weiß →</span>
            </div>
          </div>
          <div class="opening-line" id="pnOpening">${esc(openingLineText(state))}</div>
        </div>
        <div class="match-head">
          <span class="dim small">Zug ${state.myMovesMade}</span>
          <span class="dim small">FEN</span>
          <span class="mono small" id="pnFen">${esc(state.fen)}</span>
        </div>
        <div class="iso-wrapper" id="pnIsoWrapper">
          <button class="iso-fs-btn" data-iso-fullscreen type="button">[ fullscreen ]</button>
          <div class="iso-mount" id="pnBoard">${renderIsoSceneHTML(state)}</div>
        </div>
        <div class="moves">
          <div class="dim small">Zug-Historie</div>
          <div id="pnMoves" class="mono">${renderMoveList(state)}</div>
        </div>
      </section>

      <section class="panel opp-panel">
        <h3>${esc(oppName.toUpperCase())} · ${oppColor}</h3>
        <div class="small dim">${esc(oppChamp?.role ?? "")}</div>
        <div class="clock-display ${isThinking(state, state.managerIsWhite ? "b" : "w") ? "is-thinking" : ""}" id="pnOppClockBox">
          <span class="dim small">Bedenkzeit</span>
          <b class="clock-time ${clockCls(state, state.managerIsWhite ? "b" : "w")}" id="pnOppClock">${formatClock(opponentClockMs(state))}</b>
        </div>
        <div class="stat"><span id="pnOppSkillLabel">Skill (${skills.phase})</span><b id="pnOppSkill">${skills.opponent}</b><span class="small dim">/20</span></div>
        <div class="stat"><span>Status</span><b id="pnOppStatus">${oppStatus(state)}</b></div>
        <div class="hr"></div>
        <h3>AKTIVE DEBUFFS</h3>
        <div id="pnOppBuffs">${renderOppDebuffs(state)}</div>
      </section>

      <section class="panel log-panel">
        <h3>PROTOKOLL</h3>
        <div id="pnLog" class="log">${renderLog(state)}</div>
      </section>

      <section class="panel intervention-panel">
        <h3>EINGRIFFE</h3>
        <div id="pnInterventions" class="interventions">${renderInterventions(state)}</div>
      </section>
    </div>`;

  bindIsoFullscreen(document.getElementById("pnIsoWrapper"));
}

function oppStatus(state) {
  const hasDebuff = state.buffs.some((b) => (b.opponentSkillDelta || 0) < 0);
  return hasDebuff ? "abgelenkt" : "fokussiert";
}

function renderBoardHTML(state) {
  const chess = getChess();
  if (!chess) {
    return `<div class="board-placeholder">&nbsp;</div>`;
  }
  return boardToHTML(chess.board(), state.lastMove);
}

// Isometric scene used in the live match. Falls back to the starting position
// layout if chess.js is not yet ready, so the tile system is always visible.
function renderIsoSceneHTML(state) {
  const chess = getChess();
  if (!chess) return renderIsoBoardPlaceholder();
  return renderIsoBoardHTML(chess.board(), state.lastMove);
}

const UNICODE = {
  wK:"♔", wQ:"♕", wR:"♖", wB:"♗", wN:"♘", wP:"♙",
  bK:"♚", bQ:"♛", bR:"♜", bB:"♝", bN:"♞", bP:"♟︎",
};

function boardToHTML(board, lastMove) {
  // Weiß unten: board liefert rank 8 zuerst (row 0) - passt als Default.
  let html = "";
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dark = (r + f) % 2 === 1;
      const p = board[r][f];
      const sqName = "abcdefgh"[f] + (8 - r);
      const hl = lastMove && (lastMove.from === sqName || lastMove.to === sqName) ? " hl" : "";
      const glyph = p ? UNICODE[(p.color === "w" ? "w" : "b") + p.type.toUpperCase()] : "";
      html += `<div class="sq ${dark ? "d" : "l"}${hl}" data-sq="${sqName}">${glyph}</div>`;
    }
  }
  return html;
}

function renderBuffs(state) {
  const my = state.buffs.filter((b) => (b.selfSkillDelta || 0) > 0);
  if (!my.length) return `<div class="dim small">keine aktiven Boosts</div>`;
  return my.map((b) =>
    `<div class="buff ok"><span>${esc(b.label)}</span><span class="small">+${b.selfSkillDelta} · ${b.remaining} Z.</span></div>`
  ).join("");
}

function renderOppDebuffs(state) {
  const opp = state.buffs.filter((b) => (b.opponentSkillDelta || 0) < 0);
  if (!opp.length) return `<div class="dim small">keine aktiven Debuffs</div>`;
  return opp.map((b) =>
    `<div class="buff bad"><span>${esc(b.label)}</span><span class="small">${b.opponentSkillDelta} · ${b.remaining} Z.</span></div>`
  ).join("");
}

function renderInterventions(state) {
  const ids = Object.keys(CONFIG.interventions);
  return ids.map((id) => {
    const def = CONFIG.interventions[id];
    const check = canCast(state, id);
    const disabled = !check.ok ? "disabled" : "";
    const note = check.ok ? "" : `<div class="small dim">${esc(check.reason)}</div>`;
    const effect = describeEffect(def);
    return `<button class="iv" data-action="cast" data-id="${id}" ${disabled}>
      <div class="iv-h"><span class="iv-label">${esc(def.label)}</span>
        <span class="iv-cost">${def.cost}R · +${def.heatAdd}H${def.discoverChance ? ` · ${Math.round(def.discoverChance*100)}%⚠` : ""}</span></div>
      <div class="iv-eff">${effect}</div>
      <div class="iv-desc small dim">${esc(def.desc)}</div>
      ${note}
    </button>`;
  }).join("");
}

function describeEffect(def) {
  const parts = [];
  if (def.selfSkillDelta) parts.push(`eigen Skill ${def.selfSkillDelta > 0 ? "+" : ""}${def.selfSkillDelta}`);
  if (def.opponentSkillDelta) parts.push(`Gegner Skill ${def.opponentSkillDelta > 0 ? "+" : ""}${def.opponentSkillDelta}`);
  if (def.opponentBlunderBonus) parts.push(`Gegner-Fehlerchance +${Math.round(def.opponentBlunderBonus * 100)}%-P.`);
  if (def.selfBlunderMul && def.selfBlunderMul !== 1) {
    const pct = Math.round((1 - def.selfBlunderMul) * 100);
    if (pct > 0) parts.push(`eigene Fehlerchance −${pct}%`);
  }
  if (def.durationMoves) parts.push(`für ${def.durationMoves} eigene Züge`);
  if (def.id === "offerDraw") parts.push("Gegner entscheidet nach Stellung");
  return parts.join(" · ") || "Sonderwirkung";
}

function renderMoveList(state) {
  const sans = state.movesSan;
  if (!sans.length) return `<span class="dim">—</span>`;
  const out = [];
  for (let i = 0; i < sans.length; i += 2) {
    const n = (i / 2 | 0) + 1;
    const w = sans[i] ?? "";
    const b = sans[i + 1] ?? "";
    out.push(`<span class="mv"><span class="mvn">${n}.</span> ${esc(w)}${b ? " " + esc(b) : ""}</span>`);
  }
  return out.join(" ");
}

function renderLog(state) {
  return state.log.slice(0, 40).map((e) =>
    `<div class="log-entry ${e.kind}"><span class="mono small dim">[${String(e.move).padStart(2, "0")}]</span> ${esc(e.text)}</div>`
  ).join("");
}

// --- Partial Updates ---
// So spart es Klickverlust + flackert weniger.

export function patchLive(state) {
  const skills = effectiveSkills(state);
  const heatPct = Math.min(100, state.heat);
  const heatCls = state.heat >= CONFIG.heatMax ? "bad" : state.heat >= CONFIG.heatWarnThreshold ? "warn" : "ok";
  const eb = evalBarGeom(state.evalPawns ?? 0);
  byId("pnSkill", (el) => el.textContent = skills.self);
  byId("pnOppSkill", (el) => el.textContent = skills.opponent);
  byId("pnSkillLabel", (el) => el.textContent = `Skill (${skills.phase})`);
  byId("pnOppSkillLabel", (el) => el.textContent = `Skill (${skills.phase})`);
  byId("pnRes", (el) => el.textContent = state.resources);
  byId("pnHeat", (el) => { el.textContent = state.heat; el.className = heatCls; });
  byId("pnHeatBar", (el) => { el.style.width = `${heatPct}%`; el.className = heatCls; });
  byId("pnBuffs", (el) => el.innerHTML = renderBuffs(state));
  byId("pnOppBuffs", (el) => el.innerHTML = renderOppDebuffs(state));
  byId("pnOppStatus", (el) => el.textContent = oppStatus(state));
  byId("pnFen", (el) => el.textContent = state.fen);
  byId("pnMoves", (el) => el.innerHTML = renderMoveList(state));
  byId("pnLog", (el) => el.innerHTML = renderLog(state));
  byId("pnBoard", (el) => el.innerHTML = renderIsoSceneHTML(state));
  byId("pnInterventions", (el) => el.innerHTML = renderInterventions(state));
  byId("pnStatusLine", (el) => el.textContent = buildStatusBarText(state));
  byId("pnMyClock", (el) => {
    el.textContent = formatClock(managerClockMs(state));
    el.className = "clock-time " + clockCls(state, state.managerIsWhite ? "w" : "b");
  });
  byId("pnOppClock", (el) => {
    el.textContent = formatClock(opponentClockMs(state));
    el.className = "clock-time " + clockCls(state, state.managerIsWhite ? "b" : "w");
  });
  byId("pnMyClockBox", (el) => el.classList.toggle("is-thinking",
    isThinking(state, state.managerIsWhite ? "w" : "b")));
  byId("pnOppClockBox", (el) => el.classList.toggle("is-thinking",
    isThinking(state, state.managerIsWhite ? "b" : "w")));
  byId("pnEvalFill", (el) => {
    el.style.left = eb.left + "%";
    el.style.width = eb.width + "%";
    el.className = "eval-bar-fill " + eb.cls;
  });
  byId("pnEvalValue", (el) => el.textContent = eb.value);
  byId("pnOpening", (el) => el.textContent = openingLineText(state));
}
function byId(id, fn) { const el = document.getElementById(id); if (el) fn(el); }

// ---- Result Screen ----
export function renderResult(state) {
  const r = state.result ?? { outcome: "draw", reason: "" };
  const colorCls = r.outcome === "win" ? "ok" : r.outcome === "draw" ? "warn" : "bad";
  const label = {
    win: "★ GEWONNEN",
    loss: "✗ VERLOREN",
    draw: "◇ REMIS",
    dq:   "!!! DISQUALIFIZIERT",
  }[r.outcome] ?? r.outcome;

  $("#view").innerHTML = `
    <div class="term center">
      <div class="huge ${colorCls}">${label}</div>
      <div class="dim">${esc(r.reason)}</div>
      <div class="hr"></div>
      <div class="kv">
        <div>Züge gespielt</div><div>${state.myMovesMade + (state.movesSan.length - state.myMovesMade)}</div>
        <div>Ressourcen übrig</div><div>${state.resources} / ${CONFIG.startResources}</div>
        <div>End-Heat</div><div>${state.heat} / ${CONFIG.heatMax}</div>
        <div>Interventionen</div><div>${Object.entries(state.castLog).map(([k,v]) => `${k}×${v}`).join(", ") || "—"}</div>
      </div>
      <div class="hr"></div>
      <h3>Zug-Historie</h3>
      <div class="mono log-history">${renderMoveList(state)}</div>
      <div class="hr"></div>
      <button class="btn primary" data-action="new-match">[ NEUE PARTIE ]</button>
    </div>`;
}
