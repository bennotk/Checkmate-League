// Per-character profiles: persistent training (permanent stat shifts) and
// active status effects (temporary stat shifts with a duration). Lives in
// state.charProfiles[charId] = { training, statusEffects }.
//
// Training is additive and clamped to +-TRAINING_CAP per stat. Status effects
// stack by id (re-applying the same effect refreshes the duration instead of
// doubling up). Duration ticks down after each completed match.

import { getAllCharacters, getCharacterById } from "./characters.js";

export const TRAINING_CAP = 25;
const STAT_FLOOR = 0;
const STAT_CEIL = 100;

export function ensureProfiles(state) {
  state.charProfiles ??= {};
  for (const c of getAllCharacters()) {
    const p = state.charProfiles[c.id] ??= { training: {}, statusEffects: [] };
    p.training ??= {};
    p.statusEffects ??= [];
  }
}

export function getProfile(state, charId) {
  if (!state.charProfiles?.[charId]) return { training: {}, statusEffects: [] };
  return state.charProfiles[charId];
}

// Computes effective stats for a character as { base, training, buffs,
// effective, delta } per stat key. Consumers pass the character object
// (from CHARACTERS) so we know the base stat keys even if the profile
// doesn't touch them all.
export function getEffectiveStats(profile, character) {
  const base = character?.stats ?? {};
  const training = profile?.training ?? {};
  const buffs = profile?.statusEffects ?? [];
  const out = {};
  for (const stat of Object.keys(base)) {
    const b = base[stat];
    const t = training[stat] ?? 0;
    let bu = 0;
    for (const eff of buffs) bu += eff.mods?.[stat] ?? 0;
    const effective = Math.max(STAT_FLOOR, Math.min(STAT_CEIL, b + t + bu));
    out[stat] = { base: b, training: t, buffs: bu, effective, delta: t + bu };
  }
  return out;
}

// Permanent training: additive, clamped per stat. Returns the applied delta
// map (post-clamp) so callers can log what actually stuck.
export function applyTraining(state, charId, deltas) {
  ensureProfiles(state);
  const p = state.charProfiles[charId];
  const applied = {};
  for (const [stat, delta] of Object.entries(deltas)) {
    const current = p.training[stat] ?? 0;
    const next = Math.max(-TRAINING_CAP, Math.min(TRAINING_CAP, current + delta));
    applied[stat] = next - current;
    p.training[stat] = next;
  }
  return applied;
}

// Status effect: re-applying the same id refreshes the duration.
export function applyStatusEffect(state, charId, effect) {
  ensureProfiles(state);
  const p = state.charProfiles[charId];
  const normalized = {
    id: effect.id,
    label: effect.label,
    kind: effect.kind ?? "debuff",
    mods: { ...effect.mods },
    durationMatches: Math.max(1, effect.durationMatches ?? 1),
    appliedAt: Date.now(),
  };
  const idx = p.statusEffects.findIndex((e) => e.id === effect.id);
  if (idx >= 0) p.statusEffects[idx] = normalized;
  else p.statusEffects.push(normalized);
}

// Call once per finished match: decrements durations and drops expired.
export function tickStatusEffectsAfterMatch(state) {
  if (!state.charProfiles) return;
  for (const p of Object.values(state.charProfiles)) {
    if (!p?.statusEffects) continue;
    p.statusEffects = p.statusEffects
      .map((e) => ({ ...e, durationMatches: e.durationMatches - 1 }))
      .filter((e) => e.durationMatches > 0);
  }
}

// Helper: list all active effects on any character (for status UIs later).
export function listAllStatusEffects(state) {
  const out = [];
  if (!state.charProfiles) return out;
  for (const [charId, p] of Object.entries(state.charProfiles)) {
    for (const eff of p.statusEffects ?? []) out.push({ charId, ...eff });
  }
  return out;
}

// Convenience: effective stat delta for one stat (for compact summaries).
export function statDeltaFor(state, charId, stat) {
  const c = getCharacterById(charId);
  if (!c) return { effective: 0, delta: 0 };
  const stats = getEffectiveStats(getProfile(state, charId), c);
  return stats[stat] ?? { effective: c.stats?.[stat] ?? 0, delta: 0 };
}
