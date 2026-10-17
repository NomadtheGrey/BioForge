# The Scute Shield — mechanics (PREPARED 2026-10-17, dev lane)

Status: design prepared on Adam's word ("let's create the mechanics
for the shield"), build queued behind the reorganization window.
Grep-verified starting point: there is NO shield item, model, or
mechanic in the game today. What exists is the material — Field Scute
(shed by the Boneback Tortoise on the Bonefields circuit) and, per its
description, a distinct Fen Scute from the Scaldback. The shield below
is built from those.

## The item

**Scute Shield** — crafted at the Bio-Forge from Field Scutes bound in
resin and fiber. Like the weapons, it is ownership-derived: grow it
once and it is yours; it does not occupy pouch space as a consumable.

## The seat

The **Left Hand**. The radar left that cycle when it became helmet
gear, so the hand today holds the lantern or nothing; the shield
takes the lantern's place in that cycle — shield in hand means
lantern stowed, and vice versa. Raised/lowered is a state of the held
shield, not an equip swap.

**Hand grammar (Adam's pin, 2026-10-17): Alt is the left-hand
modifier.** Alt + scroll wheel, or Alt + up arrow, cycles the Left
Hand (lantern ↔ shield ↔ empty). The un-modified wheel and arrows
keep their existing right-hand/gauntlet meanings (seed/blueprint/
striker draw, fertilizer/blueprint steps) — Alt is how the game tells
the hands apart, everywhere this distinction is needed.

## The verb — hold to raise

**Passive block (Adam's addition, 2026-10-17).** The shield defends
even when it is simply held, not raised: strikes landing in the
frontal arc are blunted — a respectable reduction, no stamina cost,
no stagger, no movement penalty. A shield on the arm is never only
luggage. Raising it is what turns that blunting into a wall:

Hold the block input to raise the shield (hold right-mouse on desktop;
a hold control on touch, placed by the HUD lane). While raised:

- **Frontal block.** Creature bites and strikes landing in a ~120°
  arc in the facing direction are blocked — no damage. Facing is the
  skill: side and back hits land normally. (This pairs with the game's
  facing grammar everywhere else, S6's facing-derived carry rotation
  included.)
- **Attacker stagger.** A blocked hit staggers the attacker briefly —
  the same flinch language the strikers already speak.
- **Stamina is the price.** Each blocked hit costs stamina, and holding
  the shield raised drains it slowly. Empty stamina = guard break: the
  shield drops and the player takes a brief vulnerable beat before it
  can rise again.
- **Braced, not fast.** Movement is slowed while raised.
- **Exclusivity.** You cannot strike while raised — raising the shield
  sheathes the striker. Defense and offense are a choice, per moment.
- **Not everything is a strike.** Sprays and damage-over-time (the
  solvent class) are not blockable; a shield stops teeth, not weather.

## Co-op

Blocking is local state on the holder; damage resolution is already
host-authoritative, and the host's resolution reads the holder's
raised state. Guests see the raised shield on the holder through the
same held-item presentation path the lantern already uses.

## The model (to build with the slice)

A grown shield, not a forged one: overlapping curved scute plates on a
root-and-resin frame, worn on the forearm — world model + held
viewmodel. The Grown Look texture kit (root grain, bark) serves the
frame; the plates take a glossy shell finish. No shield mesh exists
today; this is part of the build slice, not a prerequisite.

## S6 interlock

While carrying a vault, the whole kit is inert — the shield now gives
that rule a real third member: it cannot be raised mid-carry. S6's
gate list names the shield from the start.

## Slice shape (one slice)

Item + recipe (constants/recipesData) · Left Hand integration (App
held-item cycle) · raise input + block resolution in the damage path
(useToolInteractions / useWorldEntities) · stamina costs + guard break
· the mesh (viewmodel + held) · HUD tile state (lowered/raised) via the
HUD lane's weapons-entries work, which runs alongside.
Verification by driver: bite damage front/side/back, raised vs
lowered; stamina drain + guard break; no striking while raised;
S6 carry leaves the shield unraisable.

## The Lantern Shield (Adam, 2026-10-17 — "for fun")

A grown combination: at the Bio-Forge, the **lantern and the Scute
Shield are grown together** — plus resin to bind them and a
bioluminescent feeder material to keep the lamp fed (exact feeder
item pinned at build time against the item table). The recipe
CONSUMES both parents, per the weapons-ladder doctrine: the Lantern
Shield is one item in the Left Hand cycle (lantern ↔ shield ↔
lantern shield ↔ empty, ownership-derived as usual), and a player who
wants a plain lantern back re-grows one.

It is the shield in full — passive blunt carried, braced wall raised,
same stamina, same stagger — with the lantern's light while held. The
lamp sits grown into the shield's face, so the light stays while
braced and throws forward: you light the thing you are hiding behind,
and it lights you back.

**Tier + cost (Adam's pin, 2026-10-17): TIER 2, moderately expensive.**
Tier 2 here is a branch, not a stronger wall — it blocks exactly as
the Tier 1 Scute Shield does; what the tier buys is the light. The
resin + feeder quantities are set at build time to a meaningful
mid-game cost: a deliberate grow, not an epic one.

## Open for Adam (pin-time)

- **The ladder, partly settled:** Tier 1 = Scute Shield, Tier 2 =
  Lantern Shield (a combination branch — same wall, plus light).
  Still open: whether a Tier 3 exists, and whether it would be a
  stronger wall or another combination.
- **Field vs Fen:** Field Scute is the heavy plate; the Fen Scute
  could make a lighter shield — narrower arc, cheaper stamina. Two
  shields with a real trade, or one material only?
- **Negation vs reduction:** the frontal block above negates strike
  damage outright. Against the biggest hunters, should a blocked hit
  still shave through a little?
