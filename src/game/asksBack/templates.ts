// =====================================================================
// THE WORLD ASKS BACK — the authored saga template library (S2,
// ported from the lab's templates.mts, 2026-10-16)
// =====================================================================
//
// Every title and text is a fixed authored fragment with {slots}.
// The generator fills slots from real zone data and rolls counts; it
// never invents prose. That is the whole "no AI gen" guarantee:
// variety comes from targets × zones × counts × arcs, never from
// generated sentences.
//
// SAGAS ONLY — Adam ruled against one-task quests (2026-10-16), so
// the lab's 13 World Request templates are NOT ported; their verbs
// survive only as beats inside arcs. Every arc is 2–6 steps on the
// grammar: Anchor → Need → [Investigation] → [Complication] →
// [Choice] → Resolution → [Echo]. Bracketed beats are optional; the
// generator deals them from a seeded shuffle to hit a rolled size.
//
// Goals use the game's real QuestGoal kinds where a step maps onto
// one; anything else is { kind: 'PROPOSED', signal, detail } — a
// signal the sim must write. The generator NEVER deals a beat whose
// signal has no writer (see WRITTEN_SIGNALS in generator.ts): an
// unwritable optional beat is skipped, an unwritable mandatory beat
// fails the arc.
//
// Authoring rules the lab proved (kept here as law):
// - every fragment fills ≥2 varying slots (the slot-richness rule —
//   measured 36.7% → 26.7% byte-identical repetition);
// - abstract anchors are banned (round 3): ABSTRACT_OVERRIDE below
//   re-anchors every zone-name-only beat to concrete census content.

import type { ZoneFacts } from './catalog';
import type { Dice } from './rng';

export interface GameProfile {
  tag: string;
  /** 0 hearthlands … 3 far weird. In-game this is exploration-gated
   *  (see director.ts profileForState), not gear-gated. */
  gearTier: number;
}

export interface ResolvedTarget {
  domain: 'fauna' | 'flora' | 'zone' | 'ruin' | 'home' | 'none';
  id: string;
  name: string;
}

/**
 * A step goal. The KNOWN arms mirror src/game/quests.ts QuestGoal
 * kinds the dynamic layer is allowed to use (the full QuestGoal
 * union is wider — authored quests keep the rest). PROPOSED arms
 * name a sim signal; the writer registry decides if the beat ships.
 */
export type StepGoal =
  | { kind: 'ruinEnter' }
  | { kind: 'glyphRuins'; count: number }
  | { kind: 'heart' }
  | { kind: 'zoneHybrid' }
  | { kind: 'zoneTier3' }
  | { kind: 'gardenHarvest' }
  | { kind: 'itemCount'; itemId: string; count: number }
  | { kind: 'PROPOSED'; signal: string; detail: Record<string, unknown> };

export function isProposed(g: StepGoal): boolean {
  return g.kind === 'PROPOSED';
}
export function proposedSignal(g: StepGoal): string | null {
  return g.kind === 'PROPOSED' ? (g as { signal: string }).signal : null;
}

// ── slot filling ───────────────────────────────────────────────────

export type Slots = Record<string, string | number>;

export function fill(text: string, slots: Slots): string {
  return text.replace(
    /\{(\w+)\}/g,
    (_, k: string) => (slots[k] !== undefined ? String(slots[k]) : `{${k}}`),
  );
}

/** True when every slot in the text was filled. */
export function slotsFilled(text: string): boolean {
  return !/\{(\w+)\}/.test(text);
}

// ── target selection ───────────────────────────────────────────────

export interface TargetSel {
  domain: 'fauna' | 'flora' | 'none' | 'ruin' | 'home' | 'zone';
  filter?: 'any' | 'tameable' | 'hunter' | 'harvestable' | 'seedable';
}

export function wherePhrases(dice: Dice): string {
  // Small pool, visibly recycles (lab round 1) — the cheap variety
  // lever is more fragments per template, not a bigger pool here.
  return dice.pick([
    'near the treeline',
    'by the water',
    'on the high ground',
    'where the ground changes color',
    'downwind of the old growth',
    "at the meadow's edge",
    'in the quiet part',
    'past the stones',
  ]);
}

// ── Saga arcs ──────────────────────────────────────────────────────

export type BeatKind =
  | 'anchor'
  | 'need'
  | 'investigation'
  | 'complication'
  | 'choice'
  | 'resolution'
  | 'echo';

