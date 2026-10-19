// =====================================================================
// THE WORLD ASKS BACK — consequence application at zone generation (S4)
// =====================================================================
//
// S3's resolutions WRITE per-zone consequences into the asksBack record
// (zoneState.ts helpers: abundance shifts, removals, settled named
// individuals). This module is the SINGLE read-side apply path — the
// one place those records become real zones. It runs only for the
// world author (solo player or host); guests arrive with the host's
// snapshot and never apply zone state locally from their own record.
//
// Two modes, because a fresh roll and a lived-in zone are different
// truths:
//   'generate' — the zone is being rolled for the first time
//     (completeTravel's generateSeededWorld branch). The full overlay
//     applies: removals filter the deal, abundance thins or thickens
//     the dealt census, settled individuals are sown in.
//   'load' — the zone returns from a parked snapshot or a save (a
//     revisit, or the save-load restore). The parked lists are
//     player-shaped live truth, so abundance scaling does NOT apply
//     here (it would double-count the player's own plantings and
//     culls). Removals ("gone for good") and settled individuals
//     (absent from the live lists) do.
//
// HARD CONSTRAINT: zones with no recorded modifiers generate
// byte-identically to today. The gate is zoneChanged() — an untouched
// zone returns its lists by reference, no RNG is consumed anywhere in
// this module (all transforms are index arithmetic + deterministic
// id hashes), and generateSeededWorld itself is never touched, so
// WORLD_GEN_VERSION does not move and base dealing order is intact.

import type { FaunaEntity, FloraEntity } from '../../../types/game';
import type { AsksBackState, SettledIndividual } from '../asksBackState';
import { zoneChanged, zoneConsequences } from './zoneState';
import { SPECIES } from '../../creatures/species';
import { Dice, hashStringToSeed } from './rng';

/** The zone lists the overlay reads and returns. */
export interface ZoneLists {
  fauna: FaunaEntity[];
  flora: FloraEntity[];
}

/** 'generate' = fresh roll; 'load' = parked snapshot / save restore. */
export type ConsequenceMode = 'generate' | 'load';

/** Zone half-extent for deterministic settled placement (deal points
 *  live inside this; the echo-reed hand placement uses ±44). */
const SETTLE_SPREAD = 55;
/** Clone offsets stay inside the zone. */
const ZONE_CLAMP = 70;

/**
 * Apply this zone's recorded saga consequences to its lists.
 * Pure in everything but the returned arrays (inputs are never
 * mutated); returns the input object by reference when the zone is
 * unmodified. Deterministic — no RNG consumed, ever.
 */
export function applyZoneConsequences(
  lists: ZoneLists,
  zx: number,
  zz: number,
  state: AsksBackState,
  mode: ConsequenceMode,
): ZoneLists {
  const key = `${zx},${zz}`;
  // The gate that keeps unmodified zones byte-identical: nothing
  // recorded, nothing touched — not even a copied array.
  if (!zoneChanged(state, key)) return lists;
  const zc = zoneConsequences(state, key);
  const removed = new Set(zc.removed);

  // Removals ("gone for good", both modes): the species is filtered
  // out of whatever the zone holds — but only the zone's WILD
  // census. On a fresh roll this is the deal; on a lived-in zone
  // it is the ledger's memory of an extinction the player already
  // caused.
  //
  // THE LAW (dev chair, 2026-10-19): the ledger governs the wild
  // census; what is the PLAYER's is spared, in both modes, by the
  // one rule. A tamed animal is the player's, not the zone's — and
  // so is a planting. Neither was ever in the ledger's sights: a
  // removal is recorded at saga resolution, about a species in a
  // zone; an animal tamed or a seed planted later cannot have been
  // part of it. The flora exemption reads the isPlayerPlanted
  // stamp (stamped by the one planting flow, useToolInteractions;
  // wild constructions carry nothing). A planting from before the
  // stamp existed carries nothing either, and a record that never
  // stamped it cannot be read as anything but wild — we do not
  // retroactively invent plantings. Per-entity-id removals were
  // considered and rejected — rewriting the record's shape buys
  // nothing the exemption doesn't. Settled individuals are
  // untouched by this change.
  let fauna: FaunaEntity[] = removed.size
    ? lists.fauna.filter((f) => !removed.has(f.species) || f.isTamed === true)
    : lists.fauna;
  let flora: FloraEntity[] = removed.size
    ? lists.flora.filter((f) => !removed.has(f.species) || f.isPlayerPlanted === true)
    : lists.flora;

  // Abundance (generation only): scale the DEALT census, never the
  // player's lived-in lists. Thinning keeps the first ceil(n*f)
  // individuals of each species group in stable dealt order — a
  // factor below 1 never extirpates on its own (that is what
  // removals are for). Thickening appends deterministic clones of
  // the first floor(n*(f-1)) individuals, each with a derived id
  // and a small fixed offset so they don't stack exactly.
  if (mode === 'generate') {
    const factors = new Map<string, number>();
    for (const [species, mult] of Object.entries(zc.abundance)) {
      if (mult !== 1) factors.set(species, mult);
    }
    if (factors.size > 0) {
      fauna = scaleCensus(fauna, factors, cloneFauna);
      flora = scaleCensus(flora, factors, cloneFlora);
    }
  }

  // Settled individuals (both modes): the record is the source of
  // truth. Materialize any settled individual absent from the live
  // lists — never duplicate one already present (restored from a
  // parked snapshot, or the just-released creature the record was
  // written for). The absence check keys on the record id first,
  // then on name+species, because a released creature keeps its own
  // live id while carrying the record's name.
  if (zc.settled.length > 0) {
    const additions: FaunaEntity[] = [];
    for (const s of zc.settled) {
      const present =
        fauna.some((f) => f.id === s.id) ||
        fauna.some((f) => f.species === s.species && f.customName === s.name) ||
        additions.some((f) => f.id === s.id);
      if (!present) additions.push(materializeSettledIndividual(s));
    }
    if (additions.length > 0) fauna = [...fauna, ...additions];
  }

  return { fauna, flora };
}

