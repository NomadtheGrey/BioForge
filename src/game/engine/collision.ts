/**
 * BioForge First-Person Spatial Collision System
 * Prevents walking through placed walls, closed doors, and dense plants
 * Adheres to CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 3 (Performance)
 */

import { StructureEntity, FloraEntity } from '../../types/game';
import { isWalkOverType, isPortalType, isEdgePanel, isDoorType } from '../structures/placement';

export interface CollisionObstacle {
  x: number;
  z: number;
  radius?: number;
  halfWidth?: number;
  halfDepth?: number;
  type: string;
}

const PLAYER_RADIUS = 0.42;
const WORLD_BOUNDARY = 48.0;

/**
 * Checks if a candidate position collides with any solid structure
 */
function isCollidingWithStructure(
  candidateX: number,
  candidateZ: number,
  structures: StructureEntity[],
  playerLevel: number = 0
): boolean {
  return structures.some((s) => {
    // Collision is scoped to the story the player is standing on: a
    // second-story wall must not block someone walking beneath it, and
    // a ground-floor forge must not block someone crossing the floor
    // above it.
    if ((s.level ?? 0) !== playerLevel) {
      return false;
    }

    // Doors allow passage when opened (> 65% open)
    if (isDoorType(s.type) && s.doorOpenProgress > 0.65) {
      return false;
    }

    // Floors, cultivation mounds and vine ladders can be walked over freely
    if (isWalkOverType(s.type)) {
      return false;
    }

    // The cave exit is a portal, not an obstacle: the player ENTERS
    // standing in its ring (the instance spawn is the entrance cell),
    // so it must never push back. The descent shaft is the same kind
    // of doorway — the player stands at its throat to use it. The
    // ruin threshold is the third sibling: the ruin spawn is its cell.
    if (isPortalType(s.type)) {
      return false;
    }

    // Wall and closed door box collision (the edge panels)
    if (isEdgePanel(s.type)) {
      const isRotated = Math.abs(Math.sin(s.rotation)) > 0.7;
      const halfW = isRotated ? 0.35 : 1.05;
      const halfD = isRotated ? 1.05 : 0.35;

      const dx = Math.abs(candidateX - s.worldX);
      const dz = Math.abs(candidateZ - s.worldZ);

      return dx < halfW + PLAYER_RADIUS && dz < halfD + PLAYER_RADIUS;
    }

    // Cylindrical obstacle structures (Bio-Forge, Posts, Turrets)
    let obstacleRadius = 0.5;
    if (s.type === 'bio_forge_station') obstacleRadius = 1.15;
    if (s.type === 'tamed_snap_trap_turret') obstacleRadius = 0.6;
    if (s.type === 'lantern_fern_post') obstacleRadius = 0.35;
    if (s.type === 'banner_post') obstacleRadius = 0.3;
    // The portal station's ring (Departure D2): a monument —
    // the player addresses it, never stands inside its disc.
    if (s.type === 'portal_ring') obstacleRadius = 1.3;
    // The Presence (Departure D3): its heart-growth is solid;
    // the stone ring around it is the room you stand in.
    if (s.type === 'the_presence') obstacleRadius = 0.9;
    // The Deep BioTunnel's throat (Departure D3): addressed,
    // descended by the click — never stood inside.
    if (s.type === 'deep_biotunnel_mouth') obstacleRadius = 1.5;
    // Furniture footprints (slice E): a bed is a body-length
    // piece; a stool is a small one.
    if (s.type === 'root_bed') obstacleRadius = 0.85;
    if (s.type === 'root_stool') obstacleRadius = 0.3;
    // The hearthpod is a squat pod: warm to stand NEAR, solid to touch.
    if (s.type === 'hearthpod') obstacleRadius = 0.55;
    // A cave mouth is a rock mass: you walk up TO the opening (the
    // portal radius is 1.4 m) but not into the stone.
    if (s.type === 'cave_mouth') obstacleRadius = 1.3;
    // A ruin landmark's gate massif: traces are low rubble you can
    // pick through (small radius); a real gate stops you at its
    // threshold, like the cave mouth's portal rock.
    if (s.type === 'ruin_landmark') {
      obstacleRadius = s.ruin?.tier === 'traces' ? 0.8 : s.ruin?.tier === 'small' ? 1.6 : 2.1;
    }

    const distSq = (candidateX - s.worldX) ** 2 + (candidateZ - s.worldZ) ** 2;
    return distSq < (obstacleRadius + PLAYER_RADIUS) ** 2;
  });
}

/**
 * Flora collision: NONE (Adam's ruling, 2026-10-18). Two
 * species (snap-trap, sap-weaver) used to gain a collision
 * disc at growth stage 2 — which trapped a player the
 * plant grew around, since the resolver can refuse entry
 * but had no way out. Adam's call: plants are plants —
 * every species is walk-through, like the rest of the
 * flora always was. The plants' BEHAVIORS are untouched
 * (the snap fires on proximity in the sim, not contact),
 * so nothing else depends on this returning true.
 */
