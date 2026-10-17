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
  { itemId: 'lodestone_bulwark', tier: 3, hasLamp: false },
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

/** Frontal arc, in degrees, that a carried or braced shield covers. */
export const SHIELD_FRONTAL_ARC_DEG = 120;
/** Passive (carried, not raised) blunts strikes to this fraction. */
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
/** Thorn-spike reflect: minor carried, more braced (pinned:
 *  braced > passive > none). */
export const GRAFT_REFLECT_PASSIVE = 4;
export const GRAFT_REFLECT_BRACED = 10;
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
// widens the lodestone's reach — carried, the pull starts
// farther out; braced, farther still and quicker. Pickup
// itself (2 m) never changes: the Bulwark gathers, it does
// not teleport.
// ---------------------------------------------------------------------------
/** The drop pass's standing numbers (no Bulwark held). */
export const DROP_MAGNET_BASE = { radius: 5.0, speed: 3.5 };
/** Bulwark carried: drops drift from this far, at this pace. */
export const DROP_MAGNET_CARRIED = { radius: 9.0, speed: 4.5 };
/** Bulwark braced: the pull at full stretch. */
export const DROP_MAGNET_BRACED = { radius: 13.0, speed: 5.5 };

/** The drop-magnet spec for the shield in hand right now. */
export function dropMagnetFor(
  shield: ShieldDef | undefined,
  raised: boolean
): { radius: number; speed: number } {
  if (!shield || shield.itemId !== 'lodestone_bulwark') return DROP_MAGNET_BASE;
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
  const rear = !frontal && shield.tier === 3 && inArc(attackerAngle, playerFacing + Math.PI, SHIELD_FRONTAL_ARC_DEG);
  if (raised) {
    if (frontal) return { kind: 'braced', finalDamage: 0 };
    return { kind: 'none', finalDamage: damage };
  }
  if (frontal || rear) {
    return { kind: 'passive', finalDamage: Math.round(damage * SHIELD_PASSIVE_BLUNT) };
  }
  return { kind: 'none', finalDamage: damage };
}

/** Thorn-spike reflect on a strike that met the shield. */
export function graftReflectDamage(raised: boolean): number {
  return raised ? GRAFT_REFLECT_BRACED : GRAFT_REFLECT_PASSIVE;
}

/** The Spore Answer fires only on a braced Fenback block whose
 *  cooldown has elapsed. */
export function shouldSporeBurst(shield: ShieldDef | null, blockKind: BlockKind, sporeReady: boolean): boolean {
  return !!shield && shield.tier === 3 && blockKind === 'braced' && sporeReady;
}

/** Rooted Stance: while a Fenback is braced, nothing outside moves
 *  the bearer — the predicate any displacement system consults.
 *  (No displacement systems exist in the game today; the guard is
 *  the integration point, driver-verified.) */
export function isDisplacementImmune(shield: ShieldDef | null, raised: boolean): boolean {
  return !!shield && shield.tier === 3 && raised;
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
 * After a successful craft, returns the shield item id to graft when
 * the recipe consumed a grafted shield — else null. (Graft recipes
 * themselves stamp via recipe.graftShield; this handles the
 * consume-upgrades.)
 */
export function graftInheritanceOnCraft(
  recipe: CraftingRecipe,
  grafts: Partial<Record<ItemId, boolean>>
): ItemId | null {
  const output = shieldOf(recipe.outputId);
  if (!output) return null;
  if (recipe.graftShield) return null; // the graft recipe stamps its own
  const graftedParent = recipe.ingredients.some(
    (ing) => ing.id !== recipe.outputId && isShieldItem(ing.id) && grafts[ing.id]
  );
  return graftedParent ? recipe.outputId : null;
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
  if (direction === 1) return owned[idx + 1] ?? null;
  // Walking backward past the start stows the hand.
  return idx <= 0 ? null : owned[idx - 1];
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
    queueHit(ctx.faunaId, snap.grafted ? graftReflectDamage(true) : 0, SHIELD_BRACED_STAGGER_SECONDS);
    // The Spore Answer: a braced Fenback block sheds a
    // stagger-and-knockback spore pulse (grafted: the pulse
    // carries thorn-pricks).
    if (shouldSporeBurst(snap.shield, outcome.kind, snap.sporeReady)) {
      input.onSporeBurst();
      input.triggerSporeFx(ctx.x, ctx.z);
      queueBurst(playerX, playerZ, snap.grafted);
    }
    return { finalDamage: outcome.finalDamage };
  }
  if (outcome.kind === 'passive' && snap.grafted) {
    // Carried, the graft still answers — minor.
    queueHit(ctx.faunaId, graftReflectDamage(false), 0);
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
  /** Whether the HELD shield carries the spike graft. */
  grafted: boolean;
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
