/**
 * THE SHIELD FAMILY — BioForge's grown defense (Adam, 2026-10-17).
 *
 * The doctrine: the Left Hand's ward. Carried, a shield blunts
 * frontal strikes for free; braced (hold right-mouse), it is a wall
 * that stamina pays for. Tiers climb by CONSUMING upward like the
 * strikers — but the Lantern Shield is a BRANCH (the tier buys the
 * light, not a stronger wall) and the Fenback is consume-and-keep
 * (it eats the Lantern Shield and keeps the lamp and any graft).
 *
 * This module is the RULES TABLE only, mirroring creatures/weapons.ts:
 * pure, driver-testable functions. Behavior wiring lives in
 * hooks/useShieldWield.ts (input + state), the bite site in
 * hooks/useWorldEntities.ts (attack resolution), and the per-tick
 * stamina drain in hooks/useGameLoop.ts.
 */

import type { CraftingRecipe, ItemId } from '../../types/game';

/** The shields, in tier order. The Bulwark (Ingredient
 *  Sinks slice, 2026-10-17) is the family's second BRANCH:
 *  it forks from the Scute like the Lantern does, but its
 *  tier buys the lodestone's pull instead of a lamp. */
export interface ShieldDef {
  /** The crafted item. */
  itemId: ItemId;
  tier: 1 | 2 | 3;
  /** True when a lantern is grown into the shield's face — the
   *  held light follows while the shield is in the Left Hand. */
  hasLamp: boolean;
}

export const SHIELDS: ShieldDef[] = [
  { itemId: 'scute_shield', tier: 1, hasLamp: false },
  { itemId: 'lantern_shield', tier: 2, hasLamp: true },
  { itemId: 'fenback_shield', tier: 3, hasLamp: true },
  // THE LODESTONE IS A SLOT NOW (Adam, 2026-10-17): the
  // Bulwark item is abolished — the family is a pure ladder
  // ("each tier increase is an upgrade to the existing
  // equipment"), and the pull the Bulwark carried became the
  // lodestone slot in a shield's own growth (below).
];

export const SHIELD_ITEM_IDS: ItemId[] = SHIELDS.map((s) => s.itemId);

export function shieldOf(itemId: ItemId | null | undefined): ShieldDef | undefined {
  return SHIELDS.find((s) => s.itemId === itemId);
}

export function isShieldItem(itemId: ItemId | null | undefined): boolean {
  return SHIELD_ITEM_IDS.includes(itemId as ItemId);
}

// ---------------------------------------------------------------------------
// Pinned numbers (Adam's mechanics, 2026-10-17; tune-consistent with the
// game's damage scale — wild bites run 8-18, the player carries 100 hp).
// ---------------------------------------------------------------------------

/** Frontal arc, in degrees, that a worn or braced shield covers. */
export const SHIELD_FRONTAL_ARC_DEG = 120;
/** Passive (worn, not raised) blunts strikes to this fraction. */
export const SHIELD_PASSIVE_BLUNT = 0.5;
/** Stamina paid per braced block. */
export const SHIELD_STAMINA_PER_BLOCK = 8;
/** Stamina drained per second while the shield stays raised. */
export const SHIELD_RAISED_DRAIN_PER_SEC = 3;
/** Seconds of vulnerability after the guard breaks. */
export const SHIELD_GUARD_BREAK_SECONDS = 1.5;
/** Movement multiplier while braced. */
export const SHIELD_BRACED_SLOW = 0.55;
/** Stagger dealt to an attacker whose strike meets the braced wall
 *  (the strikers' flinch language: no movement, no bites). */
export const SHIELD_BRACED_STAGGER_SECONDS = 0.4;
/** Thorn-spike reflect: minor worn, more braced (pinned:
 *  braced > passive > none). */
export const GRAFT_REFLECT_PASSIVE = 4;
export const GRAFT_REFLECT_BRACED = 10;

// ---------------------------------------------------------------------------
// The shield's OWN state (Adam, 2026-10-17): a graft is a
// property of the shield, part of its own growth — "this
// biotech is personalized anyway" — not a loose field on the
// player. The growth record lives here, in the shield module,
// and persists as its own key on the save record (the pattern
// the World Asks Back set with its notebook), so a shield
// carries its growth with it, not with the player's paperwork.
// ---------------------------------------------------------------------------

/** The graft kinds a shield's slot can hold. */
export type ShieldGraftId = 'spikes';

