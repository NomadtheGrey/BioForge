/**
 * weaponsFamily — the grown arsenal as ONE family (Adam's work
 * order, 2026-10-17): the six strikers plus the shield line,
 * presented together in the codex and the pouch with their
 * kinds, tiers, and the rules that govern the ladder.
 *
 * THE FAMILY'S TWO SHAPES:
 * - STRIKERS (close / ranged) climb a ladder: one weapon per
 *   tier per kind, and a better tier is an UPGRADE, not a
 *   sibling — its recipe CONSUMES the lower weapon of the kind,
 *   so the pouch never holds two of a kind. Rules live in
 *   creatures/weapons.ts (WEAPONS); this module only presents.
 * - DEFENSIVES (the shield line) are a BRANCH, not a ladder:
 *   the Tier 2 Lantern Shield blocks exactly as the Tier 1
 *   Scute Shield — its tier buys the light, and its recipe is
 *   a combination (lantern + shield + resin + feeder), shown
 *   as the reason. They live in the Left Hand, not slot 7.
 *
 * DATA-DRIVEN BY DESIGN: striker entries assemble from the
 * WEAPONS table; defensive entries assemble from the shield
 * items' own data (kind: 'defensive' on the item's family
 * record) the moment the shield slice lands them — the
 * surfaces below need no per-item code either way.
 */

import type { ItemId } from '../../types/game';
import { ITEMS, RECIPES } from './constants';
import { WEAPONS, weaponOf } from '../creatures/weapons';

export type FamilyKind = 'close' | 'ranged' | 'defensive' | 'helmet' | 'boots';

export const FAMILY_KIND_LABEL: Record<FamilyKind, string> = {
  close: 'Close',
  ranged: 'Ranged',
  defensive: 'Defensive',
  helmet: 'Helmet',
  boots: 'Quicksteps',
};

export const FAMILY_KIND_BLURB: Record<FamilyKind, string> = {
  close: 'In-hand strikers. Reach, damage, and the flinch — a landed hit staggers what it strikes.',
  ranged: 'Fired strikers. The shot travels and aims at where the target stood — a moving target can be missed cleanly.',
  defensive: 'The Left Hand’s ward. Carried, it blunts frontal strikes for free; braced, it is a wall that stamina pays for.',
  helmet: 'The KNOW platform. The helm names the country, reads the dark, and listens for the places and lives worth walking for.',
  boots: 'The MOVE platform. One grown pair, and a growth for every impediment the country puts underfoot — wading, water, swimming, fire.',
};

export interface FamilyEntry {
  itemId: ItemId;
  kind: FamilyKind;
  tier: 1 | 2 | 3;
  /** Striker rules (damage etc.) when this entry is a striker;
   *  defensive entries carry their facts in the item text and
   *  the block copy the surfaces render from kind alone. */
  damage?: number;
  cooldownSeconds?: number;
  staminaCost?: number;
  reach?: number;
  flinchSeconds?: number;
  projectileSpeed?: number;
  burstRadius?: number;
  /**
   * SIGNATURE LINES, AS DATA (shield slice, 2026-10-17): the
   * defensive entries' distinguishing copy lives in the registry,
   * never hardcoded in a surface. The HUD lane renders these
   * verbatim in the dossiers — rear-passive with its
   * braced-stays-frontal rider, the Spore Answer with its graft
   * rider, Rooted with its own-walk rider, Shared Cover with its
   * lee + bearer-pays rider.
   */
  signatures?: string[];
}

/** The family entry for an item, or undefined when the item is
 *  no part of the arsenal. Strikers read from WEAPONS; a
 *  defensive entry appears when the shield data lands with
 *  its family record in DEFENSIVES below. */
