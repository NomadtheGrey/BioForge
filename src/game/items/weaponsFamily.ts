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

export type FamilyKind = 'close' | 'ranged' | 'defensive';

export const FAMILY_KIND_LABEL: Record<FamilyKind, string> = {
  close: 'Close',
  ranged: 'Ranged',
  defensive: 'Defensive',
};

export const FAMILY_KIND_BLURB: Record<FamilyKind, string> = {
  close: 'In-hand strikers. Reach, damage, and the flinch — a landed hit staggers what it strikes.',
  ranged: 'Fired strikers. The shot travels and aims at where the target stood — a moving target can be missed cleanly.',
  defensive: 'The Left Hand’s ward. Carried, it blunts frontal strikes for free; braced, it is a wall that stamina pays for.',
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
}

/** The family entry for an item, or undefined when the item is
 *  no part of the arsenal. Strikers read from WEAPONS; a
 *  defensive entry appears when the shield data lands with
 *  its family record in DEFENSIVES below. */
export const DEFENSIVES: FamilyEntry[] = [
  // The shield slice lands the items; their entries register
  // here (kind 'defensive', tiers 1 and 2) in the same pass
  // that verifies the data — never hardcoded ahead of it.
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
  return DEFENSIVES.find((d) => d.itemId === itemId);
};

export const isFamilyItem = (itemId: ItemId): boolean =>
  familyEntryOf(itemId) !== undefined;

/** Every family entry, grouped for display: kinds in shelf
 *  order, tiers ascending inside each kind. */
export const familyByKind = (): { kind: FamilyKind; entries: FamilyEntry[] }[] =>
  (['close', 'ranged', 'defensive'] as FamilyKind[]).map((kind) => ({
    kind,
    entries: [...WEAPONS.filter((w) => w.kind === kind).map((w) => familyEntryOf(w.itemId)!),
      ...DEFENSIVES.filter((d) => d.kind === kind),
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
