// =====================================================================
// ONE LAW OF LIFE — the wild resolver (Adam's blend, pinned 2026-10-20)
// =====================================================================
//
// How wild animals come to be in a zone they were not standing in when
// you left it — three roads, layered by reach and rarity, resolved
// HERE and nowhere else:
//
//   LAYER 1 — WANDERING. A real individual walks in from a visited
//     neighbor zone: the same animal, out of the neighbor's parked
//     record, in at the shared border. The world's books balance.
//   LAYER 2 — WILD BIRTHS. A thriving zone's own residents produce
//     young over a long absence. Nothing is replaced; things are
//     BORN — age 0, of parents who lived the absence in that zone.
//   LAYER 3 — THE FAR COUNTRY. At genuine zero (nothing resident,
//     no neighbor able to send anyone), exactly one adult walker
//     arrives from beyond the known atlas. This layer CREATES, once,
//     and the design says so without flinching: it is the bounded
//     exception that gives the wild a road back that is not the vat.
//
// Two rules govern all three roads (the pinned doc speaks them once):
//   THE CENSUS IS THE CARRYING CAPACITY — no layer ever lifts a zone
//     above the wild census it was dealt (WorldSnapshot.census).
//   THE INTERSECTION RULE — every road runs per-species on the
//     intersection of what is actually there and what the zone was
//     dealt. An empty intersection is a correct answer.
//
// Time is the game's absence clock and nothing else: no standing
// timers (the gap-fix doctrine). The seam stamps parkedAt when a
// zone is parked or saved; this resolver reads (now - parkedAt),
// applies what the absence earned, and CONSUMES the absence — the
// returned snapshot carries no parkedAt, so a stretch of time never
// earns twice and a reload never re-rolls it. Every choice among
// equals is made with the saga dice, hashed from (seed, zone,
// parkedAt): deterministic for a given absence, and unrepeatable
// once the absence is spent.
//
// Pure, like applyZoneConsequences beside it: inputs are never
// mutated, donors are returned as updates, and settled-record
// migrations are returned as moves for the seam to apply to the
// saga state (a settled animal wanders WITH its record — one
// residence for record and animal alike).
//
// The moments live inside the law, not beside it: arrivals double-
// count an absence that spanned a meteor shower; births flush in
// the growing season; after prey rises, a hunter of the gathering
// is ordered earlier among the eligible (never made eligible); a
// released animal whose story began in the receiving zone — the
// homecoming — walks first of all.

import type { WorldSnapshot } from '../saveSystem';
import type { FaunaEntity } from '../../types/game';
import type { SettledIndividual } from '../quests/asksBackState';
import { SPECIES } from './species';
import { Dice, hashStringToSeed } from '../quests/asksBack/rng';
import { nightSkyAt, skyDayFloat, skyRosterFor } from '../world/skyCalendar';

// ---------------------------------------------------------------------------
// The law's numbers (Adam's numbers-pass, pinned 2026-10-20)
// ---------------------------------------------------------------------------

/** Zone-local coordinates run 0..100 by the dealing convention. */
const ZONE_EDGE = 100;
/** How far inside the border a walker materializes (meters). */
const BORDER_BAND_MIN = 4;
const BORDER_BAND_MAX = 12;

/** Game days from birth to full-grown — the Hearth Dog's span, shared. */
export const AGE_ADULT_DAYS = 10;
/** The far-country stranger's stamp: an old one, long past grown. */
export const FAR_STRANGER_AGE_DAYS = 30;
/** Parked aging: whole real days of absence age a stamped animal,
 *  capped so a long-forgotten zone does not return Methuselahs. */
const PARKED_AGE_CAP_DAYS = 30;

/** Layer 1 receiver lines, as fractions of the dealt wild census. */
const RECEIVER_FIRST_LINE = 0.6;
const RECEIVER_SECOND_LINE = 0.4;
/** Layer 1 absence steps (real time parked). */
const FIRST_STEP_MS = 30 * 60_000;
const SECOND_STEP_MS = 24 * 3_600_000;
/** A donor never falls below this fraction of its own census... */
const DONOR_FLOOR = 0.5;
/** ...and never gives its last of a species (a species leaves from 2+). */

