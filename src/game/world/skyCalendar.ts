/**
 * skyCalendar.ts — the seeded calendar of sky phenomena
 * (Shelf 1 of the Living World brainstorm, Adam's build,
 * 2026-10-17: "sky phenomena... that makes this world feel
 * alive in the sky").
 *
 * WHAT THIS FILE IS: a pure almanac. Given a world seed and
 * a day count it answers, with no state and no randomness
 * beyond the seeded kind: which comets are in the sky and
 * where, what tonight's meteors are (baseline drift plus a
 * shower calendar), whether the aurora is up, and which
 * moon alignments fall today. The SkyRig (skyRig.ts) renders
 * what this file predicts; nothing here imports three.js,
 * and nothing here is ever saved — the calendar is derived
 * from the seed afresh, forever, like the weather.
 *
 * THE CLOCK: one game day is one full day/night cycle
 * (600 s — SKY_DAY_MS), and the day count runs on WALL
 * CLOCK from the world's creation (the save record's
 * createdAt), the same philosophy as the Asks Back day
 * count (asksBackState.asksGameDay). That is deliberate
 * and it is the game's own pillar: the world keeps its
 * own time, with or without a witness. A comet can pass
 * while you are away. Hosts and guests share createdAt
 * (it rides the save/snapshot), so every client computes
 * the same sky.
 *
 * COMETS ARE A ROSTER (Adam, 2026-10-17: "It would be
 * weird to have only one."): five seeded members with
 * staggered periods from about a week to about half a
 * year of game days. The longest-period member is the
 * great visitor; the rest are smaller, more frequent
 * callers. The two fixed transit comets the rig used to
 * draw are retired into this roster when the rig wiring
 * lands.
 */

import { hashStringToSeed, createSeededRandom } from '../engine/motion';

/** One game day, in milliseconds — one full day/night cycle. */
export const SKY_DAY_MS = 600_000;

/**
 * Days since the world was created (fractional). The one
 * clock every phenomenon reads. Negative spans (a save
 * from the future, a clock set wrong) clamp to zero.
 */
export function skyDayFloat(createdAtMs: number, nowMs: number): number {
  return Math.max(0, (nowMs - createdAtMs) / SKY_DAY_MS);
}

// ---------------------------------------------------------------------------
// The comet roster
// ---------------------------------------------------------------------------

export interface CometDef {
  index: number;
  /** Days between returns. */
  periodDays: number;
  /** Where in its period the comet sits at day 0, as a fraction. */
  phase: number;
  /** Days the comet is visible around each return. */
  windowDays: number;
  /** 1 = minor caller, 2 = notable, 3 = the great visitor. */
  sizeClass: 1 | 2 | 3;
  /** Tail tint. */
  hue: string;
  /** Sky path over the window: azimuth sweeps start -> end. */
  azimuthStartDeg: number;
  azimuthEndDeg: number;
  /** Highest elevation of the arc, degrees. */
  peakElevationDeg: number;
}

export interface CometState {
  def: CometDef;
  visible: boolean;
  /** 0..1 through the visible window (0 = first rise, 1 = last fade). */
  progress: number;
  /** 0..1 — rises and falls across the window. */
  brightness: number;
  azimuthDeg: number;
  elevationDeg: number;
}

const COMET_HUES = ['#cfe6ff', '#ffe9c4', '#d9ffd2', '#ffd2e0', '#e6dcff'];
/** Period bands, shortest to longest — one comet is drawn per band. */
const COMET_PERIOD_BANDS: ReadonlyArray<readonly [number, number]> = [
  [7, 13],
  [17, 29],
  [37, 61],
  [79, 113],
  [149, 211],
];

// ---------------------------------------------------------------------------
// One night's meteors
// ---------------------------------------------------------------------------

export interface MeteorSpec {
  /** 0..1 through the night (night runs cycle 0.75 -> 0.25). */
  nightT: number;
  /** Where it appears: azimuth + elevation, degrees. */
  azimuthDeg: number;
  elevationDeg: number;
  /** How far it falls across the sky, degrees. */
  dropDeg: number;
  /** Relative size (bolides are 2.2+). */
  size: number;
  hue: string;
  bolide: boolean;
}

