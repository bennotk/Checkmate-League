// Transfermarkt: Kauf, Verkauf, Free Agents, Scouting.

import { marketValue, log, getMyTeam, getPlayer } from "./state.js";
import { BOARDS_PER_TEAM, makeRng } from "./data.js";
import { makePlayer } from "./state.js";

export function askingPrice(player) {
  // Klubs verlangen etwas mehr als Marktwert
  return Math.round(marketValue(player) * (1.1 + Math.random() * 0.2));
}

// Liste aller Spieler auf dem Markt: Free Agents + Klub-Spieler anderer Vereine mit Transferlist-Flag
export function listMarket(state) {
  const out = [];
  for (const p of state.freeAgents) {
    out.push({ player: p, fromTeamId: null, ask: Math.round(marketValue(p) * 0.95), isFree: true });
  }
  for (const t of Object.values(state.teams)) {
    if (t.isPlayer) continue;
    // Jeder KI-Klub bietet 1-2 Spieler an, die nicht in der Top-Aufstellung sind
    const reserves = t.players
      .filter(p => !t.lineup.slice(0, BOARDS_PER_TEAM).includes(p.id))
      .sort((a,b)=>b.rating-a.rating)
      .slice(0, 2);
    for (const p of reserves) {
      out.push({ player: p, fromTeamId: t.id, ask: askingPrice(p), isFree: false });
    }
  }
  return out;
}

export function tryBuy(state, offer) {
  const me = getMyTeam(state);
  const { player, fromTeamId, ask, isFree } = offer;
  if (me.cash < ask) { log(state, `Nicht genug Geld fuer ${player.name}.`, "bad"); return false; }
  if (me.players.length >= 10) { log(state, `Kader voll (max 10 Spieler).`, "bad"); return false; }
  me.cash -= ask;
  const newPlayer = { ...player, contractYears: 3 };
  me.players.push(newPlayer);
  if (isFree) {
    state.freeAgents = state.freeAgents.filter(p => p.id !== player.id);
    log(state, `${player.name} (Elo ${player.rating}) verpflichtet (ablösefrei, Gehalt ${player.wage}€).`, "ok");
  } else {
    const fromTeam = state.teams[fromTeamId];
    if (fromTeam) {
      fromTeam.cash += ask;
      fromTeam.players = fromTeam.players.filter(p => p.id !== player.id);
      fromTeam.lineup = fromTeam.lineup.filter(id => id !== player.id);
      // Ersatz generieren
      const rng = makeRng(Date.now() + player.rating);
      const rep = makePlayer(rng, fromTeam.leagueId);
      rep.rating = Math.min(rep.rating, Math.max(800, player.rating - 150));
      rep.contractYears = 2;
      fromTeam.players.push(rep);
    }
    log(state, `${player.name} fuer ${fmtEuro(ask)} verpflichtet.`, "ok");
  }
  return true;
}

export function trySell(state, playerId) {
  const me = getMyTeam(state);
  if (me.players.length <= BOARDS_PER_TEAM) { log(state, "Mindestkader von " + BOARDS_PER_TEAM + " Spielern noetig.", "bad"); return false; }
  const p = me.players.find(x => x.id === playerId);
  if (!p) return false;
  const price = Math.round(marketValue(p) * 0.9);
  me.cash += price;
  me.players = me.players.filter(x => x.id !== playerId);
  me.lineup = me.lineup.filter(id => id !== playerId);
  log(state, `${p.name} fuer ${fmtEuro(price)} verkauft.`, "ok");
  return true;
}

// Scout: neuer Spieler erscheint fuer Geld im Free-Agent-Pool
export function scout(state, focusLeague = 3) {
  const me = getMyTeam(state);
  const cost = [80000, 25000, 10000, 5000][focusLeague];
  if (me.cash < cost) { log(state, "Scouting-Budget zu niedrig.", "bad"); return false; }
  me.cash -= cost;
  const rng = makeRng(Date.now() + Math.random() * 1e6);
  const p = makePlayer(rng, focusLeague);
  p.age = Math.max(16, p.age - 5); // Talent: oft jung
  p.contractYears = 0;
  state.freeAgents.unshift(p);
  log(state, `Scout entdeckt: ${p.name} (${p.age}J, Elo ${p.rating}) in ${["Königsliga","Großmeister","Meister","Amateur"][focusLeague]}.`, "ok");
  return true;
}

function fmtEuro(n) { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n); }
