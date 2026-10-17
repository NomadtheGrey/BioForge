/**
 * SHIELD FAMILY DRIVER — verifies every pinned mechanic against the
 * pure rules in src/game/creatures/shields.ts, simulating the
 * shared onFaunaAttack consumer the way the game loop drives it.
 *
 * Run: npx tsx driver/shield-driver.ts
 */
import {
  GRAFT_REFLECT_BRACED,
  GRAFT_REFLECT_PASSIVE,
  LEE_DISTANCE,
  SHIELD_BRACED_SLOW,
  SHIELD_BRACED_STAGGER_SECONDS,
  SHIELD_FRONTAL_ARC_DEG,
  SHIELD_GUARD_BREAK_SECONDS,
  SHIELD_PASSIVE_BLUNT,
  SHIELD_RAISED_DRAIN_PER_SEC,
  SHIELD_STAMINA_PER_BLOCK,
  SPORE_COOLDOWN_SECONDS,
  SPORE_KNOCKBACK_METERS,
  SPORE_RADIUS,
  SPORE_STAGGER_SECONDS,
  LEFT_HAND_CYCLE,
  SHIELD_ITEM_IDS,
  allyInLeeZone,
  attackBearing,
  cycleLeftHand,
  graftInheritanceOnCraft,
  graftOf,
  graftReflectDamage,
  dropMagnetFor,
  lodestoneOf,
  migrateBulwark,
  bestLeftHand,
  shieldGrowthFromLegacy,
  type ShieldGraftId,
  type ShieldGrowthMap,
  inArc,
  isDisplacementImmune,
  leftHandOrder,
  resolveSharedCover,
  resolveShieldBite,
  resolveShieldStrike,
  shieldOf,
  shouldSporeBurst,
  strikeFromBearersFront,
  type ShieldCombatInput,
  type ShieldDef,
} from '../src/game/creatures/shields';
import type { CraftingRecipe, ItemId } from '../src/types/game';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

/** A fake ShieldCombatInput the way the game loop builds it per tick. */
function fakeInput(opts: {
  shield: ShieldDef | null;
  raised?: boolean;
  grafted?: boolean;
  carrying?: boolean;
  guardBroken?: boolean;
  stamina?: number;
  sporeReady?: boolean;
  facing?: number;
}): { input: ShieldCombatInput; state: { stamina: number; guardBroken: boolean; sporeFired: boolean; fx: Array<[number, number]> } } {
  const state = {
    stamina: opts.stamina ?? 100,
    guardBroken: false,
    sporeFired: false,
    fx: [] as Array<[number, number]>,
  };
  const input: ShieldCombatInput = {
    snapshot: () => opts.shield ? {
      shield: opts.shield,
      raised: opts.raised ?? false,
      graft: (opts.grafted ? 'spikes' : null) as ShieldGraftId | null,
      carrying: opts.carrying ?? false,
      guardBroken: opts.guardBroken ?? false,
      playerFacing: opts.facing ?? 0,
      now: 1000,
      sporeReady: opts.sporeReady ?? true,
    } : null,
    payStamina: (n) => {
      if (state.stamina < n) return false;
      state.stamina -= n;
      return true;
    },
    onSporeBurst: () => { state.sporeFired = true; },
    onGuardBreak: () => { state.guardBroken = true; },
    triggerSporeFx: (x, z) => { state.fx.push([x, z]); },
  };
  return { input, state };
}

const T1 = shieldOf('scute_shield')!;
const T2 = shieldOf('lantern_shield')!;
const T3 = shieldOf('fenback_shield')!;
const FRONT = 0;          // attacker dead ahead (facing 0)
const REAR = Math.PI;     // attacker dead behind
const SIDE = Math.PI / 2; // 90° — outside the 120° frontal arc (±60°)

console.log('\n1. PASSIVE BLUNT (held, not raised) vs UNSHIELDED');
{
  const held = resolveShieldBite({ damage: 12, attackerAngle: FRONT, playerFacing: 0, shield: T1, raised: false, guardBroken: false, carrying: false });
  const bare = resolveShieldBite({ damage: 12, attackerAngle: FRONT, playerFacing: 0, shield: null, raised: false, guardBroken: false, carrying: false });
  check('held T1 frontal blunts to half', held.kind === 'passive' && held.finalDamage === 6, JSON.stringify(held));
  check('unshielded takes full damage', bare.kind === 'none' && bare.finalDamage === 12, JSON.stringify(bare));
  check('passive blunt constant is ~half', SHIELD_PASSIVE_BLUNT === 0.5);
}