function isCollidingWithFlora(
  candidateX: number,
  candidateZ: number,
  floraList: FloraEntity[],
  playerLevel: number = 0
): boolean {
  void candidateX; void candidateZ; void floraList; void playerLevel;
  return false;
}

/** The active cavern grid while the player is inside an instance. */
export interface CavernGridRef {
  grid: string[];
  width: number;
  height: number;
}

/**
 * Cave walls collide as rock: sample the player circle's center and
 * axis extremes; if any sample lands in a wall cell (or outside the
 * grid), the move is blocked. Cell lookup inverts
 * cavernCellToWorld (game/world/cavern.ts): cx = x/2 + (width-1)/2.
 */
export function isCollidingWithCavernWalls(
  candidateX: number,
  candidateZ: number,
  cavern: CavernGridRef
): boolean {
  const samples: [number, number][] = [
    [candidateX, candidateZ],
    [candidateX + PLAYER_RADIUS, candidateZ],
    [candidateX - PLAYER_RADIUS, candidateZ],
    [candidateX, candidateZ + PLAYER_RADIUS],
    [candidateX, candidateZ - PLAYER_RADIUS],
  ];
  for (const [sx, sz] of samples) {
    const cx = Math.round(sx / 2 + (cavern.width - 1) / 2);
    const cy = Math.round(sz / 2 + (cavern.height - 1) / 2);
    if (cx < 0 || cy < 0 || cx >= cavern.width || cy >= cavern.height) return true;
    if (cavern.grid[cy][cx] === '#') return true;
  }
  return false;
}

/**
 * Resolves movement with smooth sliding along obstacles
 */
export function resolveMovementWithCollision(
  currentX: number,
  currentZ: number,
  desiredDeltaX: number,
  desiredDeltaZ: number,
  structures: StructureEntity[],
  floraList: FloraEntity[],
  playerLevel: number = 0,
  cavern: CavernGridRef | null = null
): { x: number; z: number } {

  // 1. Check full displacement
  const targetX = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, currentX + desiredDeltaX));
  const targetZ = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, currentZ + desiredDeltaZ));

  const collidesFull =
    isCollidingWithStructure(targetX, targetZ, structures, playerLevel) ||
    isCollidingWithFlora(targetX, targetZ, floraList, playerLevel) ||
    (cavern !== null && isCollidingWithCavernWalls(targetX, targetZ, cavern));

  if (!collidesFull) {
    return { x: targetX, z: targetZ };
  }

  // 2. Slide check on X axis independently
  const collidesXOnly =
    isCollidingWithStructure(targetX, currentZ, structures, playerLevel) ||
    isCollidingWithFlora(targetX, currentZ, floraList, playerLevel) ||
    (cavern !== null && isCollidingWithCavernWalls(targetX, currentZ, cavern));

  // 3. Slide check on Z axis independently
  const collidesZOnly =
    isCollidingWithStructure(currentX, targetZ, structures, playerLevel) ||
    isCollidingWithFlora(currentX, targetZ, floraList, playerLevel) ||
    (cavern !== null && isCollidingWithCavernWalls(currentX, targetZ, cavern));

  if (!collidesXOnly && collidesZOnly) {
    return { x: targetX, z: currentZ };
  }

  if (collidesXOnly && !collidesZOnly) {
    return { x: currentX, z: targetZ };
  }

  // Both axes blocked: stay in place
  return { x: currentX, z: currentZ };
}

/**
 * Fauna barrier (pens, Adam, 2026-10-16): creatures meet edge
 * panels the way the player does — the same boxes, the same
 * open-door rule — resolved as a clamp on the step they just
 * took: if the landing point sits inside a panel's box, push it
 * out along the shallower penetration. Fauna steps are small
 * (well under the thinnest box), so a push-out can never tunnel
 * or teleport. Ground story only: pens are ground works, and a
 * second-story panel never bars a creature beneath it. Flight
 * is the caller's call (species data), not this function's.
 */
export function resolveFaunaPanelStep(
  toX: number,
  toZ: number,
  radius: number,
  structures: StructureEntity[],
): { x: number; z: number } {
  let x = toX;
  let z = toZ;
  for (const s of structures) {
    if (!isEdgePanel(s.type)) continue;
    if ((s.level ?? 0) !== 0) continue;
    if (isDoorType(s.type) && s.doorOpenProgress > 0.65) continue;
    const isRotated = Math.abs(Math.sin(s.rotation)) > 0.7;
    const halfW = isRotated ? 0.35 : 1.05;
    const halfD = isRotated ? 1.05 : 0.35;
    const dx = Math.abs(x - s.worldX);
    const dz = Math.abs(z - s.worldZ);
    if (dx < halfW + radius && dz < halfD + radius) {
      const penX = halfW + radius - dx;
      const penZ = halfD + radius - dz;
      if (penX < penZ) {
        x = s.worldX + (x >= s.worldX ? halfW + radius : -(halfW + radius));
      } else {
        z = s.worldZ + (z >= s.worldZ ? halfD + radius : -(halfD + radius));
      }
    }
  }
  return { x, z };
}