export interface ShowerDef {
  /** Which 23-day block this shower belongs to. */
  blockIndex: number;
  /** The shower's night, as a day index. */
  dayIndex: number;
  /** 0.6 minor / 1.0 standard / 1.5 major — scales the night's count. */
  intensity: number;
  radiantAzimuthDeg: number;
  radiantElevationDeg: number;
  hue: string;
}

export interface NightSky {
  dayIndex: number;
  /** The quiet baseline: a handful of lone shooting stars. */
  baseline: MeteorSpec[];
  /** Tonight's shower, when the calendar deals one. */
  shower: { def: ShowerDef; meteors: MeteorSpec[] } | null;
  /**
   * Aurora tonight, before geography: the rig still gates
   * visibility by the country under it (cold/charged lands
   * see it; the near country does not).
   */
  aurora: { active: boolean; intensity: number };
}

/** Days per shower block: exactly one shower night per block. */
export const SHOWER_BLOCK_DAYS = 23;

const METEOR_HUES = ['#ffffff', '#ffeec9', '#d7ecff', '#eaffea'];

// ---------------------------------------------------------------------------
// Moon alignments (the ringed giant's moons)
// ---------------------------------------------------------------------------

/**
 * The moons' table, MIRRORED from skyRig.ts's moon defs —
 * the calendar predicts with the same numbers the rig
 * renders with. If the rig's moons ever change, this
 * table and MOON_DRIFT_PER_DAY change in the same commit.
 */
export const MOON_ORBITS_PER_CYCLE = [5, 3, 2];
export const MOON_PHASE = [0.12, 0.55, 0.83];
/**
 * How far each moon's phase slides per day. Without drift
 * the moon configuration repeats at midnight exactly, and
 * no alignment could ever be an EVENT — it would be every
 * night or never. Drift (rig applies it from this file)
 * turns transits into appointments. Moon 0 never drifts:
 * it is the metronome the others wander against.
 */
export const MOON_DRIFT_PER_DAY = [0, 0.017, 0.029];

export interface AlignmentEvent {
  kind: 'double_transit' | 'high_transit';
  /** The cycle phase at which the alignment centers. */
  atCycle: number;
  moonIndices: number[];
}

/**
 * A moon's orbital angle (radians), the rig's own formula
 * plus drift: a = 2π · (cycle · orbits + phase + drift · t).
 * A moon crosses the giant's face center when a ≡ π/2.
 */
export function moonAngleAt(moonIndex: number, cycle: number, tDays: number): number {
  return (
    Math.PI *
    2 *
    (cycle * MOON_ORBITS_PER_CYCLE[moonIndex] +
      MOON_PHASE[moonIndex] +
      MOON_DRIFT_PER_DAY[moonIndex] * tDays)
  );
}

// ---------------------------------------------------------------------------
// The roster (derived once per world seed)
// ---------------------------------------------------------------------------

export interface SkyRoster {
  worldSeed: string;
  comets: CometDef[];
}

export function skyRosterFor(worldSeed: string): SkyRoster {
  const rng = createSeededRandom(hashStringToSeed(`${worldSeed}|sky-comets`));
  const comets: CometDef[] = COMET_PERIOD_BANDS.map(([lo, hi], index) => {
    const periodDays = lo + rng() * (hi - lo);
    const sizeClass = (index === 4 ? 3 : index === 3 ? 2 : 1) as 1 | 2 | 3;
    const azimuthStartDeg = rng() * 360;
    return {
      index,
      periodDays,
      phase: rng(),
      windowDays: Math.min(14, Math.max(2.5, periodDays * 0.09)),
      sizeClass,
      hue: COMET_HUES[Math.floor(rng() * COMET_HUES.length)],
      azimuthStartDeg,
      azimuthEndDeg: azimuthStartDeg + (40 + rng() * 100) * (rng() < 0.5 ? -1 : 1),
      peakElevationDeg: 28 + rng() * 36,
    };
  });
  return { worldSeed, comets };
}

// ---------------------------------------------------------------------------
// Comet states at a moment
// ---------------------------------------------------------------------------

