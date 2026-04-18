// Saisonlogik: Spieltag abarbeiten, Ende der Saison, Auf-/Abstieg, Finanzen.

import { BOARDS_PER_TEAM, LEAGUES, SEASON_ROUNDS } from "./data.js";
import { getLeague, getMyTeam, log, marketValue, getPlayer } from "./state.js";
import { simulateMatch, applyMatchResult } from "./match.js";
import { makePlayer } from "./state.js";
import { makeRng } from "./data.js";

export function getFixturesForRound(state, round) {
  const fixtures = [];
  for (const L of state.leagues) {
    const pairings = L.schedule[round];
    if (!pairings) continue;
    for (const [h, a] of pairings) {
      fixtures.push({ leagueId: L.id, home: h, away: a });
    }
  }
  return fixtures;
}

// Fuehrt alle Matches eines Spieltages aus AUSSER dem Spieler-Match aus.
// Spieler-Match wird separat live gespielt und danach via applyPlayerMatchResult eingetragen.
export function runMatchdaySim(state, round, playerMatch) {
  const fixtures = getFixturesForRound(state, round);
  const seedBase = state.seed + state.year * 1000 + round * 17;
  for (const fx of fixtures) {
    if (playerMatch && fx.home === playerMatch.homeId && fx.away === playerMatch.awayId) {
      continue; // Spieler-Match uebersprungen, wird separat eingetragen
    }
    const home = state.teams[fx.home], away = state.teams[fx.away];
    const result = simulateMatch(home, away, seedBase + hashIds(fx.home, fx.away));
    applyMatchResult(state, result, home, away);
    state.matchHistory.push({ round, year: state.year, ...result });
  }
  // Spieler-Match integriert?
  if (playerMatch) {
    state.matchHistory.push({ round, year: state.year, ...playerMatch });
  }
}

function hashIds(a, b) {
  let s = 0; for (const ch of a + "|" + b) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(s) % 99991;
}

// Tagesfortschritt: 1 Tag = 1 Spieltag (stark vereinfacht). Ruhe-Tage dazwischen.
export function advanceDay(state) {
  state.day++;
}

// Ende der Saison: Prize Money, Auf-/Abstieg, Jahr+1, neuer Plan.
export function endSeason(state) {
  // Prize Money je Tabellenplatz (0 = 100%, 7 = 20%)
  for (const L of state.leagues) {
    const standings = leagueStandings(state, L.id);
    standings.forEach((t, idx) => {
      const prize = Math.round(L.prize * (1 - idx / 12));
      t.cash += prize;
      if (t.isPlayer) log(state, `Preisgeld ${L.name}: ${euro(prize)} (Platz ${idx+1}).`, "ok");
    });
  }
  // Auf- und Abstieg: Top 2 auf, Bottom 2 ab.
  const L_COUNT = LEAGUES.length;
  for (let L = 0; L < L_COUNT; L++) {
    const standings = leagueStandings(state, L).slice();
    if (L > 0) {
      // die letzten 2 aus Liga (L) = potentielle Abstiege -> ersetzt durch Top 2 aus Liga (L+1)? nein: Top 2 aus NIEDRIGERER liga
    }
  }
  // Sauberes 2-auf/2-ab zwischen benachbarten Ligen:
  for (let L = 0; L < L_COUNT - 1; L++) {
    const upperStandings = leagueStandings(state, L);
    const lowerStandings = leagueStandings(state, L + 1);
    const relegated = upperStandings.slice(-2);      // letzte 2 in oberer
    const promoted = lowerStandings.slice(0, 2);     // top 2 in unterer
    for (const t of relegated) { t.leagueId = L + 1; if (t.isPlayer) log(state, `Abstieg: ${t.name} spielt naechstes Jahr in ${LEAGUES[L+1].name}.`, "bad"); }
    for (const t of promoted)  { t.leagueId = L;     if (t.isPlayer) log(state, `Aufstieg! ${t.name} spielt naechstes Jahr in ${LEAGUES[L].name}.`, "ok"); }
  }
  // Saisonstats reset, Team-IDs in Liga neu setzen
  for (const t of Object.values(state.teams)) {
    t.seasonStats = { played: 0, w: 0, d: 0, l: 0, bp: 0, bpAgainst: 0, pts: 0 };
    // Alter erhoehen, Vertragsjahre reduzieren
    for (const p of t.players) {
      p.age++;
      p.contractYears = Math.max(0, (p.contractYears ?? 1) - 1);
      // Spieler mit Vertrag=0 werden Free Agent
      p.stamina = 100;
      p.form = Math.max(50, Math.min(85, p.form));
      p.injury = 0; p.banned = 0; p.yellow = 0;
    }
    // Aussortieren vertragsloser Spieler -> FreeAgents
    const leaving = t.players.filter(p => p.contractYears === 0);
    t.players = t.players.filter(p => p.contractYears > 0);
    // Stelle sicher: Kader nicht unter BOARDS_PER_TEAM
    // Verlustspieler fuer Pool
    leaving.forEach(p => state.freeAgents.push(p));
    // Lineup reparieren
    t.lineup = t.lineup.filter(id => t.players.find(p => p.id === id));
    while (t.lineup.length < BOARDS_PER_TEAM) {
      const missing = t.players.filter(p => !t.lineup.includes(p.id)).sort((a,b)=>b.rating-a.rating)[0];
      if (!missing) break;
      t.lineup.push(missing.id);
    }
  }
  // Verein muss Kader auffuellen: KI-Teams rekrutieren automatisch
  for (const t of Object.values(state.teams)) {
    while (t.players.length < BOARDS_PER_TEAM + 2) {
      // Junger Nachwuchs gemaess Ligalevel
      const rng = makeRng(state.seed + state.year * 7 + t.id.length * 31 + t.players.length);
      const p = makePlayer(rng, t.leagueId);
      p.age = Math.max(16, p.age - 8);
      p.contractYears = 2;
      t.players.push(p);
    }
  }
  // Liga-Team-IDs neu gemaess t.leagueId
  for (let L = 0; L < L_COUNT; L++) state.leagues[L].teamIds = [];
  for (const t of Object.values(state.teams)) {
    state.leagues[t.leagueId].teamIds.push(t.id);
  }
  // Neue Spielplaene
  for (let L = 0; L < L_COUNT; L++) {
    const rng = makeRng(state.seed + state.year * 13 + L);
    state.leagues[L].schedule = generateScheduleLocal(state.leagues[L].teamIds, rng);
    state.leagues[L].round = 0;
  }
  // Free-Agent-Nachschub
  const rng = makeRng(state.seed + state.year * 97);
  for (let L = 0; L < L_COUNT; L++) {
    for (let i = 0; i < 4; i++) {
      const p = makePlayer(rng, L);
      p.contractYears = 0;
      state.freeAgents.push(p);
    }
  }
  // Alte FreeAgents mit sehr hohem Alter entsorgen (Ruhestand)
  state.freeAgents = state.freeAgents.filter(p => p.age < 48);

  state.year++;
  state.pendingMatchday = 0;
  state.seasonState = "inplay";
  state.transferWindow = true; // Transferfenster zum Saisonstart

  log(state, `Saison ${state.year} beginnt. Transferfenster ist geoeffnet.`, "ok");
}

