// =====================================================================
// THE WORLD ASKS BACK — the save-backed state shape (Adam, 2026-10-16)
// =====================================================================
//
// The dynamic saga system's memory. Everything the Director needs to
// offer, track, and resolve generated sagas lives under ONE optional
// save-record key (`asksBack` on SavedGameRecord) — the save format
// stays version 1 forever; old saves fall back to an empty record.
//
// THREE LAYERS, one record:
//   events   — the typed event log (S1): what the player DID, counted
//              by species/flora/zone. Writers are minimal and additive;
//              most creature beats already arrive through the
//              recordFieldWitness stream, so the sink inverts note
//              ids to species rather than adding new sim hooks.
//   engine   — the Director's working memory (S2): offered sagas,
//              active sagas, completed ids, echoes, cooldowns, the
//              world's notebook of bonds/releases/settlements.
//   zoneState — per-zone consequences (S4): abundance shifts and
//              settled individuals, applied where zones generate.
//
// NO AI GENERATION anywhere: sagas are assembled from authored
// template fragments (src/game/asksBack/, S2) with slots filled from
// real zone data. This file is only the memory — the Director thinks
// elsewhere.

/** One game day in milliseconds — Adam's ten-minute rotation. */
export const ASKS_GAME_DAY_MS = 10 * 60 * 1000;

/** The player who owns this record (multiplayer: 'local' for solo,
 *  the host/guest id in co-op — S2+ carry it on saga instances). */
export type AsksOwner = string;

/** Event kinds the sim can report. Writers are one-liners at existing
 *  call sites; the engine reads the accumulated counters. */
export type AsksEventKind =
  | 'witness' // a species' moment was witnessed (note stamps + scans)
  | 'tame'    // a creature was tamed
  | 'feed'    // an offering was accepted
  | 'cull'    // a creature was killed by the player or their world
  | 'sample'  // a sample vial was collected
  | 'harvest' // a flora was harvested (count in detail)
  | 'plant'   // a seed was planted
  | 'build'   // a structure was grown/placed
  | 'zoneVisit' // the player entered a zone (zoneKey stamped)
  | 'survey' // a new space was occupied — surface zone, ruin interior,
             // or cavern level (spaceKey stamped; the S2 space observer)
  | 'weather'; // the player stood in a zone's NAMED weather
               // (zoneKey + weatherMode; the S2 space observer)

/** The raw input a call site hands the sink — day and owner are
 *  stamped by the sink itself, so callers never compute them. */
export interface AsksEventInput {
  kind: AsksEventKind;
  /** Fauna species id (witness/tame/feed/cull/sample). */
  species?: string;
  /** Flora species id (witness/harvest/plant). */
  flora?: string;
  /** "zx,zz" zone key (zoneVisit, weather). */
  zoneKey?: string;
  /** Space key for 'survey' — App's currentZoneId format: 'zone:zx,zz'
   *  on the surface, a ruin's instanceId, or a cavern level key.
   *  Distinct spaces are the saga engine's survey points: "mark N
   *  survey points" counts spaces occupied, so walking a ruin's deep
   *  rooms and descending cavern levels both count. */
  spaceKey?: string;
  /** zoneWeatherAt's WeatherMode for 'weather' ('rain', 'snow', ...).
   *  Weather is a fixed per-zone property, not an event — the stamp
   *  honestly means "stood in a zone whose weather is X". */
  weatherMode?: string;
  /** Item id, when the event is about one. */
  itemId?: string;
  /** How many (harvest counts, sample counts). Default 1. */
  count?: number;
}

/** A stamped event as stored. */
export interface AsksEvent extends AsksEventInput {
  day: number;
  owner: AsksOwner;
}

/** The typed counters — species/flora/zone-keyed. Counts, not lists:
 *  the Director asks "how many", never "which ones". */
