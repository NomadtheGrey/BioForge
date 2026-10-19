# World Generation — Algorithms & Player Extras (Brainstorm)

**Status: BRAINSTORM / RECOMMENDATIONS (2026-10-13; sweep note
2026-10-18).** Nothing here is pinned except where it points at
settled rules in BIOMES_BRAINSTORM.md (host generates zones;
instanced interiors; biome = rules). Much of what this file
recommends has since shipped — the shipped truth lives in
GENERATION_ALGORITHMS.md (P1–P5) and BIOMES_BRAINSTORM.md's
sweep note; this file is the era's thinking, kept as history.

Caves and ruins want *different* generators: one is grown by geology, the
other was grown on purpose.

## Cave generation (instanced zones)

**Cellular automata + graph repair.**

1. Start with a grid (same 2 m cell thinking as the surface) filled randomly
   at roughly half wall. Smooth it repeatedly with simple neighbor rules —
   organic caverns fall out of this naturally.
2. Flood-fill to find the disconnected open pockets. Keep the cave as one
   connected space: carve corridors joining the pockets that matter —
   entrance, deep chambers, exits.
3. Deliberately add **loops**, not just a tree of tunnels. Loops are escape
   routes when gas rises or something is behind you.
4. Place key chambers on the connection graph (nests, artifact vault,
   underground enclave, gas pockets) and grade everything by distance from
   the entrance: glow fungus and easy resources shallow; danger, rare
   minerals, and the weird deep.
5. **Validate before the world ships:** every key chamber reachable,
   corridors wide enough (dilate carved paths), no spawn points inside rock,
   no key point sealed off. If validation fails, repair or regenerate.
6. Host generates once; the layout serializes (compressed cell data +
   placed entities) and rides `world_sync`, per the settled host-authority
   rule. Movement plane stays flat in v1; ceiling height and decor are
   per-cell flavor until ramps/pits are designed.

## Ruin generation (surface remnants + instanced interiors)

**Room-graph grammar + a damage pass.**

1. Pick an archetype from the world's fate (see
   LORE_AND_ARTIFACTS_BRAINSTORM.md): cultivation vault, habitat ring,
   laboratory, crashed vessel, defensive root.
2. Generate a *graph* of purposeful rooms — entrance, hub, artifact vault,
   dormant-organism chamber, collapsed wing — connected with loops and one
   secret. Subdivide/grow the layout root-like (BSP or seed-and-branch):
   precursor buildings were *grown*, so branching, slightly irregular
   layouts sell that better than blueprints.
3. Stamp surface remnants from the same grammar at smaller scale, rotated
   and eroded, with scattered fragments breadcrumbing toward entrances —
   guidance without markers.
4. Run the centuries (the damage/feral pass): collapse some passages, flood
   one wing, let flora overrun another, wake nothing. Any blocked critical
   path gets a loop around it or a systemic way through — build, grow,
   light, tame — never a hard dead end, per the settled systemic-barrier
   rule.
5. Place clues and artifacts by **graph depth**: mundane evidence near the
   door, the story's heart in the deepest room; a shortcut loop opens once
   the vault is activated, so the trip out is earned, not repeated.
6. Validate like caves: reachability of every key room, alternates for
   critical paths, spawn safety.

*Later option, not now:* Wave Function Collapse for grown-ruin tilework —
pretty, but a bigger lift than the grammar above.

## Player-facing extras (brainstorm, captured alongside)

- **Comfort toggles.** Reduced flashing (the solar-flare event demands it),
  camera-bob off, signals that never rely on color alone, and difficulty
  knobs that separate creature aggression from resource scarcity.
- **Co-op kindness.** A ping system; shared map notes; players may *name*
  discovered zones themselves (the game's poetic labels, the players'
  handwriting); host handoff if the host has to leave.
- **Memory-making.** Photo mode; naming pets and bases; a world "postcard"
  at creation — the map, the fate, the family who plays it.
- **Fairness.** Ecology that regrows so a world can't be strip-mined bare;
  guest catch-up via shared storage (borrow instead of starting poor);
  event forecasts (see the weather-organ artifacts in
  BIOMES_BRAINSTORM.md's world-events section).
