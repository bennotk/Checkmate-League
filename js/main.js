// Bootstrap: State laden oder Start-Screen zeigen, Events verkabeln, Idle-Tick.

import {
  createNewGame, loadGame, saveGame, hasSave, deleteSave,
  getMyTeam, log, getLeague
} from "./state.js";
import {
  renderTopbar, renderDashboard, renderStartScreen, renderLeagueView,
  renderSquadView, renderTransfersView, renderNewsView, renderMatchSkeleton,
  renderBoardCard, updateBoardCardDOM, updateScore, toast, openModal, closeModal
} from "./ui.js";
import { BOARDS_PER_TEAM, SEASON_ROUNDS } from "./data.js";
import { commitMatchday, endSeason, leagueStandings } from "./season.js";
import { createLiveMatch, applyMatchResult } from "./match.js";
import { tryBuy, trySell, scout, listMarket } from "./transfer.js";

let state = null;
let liveMatch = null;      // laeuft ein Live-Match
let liveTimer = null;
let view = "dashboard";

// ---- Boot ----
if (hasSave()) {
  // Versuche direkt zu laden + letzte View anzeigen
  const saved = loadGame();
  if (saved && saved.version) {
    state = saved;
    state.view = state.view ?? "dashboard";
    view = state.view;
    render();
  } else {
    renderStartScreen();
  }
} else {
  renderStartScreen();
}
renderTopbar(state);

// ---- Events ----
document.addEventListener("click", onClick);
document.addEventListener("change", onChange);
window.addEventListener("beforeunload", () => { if (state) saveGame(state); });

// Idle loop: 1 tick pro 500ms bei speed=1, haeufiger bei hoeheren Speeds.
setInterval(idleTick, 250);

function idleTick() {
  if (!state) return;
  if (state.speed === 0) return;
  // Live-Match hat eigenes Tempo (getickt in liveLoop).
  if (liveMatch) return;
}

function onChange(e) {
  const el = e.target;
  if (!el) return;
  if (el.matches("[data-action=set-tactic]")) {
    const me = getMyTeam(state);
    me.tactic = el.value;
    save();
    toast(`Taktik gesetzt: ${el.value}`);
  }
}

function onClick(e) {
  const t = e.target.closest("[data-action], [data-view], [data-league-tab], [data-speed], [data-modal-close]");
  if (!t) return;

  // Modal schliessen
  if (t.matches("[data-modal-close]")) { closeModal(); return; }

  // Speed
  if (t.dataset.speed != null) {
    state.speed = Number(t.dataset.speed);
    renderTopbar(state);
    save();
    return;
  }

  // Nav
  if (t.dataset.view) {
    view = t.dataset.view;
    state.view = view;
    if (view !== "match") { stopLiveMatch(); }
    render();
    return;
  }

  // League tabs
  if (t.dataset.leagueTab != null) {
    state.leagueTab = Number(t.dataset.leagueTab);
    render();
    return;
  }

  const action = t.dataset.action;
  switch (action) {
    case "new-game": startNewGame(); break;
    case "load-game": {
      const saved = loadGame();
      if (saved) { state = saved; state.view = state.view ?? "dashboard"; view = state.view; render(); }
      else toast("Kein Speicherstand gefunden.", "bad");
      break;
    }
    case "save": { save(); toast("Gespeichert.", "ok"); break; }
    case "reset": {
      if (confirm("Speicherstand loeschen und neu starten?")) {
        deleteSave();
        state = null; liveMatch = null;
        renderStartScreen(); renderTopbar(null);
      }
      break;
    }
    case "goto-match": view = "match"; state.view = view; render(); break;
    case "goto-news":  view = "news";  state.view = view; render(); break;
    case "kickoff":    kickoff(); break;
    case "finish-match": finishLiveNow(); break;
    case "use-var": {
      const bn = Number(t.dataset.board);
      if (liveMatch && liveMatch.useVAR(bn)) toast(`Video-Referee bei Brett ${bn} eingesetzt.`, "ok");
      else toast(`VAR bei Brett ${bn} nicht möglich.`, "warn");
      break;
    }
    case "end-season": finalizeSeason(); break;

    // Squad
    case "move-up": moveLineup(Number(t.dataset.idx), -1); break;
    case "move-down": moveLineup(Number(t.dataset.idx), +1); break;
    case "bench": benchPlayer(t.dataset.pid); break;
    case "start": startPlayer(t.dataset.pid); break;
    case "sell": handleSell(t.dataset.pid); break;

    // Transfers
    case "buy": handleBuy(Number(t.dataset.idx)); break;
    case "scout": { scout(state, Number(t.dataset.league)); save(); render(); break; }
  }
}

