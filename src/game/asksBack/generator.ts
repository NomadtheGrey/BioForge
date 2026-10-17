// =====================================================================
// THE WORLD ASKS BACK — the deterministic saga generator (S2, ported
// from the lab's generator.mts, 2026-10-16)
// =====================================================================
//
// Same (worldSeed, zone, day, profile, salt) → same saga. Targets are
// picked from the zone's REAL census (catalog.zoneFacts), so a saga
// can only ask for things that are actually there; the zone's
// consequence state (S2 read-side: long-term removals, abundance
// shifts) is applied on top, so culled species are never offered.
//
// THE WRITER REGISTRY is the generator's contract with the sim: a
// beat is only dealt when its goal's signal has a writer. An
// unwritable OPTIONAL beat is skipped; an unwritable MANDATORY beat
// (anchor/need/resolution) fails the arc. This is how the engine
// keeps its promise — it never offers a saga it cannot latch.
// S3 unlocks: chooseBranch, resolveBranch, echoResolve (and the echo
// overlays' takeArtifact / markMemorial).

import { Dice, questSeed, questId } from './rng';
import {
  zoneFacts,
  faunaName,
  floraName,
  itemName,
  familyLabel,
  isTameable,
  isHunter,
  isHarvestable,
  hasSeedRecipe,
  harvestItem,
  rewardTierForHops,
  rewardItems,
  type ZoneFacts,
} from './catalog';
import {
  SAGA_ARCS,
  OPTIONAL_BEATS,
  ABSTRACT_OVERRIDE,
  fill,
  wherePhrases,
  isProposed,
  proposedSignal,
  slotsFilled,
  type GameProfile,
  type ResolvedTarget,
  type StepGoal,
  type TargetSel,
  type BeatKind,
  type Slots,
  type SagaArc,
} from './templates';
import {
  type AsksOffer,
  type AsksStep,
  type AsksGoal,
  type AsksOwner,
} from '../asksBackState';

// ── the writer registry ────────────────────────────────────────────
// Every PROPOSED signal the sim can actually write today. Beats
// naming anything else are not dealt (see header). revisitZone needs
// no new writer — the S1 zoneVisits log already carries first/last
// days per zone, which is what "return after N days" latches on.

export const WRITTEN_SIGNALS: ReadonlySet<string> = new Set([
  'witnessFauna', // 'witness' events (field-note inversion + scans)
  'witnessFlora', // 'witness' events keyed to flora
  'tameFauna', // 'tame'
  'feedFauna', // 'feed' (hearth-dog only today; no arc uses it yet)
  'cullFauna', // 'cull'
  'sampleFauna', // 'sample'
  'harvestFlora', // 'harvest'
  'plantFlora', // 'plant'
  'buildStructure', // 'build'
  'surveyPoints', // 'survey' — the S2 space observer
  'weatherWitness', // 'weather' — the S2 space observer
  'revisitZone', // zoneVisits first/last days (S3 latches it)
]);

/** S3's unlock list — signals the generator will honor once writers exist. */
export const PENDING_SIGNALS: ReadonlySet<string> = new Set([
  'chooseBranch',
  'resolveBranch',
  'echoResolve',
  'takeArtifact',
  'markMemorial',
]);

function goalWritable(goal: StepGoal): boolean {
  if (!isProposed(goal)) return true; // real QuestGoal kinds always latch
  return WRITTEN_SIGNALS.has(proposedSignal(goal) ?? '');
}

export interface SagaOpts {
  /** Force this arc only (echo-fed arcs). */
  arcId?: string;
  /** Force the saga's anchor: { domain, id, name }. The caller
   *  guarantees census membership — used for settled individuals
   *  (by name) and world-memory echoes. */
  echoAnchor?: {
    domain: ResolvedTarget['domain'];
    id: string;
    name: string;
    individual?: string;
  } | null;
  /** Salt for the top-level quest seed (Director candidates). */
  salt?: string;
  /** Exclude these arc ids (e.g. the Precursor rarity cap). */
  excludeArcs?: string[];
  /** Species removed from this zone long-term (saga consequences). */
  removed?: Set<string>;
  /** Abundance multipliers for this zone — target picks are weighted. */
  abundance?: Map<string, number>;
  /** Force a size class (Director pacing). */
  forceSize?: 'short' | 'long';
  /** The abstract-anchor ban — always on in the game. */
  noAbstract?: boolean;
}

const NONE_TARGET: ResolvedTarget = { domain: 'none', id: 'none', name: '' };

// ── target resolution from the real census ─────────────────────────

export interface PickOpts {
  excludeId?: string;
  removed?: Set<string>;
  abundance?: Map<string, number>;
}

