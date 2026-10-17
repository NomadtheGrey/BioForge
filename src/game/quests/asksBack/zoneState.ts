// =====================================================================
// THE WORLD ASKS BACK — per-zone consequence state (S2, ported from
// the lab's zonestate.mts, 2026-10-16)
// =====================================================================
//
// Each zone carries mutable state so saga resolutions feed
// GENERATION, not just prose:
//   - abundance multipliers per species (protect → up, cull → down,
//     planting → up)
//   - a long-term `removed` set (culled/dead species — gone for good,
//     ineligible as targets)
//   - a list of settled named individuals (released creatures living
//     in the zone)
//
// S2 wires the READ side: the generator applies removals and
// abundance weights when picking targets, and the Director prefers
// settled individuals as anchors BY NAME (the round-3 rider).
// S3's resolutions call the WRITE helpers; S4 applies the same state
// where zones generate. All prose-adjacent content (names) is an
// authored pool — no AI generation.

import {
  type AsksBackState,
  type ZoneConsequences,
  type SettledIndividual,
} from '../asksBackState';
import { Dice, hashStringToSeed } from './rng';

const EMPTY_CONSEQUENCES: ZoneConsequences = {
  abundance: {},
  removed: [],
  settled: [],
};

/** The consequence record for a zone key ("zx,zz") — or the empty one. */
export function zoneConsequences(
  state: AsksBackState,
  zoneKey: string,
): ZoneConsequences {
  return state.zoneState[zoneKey] ?? EMPTY_CONSEQUENCES;
}

/** Species removed from this zone long-term (culled/dead for good). */
export function removedSet(state: AsksBackState, zoneKey: string): Set<string> {
  return new Set(zoneConsequences(state, zoneKey).removed);
}

/** Abundance multipliers for this zone's census (1 = untouched). */
export function abundanceMap(
  state: AsksBackState,
  zoneKey: string,
): Map<string, number> {
  return new Map(Object.entries(zoneConsequences(state, zoneKey).abundance));
}

/** Named individuals settled in this zone. */
export function settledIn(
  state: AsksBackState,
  zoneKey: string,
): SettledIndividual[] {
  return zoneConsequences(state, zoneKey).settled;
}

/** True when saga-caused change is present in this zone's state —
 *  the "the world visibly accumulates the player's history" check. */
export function zoneChanged(state: AsksBackState, zoneKey: string): boolean {
  const zc = zoneConsequences(state, zoneKey);
  return (
    zc.removed.length > 0 ||
    zc.settled.length > 0 ||
    Object.values(zc.abundance).some((m) => m !== 1)
  );
}

// ── write helpers (S3's resolutions call these) ────────────────────
// Pure: each takes the zone's current consequences and returns the
// next. The caller writes the result back into state.zoneState.

/** Multiply an abundance entry. */
export function shiftAbundance(
  zc: ZoneConsequences,
  speciesId: string,
  mult: number,
): ZoneConsequences {
  return {
    ...zc,
    abundance: {
      ...zc.abundance,
      [speciesId]: (zc.abundance[speciesId] ?? 1) * mult,
    },
  };
}

/** Remove a species from the zone for good (cull/death consequence). */
export function removeSpecies(
  zc: ZoneConsequences,
  speciesId: string,
): ZoneConsequences {
  if (zc.removed.includes(speciesId)) return zc;
  const abundance = { ...zc.abundance };
  delete abundance[speciesId];
  return { ...zc, abundance, removed: [...zc.removed, speciesId] };
}

// ── authored settled-creature names (fixed pool, filled by machine) ─

export const SETTLED_NAMES: readonly string[] = [
  'Thistle',
  'Bramble',
  'Cinder',
  'Moss',
  'Pebble',
  'Wren',
  'Sorrel',
  'Tansy',
  'Lichen',
  'Ash',
  'Reed',
  'Flint',
  'Juniper',
  'Clover',
  'Drift',
  'Ember',
  'Fern',
  'Gale',
  'Hollow',
  'Ivy',
  'Brook',
  'Dusk',
  'Alder',
  'Birch',
];

/** Deterministic settled-individual record for a release. */
export function settleIndividual(
  worldSeed: string,
  zx: number,
  zz: number,
  species: string,
  day: number,
): SettledIndividual {
  const dice = new Dice(
    hashStringToSeed(`asks-settle|${worldSeed}|${zx}|${zz}|${species}|${day}`),
  );
  const name = dice.pick(SETTLED_NAMES);
  const id = `set_${hashStringToSeed(`${worldSeed}|${zx}|${zz}|${species}|${day}|${name}`)
    .toString(16)
    .padStart(8, '0')}`;
  return { id, species, name, zoneKey: `${zx},${zz}`, day };
}

/** Add a settled individual to the zone's consequences. */
export function addSettled(
  zc: ZoneConsequences,
  individual: SettledIndividual,
): ZoneConsequences {
  if (zc.settled.some((s) => s.id === individual.id)) return zc;
  return { ...zc, settled: [...zc.settled, individual] };
}
