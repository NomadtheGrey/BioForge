# BioForge — Building System (SHIPPED)

Status: implemented and live, 2026-10-14. This document records how
building works NOW. Design discussion that led here: the 2026-10-14
playtest session (corner gaps, stacking, traversal).

## Grid and edges

- The world builds on a 2 m grid. A cell (gx, gz) is centered at world
  (2gx, 2gz).
- CELL pieces sit at a cell's center: root floors, cultivation mounds,
  forges, posts, canopies.
- PANELS (chitin-glass walls, iris doors) sit on cell EDGES — the edge
  nearest the aim point, along the player's snapped facing (90° steps).
  Perpendicular panels share the exact corner point, so rooms close
  with no gaps. Both cells sharing an edge agree on it: you can build a
  wall from either side. (Placement math: `src/game/placement.ts`.)
- Pieces face the way the player faces, snapped to 90° steps.

## Occupancy

- One ground layer (floor OR mound) + one upright per cell, per story.
- One panel per edge, per story.
- One vine ladder per edge, per story (its own family — it hangs on a
  wall without occupying the wall's slot).
- Walls in saves from before edge placement keep their old center
  positions; they work, just off-edge, until dissolved and rebuilt.

## Stories (levels)

- Every structure has a story level (`StructureEntity.level`; absent =
  0, the ground story). One story = 2.4 m (`STORY_HEIGHT`), the height
  of a wall.
- Buildings LEVEL THEMSELVES (Adam, 2026-10-14 — reversing the
  earlier follow-the-slope call, whose tilted ground-floor slabs
  fanned against straight walls in game): connected building
  pieces (floors, walls, doors, ceilings, vine ladders, turrets,
  lantern posts) share ONE flat datum — the lowest ground height
  among the build's anchors — and all stand plumb on it, stories
  stacking from the datum. Standalone objects (the forge, the
  cultivation mound) and landmarks (cave mouths, ruins) are not
  builds: they keep their own ground height. The placement ghost
  previews at the datum of the build it touches.
- Collision is scoped to the player's story: upper walls don't block
  the floor below, ground furniture doesn't block the floor above,
  plants never collide with upper stories.
- The player has a story too (`PlayerState.level`, saved). Support
  rule: above ground, you stand on ceiling floors; step off one and
  you drop to the highest floor in that column, or the ground.

## The building verbs (Bio-Builder tool, clicks)

- Aim at ground: place the selected piece (panels land on edges).
- Click a wall or door panel with a WALL/DOOR selected: STACK it on
  top (same edge, same facing, one story up).
- Click a wall or door panel with a FLOOR selected: lay a CEILING one
  story above, over the cell on YOUR side of the wall.
- Click the ground line of an already-walled edge with a WALL/DOOR
  selected: STACK onto the panel standing on that edge. This is the
  reliable way to stack on an IRIS DOOR — its blades open as you
  approach, so a click aimed at the doorway passes through to the
  ground line, which resolves to the door's own edge.
- Click any other structure (forge, post, canopy, turret, cave
  mouth...) with a WALL/DOOR selected: the panel rings that base
  block's cell on your facing edge, at the base's story. With a
  FLOOR selected: a CEILING over the base block's cell, one story
  up. Any solid block can anchor building, not just walls.
- Click a ceiling tile with a FLOOR selected: GROW the ceiling one
  tile in your facing direction (covers room centers no wall touches).
- Click a wall with a VINE LADDER selected: grow a ladder segment on
  that wall at that story.
- Click a ladder with a VINE LADDER selected: extend it one story up
  (requires a wall above to grow onto).
- Click a ladder with any other tool: CLIMB. From its story you rise
  one (needs a floor above on your side); from the story above you
  descend. You must stand in a cell the ladder's edge touches.
- Solvent sprayer dissolves anything at any story and refunds it —
  including ceiling tiles, which is how a bounce hole is re-opened.

## Getting up: two ways (Adam's spec)

1. Vine ladder — grown on wall faces, story by story (above).
2. Bounce-shroom — a plantable flora (spore crafted at the Bio-Forge,
   planted with the trowel on soil/mounds). Plant it beneath a ceiling
   HOLE with ceiling tiles around the hole. Stand on the mature cap
   (stage 4+) and press SPACEBAR: you launch one story up through the
   hole, with a brief grace window to step onto a tile. The cap ONLY
   fires on a jump — dropping through the hole onto it never rebounds.

## Saves and multiplayer

- Levels ride the normal entity/save/world-sync paths; peer_move
  carries the player's story, and avatars render at their story
  height. Old saves read every structure as story 0.