export interface SagaBeat {
  beat: BeatKind;
  titles: string[];
  texts: string[];
  /** 'ANCHOR' = reuse the saga's anchor target; a TargetSel = new target. */
  target: TargetSel | 'ANCHOR';
  goalFor: (
    anchor: ResolvedTarget | null,
    t: ResolvedTarget,
    zone: ZoneFacts,
    dice: Dice,
  ) => StepGoal;
}

export interface SagaArc {
  id: string;
  styles: string[];
  minGearTier: number;
  anchor: TargetSel;
  eligible: (zone: ZoneFacts) => boolean;
  sizeWeights: [number, number, number]; // short, standard, epic
  titles: string[];
  texts: string[];
  beats: SagaBeat[];
  cooldownTag: (anchor: ResolvedTarget) => string;
  /** True when this arc is offered ONLY when a world-memory echo
   *  feeds it (never rolled spontaneously). */
  echoOnly?: boolean;
  /** Precursor-flavored arcs are rarity-capped by the Director. */
  precursor?: boolean;
}

const ANCHOR: 'ANCHOR' = 'ANCHOR';

export const SAGA_ARCS: SagaArc[] = [
  {
    id: 'saga_lost_one',
    styles: ['Animal Lovers'],
    minGearTier: 0,
    anchor: { domain: 'fauna', filter: 'any' },
    eligible: () => true,
    sizeWeights: [3, 5, 2],
    titles: ['The Lost One', '{Species}, Alone'],
    texts: [
      'Something in {Zone} has lost its way: a {species}, separated and circling. Follow the thread. See where it leads.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: ANCHOR,
        titles: ['Signs of the {Species}'],
        texts: [
          'Tracks {where} in {Zone}. Fresh. Something with four soft feet and no herd.',
        ],
        goalFor: () => ({
          kind: 'PROPOSED',
          signal: 'surveyPoints',
          detail: { count: 2 },
        }),
      },
      {
        beat: 'need',
        target: ANCHOR,
        titles: ['Find It'],
        texts: [
          'It is close now — a {species}, alone {where}. Witness it. Let it see you seeing it.',
        ],
        goalFor: (a) => ({
          kind: 'PROPOSED',
          signal: 'witnessFauna',
          detail: { species: a!.id },
        }),
      },
      {
        beat: 'complication',
        target: { domain: 'none' },
        titles: ['{Weather} Coming'],
        texts: [
          'The sky over {Zone} is turning. {Weather} will scatter every trail — be out in it before the signs wash away.',
        ],
        goalFor: (_a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'weatherWitness',
          detail: { mode: z.weather },
        }),
      },
      {
        beat: 'resolution',
        target: ANCHOR,
        titles: ['Bring It In'],
        texts: [
          'It is tired, and it has decided you are not a threat. Feed it, gentle it home — tame the {species}, or walk it to your hearth either way.',
        ],
        goalFor: (a) => ({
          kind: 'PROPOSED',
          signal: 'tameFauna',
          detail: { species: a!.id },
        }),
      },
      {
        beat: 'echo',
        target: ANCHOR,
        titles: ['After'],
        texts: [
          'Come back to {Zone} in a few days. See whether the {species} stayed, or whether the wild took it back — either answer is an answer.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: z.zx, zz: z.zz, afterDays: 3 },
        }),
      },
    ],
    cooldownTag: (a) => `lost:${a.id}`,
  },
  {
    id: 'saga_border_grows',
    styles: ['Explorers', 'Green Thumb'],
    minGearTier: 1,
    anchor: { domain: 'fauna', filter: 'any' },
    eligible: (z) => z.hybrid !== null,
    sizeWeights: [2, 5, 3],
    titles: ['Where {Family} Meets {Family2}', 'The Margin'],
    texts: [
      '{Zone} is margin country — {hybrid}, where {family} and {family2} argue into something new. Walk the argument. Learn its terms.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: { domain: 'none' },
        titles: ['Stand in the Margin'],
        texts: [
          "You are standing where two countries meet. The ground itself can't decide. Cross into the margin and let it read you.",
        ],
        goalFor: () => ({ kind: 'zoneHybrid' }),
      },
      {
        beat: 'need',
        target: { domain: 'flora', filter: 'harvestable' },
        titles: ['Taste Both Parents'],
        texts: [
          'Every margin has parents. Harvest the {flora} — it belongs to one side of the argument. Hold it up against the middle.',
        ],
        goalFor: (a, t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'harvestFlora',
          detail: { flora: t.id, count: dice.int(2, 4) },
        }),
      },
      {
        beat: 'investigation',
        target: { domain: 'none' },
        titles: ['Map the Seam'],
        texts: [
          'Walk the seam and mark {count} points where the margin is strongest — where neither parent country reaches.',
        ],
        goalFor: (_a, _t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'surveyPoints',
          detail: { count: dice.int(2, 3) },
        }),
      },
      {
        beat: 'resolution',
        target: { domain: 'flora', filter: 'seedable' },
        titles: ['Plant the Middle'],
        texts: [
          'The margin taught you its grammar. Sow {flora} in the middle ground — not to claim it, to join the argument. The {species} of the margin will inspect your work. Let them.',
        ],
        goalFor: (a, t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'plantFlora',
          detail: { flora: t.id, count: dice.int(2, 3) },
        }),
      },
      {
        beat: 'echo',
        target: ANCHOR,
        titles: ['What the Margin Kept'],
        texts: [
          'Return to {Zone} after some days. Margins remember gardeners — see what the middle kept of your planting, and whether the {species} approved.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: z.zx, zz: z.zz, afterDays: 4 },
        }),
      },
    ],
    cooldownTag: () => 'margin:saga',
  },
  {
    id: 'saga_ruin_remembers',
    styles: ['Explorers', 'Completionists'],
    minGearTier: 1,
    anchor: { domain: 'ruin' },
    eligible: (z) => z.hasRuin,
    sizeWeights: [2, 4, 4],
    precursor: true,
    titles: ['What the Ruin Remembers', 'The Dead Place in {Zone}'],
    texts: [
      'The ruin in {Zone} has been quiet a long time, but quiet is not empty. Go carefully. Read what it left on the walls.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: { domain: 'none' },
        titles: ['Step Inside'],
        texts: [
          'The door is open and has been open for centuries. Cross the threshold of the ruin in {Zone}.',
        ],
        goalFor: () => ({ kind: 'ruinEnter' }),
      },
      {
        beat: 'need',
        target: { domain: 'none' },
        titles: ['The Walls Talk'],
        texts: [
          'Glyphs, {where} — half-erased, deliberate. Read {count} of them before the light goes.',
        ],
        goalFor: (_a, _t, _z, dice) => ({ kind: 'glyphRuins', count: dice.int(2, 3) }),
      },
      {
        beat: 'investigation',
        target: { domain: 'none' },
        titles: ['The Deep Rooms'],
        texts: [
          "The story's heart is never near the door. Map {count} points in the deep rooms — where the ruin stops pretending to be empty.",
        ],
        goalFor: (_a, _t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'surveyPoints',
          detail: { count: dice.int(2, 3) },
        }),
      },
      {
        beat: 'complication',
        target: { domain: 'fauna', filter: 'hunter' },
        titles: ['Something Lives Here Now'],
        texts: [
          'The ruin has a tenant: a {species}. It was here first. Drive it off or put it down — {count}, no more.',
        ],
        goalFor: (a, t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'cullFauna',
          detail: { species: t.id, count: dice.int(1, 2) },
        }),
      },
      {
        beat: 'resolution',
        target: { domain: 'none' },
        titles: ['The Heart Room'],
        texts: [
          'Every dead place has one room it was built around. Find the heart room. Stand in it. Let it finish its sentence.',
        ],
        goalFor: () => ({ kind: 'heart' }),
      },
      {
        beat: 'echo',
        target: { domain: 'none' },
        titles: ['After the Reading'],
        texts: [
          'Come back when you have slept on it. Ruins reread differently — the second visit is part of the quest, not an afterthought.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: z.zx, zz: z.zz, afterDays: 2 },
        }),
      },
    ],
    cooldownTag: () => 'ruin:saga',
  },
  {
    id: 'saga_home_hunger',
    styles: ['Builders'],
    minGearTier: 0,
    anchor: { domain: 'home' },
    eligible: () => true,
    sizeWeights: [3, 5, 2],
    titles: ['What Home Is Hungry For', 'The Hearth Asks'],
    texts: [
      'Home is an organism, and organisms get hungry. Yours wants something from {family} country — {Zone}, {hops} from the hearth.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: { domain: 'flora', filter: 'harvestable' },
        titles: ['The First Craving'],
        texts: [
          'It started with a smell on the wind: {flora}. Bring {count} of it home from {Zone}.',
        ],
        goalFor: (a, t, _z, dice) => {
          const n = dice.int(3, 5);
          return {
            kind: 'itemCount',
            itemId: `__HARVEST_ITEM:${t.id}__`,
            count: n,
          } as StepGoal;
        },
      },
      {
        beat: 'need',
        target: { domain: 'flora', filter: 'harvestable' },
        titles: ['The Second Craving'],
        texts: [
          'One hunger answered, another named: {flora} this time, {count} of it. Home is specific about what it wants.',
        ],
        goalFor: (a, t, _z, dice) => {
          const n = dice.int(3, 5);
          return {
            kind: 'itemCount',
            itemId: `__HARVEST_ITEM:${t.id}__`,
            count: n,
          } as StepGoal;
        },
      },
      {
        beat: 'resolution',
        target: { domain: 'none' },
        titles: ['Feed the House'],
        texts: [
          "Grow something at home with what you brought — a wall, a floor, a room that wasn't there. Home eats building the way you eat bread.",
        ],
        goalFor: () => ({
          kind: 'PROPOSED',
          signal: 'buildStructure',
          detail: { structure: 'ANY_GROWN' },
        }),
      },
      {
        beat: 'echo',
        target: { domain: 'home' },
        titles: ['How the House Digests'],
        texts: [
          'Sleep a few days, then look at what you grew. Living architecture settles — see what yours settled into.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: 0, zz: 0, afterDays: 3 },
        }),
      },
    ],
    cooldownTag: () => 'home:hunger',
  },
  {
    id: 'saga_bloom_watch',
    styles: ['Green Thumb'],
    minGearTier: 0,
    anchor: { domain: 'flora', filter: 'harvestable' },
    eligible: () => true,
    sizeWeights: [3, 5, 2],
    titles: ['The Bloom Watch', '{Flora}, In Season'],
    texts: [
      'The {flora} in {Zone} is coming into season. Plants keep appointments — be there for this one, and it will remember you.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: ANCHOR,
        titles: ['First Buds'],
        texts: [
          'The {flora} {where} is budding. Mark it. Watch it. This is the beginning of the appointment.',
        ],
        goalFor: (a) => ({
          kind: 'PROPOSED',
          signal: 'witnessFlora',
          detail: { flora: a!.id },
        }),
      },
      {
        beat: 'need',
        target: ANCHOR,
        titles: ['The Hour'],
        texts: [
          'It is open now — {flora}, {count} harvests, at the hour it keeps. Crops do not wait, and neither does this quest.',
        ],
        goalFor: (a, _t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'harvestFlora',
          detail: { flora: a!.id, count: dice.int(3, 5) },
        }),
      },
      {
        beat: 'complication',
        target: { domain: 'fauna', filter: 'any' },
        titles: ['Rivals at the Bloom'],
        texts: [
          'You are not the only one who noticed. A {species} wants the {flora} too — drive it off, or share. The bloom will judge.',
        ],
        goalFor: (a, t) => ({
          kind: 'PROPOSED',
          signal: 'cullFauna',
          detail: { species: t.id, count: 1 },
        }),
      },
      {
        beat: 'resolution',
        target: ANCHOR,
        titles: ['Leave More Than You Took'],
        texts: [
          'The BioForge has the seeds. Sow {flora} back into {Zone} — {count} plantings — so next season is bigger than this one.',
        ],
        goalFor: (a, _t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'plantFlora',
          detail: { flora: a!.id, count: dice.int(2, 4) },
        }),
      },
      {
        beat: 'echo',
        target: ANCHOR,
        titles: ['Next Season'],
        texts: [
          'Come back when the cycle turns. If your planting took, {Zone} will show it — and the quest will know.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: z.zx, zz: z.zz, afterDays: 5 },
        }),
      },
    ],
    cooldownTag: (a) => `bloom:${a.id}`,
  },
  {
    id: 'saga_pack_pressure',
    styles: ['Hunters', 'Animal Lovers'],
    minGearTier: 1,
    anchor: { domain: 'fauna', filter: 'any' },
    eligible: () => true,
    sizeWeights: [2, 5, 3],
    titles: ['Teeth in {Zone}', 'The {Species} and the Hunter'],
    texts: [
      'Something is hunting in {Zone}, and the {species} know it. Pressure like this always ends in a decision — make it yours.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: ANCHOR,
        titles: ['The Nervous Herd'],
        texts: [
          'The {species} {where} are skittish, bunched, watching the treeline. Witness them — learn what fear looks like before you act on it.',
        ],
        goalFor: (a) => ({
          kind: 'PROPOSED',
          signal: 'witnessFauna',
          detail: { species: a!.id },
        }),
      },
      {
        beat: 'investigation',
        target: { domain: 'fauna', filter: 'hunter' },
        titles: ['Find the Teeth'],
        texts: [
          'There: a {species2}, {where2}. It is not evil — it is hungry. But hunger has a face now, and a name.',
        ],
        goalFor: (a, t) => ({
          kind: 'PROPOSED',
          signal: 'witnessFauna',
          detail: { species: t.id },
        }),
      },
      {
        beat: 'choice',
        target: { domain: 'fauna', filter: 'hunter' },
        titles: ['Choose'],
        texts: [
          'Two ways, both honest. Cull the hunter and the herd breathes easy — or protect the herd another way: feed them, move with them, stand between. Choose, and live with the {Zone} that results.',
        ],
        goalFor: (a, t) => ({
          kind: 'PROPOSED',
          signal: 'chooseBranch',
          detail: { options: [`cull:${t.id}`, `protect:${a?.id ?? 'herd'}`] },
        }),
      },
      {
        beat: 'resolution',
        target: ANCHOR,
        titles: ['What You Chose'],
        texts: [
          'Do what you decided — put down the hunter, or stand with the herd until the pressure passes. {Zone} will keep the score either way.',
        ],
        goalFor: (a, t) => ({
          kind: 'PROPOSED',
          signal: 'resolveBranch',
          detail: { anchor: a!.id },
        }),
      },
      {
        beat: 'echo',
        target: ANCHOR,
        titles: ['The New Balance'],
        texts: [
          'Return in a few days and read the new balance of {Zone}. Predators and prey renegotiate constantly — see what your vote bought.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: z.zx, zz: z.zz, afterDays: 4 },
        }),
      },
    ],
    cooldownTag: (a) => `pressure:${a.id}`,
  },
  {
    id: 'saga_far_country',
    styles: ['Explorers', 'Completionists'],
    minGearTier: 2,
    anchor: { domain: 'fauna', filter: 'any' },
    eligible: () => true,
    sizeWeights: [1, 4, 5],
    titles: ['The Far Country', 'Beyond the {Family}'],
    texts: [
      'The map has an edge, and past it, weather you have never stood in. {Zone} is the doorway — the far country is the room.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: { domain: 'none' },
        titles: ['The Doorway'],
        texts: [
          'Stand in {Zone} and look outward. Mark the doorway — one survey point where {family} country ends and the far country begins.',
        ],
        goalFor: () => ({
          kind: 'PROPOSED',
          signal: 'surveyPoints',
          detail: { count: 1 },
        }),
      },
      {
        beat: 'need',
        target: { domain: 'none' },
        titles: ['Stranger Ground'],
        texts: [
          'Find the tier-3 country — charged, living, or worse. Stand in it. Let it touch you and live to describe it.',
        ],
        goalFor: () => ({ kind: 'zoneTier3' }),
      },
      {
        beat: 'investigation',
        target: { domain: 'none' },
        titles: ['Read It'],
        texts: [
          'Map {count} points in the far country. The weird has geography too — learn its streets.',
        ],
        goalFor: (_a, _t, _z, dice) => ({
          kind: 'PROPOSED',
          signal: 'surveyPoints',
          detail: { count: dice.int(2, 4) },
        }),
      },
      {
        beat: 'resolution',
        target: ANCHOR,
        titles: ['What Lives Out There'],
        texts: [
          'Everything lives somewhere. Find the {species} of the far country — witness it, and bring the sight home like a lantern.',
        ],
        goalFor: (a) => ({
          kind: 'PROPOSED',
          signal: 'witnessFauna',
          detail: { species: a!.id },
        }),
      },
      {
        beat: 'echo',
        target: ANCHOR,
        titles: ['The Map, Redrawn'],
        texts: [
          'Come home. Look at your map with far-country eyes. The quest ends when the far country stops feeling far.',
        ],
        goalFor: (a, _t, _z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: 0, zz: 0, afterDays: 2 },
        }),
      },
    ],
    cooldownTag: () => 'far:saga',
  },
  // ── the echo-return arc ──────────────────────────────────────────
  // Offered ONLY when a world-memory echo (neglected / dead_anchor /
  // other unresolved outcomes) feeds it — never rolled spontaneously.
  // The anchor is forced from the echo record; kind-specific text
  // comes from authored echo overlays (S3). These base beats are
  // deliberately generic.
  {
    id: 'saga_echo_return',
    styles: ['Explorers', 'Animal Lovers'],
    minGearTier: 0,
    anchor: { domain: 'none' },
    eligible: () => true,
    echoOnly: true,
    sizeWeights: [5, 4, 1],
    titles: ['What {Zone} Kept', 'The Unanswered'],
    texts: [
      '{Zone} is owed a visit. Something there did not end the way it was left — go and see what the days did.',
    ],
    beats: [
      {
        beat: 'anchor',
        target: { domain: 'none' },
        titles: ['Go Back'],
        texts: [
          'Return to {Zone}. The way back is part of the quest — walk it like it matters, because it does.',
        ],
        goalFor: () => ({
          kind: 'PROPOSED',
          signal: 'surveyPoints',
          detail: { count: 1 },
        }),
      },
      {
        beat: 'need',
        target: ANCHOR,
        titles: ['Read What Changed'],
        texts: [
          'Look long at what is here now. Whatever ended here left a shape — learn the shape before you touch anything.',
        ],
        goalFor: (a, t) =>
          t.domain === 'fauna'
            ? {
                kind: 'PROPOSED',
                signal: 'witnessFauna',
                detail: { species: t.id },
              }
            : {
                kind: 'PROPOSED',
                signal: 'surveyPoints',
                detail: { count: 2 },
              },
      },
      {
        beat: 'resolution',
        target: ANCHOR,
        titles: ['Answer It'],
        texts: [
          'Do the thing the echo asks. Feed it, mark it, carry it, or let it go — but do it on purpose, and do it now.',
        ],
        goalFor: () => ({
          kind: 'PROPOSED',
          signal: 'echoResolve',
          detail: {},
        }),
      },
      {
        beat: 'echo',
        target: ANCHOR,
        titles: ['The Ledger'],
        texts: [
          'Come back in a few days and check the ledger. Answered echoes stay answered — unanswered ones find you again.',
        ],
        goalFor: (a, _t, z) => ({
          kind: 'PROPOSED',
          signal: 'revisitZone',
          detail: { zx: z.zx, zz: z.zz, afterDays: 3 },
        }),
      },
    ],
    cooldownTag: () => 'echo:return',
  },
];