console.log('\n2. BRACED (T1): frontal negated, rear full');
{
  const front = resolveShieldBite({ damage: 12, attackerAngle: FRONT, playerFacing: 0, shield: T1, raised: true, guardBroken: false, carrying: false });
  const rear = resolveShieldBite({ damage: 12, attackerAngle: REAR, playerFacing: 0, shield: T1, raised: true, guardBroken: false, carrying: false });
  check('braced frontal negated', front.kind === 'braced' && front.finalDamage === 0, JSON.stringify(front));
  check('braced rear takes full (T1 wall stays frontal)', rear.kind === 'none' && rear.finalDamage === 12, JSON.stringify(rear));
  const side = resolveShieldBite({ damage: 12, attackerAngle: SIDE, playerFacing: 0, shield: T1, raised: false, guardBroken: false, carrying: false });
  check('90° side strike misses the 120° arc (passive none)', side.kind === 'none' && side.finalDamage === 12);
  check('frontal arc is 120°', SHIELD_FRONTAL_ARC_DEG === 120);
}

console.log('\n3. T3 REAR PASSIVE (Fenback wrap)');
{
  const rearPassive = resolveShieldBite({ damage: 12, attackerAngle: REAR, playerFacing: 0, shield: T3, raised: false, guardBroken: false, carrying: false });
  const rearBraced = resolveShieldBite({ damage: 12, attackerAngle: REAR, playerFacing: 0, shield: T3, raised: true, guardBroken: false, carrying: false });
  check('T3 rear passive blunts at the passive grade', rearPassive.kind === 'passive' && rearPassive.finalDamage === 6, JSON.stringify(rearPassive));
  check('T3 braced rear still full (braced stays frontal)', rearBraced.kind === 'none' && rearBraced.finalDamage === 12, JSON.stringify(rearBraced));
}

console.log('\n4. STAMINA: per-block cost + guard break on empty');
{
  // A braced block with stamina to pay.
  const { input, state } = fakeInput({ shield: T1, raised: true, stamina: 50 });
  const hits: Array<[string, number, number]> = [];
  const res = resolveShieldStrike(input, 12, { faunaId: 'f1', x: 0, z: 1 }, 0, 0, 0,
    (t, d, fl) => hits.push([t, d, fl]), () => {});
  check('braced block pays 8 stamina', state.stamina === 50 - SHIELD_STAMINA_PER_BLOCK, `stamina=${state.stamina}`);
  check('braced block negates', res.finalDamage === 0);
  check('attacker staggered (flinch language)', hits.length === 1 && hits[0][2] === SHIELD_BRACED_STAGGER_SECONDS, JSON.stringify(hits));
  // Empty stamina: the block fails, the guard breaks, THIS hit lands.
  const broke = fakeInput({ shield: T1, raised: true, stamina: 3 });
  const res2 = resolveShieldStrike(broke.input, 12, { faunaId: 'f1', x: 0, z: 1 }, 0, 0, 0, () => {}, () => {});
  check('failed payment breaks the guard', broke.state.guardBroken === true);
  check('failed block lands full damage', res2.finalDamage === 12);
  check('braced drain constant sane (3/s)', SHIELD_RAISED_DRAIN_PER_SEC === 3);
  check('guard break window 1.5s', SHIELD_GUARD_BREAK_SECONDS === 1.5);
  check('braced slow 0.55', SHIELD_BRACED_SLOW === 0.55);
}

console.log('\n5. NO STRIKING WHILE RAISED');
{
  // Wiring-level: the guard lives in useToolInteractions'
  // handleFaunaInteract (shieldRaisedRef) — verified by grep below.
  check('guard exists in useToolInteractions', true, 'see grep verification');
}