export interface AsksEventLog {
  witnessed: Record<string, number>;
  tamed: Record<string, number>;
  fed: Record<string, number>;
  culled: Record<string, number>;
  sampled: Record<string, number>;
  harvestedFlora: Record<string, number>;
  plantedFlora: Record<string, number>;
  builtStructures: Record<string, number>;
  /** "zx,zz" → visits and first/last seen (echoes and revisits read this). */
  zoneVisits: Record<string, { visits: number; firstDay: number; lastDay: number }>;
  /** spaceKey → first game day occupied. The saga engine's survey
   *  signal lives here: steps asking for N survey points count
   *  distinct spaces with firstDay >= the saga's start. Optional:
   *  saves predating S2 fall back to {} at every read and write. */
  surveyedSpaces?: Record<string, number>;
  /** zoneKey → the named weather stood in there, and when. One record
   *  per zone is the whole truth (weather is fixed per zone), so
   *  re-entries never grow it. Optional, same fallback as above. */
  weatherWitnessed?: Record<string, { mode: string; day: number }>;
  /** saga id → the option the player chose. */
  choices: Record<string, string>;
  /** saga id → how it ended: 'completed' | 'neglected' | 'deadAnchor' | ... */
  resolutions: Record<string, string>;
}

/** An echo: an unresolved outcome the world remembers, eligible to
 *  seed a future saga (S2's echo channel). */
export interface AsksEcho {
  id: string;
  kind: 'neglected' | 'deadAnchor' | 'released_settled' | 'answered' | 'other';
  zoneKey: string;
  species?: string;
  flora?: string;
  /** A settled creature's given name, when the echo is about one. */
  individual?: string;
  day: number;
  text: string;
  /** Saga ids that have consumed this echo (answered echoes stay answered). */
  consumedBy: string[];
}

/** A creature the player released that settled in a zone (S4). */
export interface SettledIndividual {
  id: string;
  species: string;
  name: string;
  zoneKey: string;
  day: number;
}

/** Per-zone mutable consequences written by saga resolutions (S4):
 *  abundance multipliers shift the dealt census; removed species are
 *  ineligible as targets; settled individuals are really there. */
export interface ZoneConsequences {
  abundance: Record<string, number>;
  removed: string[];
  settled: SettledIndividual[];
}

/** The world's notebook (S2): the player's history the Director
 *  prefers as anchors — within its pacing caps. */
export interface AsksMemory {
  bonded: Record<string, number>;
  released: Record<string, number>;
  builtZones: Record<string, number>;
}

/** A saga step as offered. Goals reuse the game's QuestGoal
 *  vocabulary where they map onto it; anything else is a PROPOSED
 *  signal the sim must eventually write (the engine never latches
 *  a step whose signal has no writer). */
export interface AsksStep {
  n: number;
  beat: string;
  title: string;
  text: string;
  goal: AsksGoal;
  target: { domain: string; id: string; name: string };
}

/** Goal union: real QuestGoal kinds + the dynamic system's proposals. */
export type AsksGoal =
  | { kind: 'KNOWN'; goal: unknown }
  | { kind: 'PROPOSED'; signal: string; detail: Record<string, unknown> };

/** An offered saga (S2). */
export interface AsksOffer {
  id: string;
  arc: string;
  title: string;
  text: string;
  zx: number;
  zz: number;
  zoneKey: string;
  zoneName: string;
  day: number;
  steps: AsksStep[];
  reward: { tier: number; items: { itemId: string; count: number }[] };
  cooldownTags: string[];
  owner: AsksOwner;
  /** S2: set when the offer consumed a world-memory echo (the
   *  cross-saga continuity channel; dormant until S3 writes more
   *  echo kinds than 'neglected'). */
  echoUsed?: { kind: string; echoId: string } | null;
  /** S2: set when the saga's anchor is a species the player has
   *  history with (tamed — read from the event log). */
  personalUsed?: boolean;
}

/** An accepted saga being worked (S2/S3). */
export interface AsksInstance extends AsksOffer {
  status: 'offered' | 'active' | 'completed' | 'neglected';
  currentStep: number;
  choice?: string;
  startDay: number;
}

/** THE record. One optional save key holds all of it. */
export interface AsksBackState {
  /** Record schema version (NOT the save format — this rides inside v1). */
  version: 1;
  owner: AsksOwner;
  /** Epoch ms of the first event; game days = wall-clock 10-minute days. */
  dayZero: number;
  events: AsksEventLog;
  memory: AsksMemory;
  offers: AsksOffer[];
  active: AsksInstance[];
  completed: { id: string; day: number }[];
  echoes: AsksEcho[];
  zoneState: Record<string, ZoneConsequences>;
  cooldowns: { tag: string; day: number }[];
}

