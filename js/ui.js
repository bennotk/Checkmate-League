// UI-Rendering: alle Views als Strings, einfache Event-Delegation.
// DOM-Updates minimalistisch; bei View-Wechsel wird #view komplett neu gerendert.

import { BOARDS_PER_TEAM, LEAGUES, SEASON_ROUNDS } from "./data.js";
import {
  getMyTeam, getLeague, getPlayer, teamAvgRating, log, marketValue,
  saveGame, deleteSave
} from "./state.js";
import { leagueStandings, getFixturesForRound } from "./season.js";
import { listMarket, tryBuy, trySell, scout, askingPrice } from "./transfer.js";

// --------- util ---------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const euro = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));

export function toast(text, kind = "ok") {
  const box = document.createElement("div");
  box.className = `toast ${kind}`;
  box.textContent = text;
  $("#toasts").appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

export function openModal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").classList.remove("is-hidden");
}
export function closeModal() { $("#modal").classList.add("is-hidden"); $("#modalContent").innerHTML = ""; }

// --------- Top bar ---------
export function renderTopbar(state) {
  const me = getMyTeam(state);
  $("#statClub").textContent = me ? me.name : "—";
  $("#statMoney").textContent = me ? euro(me.cash) : "—";
  $("#statDate").textContent = state ? `Saison ${state.year} · Spieltag ${Math.min(state.pendingMatchday + 1, SEASON_ROUNDS)}/${SEASON_ROUNDS}` : "—";
  // Speed pills
  $$("#app .clock .pill").forEach(btn => {
    btn.classList.toggle("is-active", Number(btn.dataset.speed) === (state?.speed ?? 1));
  });
  // Nav
  const nav = $("#mainNav");
  const active = state?.view ?? "dashboard";
  const items = [
    ["dashboard", "Übersicht"],
    ["squad", "Kader"],
    ["match", "Spieltag"],
    ["league", "Tabelle"],
    ["transfers", "Transfers"],
    ["news", "Nachrichten"],
  ];
  nav.innerHTML = items.map(([id, label]) =>
    `<button data-view="${id}" class="${active === id ? "is-active" : ""}">${label}</button>`
  ).join("");
}