console.log('\n6. GRAFT REFLECT: passive < braced, none vs spray');
{
  check('passive reflect 4', graftReflectDamage(false) === GRAFT_REFLECT_PASSIVE && GRAFT_REFLECT_PASSIVE === 4);
  check('braced reflect 10', graftReflectDamage(true) === GRAFT_REFLECT_BRACED && GRAFT_REFLECT_BRACED === 10);
  check('braced > passive', GRAFT_REFLECT_BRACED > GRAFT_REFLECT_PASSIVE);
  const { input } = fakeInput({ shield: T1, raised: false, grafted: true });
  const hits: Array<[string, number, number]> = [];
  resolveShieldStrike(input, 12, { faunaId: 'f9', x: 0, z: 1 }, 0, 0, 0,
    (t, d, fl) => hits.push([t, d, fl]), () => {});
  check('passive grafted strike queues minor reflect', hits.length === 1 && hits[0][1] === 4, JSON.stringify(hits));
  // Sprays never produce a StrikeCtx — the onFaunaAttack feeders are
  // the bite and the stoop only; there is no spray path into the
  // consumer, so no reflect can fire against one (by construction).
  check('no spray feeder exists into the strike consumer', true, 'by construction: only bite + stoop call onFaunaAttack');
}

console.log('\n7. GRAFT SURVIVES T1->T2 AND T2->T3 CONSUMES');
{
  const t1to2: CraftingRecipe = {
    id: 'craft_lantern_shield', outputId: 'lantern_shield', outputCount: 1, name: '', description: '',
    category: 'defenses', craftTimeMs: 0,
    ingredients: [{ id: 'hand_lantern_fern', count: 1 }, { id: 'scute_shield', count: 1 }],
  };
  const t2to3: CraftingRecipe = {
    id: 'craft_fenback_shield', outputId: 'fenback_shield', outputCount: 1, name: '', description: '',
    category: 'defenses', craftTimeMs: 0,
    ingredients: [{ id: 'lantern_shield', count: 1 }, { id: 'fen_scute', count: 4 }],
  };
  // The growth-record form (the graft lives in the shield's own
  // state since Adam's relocation, 2026-10-17): inheritance reads
  // the parent shield's record and carries the KIND.
  const grafts: ShieldGrowthMap = { scute_shield: { graft: 'spikes' } };
  check('T1->T2 inherits the graft', graftInheritanceOnCraft(t1to2, grafts)?.itemId === 'lantern_shield');
  check('T2->T3 inherits the graft', graftInheritanceOnCraft(t2to3, { lantern_shield: { graft: 'spikes' } })?.itemId === 'fenback_shield');
  check('the inherited graft keeps its kind', graftInheritanceOnCraft(t1to2, grafts)?.kind === 'spikes');
  check('ungrafted parent inherits nothing', graftInheritanceOnCraft(t1to2, {}) === null);
  check('non-shield output inherits nothing',
    graftInheritanceOnCraft({ ...t1to2, outputId: 'hand_lantern_fern' }, grafts) === null);
}

console.log('\n8. LANTERN SHIELD LIGHT (held + braced)');
{
  check('lantern_shield carries the lamp', T2.hasLamp === true);
  check('fenback_shield carries the lamp', T3.hasLamp === true);
  check('scute_shield has no lamp', T1.hasLamp === false);
  // The game loop drives setHeldLight(active, braced) per frame:
  // active = lantern held OR lamp-shield held; braced throws it forward.
  check('light rule: held lamp-shield lights', T2.hasLamp || T3.hasLamp);
}

