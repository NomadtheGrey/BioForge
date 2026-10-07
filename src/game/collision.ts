/**
 * BioForge First-Person Spatial Collision System
 * Prevents walking through placed walls, closed doors, and dense plants
 * Adheres to CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 3 (Performance)
 */

import { StructureEntity, FloraEntity } from '../types/game';

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
  structures: StructureEntity[]
): boolean {
  return structures.some((s) => {
    // Iris doors allow passage when opened (> 65% open)
    if (s.type === 'iris_slit_door' && s.doorOpenProgress > 0.65) {
      return false;
    }

    // Floors and cultivation mounds can be walked over freely
    if (s.type === 'root_tile_floor' || s.type === 'cultivation_mound' || s.type === 'spore_canopy') {
      return false;
    }

    // Wall and closed door box collision
    if (s.type === 'chitin_glass_wall' || s.type === 'iris_slit_door') {
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

    const distSq = (candidateX - s.worldX) ** 2 + (candidateZ - s.worldZ) ** 2;
    return distSq < (obstacleRadius + PLAYER_RADIUS) ** 2;
  });
}

/**
 * Checks if a candidate position collides with dense plants (Snap-Traps, Sap-Weavers)
 */
function isCollidingWithFlora(
  candidateX: number,
  candidateZ: number,
  floraList: FloraEntity[]
): boolean {
  return floraList.some((f) => {
    // Only mature dense or hazardous flora have physical collision
    if (f.growthStage < 2) return false;
    if (f.species !== 'snap_trap' && f.species !== 'sap_weaver') return false;

    const plantRadius = f.species === 'snap_trap' ? 0.65 : 0.7;
    const distSq = (candidateX - f.x) ** 2 + (candidateZ - f.z) ** 2;
    return distSq < (plantRadius + PLAYER_RADIUS) ** 2;
  });
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
  floraList: FloraEntity[]
): { x: number; z: number } {
  // 1. Check full displacement
  const targetX = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, currentX + desiredDeltaX));
  const targetZ = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, currentZ + desiredDeltaZ));

  const collidesFull =
    isCollidingWithStructure(targetX, targetZ, structures) ||
    isCollidingWithFlora(targetX, targetZ, floraList);

  if (!collidesFull) {
    return { x: targetX, z: targetZ };
  }

  // 2. Slide check on X axis independently
  const collidesXOnly =
    isCollidingWithStructure(targetX, currentZ, structures) ||
    isCollidingWithFlora(targetX, currentZ, floraList);

  // 3. Slide check on Z axis independently
  const collidesZOnly =
    isCollidingWithStructure(currentX, targetZ, structures) ||
    isCollidingWithFlora(currentX, targetZ, floraList);

  if (!collidesXOnly && collidesZOnly) {
    return { x: targetX, z: currentZ };
  }

  if (collidesXOnly && !collidesZOnly) {
    return { x: currentX, z: targetZ };
  }

  // Both axes blocked: stay in place
  return { x: currentX, z: currentZ };
}
