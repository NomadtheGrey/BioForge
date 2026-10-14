# Creature Behaviors — Brainstorm

**Status: BRAINSTORM ONLY (2026-10-13). Nothing in this file is pinned.**
These are raw ideas to sort through later. When something gets chosen, it moves
into CORE_MECHANICS.md and gets marked decided there.

## Where we start from (already built)

- Restless wandering — wild creatures roam instead of standing like statues.
- Aggro *awareness* in Peaceful: a wild stalker inside its range notices the
  player, holds position, and faces them. Actual attacks are Normal-difficulty
  design, not Peaceful.
- Pet commands cycle follow → stay → guard. Guard is species-specific:
  stalkers patrol a ring around their post; soft-puffs and burrow mice become
  drop collectors and fetch nearby drops into the player's pouch.
- Taming is a percentage roll per attempt, bait consumed either way
  (Soft-Puff 80%, Burrow Mouse 60%, Chitin-Stalker 25%).

## Earthly behavior toolbox

Behaviors a player recognizes from real animals — readable at a glance.

- **Herd and sentinel.** Grazers travel together; most eat while one keeps
  watch. An alarm makes the herd bunch and flee. Taming one member may earn
  the whole herd's tolerance.
- **Burrow and cache.** A creature digs up seeds, carries them home, and
  buries extras. Forgotten caches occasionally sprout into wild plants.
- **Pollinator rounds.** A flying creature visits mature flowers in a loose
  route, fertilizing them, possibly carrying traits from one plant to another.
- **Cleaner symbiosis.** A small creature follows a larger one, eating
  parasites or "itch spores." Help the little one and the big one becomes
  approachable.
- **Alarm network.** Prey don't flee one by one: one chitters, nearby prey
  scatter, and a predator may come investigate the noise.
- **Parents and juveniles.** Young stay glued to an adult. Feeding the adult
  is safe; crowding the juvenile makes the adult protective.
- **Territory and scent.** Predators follow patrol routes and scent-mark
  them. Other creatures avoid fresh marks unless hungry, desperate, or tame.
- **Sleep schedules.** Some species burrow or curl up to sleep; others only
  emerge in darkness. The world feels different depending on when you arrive.

## Alien behavior toolbox

Behaviors that could only happen on this planet.

- **Blink-when-unobserved.** Moves freely while not directly watched, freezes
  under a gaze, and blinks a few meters away if stared at too long. Taming is
  a slow-approach puzzle.
- **Light-drinking.** Gathers around lantern-ferns at night and slowly
  absorbs their glow. Frightened, it releases the stored light in a flash and
  escapes.
- **Echo mimic.** Learns sounds it hears — a harvest pop, a forge chime, a
  pet's call — and repeats them later, attracting or confusing other fauna.
- **Colony merge.** Tiny motes behave individually until threatened, then
  flow together into one larger worker or guardian. Startle it and it bursts
  back apart.
- **Shared memory spores.** A species shares experiences: feed several and
  the colony warms to you; harm one and distant members may already distrust
  you.
- **Dream double.** The body sleeps somewhere hidden while a translucent
  projection wanders and explores. You can interact with the projection, but
  taming requires finding the sleeping body.
- **Chemical moods.** Color and emissions change with surroundings. Calm near
  bell blooms, it releases growth spores; agitated near snap traps, it
  produces a predator-repelling mist.
- **Gravity-sick hopper.** Doesn't walk — falls in controlled arcs, bounces
  off walls, hangs beneath a canopy before dropping somewhere new.

## Favorite first combinations (Marlowe's picks, unapproved)

1. **Burrow Mouse:** burrow + cache + alarm calls — turns it into a real
   species instead of a small soft-puff variant.
2. **A glasswing-type pollinator:** pollinator rounds + light-drinking —
   ties fauna directly into the plant economy.
3. **A blink creature:** the signature alien — the species people remember
   BioForge for.
4. **Herd behavior:** unglamorous, but reusable across half the future roster.

## Parked, related

- **The wiggle pass** (procedural micro-motion so creatures feel alive in
  their bodies) is PARKED as of 2026-10-13. When revived: Adam's idea is
  Brownian-style motion — implemented as *bounded/damped* jitter (tiny random
  nudges that settle back toward the creature's pose/anchor), never a raw
  random walk, which would accumulate drift.