function startNewGame() {
  const manager = document.getElementById("fldManager").value.trim() || "Manager";
  const club = document.getElementById("fldClub").value.trim() || "Neuer Verein";
  const league = Number(document.getElementById("fldLeague").value);
  const seedRaw = document.getElementById("fldSeed").value.trim();
  const seed = seedRaw ? (Number(seedRaw) || hashString(seedRaw)) : Math.floor(Math.random() * 1e9);
  state = createNewGame({ seed, startLeague: league, managerName: manager, clubName: club });
  state.view = "dashboard"; view = "dashboard";
  save();
  render();
}

function hashString(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

function save() { saveGame(state); }

// ---- Render Router ----
function render() {
  renderTopbar(state);
  if (!state) return;
  const v = state.view ?? view;
  if (v === "dashboard") renderDashboard(state);
  else if (v === "squad") renderSquadView(state);
  else if (v === "league") renderLeagueView(state);
  else if (v === "transfers") renderTransfersView(state);
  else if (v === "news") renderNewsView(state);
  else if (v === "match") {
    if (liveMatch) renderMatchSkeleton(state, liveMatch);
    else renderMatchSkeleton(state, null);
  }
}

// ---- Lineup ----
function moveLineup(idx, delta) {
  const me = getMyTeam(state);
  const j = idx + delta;
  if (j < 0 || j >= BOARDS_PER_TEAM) return;
  const a = me.lineup[idx], b = me.lineup[j];
  me.lineup[idx] = b; me.lineup[j] = a;
  save(); render();
}
function benchPlayer(pid) {
  const me = getMyTeam(state);
  // ersetze in lineup durch ersten verfuegbaren Reservisten
  const idx = me.lineup.indexOf(pid);
  if (idx === -1) return;
  const reserve = me.players
    .filter(p => !me.lineup.includes(p.id) && p.injury === 0 && p.banned === 0)
    .sort((a,b)=>b.rating-a.rating)[0];
  if (!reserve) { toast("Keine Reserve verfügbar.", "warn"); return; }
  me.lineup[idx] = reserve.id;
  save(); render();
}
function startPlayer(pid) {
  const me = getMyTeam(state);
  // Wenn in Reserve: tausche mit schwächstem Brett
  const p = me.players.find(x => x.id === pid); if (!p) return;
  if (p.injury > 0 || p.banned > 0) { toast("Spieler nicht einsatzfähig.", "warn"); return; }
  const weakestIdx = me.lineup.reduce((acc, id, i) => {
    const pp = me.players.find(x => x.id === id);
    if (!pp) return acc;
    if (!acc || pp.rating < acc.r) return { i, r: pp.rating };
    return acc;
  }, null);
  if (!weakestIdx) return;
  me.lineup[weakestIdx.i] = pid;
  save(); render();
}

// ---- Match ----
function kickoff() {
  const me = getMyTeam(state);
  const L = getLeague(state, me.leagueId);
  const round = state.pendingMatchday;
  const pair = L.schedule[round]?.find(p => p.includes(me.id));
  if (!pair) { toast("Kein Spiel heute.", "warn"); return; }
  // Aufstellung auf Verletzte/Gesperrte pruefen
  const badIdx = me.lineup.findIndex(id => {
    const p = me.players.find(x => x.id === id);
    return !p || p.injury > 0 || p.banned > 0;
  });
  if (badIdx >= 0) { toast("Mindestens ein Aufstellungsspieler nicht einsatzfähig. Kader anpassen.", "bad"); return; }

  const homeId = pair[0], awayId = pair[1];
  const home = state.teams[homeId], away = state.teams[awayId];
  liveMatch = createLiveMatch(home, away, { seed: state.seed + state.year * 131 + round * 11 });
  // Re-render mit skeleton-Live
  render();
  updateScore(0, 0);

  // Live loop
  const tickMs = () => ({ 0: 99999, 1: 650, 4: 220, 16: 70 }[state.speed] ?? 650);
  function step() {
    if (!liveMatch) return;
    if (state.speed === 0) { liveTimer = setTimeout(step, 300); return; }
    try { liveMatch.tick(); }
    catch (err) {
      console.error("Match-Tick-Fehler", err);
      liveMatch.forceFinish();
    }
    for (const b of liveMatch.boards) updateBoardCardDOM(b);
    updateScore(partialHome(liveMatch), partialAway(liveMatch));
    if (liveMatch.finished) { onLiveMatchDone(); return; }
    liveTimer = setTimeout(step, tickMs());
  }
  liveTimer = setTimeout(step, 400);
}

function partialHome(m) { return m.boards.reduce((s,b)=> s + (b.done ? (b.homeIsWhite?b.wScore:b.bScore) : 0), 0); }
function partialAway(m) { return m.boards.reduce((s,b)=> s + (b.done ? (b.homeIsWhite?b.bScore:b.wScore) : 0), 0); }

function finishLiveNow() {
  if (!liveMatch) return;
  liveMatch.forceFinish();
  for (const b of liveMatch.boards) updateBoardCardDOM(b);
  onLiveMatchDone();
}

function stopLiveMatch() {
  if (liveTimer) clearTimeout(liveTimer);
  liveTimer = null;
  liveMatch = null;
}

function onLiveMatchDone() {
  const m = liveMatch; if (!m) return;
  if (liveTimer) clearTimeout(liveTimer);
  // Ergebnis strukturieren wie simulateMatch
  const boards = m.boards.map(b => ({
    boardNo: b.boardNo,
    white: b.white?.name ?? "—", whiteId: b.white?.id, whiteRating: b.white?.rating ?? 0,
    black: b.black?.name ?? "—", blackId: b.black?.id, blackRating: b.black?.rating ?? 0,
    result: b.resultText ?? "", wScore: b.wScore, bScore: b.bScore,
    homeIsWhite: b.homeIsWhite,
    homeScore: b.homeIsWhite ? b.wScore : b.bScore,
    awayScore: b.homeIsWhite ? b.bScore : b.wScore,
  }));
  const homePts = m.homePts, awayPts = m.awayPts;
  const playerMatch = {
    homeId: m.homeTeam.id, awayId: m.awayTeam.id,
    homePts, awayPts, boards,
    homeMP: homePts > awayPts ? 2 : (homePts === awayPts ? 1 : 0),
    awayMP: awayPts > homePts ? 2 : (awayPts === homePts ? 1 : 0),
  };
  applyMatchResult(state, playerMatch, m.homeTeam, m.awayTeam);
  commitMatchday(state, state.pendingMatchday, playerMatch);
  state.day++;
  liveMatch = null;
  save();
  const myId = getMyTeam(state).id;
  const myPts = myId === playerMatch.homeId ? homePts : awayPts;
  const oppPts = myId === playerMatch.homeId ? awayPts : homePts;
  const kind = myPts > oppPts ? "ok" : (myPts < oppPts ? "bad" : "warn");
  toast(`Endstand: ${myPts} : ${oppPts}`, kind);
  log(state, `Spieltag abgeschlossen gegen ${m.homeTeam.id === myId ? m.awayTeam.name : m.homeTeam.name}: ${myPts}-${oppPts}.`, kind);
  if (state.seasonState === "offseason") {
    log(state, `Letzter Spieltag gespielt. Bitte Saison abschließen.`, "ok");
  }
  render();
}

// ---- Season end ----
function finalizeSeason() {
  endSeason(state);
  save();
  view = "dashboard"; state.view = view;
  toast("Saison abgeschlossen. Transferfenster offen.", "ok");
  render();
}

// ---- Transfers ----
function handleBuy(idx) {
  const market = listMarket(state).sort((a,b)=>b.player.rating-a.player.rating);
  const offer = market[idx];
  if (!offer) return;
  if (!state.transferWindow) { toast("Transferfenster ist geschlossen.", "bad"); return; }
  if (tryBuy(state, offer)) { save(); render(); }
  else render();
}
function handleSell(pid) {
  if (!state.transferWindow) { toast("Transferfenster ist geschlossen.", "bad"); return; }
  if (trySell(state, pid)) { save(); render(); }
}