/** Optional beats, in grammar order, that the generator may deal in. */
export const OPTIONAL_BEATS: BeatKind[] = [
  'investigation',
  'complication',
  'choice',
  'echo',
];

/**
 * Round-3 abstract-anchor ban (always on in the game). Beats whose
 * only varying slot was the zone name are re-anchored to concrete
 * census content: the saga's anchor creature, the ruin, or home.
 * Keyed arc:beat; 'ANCHOR' = the saga's anchor target.
 */
export const ABSTRACT_OVERRIDE: Record<string, TargetSel | 'ANCHOR'> = {
  'saga_lost_one:complication': 'ANCHOR',
  'saga_border_grows:anchor': 'ANCHOR',
  'saga_border_grows:investigation': 'ANCHOR',
  'saga_far_country:anchor': 'ANCHOR',
  'saga_far_country:need': 'ANCHOR',
  'saga_far_country:investigation': 'ANCHOR',
  'saga_ruin_remembers:anchor': { domain: 'ruin' },
  'saga_ruin_remembers:need': { domain: 'ruin' },
  'saga_ruin_remembers:investigation': { domain: 'ruin' },
  'saga_ruin_remembers:echo': { domain: 'ruin' },
  'saga_ruin_remembers:resolution': { domain: 'ruin' },
  'saga_home_hunger:resolution': { domain: 'home' },
  'saga_echo_return:anchor': 'ANCHOR',
};

/** True for the arcs the Director rarity-caps (see director.ts). */
export function isPrecursorArc(arcId: string): boolean {
  return SAGA_ARCS.some((a) => a.id === arcId && a.precursor === true);
}

/** Arc lookup by id. */
export function arcById(id: string): SagaArc | undefined {
  return SAGA_ARCS.find((a) => a.id === id);
}