/** Layer 2: the health line a zone must hold (on its PARKED
 *  residents) before its own life can add more. */
const HEALTH_LINE = 0.8;
/** Layer 2 absence steps: the base step, and the growing-season one. */
const BIRTH_STEP_MS = 48 * 3_600_000;
const BIRTH_STEP_SEASON_MS = 24 * 3_600_000;
const BIRTH_CAP = 1;
const BIRTH_CAP_SEASON = 2;

/** Layer 3: the longest absence of the three roads. */
const FAR_COUNTRY_MS = 7 * 24 * 3_600_000;
/** How often the far country sends the cast's rare edge instead of
 *  its common share (an original census count of 1–2). */
const FAR_RARE_CHANCE = 0.25;

/** The growing season, read off the sky clock: the calendar turns
 *  in 23-day shower blocks; the law reads a year as four blocks and
 *  the FIRST block as the flush. (A build-time definition — the
 *  pinned doc left the window's length to this pass.) */
export const SEASON_CYCLE_DAYS = 92;
export const GROWING_SEASON_DAYS = 23;

/** The teeth note's memory: a hunter is ordered early only while
 *  the gathering it would hunt is fresh (see preyRoseAt). */
const TEETH_WINDOW_MS = 48 * 3_600_000;

// ---------------------------------------------------------------------------
// Small truths the seam and the lab share
// ---------------------------------------------------------------------------

/** The dealt wild census of a fauna list: wild individuals by species. */
export function censusFromFauna(fauna: readonly FaunaEntity[]): Record<string, number> {
  const census: Record<string, number> = {};
  for (const f of fauna) {
    if (f.isTamed) continue;
    census[f.species] = (census[f.species] ?? 0) + 1;
  }
  return census;
}

function censusTotal(census: Record<string, number>): number {
  let total = 0;
  for (const key of Object.keys(census)) total += census[key];
  return total;
}

function wildCount(fauna: readonly FaunaEntity[]): number {
  let n = 0;
  for (const f of fauna) if (!f.isTamed) n += 1;
  return n;
}

function wildCountOf(fauna: readonly FaunaEntity[], species: string): number {
  let n = 0;
  for (const f of fauna) if (!f.isTamed && f.species === species) n += 1;
  return n;
}

/** The oversize tier — the provokedOnly giants. Landmarks, not
 *  census filler: they never wander, and the far country never
 *  sends one (a giant strolling in reads as a malfunction). */
function isOversize(species: string): boolean {
  return SPECIES[species as keyof typeof SPECIES]?.hunt?.provokedOnly === true;
}

/** An unprovoked hunter — a species the distance gradient stamps. */
function isGradientHunter(species: string): boolean {
  const def = SPECIES[species as keyof typeof SPECIES];
  return !!def?.hunt && !def.hunt.provokedOnly;
}

/** Young under the shared age: no stamp = grown; a stamp counts. */
function isYoung(f: FaunaEntity): boolean {
  return f.ageDays !== undefined && f.ageDays < AGE_ADULT_DAYS;
}

/** Whether a sky-day float (days since the world's creation) sits
 *  inside the growing-season flush. */
export function isGrowingSeason(dayFloat: number): boolean {
  const intoCycle = ((dayFloat % SEASON_CYCLE_DAYS) + SEASON_CYCLE_DAYS) % SEASON_CYCLE_DAYS;
  return intoCycle < GROWING_SEASON_DAYS;
}

/**
 * Whether any meteor-shower night fell in (fromMs, toMs] — the
 * weather beat of the law. The sky calendar deals exactly one
 * shower night per 23-day block, deterministically from the seed,
 * so any window longer than a block certainly contains one; the
 * day walk is capped for sanity on very long absences.
 */