export const DEFENSIVES: FamilyEntry[] = [
  {
    itemId: 'scute_shield',
    kind: 'defensive',
    tier: 1,
    signatures: [
      'Carried, it blunts frontal strikes for free — no stamina, no stagger, no slow.',
      'Braced (hold right-mouse), it is a wall: frontal strikes negated, the attacker staggered, at stamina\'s price.',
    ],
  },
  {
    itemId: 'lantern_shield',
    kind: 'defensive',
    tier: 2,
    signatures: [
      'The Tier 2 branch, not a ladder: it blocks exactly as the Scute Shield — the tier buys the light.',
      'A Hand Lantern-Fern grown into the shield\'s face; the light holds while held, and throws forward while braced.',
      'Grown by combination: its recipe consumes the lantern and the Scute Shield.',
    ],
  },
  {
    itemId: 'fenback_shield',
    kind: 'defensive',
    tier: 3,
    signatures: [
      'Consume-and-keep: grown from a Lantern Shield, it keeps the lamp and any spike graft — nothing the shield ate is lost.',
      'Rear passive coverage: the passive blunt wraps around the back. The BRACED wall stays frontal — facing still matters when raised.',
      'The Spore Answer: a braced block sheds a stagger-and-knockback spore burst around the bearer (grafted shields add thorn-pricks to the burst).',
      'Rooted Stance: while braced, no hit moves the bearer — charges slide off. The bearer\'s own braced walk tears and re-sets the roots.',
      'Shared Cover: while braced, an ally in the lee behind the bearer stands under the wall — blocked-for at braced grade, from the bearer\'s stamina.',
    ],
  },
  {
    // The Bulwark (Ingredient Sinks, 2026-10-17): the family's
    // second Tier 3 branch — the Fenback buys the wrap, the
    // Bulwark buys the pull. Its distinguishing copy lives
    // here like every defensive's; the pull's numbers are the
    // shields.ts constants (DROP_MAGNET_CARRIED / _BRACED),
    // stated in words so the dossier never drifts from them.
    itemId: 'lodestone_bulwark',
    kind: 'defensive',
    tier: 3,
    signatures: [
      'The second Tier 3 branch, not a ladder: grown from a Scute Shield — where the Fenback buys the wrap, the Bulwark buys the pull.',
      'The Pull: carried, dropped things drift toward you from nine meters out; pickup itself still asks you to arrive.',
      'Braced, the pull widens and quickens — thirteen meters, and the drift runs faster. A wall that gathers what the fight scattered.',
      'No lamp: the dark stays dark. Its tier buys reach, not light.',
      'Grown by combination: its recipe consumes the Scute Shield, two lodestone plates, carapace, and resin.',
    ],
  },
];

/**
 * THE HELMET LINE (Platforms Parallel, 2026-10-17): the KNOW
 * platform's family record, twin of DEFENSIVES above — the
 * base helm, its two listening growths, and the lens track.
 * The sonar subassemblies (antenna fan, receiver, housing,
 * power cell) are NOT here: they are ingredients the radar
 * is grown FROM, not upgrades a grower wears. Tiers are the
 * DISPLAY tiers the surfaces already show (GEAR_DISPLAY_TIER
 * pins where they exist — the radar at 2 — else the recipe
 * book's), so the dossier never contradicts the pouch.
 */
export const HELMETS: FamilyEntry[] = [
  {
    itemId: 'homestead_helm',
    kind: 'helmet',
    tier: 1,
    signatures: [
      'The platform: a grown shell-cap that every lens and visor mounts on.',
      'Carries the basic radar in its band — the way home, and the way out, always pointed.',
    ],
  },
  {
    itemId: 'prismatic_field_radar',
    kind: 'helmet',
    tier: 2,
    signatures: [
      'Four subassemblies grown into one listening instrument — it rides in the helm, never in the hand.',
      'Own helm and radar both, and the minimap pings the places worth walking for: cave mouths, ruins, and deep shafts.',
    ],
  },
  {
    itemId: 'prismatic_lifefinder',
    kind: 'helmet',
    tier: 3,
    signatures: [
      'A second listening array, grown onto the helm radar.',
      'The places were only half the world — with the Lifefinder, the rare lives answer by name on the minimap.',
    ],
  },
  {
    itemId: 'trail_lens',
    kind: 'helmet',
    tier: 1,
    signatures: ['Names the FAMILY of the country you stand in — the first word of every place.'],
  },
  {
    itemId: 'spore_filter',
    kind: 'helmet',
    tier: 1,
    signatures: [
      'A living mask of woven glow-spore mat.',
      'The Hollow’s spore tax stops at the filter — breathe easy.',
    ],
  },
  {
    itemId: 'biolume_visor',
    kind: 'helmet',
    tier: 1,
    signatures: ['Reads living light through the deepest dark — cave flora, sigils, and the exit shimmer.'],
  },
  {
    itemId: 'shade_visor',
    kind: 'helmet',
    tier: 1,
    signatures: ['A single saltglass pane. Glare country — the Flats, the Singing Ice, the Mirror Marsh — dims to bearable.'],
  },
  {
    itemId: 'identifier_lens',
    kind: 'helmet',
    tier: 1,
    signatures: ['The country gives up its whole name — family, variant, and all.'],
  },
  {
    itemId: 'glyph_lens',
    kind: 'helmet',
    tier: 1,
    signatures: ['Glyph stones give their deep line first, and caches glow faintly through ruin walls.'],
  },
  {
    itemId: 'charge_sight',
    kind: 'helmet',
    tier: 1,
    signatures: ['Lightning’s own glass over a prismatic heart: a coming strike paints its warned spot on the ground itself.'],
  },
];

/**
 * THE QUICKSTEPS LINE (Platforms Parallel, 2026-10-17): the
 * MOVE platform's family record — the crafted base set and
 * its four growths, one per impediment, in the order the
 * country teaches them: wade, water-walk, swim, cross fire.
 */