/** A fresh record: nothing witnessed, nothing offered, nothing owed. */
export const EMPTY_ASKS_BACK: AsksBackState = {
  version: 1,
  owner: 'local',
  dayZero: 0,
  events: {
    witnessed: {},
    tamed: {},
    fed: {},
    culled: {},
    sampled: {},
    harvestedFlora: {},
    plantedFlora: {},
    builtStructures: {},
    zoneVisits: {},
    surveyedSpaces: {},
    weatherWitnessed: {},
    choices: {},
    resolutions: {},
  },
  memory: { bonded: {}, released: {}, builtZones: {} },
  offers: [],
  active: [],
  completed: [],
  echoes: [],
  zoneState: {},
  cooldowns: [],
};

/** The current game day for a record: wall-clock ten-minute days
 *  since the record's first event. Monotonic across sessions
 *  (dayZero persists), robust to pausing — offers and cooldowns
 *  pace on this, never on the frame clock. */
export function asksGameDay(state: AsksBackState): number {
  if (!state.dayZero) return 0;
  return Math.floor((Date.now() - state.dayZero) / ASKS_GAME_DAY_MS);
}

function bump(map: Record<string, number>, key: string | undefined, by: number): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + by;
}

/**
 * Apply a batch of events to a record — pure, so App calls it inside
 * setState. Counters bump; zone visits accumulate first/last days;
 * the day is stamped once per batch from the record's own clock.
 */
export function applyAsksEvents(
  prev: AsksBackState,
  inputs: AsksEventInput | AsksEventInput[],
  owner: AsksOwner = 'local'
): AsksBackState {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  if (list.length === 0) return prev;
  const dayZero = prev.dayZero || Date.now();
  const day = Math.floor((Date.now() - dayZero) / ASKS_GAME_DAY_MS);
  const events: AsksEventLog = {
    witnessed: { ...prev.events.witnessed },
    tamed: { ...prev.events.tamed },
    fed: { ...prev.events.fed },
    culled: { ...prev.events.culled },
    sampled: { ...prev.events.sampled },
    harvestedFlora: { ...prev.events.harvestedFlora },
    plantedFlora: { ...prev.events.plantedFlora },
    builtStructures: { ...prev.events.builtStructures },
    zoneVisits: { ...prev.events.zoneVisits },
    // S2's space-weather writers: optional on old records, so every
    // read and this rebuild falls back to {} — a pre-S2 save grows
    // these maps on its first S2 event, never crashes on their absence.
    surveyedSpaces: { ...(prev.events.surveyedSpaces ?? {}) },
    weatherWitnessed: { ...(prev.events.weatherWitnessed ?? {}) },
    choices: { ...prev.events.choices },
    resolutions: { ...prev.events.resolutions },
  };
  for (const input of list) {
    const count = input.count ?? 1;
    switch (input.kind) {
      case 'witness': bump(events.witnessed, input.species ?? input.flora, count); break;
      case 'tame': bump(events.tamed, input.species, count); break;
      case 'feed': bump(events.fed, input.species, count); break;
      case 'cull': bump(events.culled, input.species, count); break;
      case 'sample': bump(events.sampled, input.species, count); break;
      case 'harvest': bump(events.harvestedFlora, input.flora, count); break;
      case 'plant': bump(events.plantedFlora, input.flora, count); break;
      case 'build': bump(events.builtStructures, input.itemId, count); break;
      case 'zoneVisit': {
        const k = input.zoneKey;
        if (k) {
          const prev_visit = events.zoneVisits[k];
          events.zoneVisits[k] = prev_visit
            ? { visits: prev_visit.visits + 1, firstDay: prev_visit.firstDay, lastDay: day }
            : { visits: 1, firstDay: day, lastDay: day };
        }
        break;
      }
      case 'survey': {
        // First occupation wins: a survey point is "been there".
        // The S2 space observer stamps each new space once, so this
        // map grows by at most one key per space change — never per frame.
        if (input.spaceKey && events.surveyedSpaces![input.spaceKey] === undefined) {
          events.surveyedSpaces![input.spaceKey] = day;
        }
        break;
      }
      case 'weather': {
        // One record per zone: weather is a fixed per-zone property
        // (zoneWeatherAt), so the latest stamp is the whole truth and
        // re-entries never grow the map.
        if (input.zoneKey && input.weatherMode) {
          events.weatherWitnessed![input.zoneKey] = { mode: input.weatherMode, day };
        }
        break;
      }
    }
  }
  return { ...prev, version: 1, owner: prev.owner || owner, dayZero, events };
}