function pickTarget(
  zone: ZoneFacts,
  sel: TargetSel,
  dice: Dice,
  popts?: PickOpts,
): ResolvedTarget | null {
  if (sel.domain === 'none') return { ...NONE_TARGET };
  // Concrete non-census anchors: the ruin in this zone, or home
  // itself. Not census picks — the eligibility gate already proved
  // them real (zone.hasRuin for ruins; home always exists).
  if (sel.domain === 'ruin') return { domain: 'ruin', id: 'ruin', name: 'the ruin' };
  if (sel.domain === 'home') return { domain: 'home', id: 'home', name: 'home' };
  const gone = (id: string) => popts?.removed?.has(id) ?? false;
  const weightOf = (id: string): number => {
    const w = popts?.abundance?.get(id);
    return w === undefined ? 1 : Math.max(0, w);
  };
  const weightedPick = (pool: string[]): string => {
    const entries = pool.map((id) => [id, weightOf(id)] as [string, number]);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (total <= 0) return pool[0];
    return dice.weighted(entries);
  };
  if (sel.domain === 'fauna') {
    let pool = zone.censusFauna.filter((id) => !gone(id));
    if (sel.filter === 'tameable') pool = pool.filter(isTameable);
    if (sel.filter === 'hunter') pool = pool.filter(isHunter);
    if (popts?.excludeId) {
      const rest = pool.filter((id) => id !== popts.excludeId);
      if (rest.length > 0) pool = rest;
    }
    if (pool.length === 0) return null;
    const id = weightedPick(pool);
    return { domain: 'fauna', id, name: faunaName(id) };
  }
  // flora
  let pool = zone.censusFlora.filter((id) => !gone(id));
  if (sel.filter === 'harvestable') pool = pool.filter(isHarvestable);
  if (sel.filter === 'seedable')
    pool = pool.filter((id) => isHarvestable(id) && hasSeedRecipe(id));
  if (popts?.excludeId) {
    const rest = pool.filter((id) => id !== popts.excludeId);
    if (rest.length > 0) pool = rest;
  }
  if (pool.length === 0) return null;
  const id = weightedPick(pool);
  return { domain: 'flora', id, name: floraName(id) };
}

/** Resolve __HARVEST_ITEM:<floraId>__ placeholders to real item ids. */
function resolveGoal(goal: StepGoal): StepGoal | null {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const m = /^__HARVEST_ITEM:(.+)__$/.exec(v);
      if (m) return harvestItem(m[1]) ?? null;
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        const r = walk(x);
        if (r === null) return null;
        out[k] = r;
      }
      return out;
    }
    return v;
  };
  const r = walk(goal);
  return r === null ? null : (r as StepGoal);
}

// ── slot assembly ──────────────────────────────────────────────────

export function baseSlots(zone: ZoneFacts, dice: Dice): Slots {
  const w = zone.weather;
  return {
    Zone: zone.name,
    zone: zone.name.toLowerCase(),
    family: familyLabel(zone.families[0]),
    family2: zone.families[1]
      ? familyLabel(zone.families[1])
      : familyLabel(zone.families[0]),
    Family: cap(familyLabel(zone.families[0])),
    Family2: zone.families[1]
      ? cap(familyLabel(zone.families[1]))
      : cap(familyLabel(zone.families[0])),
    hybrid: zone.hybrid ? zone.hybrid.name : familyLabel(zone.families[0]),
    weather: w,
    Weather: w.charAt(0).toUpperCase() + w.slice(1),
    hops: zone.hops === 1 ? '1 zone' : `${zone.hops} zones`,
    where: wherePhrases(dice),
    where2: wherePhrases(dice),
  };
}