export function cometStatesAt(roster: SkyRoster, tDays: number): CometState[] {
  return roster.comets.map((def) => {
    // Position in the period, folded to 0..1; the visible
    // window is the first windowDays of each period.
    const local = ((tDays / def.periodDays + def.phase) % 1 + 1) % 1;
    const windowFraction = def.windowDays / def.periodDays;
    const visible = local < windowFraction;
    const progress = visible ? local / windowFraction : 0;
    const brightness = visible ? Math.pow(Math.sin(Math.PI * progress), 0.8) : 0;
    return {
      def,
      visible,
      progress,
      brightness,
      azimuthDeg: def.azimuthStartDeg + (def.azimuthEndDeg - def.azimuthStartDeg) * progress,
      elevationDeg: def.peakElevationDeg * Math.sin(Math.PI * progress),
    };
  });
}

// ---------------------------------------------------------------------------
// One night's sky
// ---------------------------------------------------------------------------

function meteorsForNight(
  worldSeed: string,
  dayIndex: number,
  stream: string,
  count: number,
  opts: { radiantAzimuthDeg?: number; radiantElevationDeg?: number; hue: string; bolideChance: number },
): MeteorSpec[] {
  const rng = createSeededRandom(hashStringToSeed(`${worldSeed}|${stream}|${dayIndex}`));
  const out: MeteorSpec[] = [];
  for (let i = 0; i < count; i++) {
    const bolide = rng() < opts.bolideChance;
    // Shower meteors cluster around the radiant and around
    // the night's peak hour; baseline meteors fall anywhere.
    const clustered = opts.radiantAzimuthDeg !== undefined;
    const nightT = clustered
      ? Math.min(0.97, Math.max(0.03, 0.52 + ((rng() + rng()) / 2 - 0.5) * 1.25))
      : 0.04 + rng() * 0.92;
    out.push({
      nightT,
      azimuthDeg: clustered
        ? (opts.radiantAzimuthDeg! + (rng() - 0.5) * 55 + 360) % 360
        : rng() * 360,
      elevationDeg: clustered
        ? Math.min(82, Math.max(18, opts.radiantElevationDeg! + (rng() - 0.5) * 36))
        : 26 + rng() * 46,
      dropDeg: 16 + rng() * 26,
      size: bolide ? 2.2 + rng() * 0.9 : 0.5 + rng() * (clustered ? 1.0 : 0.6),
      hue: opts.hue,
      bolide,
    });
  }
  // Chronological through the night, so the rig can consume
  // the list with a single walking pointer.
  return out.sort((a, b) => a.nightT - b.nightT);
}

export function nightSkyAt(roster: SkyRoster, dayIndex: number): NightSky {
  const { worldSeed } = roster;

  // Baseline: 3..7 lone stars, seeded per night.
  const baseRng = createSeededRandom(hashStringToSeed(`${worldSeed}|night|${dayIndex}`));
  const baselineCount = 3 + Math.floor(baseRng() * 5);
  const baseline = meteorsForNight(worldSeed, dayIndex, 'baseline', baselineCount, {
    hue: METEOR_HUES[Math.floor(baseRng() * METEOR_HUES.length)],
    bolideChance: 0.1,
  });

  // Shower: exactly one night per 23-day block deals one.
  const blockIndex = Math.floor(dayIndex / SHOWER_BLOCK_DAYS);
  const blockRng = createSeededRandom(hashStringToSeed(`${worldSeed}|shower-block|${blockIndex}`));
  const showerDay = blockIndex * SHOWER_BLOCK_DAYS + 2 + Math.floor(blockRng() * (SHOWER_BLOCK_DAYS - 4));
  let shower: NightSky['shower'] = null;
  if (dayIndex === showerDay) {
    const intensity = [0.6, 1.0, 1.0, 1.5][Math.floor(blockRng() * 4)];
    const def: ShowerDef = {
      blockIndex,
      dayIndex,
      intensity,
      radiantAzimuthDeg: blockRng() * 360,
      radiantElevationDeg: 34 + blockRng() * 30,
      hue: METEOR_HUES[Math.floor(blockRng() * METEOR_HUES.length)],
    };
    const count = Math.round(26 * intensity * (0.8 + blockRng() * 0.4));
    shower = {
      def,
      meteors: meteorsForNight(worldSeed, dayIndex, 'shower', count, {
        radiantAzimuthDeg: def.radiantAzimuthDeg,
        radiantElevationDeg: def.radiantElevationDeg,
        hue: def.hue,
        bolideChance: 0.06,
      }),
    };
  }

  // Aurora: storms run in 3-day blocks; inside a storm most
  // nights are up. Outside one, a rare faint solo showing.
  const auroraBlock = Math.floor(dayIndex / 3);
  const stormRng = createSeededRandom(hashStringToSeed(`${worldSeed}|aurora-block|${auroraBlock}`));
  const storm = stormRng() < 0.38;
  const nightRng = createSeededRandom(hashStringToSeed(`${worldSeed}|aurora|${dayIndex}`));
  let aurora = { active: false, intensity: 0 };
  if (storm) {
    aurora = { active: true, intensity: 0.45 + nightRng() * 0.55 };
  } else if (nightRng() < 0.05) {
    aurora = { active: true, intensity: 0.25 + nightRng() * 0.2 };
  }

  return { dayIndex, baseline, shower, aurora };
}