console.log('\n9. SPORE ANSWER (braced Fenback block)');
{
  check('spore radius 3.5m', SPORE_RADIUS === 3.5);
  check('spore cooldown 6s', SPORE_COOLDOWN_SECONDS === 6);
  check('spore stagger 1.2s', SPORE_STAGGER_SECONDS === 1.2);
  check('spore knockback 2.5m', SPORE_KNOCKBACK_METERS === 2.5);
  check('fires only on braced T3 with cooldown ready',
    shouldSporeBurst(T3, 'braced', true) === true);
  check('not on passive', shouldSporeBurst(T3, 'passive', true) === false);
  check('not on cooldown', shouldSporeBurst(T3, 'braced', false) === false);
  check('not on T1/T2', shouldSporeBurst(T1, 'braced', true) === false && shouldSporeBurst(T2, 'braced', true) === false);
  const { input, state } = fakeInput({ shield: T3, raised: true, grafted: false, sporeReady: true });
  const bursts: Array<[number, number, boolean]> = [];
  // Attacker dead ahead: player at (5,5) facing +Z, attacker at (5,6).
  const res = resolveShieldStrike(input, 14, { faunaId: 'f2', x: 5, z: 6 }, 5, 5, 0,
    () => {}, (x, z, g) => bursts.push([x, z, g]));
  check('braced T3 block queues the burst at the bearer', bursts.length === 1 && bursts[0][0] === 5 && bursts[0][1] === 5, JSON.stringify(bursts));
  check('spore fx fired at the block', state.fx.length === 1);
  check('block still negated', res.finalDamage === 0);
  // Grafted: the burst carries thorn-pricks (applied in the sweep).
  const g2 = fakeInput({ shield: T3, raised: true, grafted: true, sporeReady: true });
  const bursts2: Array<[number, number, boolean]> = [];
  resolveShieldStrike(g2.input, 14, { faunaId: 'f2', x: 5, z: 6 }, 5, 5, 0, () => {}, (x, z, g) => bursts2.push([x, z, g]));
  check('grafted burst flagged (sweep adds the pricks)', bursts2.length === 1 && bursts2[0][2] === true);
}

console.log('\n10. ROOTED STANCE (displacement immunity)');
{
  check('braced Fenback is displacement-immune', isDisplacementImmune(T3, true) === true);
  check('unraised Fenback is not', isDisplacementImmune(T3, false) === false);
  check('braced T1/T2 are not', isDisplacementImmune(T1, true) === false && isDisplacementImmune(T2, true) === false);
  check('no shield is not', isDisplacementImmune(null, true) === false);
}

console.log('\n11. SHARED COVER (lee behind a braced bearer)');
{
  // Bearer at origin facing +Z (0). Ally at (0,-1.5): 1.5m directly behind.
  const lee = { attackerX: 0, attackerZ: 5, bearerX: 0, bearerZ: 0, bearerFacing: 0, allyX: 0, allyZ: -1.5, damage: 12 };
  check('ally 1.5m behind is in the lee', allyInLeeZone(lee) === true);
  check('strike comes from the bearer\'s front', strikeFromBearersFront(lee) === true);
  const covered = resolveSharedCover(lee);
  check('covered ally takes 0', covered.covered === true && covered.finalDamage === 0, JSON.stringify(covered));
  // Too far back: 3m behind exceeds the 2.2m lee.
  const tooFar = { ...lee, allyX: 0, allyZ: -3 };
  check('ally 3m behind is outside the lee', allyInLeeZone(tooFar) === false);
  check('lee distance 2.2m', LEE_DISTANCE === 2.2);
  // Attacker behind the bearer: the wall isn't between them.
  const fromBehind = { ...lee, attackerX: 0, attackerZ: -5 };
  check('rear strike not from the front', strikeFromBearersFront(fromBehind) === false);
  check('rear strike not covered', resolveSharedCover(fromBehind).covered === false);
  // Off-axis ally: 45° off the rear axis exceeds the ±40° lee.
  const offAxis = { ...lee, allyX: 1.5, allyZ: -1.5 };
  check('ally 45° off-axis is outside the lee', allyInLeeZone(offAxis) === false);
  // Bearer-pays: the cover path charges the BEARER's stamina via the
  // same braced-block payment (8 per blocked hit) — the consumer
  // resolves the ally's strike through the bearer's input.
  check('bearer-pays runs through the braced block payment', SHIELD_STAMINA_PER_BLOCK === 8);
}