/** Scale one dealt list by per-species factors (deterministic). */
function scaleCensus<T extends { species: string }>(
  list: T[],
  factors: Map<string, number>,
  clone: (orig: T, k: number) => T,
): T[] {
  const out: T[] = [];
  // Group indices by species in stable dealt order.
  const groups = new Map<string, number[]>();
  list.forEach((e, i) => {
    const g = groups.get(e.species);
    if (g) g.push(i);
    else groups.set(e.species, [i]);
  });
  const kept = new Set<number>();
  const clones: T[] = [];
  for (const [species, idxs] of groups) {
    const f = factors.get(species);
    if (f === undefined || f === 1) {
      idxs.forEach((i) => kept.add(i));
      continue;
    }
    if (f < 1) {
      // Thin: keep the first ceil(n*f) in dealt order.
      const keep = Math.max(1, Math.ceil(idxs.length * f));
      idxs.slice(0, keep).forEach((i) => kept.add(i));
    } else {
      // Thicken: keep all, append floor(n*(f-1)) deterministic clones.
      idxs.forEach((i) => kept.add(i));
      const extra = Math.floor(idxs.length * (f - 1));
      for (let k = 0; k < extra; k++) clones.push(clone(list[idxs[k]], k));
    }
  }
  list.forEach((e, i) => {
    if (kept.has(i)) out.push(e);
  });
  return [...out, ...clones];
}

/** Deterministic fauna clone (abundance thickening). */
function cloneFauna(orig: FaunaEntity, k: number): FaunaEntity {
  const dx = 0.9 * (k + 1);
  const dz = 0.7 * (k + 1);
  const x = clampZone(orig.x + dx);
  const z = clampZone(orig.z + dz);
  return {
    ...orig,
    id: `${orig.id}:ab${k}`,
    x,
    z,
    targetX: x,
    targetZ: z,
  };
}

/** Deterministic flora clone (abundance thickening). */
function cloneFlora(orig: FloraEntity, k: number): FloraEntity {
  return {
    ...orig,
    id: `${orig.id}:ab${k}`,
    x: clampZone(orig.x + 0.9 * (k + 1)),
    z: clampZone(orig.z + 0.7 * (k + 1)),
  };
}

function clampZone(v: number): number {
  return Math.max(-ZONE_CLAMP, Math.min(ZONE_CLAMP, v));
}

/**
 * Materialize a settled record as a real fauna entity — a normal
 * individual of its species, carrying the record's name (the name
 * the Director anchors on and the player reads). Position is
 * deterministic from the record id so a materialization is stable
 * across the calls that might race it; once parked, the zone's
 * snapshot owns the position like any other citizen.
 */
export function materializeSettledIndividual(s: SettledIndividual): FaunaEntity {
  const def = SPECIES[s.species as keyof typeof SPECIES];
  // Shipped stat blocks live on the bonusSpawn spec (bonus species
  // carry theirs there; census species carry theirs in worldGen's
  // census defs). Fallbacks are ordinary wild-individual values —
  // the sim reads behavior from the species id, not these numbers.
  const speed = def?.bonusSpawn?.speed ?? 1.5;
  const health = def?.bonusSpawn?.health ?? 30;
  const dice = new Dice(hashStringToSeed(`asks-settle-pos|${s.id}`));
  const x = (dice.f() * 2 - 1) * SETTLE_SPREAD;
  const z = (dice.f() * 2 - 1) * SETTLE_SPREAD;
  return {
    id: s.id,
    species: s.species as FaunaEntity['species'],
    x,
    z,
    y: 0,
    rotation: dice.f() * Math.PI * 2,
    state: 'wandering',
    isTamed: false,
    targetX: x,
    targetZ: z,
    speed,
    health,
    maxHealth: health,
    byproductTimer: 0,
    animTime: 0,
    customName: s.name,
  };
}