// ---------------------------------------------------------------------------
// Alignments on a day
// ---------------------------------------------------------------------------

/**
 * The cycle phases at which a moon crosses the giant's
 * face center TODAY: solve cycle · orbits ≡ 0.25 − phase
 * − drift · t (mod 1) for each whole orbit, keeping only
 * the phases when the giant is up (cycle ∈ [0.75, 1) ∪
 * [0, 0.25) — the rig's planetUp window).
 */
function transitCentersAt(moonIndex: number, tDays: number): number[] {
  const orbits = MOON_ORBITS_PER_CYCLE[moonIndex];
  const target =
    ((0.25 - MOON_PHASE[moonIndex] - MOON_DRIFT_PER_DAY[moonIndex] * tDays) % 1 + 1) % 1;
  const centers: number[] = [];
  for (let k = 0; k < orbits; k++) {
    const cycle = (target + k) / orbits;
    if (cycle >= 0.75 || cycle < 0.25) centers.push(cycle);
  }
  return centers.sort((a, b) => a - b);
}

export function alignmentsOn(roster: SkyRoster, dayIndex: number): AlignmentEvent[] {
  void roster; // alignments ride the shared moon table, not the roster
  const perMoon = [0, 1, 2].map((m) => transitCentersAt(m, dayIndex));
  const events: AlignmentEvent[] = [];

  // Double transits — defined NARROWLY, on purpose. With
  // whole orbits per cycle, every night is full of moon
  // crossings and near-misses; a loose definition fires
  // on most nights and an alignment that happens most
  // nights is not an alignment (the lab harness measured
  // a loose version at 57% of days). So: only the two
  // DRIFTING moons (1 and 2), centers within 0.006 of
  // cycle (~4 s — the discs genuinely share the face),
  // and the shared center in the giant's high band
  // (planetT 0.3..0.7), where anyone looking up would
  // actually see it. That is the dated rarity the drift
  // exists to create.
  for (const ca of perMoon[1]) {
    for (const cb of perMoon[2]) {
      const gap = Math.min(Math.abs(ca - cb), 1 - Math.abs(ca - cb));
      if (gap >= 0.006) continue;
      const at = ca >= 0.75 || cb >= 0.75 ? Math.max(ca, cb) : ca;
      const planetT = at >= 0.75 ? (at - 0.75) / 0.5 : (at + 0.25) / 0.5;
      if (planetT >= 0.3 && planetT <= 0.7) {
        events.push({ kind: 'double_transit', atCycle: at, moonIndices: [1, 2] });
      }
    }
  }

  // High transits: a lone moon crossing while the giant is
  // near its peak (planetT 0.35..0.65 => cycle within the
  // middle of the up-window). Common enough to notice,
  // worth listing for the Field Notes shelf later.
  const isDouble = (cycle: number) =>
    events.some((e) => Math.abs(e.atCycle - cycle) < 0.02);
  for (let m = 0; m < 3; m++) {
    for (const c of perMoon[m]) {
      const planetT = c >= 0.75 ? (c - 0.75) / 0.5 : (c + 0.25) / 0.5;
      if (planetT >= 0.35 && planetT <= 0.65 && !isDouble(c)) {
        events.push({ kind: 'high_transit', atCycle: c, moonIndices: [m] });
      }
    }
  }

  return events.sort((a, b) => a.atCycle - b.atCycle);
}