/** One shield's own growth: what its slots wear today — the
 *  graft slot, and (Adam, 2026-10-17) the LODESTONE SLOT: a
 *  lodestone set into the shield gives it the drop-pull the
 *  abolished Bulwark used to carry. Optional so growth
 *  records written before the slot existed stay valid. */
export interface ShieldGrowth {
  graft: ShieldGraftId | null;
  lodestone?: boolean;
}

/** Every shield's growth, by shield item. Sparse by design —
 *  an absent entry is a shield that has grown nothing yet. */
export type ShieldGrowthMap = Partial<Record<ItemId, ShieldGrowth>>;

/** Read a shield's graft from its own growth record. */
export function graftOf(
  growth: ShieldGrowthMap | undefined,
  itemId: ItemId
): ShieldGraftId | null {
  return growth?.[itemId]?.graft ?? null;
}

/** Read a shield's lodestone slot from its own growth record. */
export function lodestoneOf(
  growth: ShieldGrowthMap | undefined,
  itemId: ItemId
): boolean {
  return growth?.[itemId]?.lodestone === true;
}

/** The lodestone slot's def, beside the graft defs: its name
 *  and its pull numbers (the DROP_MAGNET rows below). */
export const LODESTONE_SLOT = {
  name: 'Lodestone',
  blurb: 'A lodestone set into the shield: dropped things drift to you from afar, and further still while you brace.',
} as const;

/**
 * Fold a legacy save's player-level graft map into the
 * shields' own growth records (the relocation, 2026-10-17).
 * Legacy `true` meant the one graft that existed then —
 * spikes; a stored kind keeps its name; anything else grows
 * nothing. Runs at load; the old field is not carried forward.
 */
export function shieldGrowthFromLegacy(
  legacy: Partial<Record<ItemId, ShieldGraftId | boolean>> | undefined
): ShieldGrowthMap {
  const out: ShieldGrowthMap = {};
  if (!legacy) return out;
  for (const [id, v] of Object.entries(legacy)) {
    if (v === true) out[id as ItemId] = { graft: 'spikes' };
    else if (typeof v === 'string') out[id as ItemId] = { graft: v as ShieldGraftId };
  }
  return out;
}

// ---------------------------------------------------------------------------
// The graft SLOT (Platforms Parallel, 2026-10-17): one graft per
// shield, named by kind — the shield's parallel to the gauntlet's
// modules and the helmet's growths. The defs are data; a second
// kind joins this table (and the ShieldGraftId union) without
// any save-shape change.
// ---------------------------------------------------------------------------

export interface ShieldGraftDef {
  id: ShieldGraftId;
  /** Player-facing name, for the graft notification. */
  name: string;
  /** Reflect on a strike the shield met, worn / braced. */
  reflectPassive: number;
  reflectBraced: number;
}

export const SHIELD_GRAFTS: Record<ShieldGraftId, ShieldGraftDef> = {
  spikes: {
    id: 'spikes',
    name: 'Thorn Spikes',
    reflectPassive: GRAFT_REFLECT_PASSIVE,
    reflectBraced: GRAFT_REFLECT_BRACED,
  },
};

/** The Spore Answer (Fenback, braced): stagger-and-knockback pulse. */
export const SPORE_RADIUS = 3.5;
export const SPORE_COOLDOWN_SECONDS = 6;
export const SPORE_STAGGER_SECONDS = 1.2;
export const SPORE_KNOCKBACK_METERS = 2.5;
/** Shared Cover: the lee zone directly behind a braced bearer. */
export const LEE_DISTANCE = 2.2;
export const LEE_HALF_ANGLE_DEG = 40;
// ---------------------------------------------------------------------------
// The Lodestone Bulwark's pull (Ingredient Sinks, 2026-10-17):
// the drop pass in useWorldEntities already vacuums drops
// toward the player inside a small radius. A held Bulwark
// widens the lodestone's reach — worn, the pull starts
// farther out; braced, farther still and quicker. Pickup
// itself (2 m) never changes: the Bulwark gathers, it does
// not teleport.
// ---------------------------------------------------------------------------
/** The drop pass's standing numbers (no lodestone worn). */
export const DROP_MAGNET_BASE = { radius: 5.0, speed: 3.5 };
/** Lodestone worn: drops drift from this far, at this pace. */
export const DROP_MAGNET_CARRIED = { radius: 9.0, speed: 4.5 };
/** Lodestone braced: the pull at full stretch. */
export const DROP_MAGNET_BRACED = { radius: 13.0, speed: 5.5 };

