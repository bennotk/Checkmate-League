// Globaler Spielzustand + Initialisierung + Speichern/Laden.

import {
  LEAGUES, TEAMS_PER_LEAGUE, BOARDS_PER_TEAM, SEASON_ROUNDS,
  makeRng, gauss, randName, randClubName
} from "./data.js";

export const STORAGE_KEY = "checkmate-league-save-v1";

// --------- Helpers ---------
function clamp(v, mn, mx) { return v < mn ? mn : v > mx ? mx : v; }
export function uid(rng) { return Math.floor(rng() * 1e9).toString(36); }

// Runde Elo so, dass es weniger Dezimalstellen gibt.
function round5(v) { return Math.round(v / 5) * 5; }

// --------- Player / Team Generation ---------
export function makePlayer(rng, leagueId, opts = {}) {
  const L = LEAGUES[leagueId];
  const rating = round5(clamp(gauss(rng, L.ratingMean, L.ratingSd), 800, 2850));
  const age = clamp(Math.round(gauss(rng, 28, 7)), 16, 55);
  const potential = clamp(rating + Math.round(gauss(rng, 100, 80)) + Math.max(0, 30 - age) * 15, rating, 2900);
  const style = ["aggressive", "balanced", "defensive"][Math.floor(rng() * 3)];
  const baseWage = Math.round((rating - 800) ** 1.6 * 0.05 + 500);
  return {
    id: uid(rng),
    name: opts.name ?? randName(rng),
    rating,
    potential,
    age,
    style,
    form: 60 + Math.round(rng() * 30),
    stamina: 100,
    morale: 70,
    yellow: 0,      // Taktik-Foul-Karten
    banned: 0,      // Sperren in Spielen
    injury: 0,      // Spiele verletzt
    wage: baseWage,
    contractYears: 1 + Math.floor(rng() * 3),
    games: 0,
    wins: 0, draws: 0, losses: 0,
  };
}

export function makeTeam(rng, leagueId, id, name) {
  const players = [];
  for (let i = 0; i < BOARDS_PER_TEAM + 3; i++) {  // 8 Spieler pro Kader
    players.push(makePlayer(rng, leagueId));
  }
  // Sortiere nach Rating fuer Default-Aufstellung
  players.sort((a, b) => b.rating - a.rating);
  const lineup = players.slice(0, BOARDS_PER_TEAM).map(p => p.id);
  return {
    id, name,
    leagueId,
    players,
    lineup,               // Spieler-IDs Brett 1..BOARDS_PER_TEAM
    tactic: "balanced",   // Mannschaftstaktik: aggressive|balanced|defensive
    cash: 0,
    stadium: 1,
    fans: 500 + Math.floor(rng() * 2000),
    seasonStats: newSeasonStats(),
    history: [],
    isPlayer: false,
  };
}

function newSeasonStats() {
  return { played: 0, w: 0, d: 0, l: 0, bp: 0, bpAgainst: 0, pts: 0 };
}

// --------- League & Schedule ---------
export function generateSchedule(teamIds, rng) {
  // Round-Robin (Berger-Tabellen) Doppelrunde
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error("even teams required");
  const rounds = [];
  const list = [...teamIds];
  const half = n / 2;
  for (let r = 0; r < n - 1; r++) {
    const pairings = [];
    for (let i = 0; i < half; i++) {
      const a = list[i], b = list[n - 1 - i];
      // abwechselnd Heim/Auswaerts
      if (r % 2 === 0) pairings.push([a, b]);
      else pairings.push([b, a]);
    }
    rounds.push(pairings);
    // Rotation (list[0] fix)
    list.splice(1, 0, list.pop());
  }
  // Rueckrunde mit getauschtem Heimrecht
  const second = rounds.map(r => r.map(([a,b]) => [b, a]));
  return rounds.concat(second);
}