// --------- Dashboard ---------
export function renderDashboard(state) {
  const me = getMyTeam(state);
  const L = getLeague(state, me.leagueId);
  const standings = leagueStandings(state, me.leagueId);
  const pos = standings.findIndex(t => t.id === me.id) + 1;
  const upcomingRound = state.pendingMatchday;
  const pair = L.schedule[upcomingRound]?.find(p => p.includes(me.id));
  const opp = pair ? state.teams[pair[0] === me.id ? pair[1] : pair[0]] : null;
  const isHome = pair && pair[0] === me.id;

  const recentNews = state.news.slice(0, 6).map(n =>
    `<div class="news-item"><span class="t">S${n.year} T${n.day}</span>${esc(n.text)}</div>`
  ).join("") || `<div class="small dim">Noch keine Nachrichten.</div>`;

  $("#view").innerHTML = `
  <div class="grid two-thirds">
    <div class="panel">
      <div class="spread">
        <div>
          <h2>${esc(me.name)} <span class="small dim">${esc(L.name)}</span></h2>
          <div class="small">Manager: <span class="hl">${esc(me.manager ?? "Manager")}</span> · Tabellenplatz: <b>${pos}</b>/${L.teamIds.length}</div>
        </div>
        <div class="row">
          <span class="tag">Ø Elo ${teamAvgRating(me, true)}</span>
          <span class="tag">Kader ${me.players.length}</span>
          <span class="tag">Taktik: ${tacticName(me.tactic)}</span>
        </div>
      </div>
      <div class="hr"></div>
      <div class="grid cols-3">
        <div>
          <h3>Nächstes Spiel</h3>
          ${opp ? `
            <div class="spread">
              <div>
                <div><b>${esc(me.name)}</b> ${isHome ? "(H)" : "(A)"} vs ${esc(opp.name)}</div>
                <div class="small dim">Runde ${upcomingRound + 1} · Ø Elo Gegner ${teamAvgRating(opp, true)}</div>
              </div>
              <button class="btn primary" data-action="goto-match">Zum Spieltag</button>
            </div>
          ` : `<div class="small dim">Keine Partie geplant.</div>`}
        </div>
        <div>
          <h3>Finanzen</h3>
          <div>Kasse: <b>${euro(me.cash)}</b></div>
          <div class="small">Wöchentliche Gehälter: ${euro(me.players.reduce((s,p)=>s+(p.wage||0),0))}</div>
          <div class="small">Fans: ${me.fans.toLocaleString("de-DE")}</div>
        </div>
        <div>
          <h3>Aktionen</h3>
          <div class="row">
            <button class="btn" data-action="save">Speichern</button>
            <button class="btn danger" data-action="reset" title="Komplett neu starten">Neu beginnen</button>
          </div>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>Nachrichten</h2>
      ${recentNews}
      <div class="hr"></div>
      <button class="btn ghost" data-action="goto-news">Alle Nachrichten</button>
    </div>
  </div>
  <div class="grid cols-2" style="margin-top:14px;">
    <div class="panel">
      <h2>Top der ${esc(L.name)}</h2>
      ${renderStandingsTable(state, me.leagueId, 5)}
    </div>
    <div class="panel">
      <h2>Eure Top-Bretter</h2>
      <table class="ct">
        <thead><tr><th>#</th><th>Name</th><th class="num">Elo</th><th class="num">Form</th><th class="num">Kraft</th><th>Status</th></tr></thead>
        <tbody>
          ${me.lineup.slice(0, BOARDS_PER_TEAM).map((pid, i) => {
            const p = getPlayer(me, pid); if (!p) return "";
            return `<tr>
              <td class="hl">${i+1}</td>
              <td>${esc(p.name)}</td>
              <td class="num">${p.rating}</td>
              <td class="num">${bar(p.form)}</td>
              <td class="num">${bar(p.stamina)}</td>
              <td>${playerStatusTags(p)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>
  `;
}

function tacticName(t) {
  return t === "aggressive" ? "Angriff" : t === "defensive" ? "Verteidigung" : "Ausgewogen";
}

function bar(v) {
  const pct = Math.max(0, Math.min(100, v));
  return `<span class="bar"><i style="width:${pct}%"></i></span> <span class="small">${Math.round(pct)}</span>`;
}

function playerStatusTags(p) {
  const tags = [];
  if (p.injury > 0) tags.push(`<span class="tag bad">verletzt ${p.injury}</span>`);
  if (p.banned > 0) tags.push(`<span class="tag bad">gesperrt ${p.banned}</span>`);
  if (p.yellow > 0) tags.push(`<span class="tag warn">${p.yellow}× gelb</span>`);
  if (!tags.length) tags.push(`<span class="tag ok">fit</span>`);
  return tags.join(" ");
}

// --------- Standings ---------
export function renderStandingsTable(state, leagueId, limit = null) {
  const standings = leagueStandings(state, leagueId);
  const rows = standings.slice(0, limit ?? standings.length).map((t, i) => {
    const s = t.seasonStats;
    return `<tr class="${t.isPlayer ? "me" : ""}">
      <td>${i+1}</td>
      <td>${esc(t.name)}</td>
      <td class="num">${s.played}</td>
      <td class="num">${s.w}-${s.d}-${s.l}</td>
      <td class="num">${s.bp.toFixed(1)}:${s.bpAgainst.toFixed(1)}</td>
      <td class="num"><b>${s.pts}</b></td>
    </tr>`;
  }).join("");
  return `<table class="ct">
    <thead><tr><th>#</th><th>Verein</th><th class="num">Sp</th><th class="num">S-U-N</th><th class="num">Brettpunkte</th><th class="num">Pkt</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderLeagueView(state) {
  const me = getMyTeam(state);
  const tabs = state.leagues.map(L =>
    `<button class="btn ${state.leagueTab === L.id ? "primary" : ""}" data-league-tab="${L.id}">${esc(L.name)}</button>`
  ).join(" ");
  const activeLeague = state.leagueTab ?? me.leagueId;
  $("#view").innerHTML = `
    <div class="panel">
      <div class="row">${tabs}</div>
      <div class="hr"></div>
      ${renderStandingsTable(state, activeLeague)}
      <div class="hr"></div>
      <h3>Paarungen nächste Runde (${(state.pendingMatchday ?? 0) + 1}/${SEASON_ROUNDS})</h3>
      ${renderFixturesForLeague(state, activeLeague)}
    </div>`;
}

function renderFixturesForLeague(state, leagueId) {
  const L = state.leagues[leagueId];
  const round = state.pendingMatchday ?? 0;
  const pairs = L.schedule[round] || [];
  if (!pairs.length) return `<div class="small dim">Keine weiteren Spiele diese Saison.</div>`;
  return `<table class="ct"><tbody>${pairs.map(([h,a]) => {
    const ht = state.teams[h], at = state.teams[a];
    return `<tr><td>${esc(ht.name)}</td><td class="num">vs</td><td>${esc(at.name)}</td></tr>`;
  }).join("")}</tbody></table>`;
}

// --------- Squad ---------
export function renderSquadView(state) {
  const me = getMyTeam(state);
  const lineupIds = me.lineup.slice(0, BOARDS_PER_TEAM);
  const reserves = me.players.filter(p => !lineupIds.includes(p.id));

  $("#view").innerHTML = `
  <div class="grid cols-2">
    <div class="panel">
      <div class="spread">
        <h2>Aufstellung</h2>
        <div class="row">
          <label class="small dim">Mannschaftstaktik</label>
          <select data-action="set-tactic">
            <option value="aggressive" ${me.tactic==="aggressive"?"selected":""}>Angriff</option>
            <option value="balanced" ${me.tactic==="balanced"?"selected":""}>Ausgewogen</option>
            <option value="defensive" ${me.tactic==="defensive"?"selected":""}>Verteidigung</option>
          </select>
        </div>
      </div>
      <div class="lineup">
        ${lineupIds.map((pid, i) => {
          const p = getPlayer(me, pid); if (!p) return "";
          return `<div class="row" data-row="${i}" style="display:grid;grid-template-columns:32px 1fr auto auto;gap:8px;align-items:center;padding:6px 8px;background:var(--panel-2);border:1px solid var(--line);border-radius:8px;">
            <div class="bno">${i+1}</div>
            <div>
              <div class="nm">${esc(p.name)}</div>
              <div class="small dim">Elo ${p.rating} · ${styleName(p.style)} · ${p.age}J · ${playerStatusTags(p)}</div>
            </div>
            <div class="mv">
              <button class="btn ghost" data-action="move-up" data-idx="${i}">↑</button>
              <button class="btn ghost" data-action="move-down" data-idx="${i}">↓</button>
            </div>
            <div class="row">
              <button class="btn ghost" data-action="bench" data-pid="${p.id}">Bank</button>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
    <div class="panel">
      <h2>Reservebank (${reserves.length})</h2>
      <table class="ct">
        <thead><tr><th>Name</th><th class="num">Elo</th><th class="num">Alter</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${reserves.sort((a,b)=>b.rating-a.rating).map(p => `
          <tr>
            <td>${esc(p.name)}<div class="small dim">${styleName(p.style)} · Gehalt ${euro(p.wage)}</div></td>
            <td class="num">${p.rating}</td>
            <td class="num">${p.age}</td>
            <td>${playerStatusTags(p)}</td>
            <td class="num"><button class="btn" data-action="start" data-pid="${p.id}">Einsetzen</button>
            <button class="btn ghost" data-action="sell" data-pid="${p.id}">Verkaufen (${euro(Math.round(marketValue(p)*0.9))})</button></td>
          </tr>
        `).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function styleName(s) { return s === "aggressive" ? "aggressiv" : s === "defensive" ? "solide" : "ausgewogen"; }

// --------- Transfers ---------
export function renderTransfersView(state) {
  const me = getMyTeam(state);
  const market = listMarket(state).sort((a, b) => b.player.rating - a.player.rating);

  $("#view").innerHTML = `
    <div class="panel">
      <div class="spread">
        <h2>Transfermarkt</h2>
        <div class="row">
          <span class="tag ${state.transferWindow ? "ok":"bad"}">Fenster: ${state.transferWindow ? "offen" : "geschlossen"}</span>
          <span class="tag">Kasse ${euro(me.cash)}</span>
        </div>
      </div>
      <div class="hr"></div>
      <h3>Scouting</h3>
      <div class="row small">
        Einen neuen Spieler entdecken (als Free Agent):
        <button class="btn" data-action="scout" data-league="3">Amateur (5.000€)</button>
        <button class="btn" data-action="scout" data-league="2">Meister (10.000€)</button>
        <button class="btn" data-action="scout" data-league="1">Großmeister (25.000€)</button>
        <button class="btn" data-action="scout" data-league="0">Königsliga (80.000€)</button>
      </div>
      <div class="hr"></div>
      <h3>Angebote (${market.length})</h3>
      <table class="ct">
        <thead><tr><th>Name</th><th class="num">Elo</th><th class="num">Pot.</th><th class="num">Alter</th><th>Stil</th><th>Verein</th><th class="num">Preis</th><th></th></tr></thead>
        <tbody>
          ${market.slice(0, 60).map((o, idx) => `
            <tr>
              <td>${esc(o.player.name)}</td>
              <td class="num">${o.player.rating}</td>
              <td class="num small dim">${o.player.potential ?? "—"}</td>
              <td class="num">${o.player.age}</td>
              <td>${styleName(o.player.style)}</td>
              <td class="small dim">${o.isFree ? "Free Agent" : esc(state.teams[o.fromTeamId]?.name ?? "—")}</td>
              <td class="num">${euro(o.ask)}</td>
              <td class="num">${state.transferWindow
                ? `<button class="btn primary" data-action="buy" data-idx="${idx}">Kaufen</button>`
                : `<span class="small dim">geschlossen</span>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="panel" style="margin-top:14px;">
      <h2>Eigener Kader</h2>
      <table class="ct">
        <thead><tr><th>Name</th><th class="num">Elo</th><th class="num">Alter</th><th class="num">Vertrag</th><th class="num">Marktwert</th><th></th></tr></thead>
        <tbody>
          ${[...me.players].sort((a,b)=>b.rating-a.rating).map(p => `
            <tr>
              <td>${esc(p.name)}</td>
              <td class="num">${p.rating}</td>
              <td class="num">${p.age}</td>
              <td class="num">${p.contractYears ?? 1}J</td>
              <td class="num">${euro(marketValue(p))}</td>
              <td class="num">${state.transferWindow
                ? `<button class="btn ghost" data-action="sell" data-pid="${p.id}">Verkaufen</button>`
                : `<span class="small dim">Fenster zu</span>`}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

// --------- News ---------
export function renderNewsView(state) {
  $("#view").innerHTML = `
    <div class="panel">
      <h2>Nachrichten</h2>
      ${state.news.length === 0 ? `<div class="small dim">Nichts zu berichten.</div>` :
        state.news.map(n => `<div class="news-item"><span class="t">S${n.year} T${n.day}</span>${esc(n.text)}</div>`).join("")}
    </div>`;
}

// --------- Match View ---------
// Bretter + Live-Schach wird vom Spielloop aktualisiert.
export function renderMatchSkeleton(state, matchCtx) {
  const me = getMyTeam(state);
  const L = getLeague(state, me.leagueId);
  const round = state.pendingMatchday;
  const pair = L.schedule[round]?.find(p => p.includes(me.id));
  if (!pair) {
    $("#view").innerHTML = `<div class="panel"><h2>Saison beendet</h2>
      <p>Keine Partie mehr geplant. Drücke <b>Saison abschließen</b> um Preisgelder und Auf-/Abstieg zu verrechnen.</p>
      <button class="btn primary" data-action="end-season">Saison abschließen</button></div>`;
    return;
  }
  const opp = state.teams[pair[0] === me.id ? pair[1] : pair[0]];
  const isHome = pair[0] === me.id;

  $("#view").innerHTML = `
    <div class="panel">
      <div class="spread">
        <h2>${esc(me.name)} ${isHome ? "vs" : "@"} ${esc(opp.name)}</h2>
        <div class="row">
          <span class="tag">Runde ${round+1}/${SEASON_ROUNDS}</span>
          <span class="tag rat">Ø ${teamAvgRating(me, true)} vs ${teamAvgRating(opp, true)}</span>
          ${matchCtx
            ? `<span class="tag" id="mdScore">0 : 0</span>`
            : `<button class="btn primary" data-action="kickoff">Anpfiff</button>`}
        </div>
      </div>
      <div class="small dim">Anpfiff zeigt alle ${BOARDS_PER_TEAM} Bretter live. Dein Match wird mit echter Schachlogik gespielt; alle anderen Begegnungen werden parallel simuliert.</div>
      ${matchCtx ? `
        <div class="hr"></div>
        <div class="row">
          <button class="btn" data-action="use-var" data-board="1">Video-Referee (Brett 1)</button>
          <button class="btn" data-action="use-var" data-board="2">VAR (Brett 2)</button>
          <button class="btn" data-action="use-var" data-board="3">VAR (Brett 3)</button>
          <button class="btn" data-action="use-var" data-board="4">VAR (Brett 4)</button>
          <button class="btn" data-action="use-var" data-board="5">VAR (Brett 5)</button>
          <button class="btn ghost" data-action="finish-match">Rest simulieren</button>
        </div>
        <div class="hr"></div>
        <div class="boards" id="liveBoards">
          ${matchCtx.boards.map(b => renderBoardCard(b, me)).join("")}
        </div>
      ` : `
        <div class="hr"></div>
        <div class="grid cols-2">
          <div>
            <h3>Eure Aufstellung</h3>
            ${renderTeamLineupTable(me)}
          </div>
          <div>
            <h3>Gegner</h3>
            ${renderTeamLineupTable(opp)}
          </div>
        </div>
      `}
    </div>`;
}

function renderTeamLineupTable(team) {
  const rows = team.lineup.slice(0, BOARDS_PER_TEAM).map((pid, i) => {
    const p = team.players.find(x => x.id === pid); if (!p) return "";
    return `<tr><td>${i+1}</td><td>${esc(p.name)}</td><td class="num">${p.rating}</td><td>${styleName(p.style)}</td></tr>`;
  }).join("");
  return `<table class="ct"><thead><tr><th>Brett</th><th>Name</th><th class="num">Elo</th><th>Stil</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderBoardCard(board, myTeam) {
  // myTeam ist Spielerteam (kann aber auch away sein, egal fuer Anzeige)
  return `
    <div class="board-card" data-board="${board.boardNo}">
      <div class="hd">
        <div class="opp">B${board.boardNo}: ♔ ${esc(board.white?.name ?? "—")} <span class="small dim">${board.white?.rating ?? ""}</span></div>
        <div class="result ${resultClass(board)}">${esc(board.resultText ?? "…")}</div>
      </div>
      <div class="chessboard" data-cb="${board.boardNo}">${renderChessBoardHTML(board.chess, board.lastMove)}</div>
      <div class="hd" style="margin-top:6px;">
        <div class="opp">♚ ${esc(board.black?.name ?? "—")} <span class="small dim">${board.black?.rating ?? ""}</span></div>
        <div class="small dim">Züge: <span data-moves="${board.boardNo}">${board.moves.length}</span></div>
      </div>
    </div>`;
}

function resultClass(b) {
  if (!b.done) return "";
  if (b.wScore === 1 || b.bScore === 1) return (b.wScore === 1) ? "win" : "loss";
  return "draw";
}

const UNICODE_PIECES = {
  wK:"♔", wQ:"♕", wR:"♖", wB:"♗", wN:"♘", wP:"♙",
  bK:"♚", bQ:"♛", bR:"♜", bB:"♝", bN:"♞", bP:"♟︎",
};

export function renderChessBoardHTML(chess, lastMove) {
  const b = chess.board();
  let html = "";
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dark = (r + f) % 2 === 1;
      const p = b[r][f];
      const sqName = "abcdefgh"[f] + (8 - r);
      const hl = lastMove && (lastMove.from === sqName || lastMove.to === sqName) ? " hl" : "";
      const glyph = p ? UNICODE_PIECES[(p.color === "w" ? "w" : "b") + p.type.toUpperCase()] : "";
      html += `<div class="sq ${dark ? "d" : "l"}${hl}">${glyph}</div>`;
    }
  }
  return html;
}

export function updateBoardCardDOM(board) {
  const root = document.querySelector(`.board-card[data-board="${board.boardNo}"]`);
  if (!root) return;
  const cb = root.querySelector(".chessboard");
  if (cb) cb.innerHTML = renderChessBoardHTML(board.chess, board.lastMove);
  const mv = root.querySelector(`[data-moves="${board.boardNo}"]`);
  if (mv) mv.textContent = board.moves.length;
  const res = root.querySelector(".result");
  if (res) { res.textContent = board.resultText ?? "…"; res.className = `result ${resultClass(board)}`; }
}

export function updateScore(homePts, awayPts) {
  const el = document.getElementById("mdScore");
  if (el) el.textContent = `${fmtPts(homePts)} : ${fmtPts(awayPts)}`;
}
function fmtPts(p) { return Number.isInteger(p) ? p.toFixed(1) : p.toFixed(1); }

// --------- Start screen ---------
export function renderStartScreen() {
  $("#view").innerHTML = `
    <div class="start">
      <h1><span class="hl">♛</span> Checkmate League</h1>
      <p class="dim">Ein Idle-Manager-Spiel rund um echtes Schach. Recrutiere Spieler, feile an Taktik, kletter die Ligapyramide hinauf.</p>
      <div class="tag-row">
        <span class="tag">4 Ligen</span>
        <span class="tag">Mannschaftsschach (5 Bretter)</span>
        <span class="tag">Transfermarkt</span>
        <span class="tag">VAR, Gelbe Karten, Verletzungen</span>
      </div>
      <div class="panel" style="text-align:left;">
        <div class="field"><label>Manager-Name</label><input id="fldManager" value="Trainer Fischer" /></div>
        <div class="field"><label>Vereinsname</label><input id="fldClub" placeholder="z. B. SC Bauernopfer" /></div>
        <div class="field"><label>Start-Liga</label>
          <select id="fldLeague">
            <option value="3" selected>Amateur-Liga (Anfänger)</option>
            <option value="2">Meister-Liga (Profi)</option>
            <option value="1">Großmeister-Liga (Hart)</option>
            <option value="0">Königsliga (Brutal)</option>
          </select>
        </div>
        <div class="field"><label>Seed (optional)</label><input id="fldSeed" placeholder="leer für Zufall" /></div>
        <div class="row" style="margin-top:12px;">
          <button class="btn primary" data-action="new-game">Spiel starten</button>
          ${localStorage.getItem("checkmate-league-save-v1") ? `<button class="btn" data-action="load-game">Speicherstand laden</button>` : ""}
        </div>
      </div>
    </div>`;
}