// Zentrale Tabellenfunktion
export function leagueStandings(state, leagueId) {
  const L = state.leagues[leagueId];
  const list = L.teamIds.map(id => state.teams[id]);
  list.sort((a, b) => {
    const sa = a.seasonStats, sb = b.seasonStats;
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    const bdA = sa.bp - sa.bpAgainst, bdB = sb.bp - sb.bpAgainst;
    if (bdB !== bdA) return bdB - bdA;
    return sb.bp - sa.bp;
  });
  return list;
}

function euro(n) { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n); }

// lokale Kopie des Schedule-Generators (vermeide zyklische Imports)
function generateScheduleLocal(teamIds, rng) {
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error("even teams required");
  const rounds = [];
  const list = [...teamIds];
  const half = n / 2;
  for (let r = 0; r < n - 1; r++) {
    const pairings = [];
    for (let i = 0; i < half; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (r % 2 === 0) pairings.push([a, b]);
      else pairings.push([b, a]);
    }
    rounds.push(pairings);
    list.splice(1, 0, list.pop());
  }
  const second = rounds.map(r => r.map(([a,b]) => [b, a]));
  return rounds.concat(second);
}

// Finanzen nach Matchday: Tickets + Wages + Sponsor
export function runFinances(state) {
  for (const t of Object.values(state.teams)) {
    const wage = t.players.reduce((s, p) => s + (p.wage || 0), 0);
    const ticket = t.fans * 12 + Math.round(Math.random() * 2000);
    const sponsor = 8000 + (3 - t.leagueId) * 5000;
    t.cash += ticket + sponsor - wage;
    if (t.isPlayer && t.cash < 0) log(state, `Warnung: Konto im Minus (${euro(t.cash)}). Gehaelter kuerzen oder Spieler verkaufen!`, "bad");
  }
}

// Matchday ausfuehren: Spieler-Match wird ausgelassen (extern live abgespielt), danach aufgerufen.
// Hier: Simulation aller uebrigen Matches + Finanzen.
export function commitMatchday(state, round, playerMatchResult = null) {
  runMatchdaySim(state, round, playerMatchResult);
  runFinances(state);
  // Injury/Ban Countdown
  for (const t of Object.values(state.teams)) {
    for (const p of t.players) {
      if (p.injury > 0) p.injury--;
      if (p.banned > 0) p.banned--;
      p.stamina = Math.min(100, p.stamina + 18); // Erholung
    }
  }
  state.leagues.forEach(L => L.round = Math.max(L.round, round + 1));
  state.pendingMatchday = round + 1;
  // Transferfenster schliesst sich nach erstem Spieltag einer Saison
  if (round === 0) {
    state.transferWindow = false;
    log(state, `Das Transferfenster ist nun geschlossen.`);
  }
  if (state.pendingMatchday >= SEASON_ROUNDS) {
    state.seasonState = "offseason";
    log(state, `Saison ${state.year} ist zu Ende.`, "ok");
  }
}