export function absenceSpannedShower(
  worldSeed: string,
  createdAtMs: number,
  fromMs: number,
  toMs: number,
): boolean {
  if (toMs <= fromMs) return false;
  const roster = skyRosterFor(worldSeed);
  const fromDay = Math.floor(skyDayFloat(createdAtMs, fromMs));
  const toDay = Math.floor(skyDayFloat(createdAtMs, toMs));
  if (toDay - fromDay > 23) return true; // one shower per block, always
  for (let d = fromDay; d <= toDay; d += 1) {
    if (nightSkyAt(roster, d).shower) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

export interface ImmigrationDonor {
  key: string;
  zx: number;
  zz: number;
  snapshot: WorldSnapshot;
  census: Record<string, number>;
}

export interface ImmigrationInput {
  now: number;
  worldSeed: string;
  receiverKey: string;
  receiverZx: number;
  receiverZz: number;
  /** The receiver's lists, post-overlay, exactly as loaded. */
  receiver: WorldSnapshot;
  receiverCensus: Record<string, number>;
  /** The receiver zone's variant id, for newborns' homeVariant. */
  receiverVariant?: string;
  /** Adjacent parked zones (the 4-neighborhood), censuses resolved. */
  donors: ImmigrationDonor[];
  /** Saga removals for the receiver — absolute in every layer. */
  removedHere: ReadonlySet<string>;
  /** The receiver's settled records (homecoming origins read here). */
  settledHere: readonly SettledIndividual[];
  /** Donor zones' settled records, by zone key. */
  settledByDonor: ReadonlyMap<string, readonly SettledIndividual[]>;
  /** Settled animals wander only when the seam can migrate their
   *  records (it bridges the saga state); without the bridge they
   *  stay — the record must never be left behind. */
  allowSettledMoves: boolean;
  /** The receiver's dealt cast (post-overlay generate lists) —
   *  required only for layer 3's template; the seam supplies it
   *  when the receiver stands at zero. */
  dealtCast?: readonly FaunaEntity[];
  /** The weather beat: the absence crossed a shower night. */
  showerSpanned: boolean;
  /** The season beat: the resolution lands in the growing season. */
  inGrowingSeason: boolean;
  /** This zone's gradient stamps (wildPressureFor at the seam), for
   *  animals BORN here — their teeth are this country's teeth. */
  nativeDmg: number;
  nativeAggro: number;
}

export interface ImmigrationResult {
  /** The receiver, resolved: arrivals and births in, the absence
   *  consumed (no parkedAt), the census ensured, the teeth note kept. */
  receiver: WorldSnapshot;
  /** Donor snapshots that lost a wanderer (new objects). */
  donorUpdates: Map<string, WorldSnapshot>;
  /** Settled records to migrate, applied by the seam to saga state. */
  settledMoves: { id: string; fromKey: string; toKey: string }[];
  wanderers: number;
  births: number;
  farCountry: boolean;
  changed: boolean;
}

/** A walker's door in the receiver: the shared edge with its donor
 *  (or a dice-chosen edge, for the far country), inside the band,
 *  aimed at the interior. Zone-local coordinates. */
function borderArrival(
  dice: Dice,
  fromDir: { dx: number; dz: number } | null,
  along: number,
): { x: number; z: number; targetX: number; targetZ: number } {
  const band = BORDER_BAND_MIN + dice.int(0, BORDER_BAND_MAX - BORDER_BAND_MIN);
  const across = Math.max(4, Math.min(ZONE_EDGE - 4, along + dice.int(-8, 8)));
  const inX = ZONE_EDGE / 2 + dice.int(-18, 18);
  const inZ = ZONE_EDGE / 2 + dice.int(-18, 18);
  if (fromDir && fromDir.dx > 0) return { x: ZONE_EDGE - band, z: across, targetX: inX, targetZ: inZ }; // donor east
  if (fromDir && fromDir.dx < 0) return { x: band, z: across, targetX: inX, targetZ: inZ }; // donor west
  if (fromDir && fromDir.dz > 0) return { x: across, z: ZONE_EDGE - band, targetX: inX, targetZ: inZ }; // donor south
  if (fromDir && fromDir.dz < 0) return { x: across, z: band, targetX: inX, targetZ: inZ }; // donor north
  const edge = dice.int(0, 3);
  if (edge === 0) return { x: band, z: across, targetX: inX, targetZ: inZ };
  if (edge === 1) return { x: ZONE_EDGE - band, z: across, targetX: inX, targetZ: inZ };
  if (edge === 2) return { x: across, z: band, targetX: inX, targetZ: inZ };
  return { x: across, z: ZONE_EDGE - band, targetX: inX, targetZ: inZ };
}

/** Stamps for an animal born (or arrived from the far country) HERE:
 *  gradient hunters wear this country's pressure; others wear none.
 *  Mutates the freshly-cloned entity the caller hands it — never an
 *  input. */
function stampNative(f: FaunaEntity, input: ImmigrationInput): void {
  if (isGradientHunter(f.species)) {
    f.wildDmg = input.nativeDmg;
    f.wildAggro = input.nativeAggro;
  } else {
    delete f.wildDmg;
    delete f.wildAggro;
  }
}

export function resolveImmigration(input: ImmigrationInput): ImmigrationResult {
  const { now, receiver } = input;
  const census = input.receiverCensus;
  const total = censusTotal(census);
  const settledMoves: { id: string; fromKey: string; toKey: string }[] = [];
  const donorUpdates = new Map<string, WorldSnapshot>();
  let wanderers = 0;
  let preyArrived = false;
  let births = 0;
  let farCountry = false;

  // No census, no law: an undealt or cast-less zone is not this
  // system's country. (The seam still consumes nothing — the
  // snapshot returns untouched so the absence is NOT spent on a
  // resolution that never ran.)
  if (total <= 0) {
    return { receiver, donorUpdates, settledMoves, wanderers, births, farCountry, changed: false };
  }

  const parkedAt = receiver.parkedAt;
  const absenceMs = parkedAt !== undefined ? Math.max(0, now - parkedAt) : 0;
  const dice = new Dice(
    hashStringToSeed(`one-law|${input.worldSeed}|${input.receiverKey}|${parkedAt ?? 0}`),
  );

  // AGING, before any law reads the list: animals carrying the
  // shared age stamp grow by the whole real days they sat parked
  // (live growth rides the sim's rotation, in useWorldEntities).
  const absenceDays = Math.floor(absenceMs / 86_400_000);
  const ageGain = Math.min(PARKED_AGE_CAP_DAYS, absenceDays);
  let fauna: FaunaEntity[] = receiver.fauna;
  if (ageGain > 0) {
    fauna = fauna.map((f) =>
      f.ageDays !== undefined ? { ...f, ageDays: f.ageDays + ageGain } : f,
    );
  }
  // The residents AS PARKED (aged, but before this resolution moves
  // anyone): layer 2's parents are judged from this list alone —
  // a wanderer who arrived this morning is not a parent by noon.
  const parkedFauna = fauna;
  const parkedWild = wildCount(parkedFauna);

  // Working donor state: species counts and lists, rewritten only
  // in the updates map (inputs are never mutated).
  const donorLists = new Map<string, FaunaEntity[]>();
  const donorByKey = new Map<string, ImmigrationDonor>();
  for (const donor of input.donors) {
    donorLists.set(donor.key, [...donor.snapshot.fauna]);
    donorByKey.set(donor.key, donor);
  }

  const settledRecordOf = (donorKey: string, id: string): SettledIndividual | undefined =>
    input.settledByDonor.get(donorKey)?.find((s) => s.id === id);

  // ------------------------------------------------------------------
  // LAYER 1 — WANDERING
  // ------------------------------------------------------------------
  const wildNow = () => wildCount(fauna);
  let wanted = 0;
  if (wildNow() < RECEIVER_FIRST_LINE * total) {
    // The weather beat: an absence that crossed a shower counts
    // double toward the FIRST step only.
    const firstStepMs = input.showerSpanned ? absenceMs * 2 : absenceMs;
    if (firstStepMs >= FIRST_STEP_MS) wanted = 1;
    if (wildNow() < RECEIVER_SECOND_LINE * total && absenceMs >= SECOND_STEP_MS) wanted = 2;
  }
  // The teeth note, read before any pick: prey rose here recently.
  const teethFresh =
    receiver.preyRoseAt !== undefined && now - receiver.preyRoseAt <= TEETH_WINDOW_MS;

  interface Candidate {
    donorKey: string;
    entity: FaunaEntity;
    homecoming: boolean;
    known: boolean;
    teeth: boolean;
    deficit: number;
  }
  const candidates: Candidate[] = [];
  if (wanted > 0) {
    for (const donor of input.donors) {
      const list = donorLists.get(donor.key)!;
      for (const f of list) {
        if (f.isTamed) continue; // tames are not wanderers
        if (input.removedHere.has(f.species)) continue; // saga removals are absolute
        if (census[f.species] === undefined) continue; // the intersection: not dealt here
        if (f.pondRadius !== undefined) continue; // its world is its pond
        if (isOversize(f.species)) continue; // landmarks do not stroll
        if (isYoung(f)) continue; // young stay with their herd
        const record = settledRecordOf(donor.key, f.id);
        if (record && !input.allowSettledMoves) continue; // the record must travel too
        const origin = record ? (record.originZone ?? record.zoneKey) : undefined;
        candidates.push({
          donorKey: donor.key,
          entity: f,
          homecoming: origin !== undefined && origin === input.receiverKey,
          known: record !== undefined || f.customName !== undefined,
          // The teeth follow the table: while the zone's preyRoseAt
          // note is fresh (prey rose here within two days), hunters
          // in the intersection are ordered early — the country
          // keeping its balance a beat behind the feast. (The defs
          // carry no prey map, so the fresh note is the honest
          // signal; ordering only, never eligibility.)
          teeth: teethFresh && isGradientHunter(f.species),
          deficit: 0, // filled below, per species
        });
      }
    }
    // Deficit depth per species, against the receiver's live counts.
    const deficitOf = (species: string): number => {
      const dealt = census[species] ?? 0;
      if (dealt <= 0) return 0;
      return (dealt - wildCountOf(fauna, species)) / dealt;
    };
    for (const c of candidates) c.deficit = deficitOf(c.entity.species);
    // ORDER (the law, then the moments, then the dice): homecoming
    // first; known (settled/named) next; the teeth while fresh;
    // deepest deficit; dice shuffled within equal ranks so repeat
    // resolutions of like situations do not march in lockstep.
    const shuffled = dice.shuffled(candidates);
    const rank = (c: Candidate): number =>
      (c.homecoming ? 0 : 4) + (c.known ? 0 : 2) + (c.teeth ? 0 : 1);
    shuffled.sort((a, b) => rank(a) - rank(b) || b.deficit - a.deficit);
    candidates.length = 0;
    candidates.push(...shuffled);
  }

  for (const pick of candidates) {
    if (wanderers >= wanted) break;
    if (wildNow() >= total) break; // the ceiling, spoken once
    const species = pick.entity.species;
    if (wildCountOf(fauna, species) >= (census[species] ?? 0)) continue; // per-species ceiling
    const donor = donorByKey.get(pick.donorKey)!;
    const list = donorLists.get(pick.donorKey)!;
    if (!list.some((f) => f.id === pick.entity.id)) continue; // already walked
    // Donor protections, judged at the moment of the gift: the
    // floor under the donor's whole census, and never its last
    // of a species.
    const donorTotal = censusTotal(donor.census);
    if (wildCount(list) - 1 < DONOR_FLOOR * donorTotal) continue;
    if (wildCountOf(list, species) - 1 < 1) continue;
    // The walk: out of the donor's list, into the receiver at the
    // shared border, whole — id, health, stamps, name and all.
    donorLists.set(pick.donorKey, list.filter((f) => f.id !== pick.entity.id));
    // The across-coordinate carries over from the animal's own
    // position in its home zone — the axes align across a shared
    // border (z for an east/west neighbor, x for north/south), so
    // the walker crosses at the world line it was already on.
    const arrival = borderArrival(
      dice,
      { dx: donor.zx - input.receiverZx, dz: donor.zz - input.receiverZz },
      donor.zx !== input.receiverZx ? pick.entity.z : pick.entity.x,
    );
    fauna = [
      ...fauna,
      {
        ...pick.entity,
        x: arrival.x,
        z: arrival.z,
        targetX: arrival.targetX,
        targetZ: arrival.targetZ,
        state: 'wandering' as const,
        // Its home becomes this zone's story now; the animal itself
        // keeps everything else it was.
      },
    ];
    const record = settledRecordOf(pick.donorKey, pick.entity.id);
    if (record) settledMoves.push({ id: record.id, fromKey: pick.donorKey, toKey: input.receiverKey });
    if (!isGradientHunter(species)) preyArrived = true;
    wanderers += 1;
  }
  for (const [key, list] of donorLists) {
    const donor = donorByKey.get(key)!;
    if (list.length !== donor.snapshot.fauna.length) {
      donorUpdates.set(key, { ...donor.snapshot, fauna: list });
    }
  }

  // ------------------------------------------------------------------
  // LAYER 2 — WILD BIRTHS (parents judged on the parked residents)
  // ------------------------------------------------------------------
  const birthStep = input.inGrowingSeason ? BIRTH_STEP_SEASON_MS : BIRTH_STEP_MS;
  const birthCap = input.inGrowingSeason ? BIRTH_CAP_SEASON : BIRTH_CAP;
  if (parkedWild >= HEALTH_LINE * total && absenceMs >= birthStep) {
    // Species with two grown wild parents among the parked, still
    // below their census count in the receiver as it now stands.
    const parentSpecies = new Map<string, FaunaEntity[]>();
    for (const f of parkedFauna) {
      if (f.isTamed || isYoung(f)) continue;
      const arr = parentSpecies.get(f.species) ?? [];
      arr.push(f);
      parentSpecies.set(f.species, arr);
    }
    const options: { species: string; parents: FaunaEntity[]; deficit: number }[] = [];
    for (const [species, parents] of parentSpecies) {
      if (parents.length < 2) continue;
      if (input.removedHere.has(species)) continue; // a removed species has no residents — belt and braces
      const dealt = census[species] ?? 0;
      if (dealt <= 0) continue;
      if (wildCountOf(fauna, species) >= dealt) continue;
      options.push({ species, parents, deficit: (dealt - wildCountOf(fauna, species)) / dealt });
    }
    options.sort((a, b) => b.deficit - a.deficit);
    for (const option of options) {
      if (births >= birthCap) break;
      if (wildNow() >= total) break;
      if (wildCountOf(fauna, option.species) >= (census[option.species] ?? 0)) continue;
      const parent = dice.pick(option.parents);
      const newborn: FaunaEntity = {
        ...parent,
        id: `born_${hashStringToSeed(`${input.worldSeed}|${input.receiverKey}|${option.species}|${parkedAt ?? 0}|${births}`).toString(16)}`,
        x: Math.max(2, Math.min(ZONE_EDGE - 2, parent.x + dice.int(-3, 3))),
        z: Math.max(2, Math.min(ZONE_EDGE - 2, parent.z + dice.int(-3, 3))),
        targetX: parent.targetX,
        targetZ: parent.targetZ,
        state: 'wandering',
        isTamed: false,
        health: parent.maxHealth,
        ageDays: 0,
        byproductTimer: 0,
        sampleTimer: 0,
      };
      // A newborn is a NEW animal, not a copy of its parent: it
      // keeps the pond it was born into (a pond species' young
      // belong to the pond) and its birth variant — and nothing of
      // the parent's bond, name, cargo, clocks, or broth.
      delete newborn.tamedBy;
      delete newborn.customName;
      delete newborn.command;
      delete newborn.biteTimer;
      delete newborn.dissolveTimer;
      delete newborn.flinchTimer;
      delete newborn.provokedTimer;
      delete newborn.phaseTimer;
      delete newborn.socialState;
      delete newborn.socialTimer;
      delete newborn.socialTravel;
      delete newborn.calmRegard;
      delete newborn.cargoItems;
      delete newborn.routeX;
      delete newborn.routeZ;
      delete newborn.hearthFeedings;
      delete newborn.hearthDecideTimer;
      delete newborn.hearthFedTimer;
      delete newborn.hearthAgeDays;
      delete newborn.brothGentle;
      delete newborn.shedCadenceMul;
      delete newborn.cavernRoam;
      if (input.receiverVariant !== undefined) newborn.homeVariant = input.receiverVariant;
      else delete newborn.homeVariant;
      stampNative(newborn, input);
      fauna = [...fauna, newborn];
      births += 1;
    }
  }

  // ------------------------------------------------------------------
  // LAYER 3 — THE FAR COUNTRY (triple zero, the longest absence)
  // ------------------------------------------------------------------
  if (
    wildNow() === 0 &&
    wanderers === 0 &&
    births === 0 &&
    absenceMs >= FAR_COUNTRY_MS &&
    input.dealtCast !== undefined &&
    input.dealtCast.length > 0
  ) {
    // Species of the dealt cast, saga exclusions absolute even here.
    const castSpecies = Object.keys(census).filter((s) => !input.removedHere.has(s) && !isOversize(s));
    if (castSpecies.length > 0) {
      // The common share first — the zone's largest original count —
      // unless the dice send the rare edge instead: a species the
      // cast dealt only once or twice.
      const byShare = [...castSpecies].sort((a, b) => (census[b] ?? 0) - (census[a] ?? 0));
      let species = byShare[0];
      const rareEdge = byShare.filter((s) => (census[s] ?? 0) >= 1 && (census[s] ?? 0) <= 2);
      if (rareEdge.length > 0 && dice.chance(FAR_RARE_CHANCE)) {
        species = dice.pick(rareEdge);
      }
      const template = input.dealtCast.find((f) => f.species === species && !f.isTamed);
      if (template) {
        const arrival = borderArrival(dice, null, template.z);
        const walker: FaunaEntity = {
          ...template,
          id: `far_${hashStringToSeed(`${input.worldSeed}|${input.receiverKey}|far|${parkedAt ?? 0}`).toString(16)}`,
          x: arrival.x,
          z: arrival.z,
          targetX: arrival.targetX,
          targetZ: arrival.targetZ,
          state: 'wandering',
          isTamed: false,
          health: template.maxHealth,
          // A stranger with a past: OLD, and wearing the road.
          ageDays: FAR_STRANGER_AGE_DAYS,
          colorVariant: 'weathered',
          byproductTimer: 0,
          sampleTimer: 0,
        };
        delete walker.tamedBy;
        delete walker.customName;
        delete walker.command;
        stampNative(walker, input);
        fauna = [...fauna, walker];
        farCountry = true;
      }
    }
  }

  // The teeth note: births and PREY arrivals raise the table
  // (a hunter's own arrival does not); a stale note lapses. Kept
  // on the snapshot for the NEXT resolution to read.
  let preyRoseAt = receiver.preyRoseAt;
  if (births > 0 || preyArrived) preyRoseAt = now;
  else if (preyRoseAt !== undefined && now - preyRoseAt > TEETH_WINDOW_MS) preyRoseAt = undefined;

  const changed =
    fauna !== receiver.fauna || donorUpdates.size > 0 || settledMoves.length > 0 || parkedAt !== undefined;
  const resolved: WorldSnapshot = {
    ...receiver,
    fauna,
    census,
    preyRoseAt,
    // The absence is consumed: the returned snapshot carries no
    // parkedAt. The seam stamps a fresh one when the zone is
    // parked again (or saved).
    parkedAt: undefined,
  };
  return { receiver: resolved, donorUpdates, settledMoves, wanderers, births, farCountry, changed };
}