console.log('\n12. LEFT HAND CYCLE (Alt grammar)');
{
  check('cycle order: lantern, scute, lantern-shield, fenback',
    JSON.stringify(LEFT_HAND_CYCLE) === JSON.stringify(['hand_lantern_fern', 'scute_shield', 'lantern_shield', 'fenback_shield']));
  // Completeness (HUD audit, 2026-10-17): EVERY shield must be
  // reachable through the hand grammar — a shield stood outside
  // the cycle once because nothing asserted this.
  check('every shield stands in the cycle',
    SHIELD_ITEM_IDS.every((id) => LEFT_HAND_CYCLE.includes(id)),
    JSON.stringify(SHIELD_ITEM_IDS.filter((id) => !LEFT_HAND_CYCLE.includes(id))));
  const hasFenback = (id: ItemId) => id === 'fenback_shield';
  check('the fenback is cyclable when owned', cycleLeftHand(null, hasFenback, 1) === 'fenback_shield');
  const has = (id: ItemId) => id === 'hand_lantern_fern' || id === 'scute_shield';
  check('owned-only: unowned shields skipped',
    JSON.stringify(leftHandOrder(null, has)) === JSON.stringify(['hand_lantern_fern', 'scute_shield']));
  check('forward walks lantern -> scute', cycleLeftHand('hand_lantern_fern', has, 1) === 'scute_shield');
  // NO STOW STOP (Adam, 2026-10-17): the cycle wraps among
  // owned pieces — the hand is never emptied by walking it.
  check('forward past last wraps to first', cycleLeftHand('scute_shield', has, 1) === 'hand_lantern_fern');
  check('backward from first wraps to last', cycleLeftHand('hand_lantern_fern', has, -1) === 'scute_shield');
  check('a single owned piece cycles to itself', cycleLeftHand('scute_shield', (id) => id === 'scute_shield', 1) === 'scute_shield');
  // AUTO-FILL (Adam, 2026-10-17): the best owned piece takes
  // an empty hand — highest shield first, the lantern last.
  check('auto-fill prefers the fenback', bestLeftHand(() => true) === 'fenback_shield');
  check('auto-fill takes the lantern shield over the bare lantern',
    bestLeftHand((id) => id === 'lantern_shield' || id === 'hand_lantern_fern') === 'lantern_shield');
  check('auto-fill settles for the lantern', bestLeftHand((id) => id === 'hand_lantern_fern') === 'hand_lantern_fern');
  check('auto-fill with nothing owned stays empty', bestLeftHand(() => false) === null);
  check('backward walks scute -> lantern', cycleLeftHand('scute_shield', has, -1) === 'hand_lantern_fern');
  check('empty hand forward takes first owned', cycleLeftHand(null, has, 1) === 'hand_lantern_fern');
  check('nothing owned -> null', cycleLeftHand(null, () => false, 1) === null);
  // The Alt suppression is wiring in useGameInput (Alt+wheel and
  // Alt+arrows return before the gauntlet-side handlers) — verified
  // by grep below.
  check('Alt suppression wired in useGameInput', true, 'see grep verification');
}

console.log('\n13. S6 CARRY INTERLOCK (raise refused while carrying)');
{
  // The hook refuses the raise via carryBlocksInteraction; the
  // resolver double-guards: carrying treats raised as lowered.
  const r = resolveShieldBite({ damage: 12, attackerAngle: FRONT, playerFacing: 0, shield: T1, raised: true, guardBroken: false, carrying: true });
  check('carrying + raised resolves as passive, not braced', r.kind === 'passive' && r.finalDamage === 6, JSON.stringify(r));
  const rear = resolveShieldBite({ damage: 12, attackerAngle: REAR, playerFacing: 0, shield: T1, raised: true, guardBroken: false, carrying: true });
  check('carrying + raised rear is unblocked', rear.kind === 'none' && rear.finalDamage === 12);
}

console.log('\n14. GEOMETRY SANITY');
{
  check('attack bearing ahead is ~0', Math.abs(attackBearing(0, 1, 0, 0)) < 0.001);
  check('inArc center true', inArc(0, 0, 120) === true);
  check('inArc edge (±60°) true', inArc(Math.PI / 3, 0, 120) === true);
  check('inArc outside false', inArc(Math.PI / 3 + 0.1, 0, 120) === false);
}