/** The drop-magnet spec for the shield worn right now: the
 *  pull belongs to whichever shield wears the lodestone slot
 *  (the slot ruling, 2026-10-17 — it was a whole shield, the
 *  Bulwark, until Adam made it a slot like the spikes). */
export function dropMagnetFor(
  shield: ShieldDef | undefined,
  raised: boolean,
  growth?: ShieldGrowthMap
): { radius: number; speed: number } {
  if (!shield || !lodestoneOf(growth, shield.itemId)) return DROP_MAGNET_BASE;
  return raised ? DROP_MAGNET_BRACED : DROP_MAGNET_CARRIED;
}

// ---------------------------------------------------------------------------
// Geometry — the facing grammar. Angles in radians; 0 faces +Z.
// ---------------------------------------------------------------------------

/** Smallest signed difference between two angles, in [-PI, PI]. */
export function angleDifference(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Bearing from the player to the attacker. */
export function attackBearing(attackerX: number, attackerZ: number, playerX: number, playerZ: number): number {
  return Math.atan2(attackerX - playerX, attackerZ - playerZ);
}

/** True when the attacker stands inside an arc of the given width
 *  centered on the player's facing. */
export function inArc(attackerAngle: number, playerFacing: number, arcDeg: number): boolean {
  return Math.abs(angleDifference(attackerAngle, playerFacing)) <= (arcDeg * Math.PI) / 360;
}

// ---------------------------------------------------------------------------
// Block resolution — called at the bite site, where a wild hunter's
// strike lands on the player. Sprays and damage-over-time never reach
// here: the solvent class damages creatures, and the player's own
// environmental drains (heat, cold, hunger) resolve in the game loop,
// not at the bite site — so "a shield stops teeth, not weather" holds
// by construction.
// ---------------------------------------------------------------------------

export type BlockKind = 'none' | 'passive' | 'braced';

export interface BiteInput {
  /** The strike's raw damage from the hunt table. */
  damage: number;
  /** Bearing from player to attacker (see attackBearing). */
  attackerAngle: number;
  /** The bearer's continuous camera yaw. */
  playerFacing: number;
  /** The held shield, or null when the Left Hand holds none. */
  shield: ShieldDef | null;
  /** True while the block input is held (S6: never true while
   *  carrying — the hook refuses the raise, and this resolver
   *  double-guards on carrying). */
  raised: boolean;
  /** True while the guard-break vulnerable beat runs. */
  guardBroken: boolean;
  /** True while a vault carry is live (the whole kit is inert). */
  carrying: boolean;
}

export interface BiteOutcome {
  kind: BlockKind;
  /** Damage the player actually takes. */
  finalDamage: number;
}

export function resolveShieldBite(input: BiteInput): BiteOutcome {
  const { damage, attackerAngle, playerFacing, shield, guardBroken, carrying } = input;
  const raised = input.raised && !carrying;
  if (!shield || guardBroken) return { kind: 'none', finalDamage: damage };
  const frontal = inArc(attackerAngle, playerFacing, SHIELD_FRONTAL_ARC_DEG);
  // The Fenback's wrap: the passive blunt extends to the rear —
  // the braced wall does NOT widen (facing still matters raised).
  // A BRANCH signature, keyed on the Fenback itself (Platforms
  // Parallel fix, 2026-10-17): it was tier === 3 from the days
  // when tier 3 meant Fenback alone, and the Bulwark — the
  // other tier-3 branch — silently inherited it. Branch
  // signatures key on the branch, never the tier.
  const rear = !frontal && shield.itemId === 'fenback_shield' && inArc(attackerAngle, playerFacing + Math.PI, SHIELD_FRONTAL_ARC_DEG);
  if (raised) {
    if (frontal) return { kind: 'braced', finalDamage: 0 };
    return { kind: 'none', finalDamage: damage };
  }
  if (frontal || rear) {
    return { kind: 'passive', finalDamage: Math.round(damage * SHIELD_PASSIVE_BLUNT) };
  }
  return { kind: 'none', finalDamage: damage };
}

/** A graft's reflect on a strike that met the shield, read
 *  from the graft's own def (the slot's kind decides). */
export function graftReflectDamage(raised: boolean, kind: ShieldGraftId = 'spikes'): number {
  const def = SHIELD_GRAFTS[kind];
  return raised ? def.reflectBraced : def.reflectPassive;
}

/** The Spore Answer fires only on a braced Fenback block whose
 *  cooldown has elapsed. The Fenback's alone (branch-keyed, not
 *  tier-keyed — see resolveShieldBite's wrap note). */
export function shouldSporeBurst(shield: ShieldDef | null, blockKind: BlockKind, sporeReady: boolean): boolean {
  return !!shield && shield.itemId === 'fenback_shield' && blockKind === 'braced' && sporeReady;
}

/** Rooted Stance: while a Fenback is braced, nothing outside moves
 *  the bearer — the predicate any displacement system consults.
 *  (No displacement systems exist in the game today; the guard is
 *  the integration point, driver-verified.) */
export function isDisplacementImmune(shield: ShieldDef | null, raised: boolean): boolean {
  // Rooted Stance is the Fenback's (branch-keyed, not tier-keyed).
  return !!shield && shield.itemId === 'fenback_shield' && raised;
}

// ---------------------------------------------------------------------------
// Shared Cover — pure, driver-verified. An ally in the lee directly
// behind a braced bearer is blocked-for at braced grade. (v1 note:
// the sim only ever deals bites to the local player, so the in-game
// trigger surface for cover is a future multi-target pass — the
// rules below are complete and waiting for it.)
// ---------------------------------------------------------------------------

export interface CoverInput {
  attackerX: number;
  attackerZ: number;
  bearerX: number;
  bearerZ: number;
  /** The bearer's facing; the lee is behind it. */
  bearerFacing: number;
  allyX: number;
  allyZ: number;
}

/** True when the ally stands in the short lee directly behind the
 *  bearer. */
export function allyInLeeZone(input: CoverInput): boolean {
  const dx = input.allyX - input.bearerX;
  const dz = input.allyZ - input.bearerZ;
  const dist = Math.hypot(dx, dz);
  if (dist > LEE_DISTANCE) return false;
  const rearBearing = input.bearerFacing + Math.PI;
  const allyBearing = Math.atan2(dx, dz);
  return Math.abs(angleDifference(allyBearing, rearBearing)) <= (LEE_HALF_ANGLE_DEG * Math.PI) / 180;
}

/** True when the strike comes from the bearer's facing hemisphere —
 *  the side the wall actually stands between. */
export function strikeFromBearersFront(input: CoverInput): boolean {
  const bearing = attackBearing(input.attackerX, input.attackerZ, input.bearerX, input.bearerZ);
  return Math.abs(angleDifference(bearing, input.bearerFacing)) <= Math.PI / 2;
}

export interface CoverOutcome {
  covered: boolean;
  /** Damage the ally takes (0 at braced grade). */
  finalDamage: number;
}

export function resolveSharedCover(input: CoverInput & { damage: number }): CoverOutcome {
  if (allyInLeeZone(input) && strikeFromBearersFront(input)) {
    return { covered: true, finalDamage: 0 };
  }
  return { covered: false, finalDamage: input.damage };
}

// ---------------------------------------------------------------------------
// Graft inheritance — a grafted shield consumed by an upgrade keeps
// its spikes (Lantern ← Scute, Fenback ← Lantern). Called in the
// craft flow after a successful craft.
// ---------------------------------------------------------------------------

/**
 * After a successful craft, returns the shield item id to graft
 * AND the graft's kind when the recipe consumed a grafted
 * shield — else null. The kind rides along (Platforms Parallel,
 * 2026-10-17): a graft is inherited as what it IS, not as a
 * bare yes. (Graft recipes themselves stamp via
 * recipe.graftShield; this handles the consume-upgrades.)
 */
export function graftInheritanceOnCraft(
  recipe: CraftingRecipe,
  growth: ShieldGrowthMap
): { itemId: ItemId; kind: ShieldGraftId | null; lodestone: boolean } | null {
  const output = shieldOf(recipe.outputId);
  if (!output) return null;
  if (recipe.graftShield || recipe.lodestoneShield) return null; // set recipes stamp their own
  for (const ing of recipe.ingredients) {
    if (ing.id === recipe.outputId || !isShieldItem(ing.id)) continue;
    const kind = graftOf(growth, ing.id);
    const lodestone = lodestoneOf(growth, ing.id);
    if (kind || lodestone) return { itemId: recipe.outputId, kind, lodestone };
  }
  return null;
}

// ---------------------------------------------------------------------------
// THE BULWARK FOLD (Adam, 2026-10-17): saves written while
// the Lodestone Bulwark was an ITEM convert at load — nothing
// earned evaporates. A Bulwark becomes its tier peer, the
// Fenback, wearing the lodestone slot and the Bulwark's own
// graft; if a Fenback already stands in the pouch, no
// duplicate is granted — the owned Fenback gains the slots.
// A held Bulwark becomes a held Fenback. Pure: the caller
// applies the result.
// ---------------------------------------------------------------------------

/** The abolished item's id, named once for the fold. */
const BULWARK_ID = 'lodestone_bulwark' as ItemId;

export function migrateBulwark(
  inventory: Record<ItemId, number>,
  growth: ShieldGrowthMap,
  heldItemId: ItemId | null
): { inventory: Record<ItemId, number>; growth: ShieldGrowthMap; heldItemId: ItemId | null; changed: boolean } {
  const bulwarkCount = inventory[BULWARK_ID] ?? 0;
  const bulwarkGrowth = growth[BULWARK_ID];
  const held = heldItemId === BULWARK_ID;
  if (bulwarkCount <= 0 && !bulwarkGrowth && !held) {
    return { inventory, growth, heldItemId, changed: false };
  }
  const nextInventory = { ...inventory };
  delete nextInventory[BULWARK_ID];
  const nextGrowth: ShieldGrowthMap = { ...growth };
  delete nextGrowth[BULWARK_ID];
  // The Fenback receives the Bulwark's slots — its own graft
  // wins where it has one; the Bulwark's fills an empty slot.
  const fenbackOwned = (nextInventory['fenback_shield'] ?? 0) > 0;
  if (fenbackOwned || bulwarkCount > 0 || held) {
    if (!fenbackOwned) nextInventory['fenback_shield'] = 1;
    const existing = nextGrowth['fenback_shield'];
    nextGrowth['fenback_shield'] = {
      graft: existing?.graft ?? bulwarkGrowth?.graft ?? null,
      lodestone: true,
    };
  }
  return {
    inventory: nextInventory,
    growth: nextGrowth,
    heldItemId: held ? 'fenback_shield' : heldItemId,
    changed: true,
  };
}

// ---------------------------------------------------------------------------
// The Left Hand cycle — Alt is the left-hand modifier (Adam's hand
// grammar, 2026-10-17): Alt+wheel or Alt+↑ walks the owned
// left-hand instruments; the plain wheel/arrows keep their
// gauntlet-side meanings.
// ---------------------------------------------------------------------------

export const LEFT_HAND_CYCLE: ItemId[] = [
  'hand_lantern_fern',
  'scute_shield',
  'lantern_shield',
  'fenback_shield',
];

/** The owned cycle order, given what's held and what the pouch
 *  holds. Owned-only, per the grammar. */
export function leftHandOrder(held: ItemId | null | undefined, hasItem: (id: ItemId) => boolean): ItemId[] {
  return LEFT_HAND_CYCLE.filter((id) => id === held || hasItem(id));
}

/** The next item in the cycle after `held` (null = stow the hand). */
export function cycleLeftHand(
  held: ItemId | null | undefined,
  hasItem: (id: ItemId) => boolean,
  direction: 1 | -1
): ItemId | null {
  const owned = leftHandOrder(held, hasItem);
  if (owned.length === 0) return null;
  const idx = held ? owned.indexOf(held) : -1;
  // NO STOW STOP (Adam, 2026-10-17): while anything is owned
  // the cycle is a choice among owned pieces only — it wraps
  // at both ends and the hand is never emptied by walking it.
  if (idx === -1) return direction === 1 ? owned[0] : owned[owned.length - 1];
  return owned[(idx + direction + owned.length) % owned.length];
}

/** The auto-fill priority (Adam, 2026-10-17): when the hand
 *  stands empty, the best owned piece takes it — the highest
 *  shield first, the plain lantern last (a Lantern Shield
 *  carries its own lamp, so the bare lantern yields to it). */
export const LEFT_HAND_BEST: ItemId[] = [
  'fenback_shield',
  'lantern_shield',
  'scute_shield',
  'hand_lantern_fern',
];

/** The piece the hand should take on its own, if any. */
export function bestLeftHand(hasItem: (id: ItemId) => boolean): ItemId | null {
  return LEFT_HAND_BEST.find((id) => hasItem(id)) ?? null;
}

// ---------------------------------------------------------------------------
// The shared strike resolution. The creatures lane's seam map
// (2026-10-17): bites reach the player through the onFaunaAttack
// callback — the main bite line AND the Fall Hawk's stoop feed the
// SAME consumer (the game loop's damage application). Block
// resolution belongs at that shared consumer, never at a call
// site: the damage arriving is final (the bite line's scaled
// expression), and the strike context below is how the consumer
// knows where the teeth came from.
// ---------------------------------------------------------------------------

/** Where a strike came from — appended at the call sites, read at
 *  the shared consumer. */
export interface StrikeCtx {
  faunaId: string;
  x: number;
  z: number;
}

/** Side effects a resolved strike queues back into the sim (the
 *  consumer can't touch the fauna list; the post-map sweep drains
 *  these). */
export type ShieldSideEffect =
  | { kind: 'hit'; targetId: string; damage: number; flinch: number }
  | { kind: 'burst'; x: number; z: number; grafted: boolean };

export interface StrikeResolution {
  /** The damage the player actually takes. */
  finalDamage: number;
}

/**
 * Resolves one incoming strike against the held shield. Pure
 * rules + the input's own stamina/hook callbacks; side effects
 * leave through the two queues. Returns the damage the player
 * takes. When no shield is held the arriving damage passes
 * through untouched.
 */
export function resolveShieldStrike(
  input: ShieldCombatInput,
  damage: number,
  ctx: StrikeCtx,
  playerX: number,
  playerZ: number,
  playerFacing: number,
  queueHit: (targetId: string, damage: number, flinch: number) => void,
  queueBurst: (x: number, z: number, grafted: boolean) => void
): StrikeResolution {
  const snap = input.snapshot();
  if (!snap?.shield) return { finalDamage: damage };
  const outcome = resolveShieldBite({
    damage,
    attackerAngle: attackBearing(ctx.x, ctx.z, playerX, playerZ),
    playerFacing: snap.playerFacing,
    shield: snap.shield,
    raised: snap.raised,
    guardBroken: snap.guardBroken,
    carrying: snap.carrying,
  });
  if (outcome.kind === 'braced') {
    // The wall holds only if stamina pays: a failed payment
    // breaks the guard and THIS strike lands full — the block
    // cost is per-hit, win or lose.
    if (!input.payStamina(SHIELD_STAMINA_PER_BLOCK)) {
      input.onGuardBreak();
      return { finalDamage: damage };
    }
    // The striker's flinch language: the attacker's teeth met a
    // wall — no movement, no bites.
    queueHit(ctx.faunaId, snap.graft ? graftReflectDamage(true, snap.graft) : 0, SHIELD_BRACED_STAGGER_SECONDS);
    // The Spore Answer: a braced Fenback block sheds a
    // stagger-and-knockback spore pulse (spike-grafted: the
    // pulse carries thorn-pricks).
    if (shouldSporeBurst(snap.shield, outcome.kind, snap.sporeReady)) {
      input.onSporeBurst();
      input.triggerSporeFx(ctx.x, ctx.z);
      queueBurst(playerX, playerZ, snap.graft === 'spikes');
    }
    return { finalDamage: outcome.finalDamage };
  }
  if (outcome.kind === 'passive' && snap.graft) {
    // Carried, the graft still answers — minor.
    queueHit(ctx.faunaId, graftReflectDamage(false, snap.graft), 0);
  }
  return { finalDamage: outcome.finalDamage };
}

// ---------------------------------------------------------------------------
// The sim-facing combat input. The game loop builds one per tick
// from the wield hook's refs; the shared onFaunaAttack consumer
// reads it — never the hunt-scaling, spawning, or sim-drive code.
// ---------------------------------------------------------------------------

export interface ShieldCombatSnapshot {
  /** The held shield (null = the Left Hand holds no shield). */
  shield: ShieldDef | null;
  raised: boolean;
  /** The HELD shield's graft slot: the graft's kind, or null
   *  when the slot stands empty. */
  graft: ShieldGraftId | null;
  carrying: boolean;
  guardBroken: boolean;
  playerFacing: number;
  /** Sim clock, seconds — for cooldowns and guard-break windows. */
  now: number;
  sporeReady: boolean;
}

export interface ShieldCombatInput {
  /** Fresh snapshot, or null when the shield program has nothing
   *  to say this tick (no shield held). */
  snapshot: () => ShieldCombatSnapshot | null;
  /** Stamina payment; false = too winded (the block fails and the
   *  guard breaks). */
  payStamina: (n: number) => boolean;
  /** The hook starts the spore cooldown (presentation fires via
   *  triggerSporeFx). */
  onSporeBurst: () => void;
  /** The hook drops the raise and opens the vulnerable window. */
  onGuardBreak: () => void;
  /** Engine presentation: the visible spore puff at the block. */
  triggerSporeFx: (x: number, z: number) => void;
}