export function targetSlots(
  slots: Slots,
  anchor: ResolvedTarget | null,
  bt: ResolvedTarget,
): Slots {
  const s = { ...slots };
  // {species}/{flora} name the anchor's creature/plant when the anchor
  // is one; otherwise they name the beat target's. {species2}/{flora2}
  // always name the beat target when it is a creature/plant.
  const aFauna = anchor && anchor.domain === 'fauna' ? anchor : null;
  const aFlora = anchor && anchor.domain === 'flora' ? anchor : null;
  const bFauna = bt.domain === 'fauna' ? bt : null;
  const bFlora = bt.domain === 'flora' ? bt : null;
  const sp = aFauna ?? bFauna;
  if (sp) {
    s['Species'] = cap(sp.name);
    s['species'] = sp.name;
  }
  const fl = aFlora ?? bFlora;
  if (fl) {
    s['Flora'] = cap(fl.name);
    s['flora'] = fl.name;
  }
  if (bFauna) {
    s['Species2'] = cap(bFauna.name);
    s['species2'] = bFauna.name;
  }
  if (bFlora) {
    s['Flora2'] = cap(bFlora.name);
    s['flora2'] = bFlora.name;
  }
  return s;
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pull a numeric {count} out of a goal's detail, when present. */
export function countSlot(goal: StepGoal): number | null {
  if (isProposed(goal)) {
    const c = (goal as { detail: Record<string, unknown> }).detail.count;
    return typeof c === 'number' ? c : null;
  }
  const c = (goal as Record<string, unknown>).count;
  return typeof c === 'number' ? c : null;
}

/** Pull the resolved item name for an {item} slot. */
export function itemSlot(goal: StepGoal): string | null {
  const id = (goal as Record<string, unknown>).itemId;
  return typeof id === 'string' ? itemName(id) : null;
}

// ── offerability: the generator's self-proof ───────────────────────
// The lab had a separate validator; in the game these checks run
// inline at generation — a saga is only returned when every one
// holds. (Census membership is already guaranteed by pickTarget;
// these are the checks pickTarget can't do.)

const CONCRETE_DOMAINS = new Set(['fauna', 'flora', 'ruin', 'home']);

function assertOfferable(
  steps: { title: string; text: string; target: { domain: string } }[],
): boolean {
  // 1. no unfilled slots anywhere (the slot-richness rule's backstop).
  for (const s of steps) {
    if (!slotsFilled(s.title) || !slotsFilled(s.text)) return false;
    if (s.title.length < 3 || s.text.length < 20) return false;
  }
  // 2. the abstract-anchor ban: ≥1 concrete anchor (fauna / flora /
  //    ruin / home). A saga about nothing in particular is not offered.
  return steps.some((s) => CONCRETE_DOMAINS.has(s.target.domain));
}

// ── sagas ──────────────────────────────────────────────────────────

const BEAT_ORDER: BeatKind[] = [
  'anchor',
  'need',
  'investigation',
  'complication',
  'choice',
  'resolution',
  'echo',
];

/** The (arc, anchor) key for the Director's per-anchor cooldown. */
export function nearKey(arc: string, anchor: { domain: string; id: string }): string {
  return `${arc}|${anchor.domain}:${anchor.id}`;
}

function toAsksGoal(goal: StepGoal): AsksGoal {
  if (isProposed(goal)) {
    const g = goal as { signal: string; detail: Record<string, unknown> };
    return { kind: 'PROPOSED', signal: g.signal, detail: g.detail };
  }
  return { kind: 'KNOWN', goal };
}

export function generateSaga(
  worldSeed: string,
  zx: number,
  zz: number,
  day: number,
  profile: GameProfile,
  owner: AsksOwner,
  opts?: SagaOpts,
): AsksOffer | null {
  const zone = zoneFacts(worldSeed, zx, zz);
  const dice = new Dice(
    questSeed(worldSeed, zx, zz, day, profile.tag, opts?.salt ?? 'saga'),
  );
  const order = dice.shuffled(SAGA_ARCS);
  for (const arc of order) {
    // echo-only arcs never roll spontaneously; the Precursor cap can
    // exclude flagged arcs from a rotation.
    if (arc.echoOnly && opts?.arcId !== arc.id) continue;
    if (opts?.arcId && arc.id !== opts.arcId) continue;
    if (opts?.excludeArcs?.includes(arc.id)) continue;
    const saga = trySaga(arc, worldSeed, zone, day, profile, owner, dice, opts);
    if (saga) return saga;
  }
  return null;
}

function trySaga(
  arc: SagaArc,
  worldSeed: string,
  zone: ZoneFacts,
  day: number,
  profile: GameProfile,
  owner: AsksOwner,
  dice: Dice,
  opts?: SagaOpts,
): AsksOffer | null {
  if (profile.gearTier < arc.minGearTier) return null;
  if (!arc.eligible(zone)) return null;
  // The anchor may be forced — a settled individual by name (the
  // round-3 rider: consequences come back by name) or a world-memory
  // echo's entity. The caller guarantees census membership.
  let anchorT: ResolvedTarget;
  if (opts?.echoAnchor) {
    anchorT = {
      domain: opts.echoAnchor.domain,
      id: opts.echoAnchor.id,
      name: opts.echoAnchor.individual ?? opts.echoAnchor.name,
    };
  } else {
    const anchor = pickTarget(zone, arc.anchor, dice, {
      removed: opts?.removed,
      abundance: opts?.abundance,
    });
    if (!anchor && arc.anchor.domain !== 'none') return null;
    anchorT = anchor ?? { ...NONE_TARGET };
  }

  // Size class → target step count. Genuinely variable, not fixed.
  // The Director may force a size class (pacing).
  let sizeClass: string = dice.weighted([
    ['short', arc.sizeWeights[0]],
    ['standard', arc.sizeWeights[1]],
    ['epic', arc.sizeWeights[2]],
  ] as [string, number][]);
  if (opts?.forceSize === 'short') sizeClass = 'short';
  if (opts?.forceSize === 'long')
    sizeClass = dice.chance(0.6) ? 'epic' : 'standard';
  const targetLen =
    sizeClass === 'short'
      ? dice.int(2, 3)
      : sizeClass === 'standard'
        ? dice.int(3, 4)
        : dice.int(4, 6);

  // Mandatory skeleton: anchor + resolution, plus need when length allows.
  const byBeat = new Map<BeatKind, (typeof arc.beats)[number]>();
  for (const b of arc.beats) byBeat.set(b.beat, b);
  const chosen: BeatKind[] = ['anchor', 'resolution'];
  if (targetLen >= 3 && byBeat.has('need')) chosen.push('need');
  const optionals = dice.shuffled(
    arc.beats.filter((b) => OPTIONAL_BEATS.includes(b.beat)).map((b) => b.beat),
  );
  for (const o of optionals) {
    if (chosen.length >= targetLen) break;
    chosen.push(o);
  }
  chosen.sort((a, b) => BEAT_ORDER.indexOf(a) - BEAT_ORDER.indexOf(b));

  const noAbstract = opts?.noAbstract ?? true;
  const steps: AsksStep[] = [];
  const base = baseSlots(zone, dice);
  const usedPairs = new Set<string>();
  const anchorOrNull =
    anchorT.domain === 'none' ||
    anchorT.domain === 'ruin' ||
    anchorT.domain === 'home'
      ? null
      : anchorT;
  let n = 0;
  for (const beat of chosen) {
    const def = byBeat.get(beat);
    if (!def) return null; // arc missing a mandatory beat = authoring bug
    // Place the beat; on a duplicate (goal,target) pair, retry with
    // fresh dice up to 3 times, then skip optional beats or fail the arc.
    let placed = false;
    for (let attempt = 0; attempt < 3 && !placed; attempt++) {
      const d =
        attempt === 0
          ? dice
          : new Dice(
              questSeed(
                worldSeed,
                zone.zx,
                zone.zz,
                day,
                profile.tag,
                `saga-beat-${beat}-${attempt}`,
              ),
            );
      const sel: TargetSel | 'ANCHOR' = noAbstract
        ? (ABSTRACT_OVERRIDE[`${arc.id}:${beat}`] ?? def.target)
        : def.target;
      const bt =
        sel === 'ANCHOR'
          ? anchorT
          : pickTarget(zone, sel, d, {
              excludeId: anchorT.id,
              removed: opts?.removed,
              abundance: opts?.abundance,
            });
      if (!bt) break;
      const rawGoal = def.goalFor(anchorOrNull, bt, zone, d);
      const goal = resolveGoal(rawGoal);
      if (!goal) break;
      // THE WRITER REGISTRY: a beat whose signal has no writer is not
      // dealt. Mandatory beats fail the arc; optional beats are skipped.
      if (!goalWritable(goal)) {
        if (beat === 'anchor' || beat === 'need' || beat === 'resolution')
          return null;
        break; // skip this optional beat
      }
      const pairKey = `${JSON.stringify(goal)}|${bt.domain}:${bt.id}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);
      n++;
      const slots = targetSlots(base, anchorOrNull, bt);
      const c = countSlot(goal);
      if (c !== null) {
        slots['count'] = c;
        slots['Count'] = c;
      }
      const item = itemSlot(goal);
      if (item) {
        slots['item'] = item;
        slots['Item'] = cap(item);
      }
      steps.push({
        n,
        beat,
        title: fill(d.pick(def.titles), slots),
        text: fill(d.pick(def.texts), slots),
        goal: toAsksGoal(goal),
        target: { domain: bt.domain, id: bt.id, name: bt.name },
      });
      placed = true;
    }
    if (!placed) {
      if (beat === 'anchor' || beat === 'need' || beat === 'resolution')
        return null;
      continue; // skip the optional beat; the saga stays grammatical
    }
  }

  if (!assertOfferable(steps)) return null;

  const aslots = targetSlots(
    base,
    anchorT.domain === 'none' ? null : anchorT,
    anchorT,
  );
  const tier = Math.min(
    3,
    rewardTierForHops(zone.hops) + (sizeClass === 'epic' ? 1 : 0),
  );
  return {
    id: questId(worldSeed, zone.zx, zone.zz, day, profile.tag, arc.id),
    arc: arc.id,
    title: fill(dice.pick(arc.titles), aslots),
    text: fill(dice.pick(arc.texts), aslots),
    zx: zone.zx,
    zz: zone.zz,
    zoneKey: `${zone.zx},${zone.zz}`,
    zoneName: zone.name,
    day,
    steps,
    reward: {
      tier,
      items: rewardItems(tier, Math.min(3, steps.length), (k, a) =>
        dice.shuffled(a).slice(0, k),
      ),
    },
    cooldownTags: [arc.cooldownTag(anchorT), `zone:${zone.zx},${zone.zz}`],
    owner,
  };
}