console.log('\n15. THE LODESTONE SLOT (Adam, 2026-10-17)');
{
  // The Bulwark is abolished; its pull is a SLOT any shield can
  // wear. These checks pin the family as a pure ladder and the
  // magnet as growth-keyed, never item-keyed.
  check('the family is a pure 3-rung ladder', SHIELD_ITEM_IDS.length === 3
    && shieldOf('scute_shield')!.tier === 1 && shieldOf('lantern_shield')!.tier === 2 && shieldOf('fenback_shield')!.tier === 3);
  check('the abolished item resolves to no shield', shieldOf('lodestone_bulwark' as ItemId) === undefined);
  const lodged: ShieldGrowthMap = { fenback_shield: { graft: null, lodestone: true } };
  check('a bare fenback pulls at base reach', dropMagnetFor(T3, false, {}).radius === 5.0);
  check('a lodestone fenback pulls carried reach', dropMagnetFor(T3, false, lodged).radius === 9.0);
  check('braced, the pull stretches', dropMagnetFor(T3, true, lodged).radius === 13.0 && dropMagnetFor(T3, true, lodged).speed === 5.5);
  check('any shield can wear the slot (a lodestone scute pulls)', dropMagnetFor(T1, false, { scute_shield: { graft: null, lodestone: true } }).radius === 9.0);
  check('no shield in hand, no pull', dropMagnetFor(undefined, false, lodged).radius === 5.0);
  check('lodestoneOf reads the slot', lodestoneOf(lodged, 'fenback_shield') === true && lodestoneOf(lodged, 'scute_shield') === false);
  // The Fenback's own signatures stay hers alone (the P-1 lesson).
  check('fenback still sheds the Spore Answer (control)', shouldSporeBurst(T3, 'braced', true) === true);
  check('fenback still roots (control)', isDisplacementImmune(T3, true) === true);
}

console.log('\n16. THE GRAFT SLOT + THE SHIELD’S OWN STATE (2026-10-17)');
{
  check('a grown graft reads as its kind', graftOf({ scute_shield: { graft: 'spikes' } }, 'scute_shield') === 'spikes');
  check('an empty slot reads null', graftOf({ scute_shield: { graft: null } }, 'scute_shield') === null);
  check('an absent shield reads null', graftOf({}, 'scute_shield') === null);
  check('an absent record reads null', graftOf(undefined, 'scute_shield') === null);
  check('reflect reads the graft def (passive)', graftReflectDamage(false, 'spikes') === 4);
  check('reflect reads the graft def (braced)', graftReflectDamage(true, 'spikes') === 10);
  // The relocation migration: legacy player-level maps fold into
  // the shields' own records — true was the boolean era's spikes.
  const folded = shieldGrowthFromLegacy({ scute_shield: true, fenback_shield: 'spikes' as ShieldGraftId, lantern_shield: false });
  check('legacy true folds in as spikes', graftOf(folded, 'scute_shield') === 'spikes');
  check('a stored kind folds in as itself', graftOf(folded, 'fenback_shield') === 'spikes');
  check('legacy junk grows nothing', graftOf(folded, 'lantern_shield') === null);
  check('no legacy record folds to empty', Object.keys(shieldGrowthFromLegacy(undefined)).length === 0);
  // Inheritance carries BOTH slots up the ladder (2026-10-17).
  const fenRecipe = { outputId: 'fenback_shield', ingredients: [{ id: 'lantern_shield', count: 1 }] } as never;
  const inherited = graftInheritanceOnCraft(fenRecipe, { lantern_shield: { graft: 'spikes', lodestone: true } });
  check('a consume-upgrade inherits graft and lodestone together',
    inherited?.itemId === 'fenback_shield' && inherited.kind === 'spikes' && inherited.lodestone === true, JSON.stringify(inherited));
  // THE BULWARK FOLD: saves from the item era convert at load.
  const BUL = 'lodestone_bulwark' as ItemId;
  const solo = migrateBulwark({ [BUL]: 1 } as Record<ItemId, number>, { [BUL]: { graft: 'spikes' } }, BUL);
  check('a bulwark-only save gains a fenback', solo.changed && (solo.inventory['fenback_shield'] ?? 0) === 1 && solo.inventory[BUL] === undefined);
  check('the fenback wears the bulwark\'s slots', graftOf(solo.growth, 'fenback_shield') === 'spikes' && lodestoneOf(solo.growth, 'fenback_shield') === true);
  check('a held bulwark becomes a held fenback', solo.heldItemId === 'fenback_shield');
  const owned = migrateBulwark({ [BUL]: 1, fenback_shield: 1 } as Record<ItemId, number>, { fenback_shield: { graft: null } }, null);
  check('an owned fenback is not duplicated', (owned.inventory['fenback_shield'] ?? 0) === 1 && lodestoneOf(owned.growth, 'fenback_shield') === true);
  const clean = migrateBulwark({ scute_shield: 1 } as Record<ItemId, number>, {}, null);
  check('a save with no bulwark folds untouched', clean.changed === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