export const BOOTS: FamilyEntry[] = [
  {
    itemId: 'quicksteps',
    kind: 'boots',
    tier: 1,
    signatures: [
      'The base set of the movement platform: living footwear grown to your own feet, sure on plain ground.',
      'Every impediment growth mounts on this pair.',
    ],
  },
  {
    itemId: 'waders',
    kind: 'boots',
    tier: 1,
    signatures: ['Grown onto the Quicksteps. The Mirror Marsh’s wading drag, answered — the water still holds you, it just stops arguing.'],
  },
  {
    itemId: 'stillsteps',
    kind: 'boots',
    tier: 1,
    signatures: ['A tension film of dew and resin under the sole. Step onto still water and it holds — walk the water.'],
  },
  {
    itemId: 'webfoots',
    kind: 'boots',
    tier: 1,
    signatures: ['Reed-vane webs between the toes, resin-stiffened. In the water the swim becomes a stroke, not a struggle.'],
  },
  {
    itemId: 'ember_soles',
    kind: 'boots',
    tier: 1,
    signatures: ['Obsidian tread bound in heat-cured resin. Cross the fire country on your own feet — the ground warns you, and the soles answer.'],
  },
  // THE WINDLUNG (2026-10-17): the breath ladder — a branch of
  // rungs, each grown from the one below. Its tiers are the
  // ladder's own (1/2/3), and the numbers are the factors in
  // game/creatures/quicksteps.ts, in words.
  {
    itemId: 'windlung_sprig',
    kind: 'boots',
    tier: 1,
    signatures: [
      'A first small lung grown into the Quicksteps, down-lined and dew-fed.',
      'Every stamina drain costs seven-tenths; resting recovery runs near double.',
    ],
  },
  {
    itemId: 'windlung_bellows',
    kind: 'boots',
    tier: 2,
    signatures: [
      'Paired bellows at the ankles, grown from the Sprig — they pump with every stride.',
      'Stamina drains cost under half; recovery runs near triple.',
    ],
  },
  {
    itemId: 'windlung_heart',
    kind: 'boots',
    tier: 3,
    signatures: [
      'A true second heart for the road, grown from the Bellows and fed on a Fall Hawk\u2019s plume.',
      'Stamina drains cost under a fifth — a sprint barely sips — and recovery runs over quadruple: a spent bar refills in under two seconds.',
    ],
  },
];

export const familyEntryOf = (itemId: ItemId): FamilyEntry | undefined => {
  const w = weaponOf(itemId);
  if (w) {
    return {
      itemId,
      kind: w.kind,
      tier: w.tier,
      damage: w.damage,
      cooldownSeconds: w.cooldownSeconds,
      staminaCost: w.staminaCost,
      reach: w.reach,
      flinchSeconds: w.flinchSeconds,
      projectileSpeed: w.projectileSpeed,
      burstRadius: w.burstRadius,
    };
  }
  return (
    DEFENSIVES.find((d) => d.itemId === itemId) ??
    HELMETS.find((d) => d.itemId === itemId) ??
    BOOTS.find((d) => d.itemId === itemId)
  );
};

export const isFamilyItem = (itemId: ItemId): boolean =>
  familyEntryOf(itemId) !== undefined;

/** Every family entry, grouped for display: kinds in shelf
 *  order, tiers ascending inside each kind. The Platforms
 *  Parallel (2026-10-17) shelves all five kinds — the
 *  arsenal's three and the two worn platforms. */
export const familyByKind = (): { kind: FamilyKind; entries: FamilyEntry[] }[] =>
  (['close', 'ranged', 'defensive', 'helmet', 'boots'] as FamilyKind[]).map((kind) => ({
    kind,
    entries: [...WEAPONS.filter((w) => w.kind === kind).map((w) => familyEntryOf(w.itemId)!),
      ...DEFENSIVES.filter((d) => d.kind === kind),
      ...HELMETS.filter((d) => d.kind === kind),
      ...BOOTS.filter((d) => d.kind === kind),
    ].sort((a, b) => a.tier - b.tier),
  }));

/** The recipe that grows this item, when one exists. */
export const recipeForItem = (itemId: ItemId) =>
  RECIPES.find((r) => r.outputId === itemId);

/** The lower rung a striker's recipe consumes, if any — the
 *  ladder's upgrade rule made visible: a Tier 2/3 recipe whose
 *  ingredients include the same kind's previous tier. */
export const consumedRung = (entry: FamilyEntry): FamilyEntry | undefined => {
  const recipe = recipeForItem(entry.itemId);
  if (!recipe) return undefined;
  for (const ing of recipe.ingredients) {
    const other = familyEntryOf(ing.id);
    if (other && other.kind === entry.kind && other.tier === entry.tier - 1) {
      return other;
    }
  }
  return undefined;
};

/** The item's display name (single source: ITEMS). */
export const familyItemName = (itemId: ItemId): string =>
  ITEMS[itemId]?.name ?? itemId;