// --------- World Gen ---------
export function createNewGame(opts) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rng = makeRng(seed);
  const usedClubs = new Set();
  const leagues = LEAGUES.map(l => ({ ...l, teamIds: [], schedule: [], round: 0 }));
  const teams = {};

  let tid = 1;
  for (let L = 0; L < LEAGUES.length; L++) {
    const ids = [];
    for (let t = 0; t < TEAMS_PER_LEAGUE; t++) {
      const name = randClubName(rng, usedClubs);
      const id = "t" + tid++;
      teams[id] = makeTeam(rng, L, id, name);
      ids.push(id);
    }
    leagues[L].teamIds = ids;
    leagues[L].schedule = generateSchedule(ids, rng);
  }

  // Spieler-Team markieren
  const playerLeagueId = opts.startLeague ?? 3;
  const playerTeamIds = leagues[playerLeagueId].teamIds;
  let myTeamId;
  if (opts.pickedTeamId) myTeamId = opts.pickedTeamId;
  else myTeamId = playerTeamIds[playerTeamIds.length - 1]; // letzter aus Liste

  const myTeam = teams[myTeamId];
  if (opts.clubName) myTeam.name = opts.clubName;
  myTeam.isPlayer = true;
  myTeam.cash = 500000;
  myTeam.manager = opts.managerName ?? "Manager";

  // Transfermarkt: freie Spieler-Pool
  const freeAgents = [];
  for (let L = 0; L < LEAGUES.length; L++) {
    for (let i = 0; i < 6; i++) {
      const p = makePlayer(rng, L);
      p.contractYears = 0;
      freeAgents.push(p);
    }
  }

  const state = {
    seed,
    version: 1,
    day: 1,
    year: 2026,
    speed: 1,
    leagues,
    teams,
    myTeamId,
    freeAgents,
    news: [],
    lastMatch: null,
    pendingMatchday: 0,       // naechste Runde zu spielen
    seasonState: "inplay",    // inplay | offseason
    transferWindow: false,
    matchHistory: [],
    achievements: {},
    transferWindow: true,
    view: "dashboard",
  };

  log(state, `Ein neuer Manager uebernimmt ${myTeam.name}. Willkommen in der ${LEAGUES[playerLeagueId].name}!`, "ok");
  log(state, `Saison ${state.year} beginnt. ${SEASON_ROUNDS} Spieltage liegen vor uns.`);

  return state;
}

// --------- News ---------
export function log(state, text, kind = "info") {
  state.news.unshift({ id: Date.now() + Math.random(), day: state.day, year: state.year, text, kind });
  if (state.news.length > 120) state.news.pop();
}

// --------- Save/Load ---------
export function saveGame(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) { console.error(e); return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function hasSave() { return !!localStorage.getItem(STORAGE_KEY); }

export function deleteSave() { localStorage.removeItem(STORAGE_KEY); }

// --------- Access Helpers ---------
export function getMyTeam(state) { return state.teams[state.myTeamId]; }
export function getLeague(state, leagueId) { return state.leagues[leagueId]; }
export function getPlayer(team, pid) { return team.players.find(p => p.id === pid); }
export function teamAvgRating(team, onlyLineup = false) {
  const pool = onlyLineup ? team.lineup.map(id => getPlayer(team, id)).filter(Boolean) : team.players;
  if (!pool.length) return 0;
  return Math.round(pool.reduce((s, p) => s + p.rating, 0) / pool.length);
}
export function marketValue(p) {
  // exponentielle Kurve ab 1000 Rating, Bonus fuer Potential-Luft und junges Alter
  const base = Math.max(0, p.rating - 1000);
  let v = Math.pow(base, 2.05) * 2.4;
  if (p.age < 23) v *= 1.4;
  if (p.age > 33) v *= 0.55;
  if (p.age > 40) v *= 0.25;
  const potGap = Math.max(0, (p.potential ?? p.rating) - p.rating);
  v *= (1 + potGap / 400);
  return Math.round(v / 1000) * 1000;
}
