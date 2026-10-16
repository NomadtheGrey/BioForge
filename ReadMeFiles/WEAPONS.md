# BioForge — The Strikers (grown weapons)

*Built and live 2026-10-16 (Adam's directives, background-tasks chat).
Rules table in code: `src/game/weapons.ts`. This page is the
plain-language record.*

## The slot

Weapons live in ONE place: a **seventh slot** in the gauntlet's
tool row — the **Striker** slot (key **7**). The slot draws one
weapon at a time:

- **Tap 7** (or tap the slot tile) while the striker is in hand to
  swap the draw between your close weapon and your ranged weapon.
- The **mouse wheel** does the same while the striker is in hand
  (the wheel keeps its old meanings for the trowel and builder).
  On the phone, tapping the active slot-7 tile swaps the draw.
- The HUD tile wears the drawn weapon's name and icon, so you
  always know what's in hand.
- The slot wakes only when you own a weapon — same
  ownership-derivation as every other tool. Locked, it explains
  itself: grow a Briar Barb or a Spit Pod.

## The ladder — one close + one ranged per tier

| Tier | Close | Ranged | Craft |
|---|---|---|---|
| 1 | **Briar Barb** — 18 dmg, fast, flinches | **Spit Pod** — 12 dmg, spine at 16 m/s | Barb: 2 resin + 2 fiber + 1 carapace scale. Pod: 2 fiber + 2 dew + 1 resin |
| 2 | **Chitin Fang** — 34 dmg | **Spore Puffer** — 24 dmg, bursts in a 1.8 m spore ball | Fang: the Barb + 2 carapace + 1 cinder scale. Puffer: the Pod + 2 bio-pellets + 2 glow spores |
| 3 | **Glass Sting** — 55 dmg | **Storm Lance** — 44 dmg, lance at 26 m/s | Sting: the Fang + 2 saltglass shards + 1 living thread. Lance: the Puffer + 1 fulgurite shard + 1 prismatic core + 1 living thread |

**A better tier is an upgrade, not a sibling:** each higher craft
*consumes* the lower weapon of its kind, so your pouch only ever
holds one close striker and one ranged striker — your best pair.
Weapon-specific upgrade paths beyond the tiers are deliberately
parked (Adam, 2026-10-16: "we'll think about upgrades for the
weapons later").

## How striking works

- The game's click grammar, unchanged: select slot 7, click the
  creature. Clicking open ground swings (close) or looses at that
  point (ranged); clicking a plant never harms the plant.
- **Close** is reach-checked (~2.4 m + a half-meter of grace —
  deliberately a step beyond a hunter's bite). A landed hit
  **flinches** the creature: for a third of a second or so it
  neither moves nor bites. The flinch is the melee's real job.
- **Ranged** shots fly at a real speed and are aimed at where the
  target *stood* when you fired. If it has moved ~2 m by the time
  the shot arrives, you miss cleanly. The Spore Puffer's ball
  bursts where it lands and catches everything wild nearby.
- Every strike costs **stamina** and respects the weapon's
  **cooldown** — hits and whiffs alike. No ammo: a grown weapon
  regrows its spine or spore during the cooldown.
- Feedback: swing whoosh, a woody thock + amber burst on a landed
  hit, a visible tracer flying the true shot line at the true
  speed, and a first-person model per weapon that re-grows in
  your hand when the draw changes.

## The harm doctrine (shared with the solvent)

- **Companions are immune.** Your strikers never harm your own —
  clicking a companion stays the hand before any cost.
- **Peaceful is safe both ways.** Like hunter bites and the
  solvent's dissolve, strikes and shots are armed only where the
  difficulty arms harm.
- **A kill drops the creature's sample** — the remains rule — by
  any route: strike, shot, guardian bite, or dissolve. The
  culture vat is how the dead come back.
- The **solvent sprayer** remains the tier-0 emergency floor
  (damage over time + flight), underneath the whole ladder.
