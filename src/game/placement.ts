// ============================================================================
// placement.ts — where a placed structure actually goes
// ============================================================================
//
// Two placement families:
//   * CELL pieces (root floors, cultivation mounds, the forge...) live at
//     a grid cell's center.
//   * EDGE pieces — the structural panels: chitin-glass walls and iris
//     doors — live on a cell EDGE (Adam, 2026-10-14). Center-placed walls
//     could never form a corner: each stopped at its own cell's middle
//     span, leaving a gap at every turn. On edges, a north-edge wall and
//     an east-edge wall share the exact corner point, and a wall rings a
//     floor tile flush along its border.
//
// Which edge? The aimed cell's edge NEAREST the aim point, along the
// player's snapped facing: facing north/south means the panel runs
// east-west, so it takes the cell's north or south edge (whichever half
// you aimed at); facing east/west it runs north-south on the east or
// west edge. A happy consequence: the two cells sharing an edge agree
// on it — aiming from either side picks the same wall line.
//
// Occupancy follows the same split: one panel per edge; cell pieces keep
// the one-ground-layer + one-upright-per-cell rule. This module is the
// single source both the click handler (useToolInteractions) and the
// ghost preview (App) consult, so the ghost can never promise a spot the
// click would refuse.
// ============================================================================

import type { StructureEntity, StructureType } from '../types/game';

/** Grid cells are 2 m squares; cell (gx, gz) is centered at (2gx, 2gz). */
export const CELL_SIZE = 2;

/** Structural panels that live on cell edges instead of cell centers. */
export const EDGE_PANEL_TYPES: StructureType[] = ['chitin_glass_wall', 'iris_slit_door', 'rootweave_wall'];

/** Cell pieces that form the ground layer (one per cell). */
export const GROUND_LAYER_TYPES: StructureType[] = ['root_tile_floor', 'cultivation_mound', 'heart_tile'];

/**
 * Floor-kind structures (Adam, 2026-10-16): the walkable build
 * surfaces. Footing, landing support, terrain lift, collision,
 * the ladder's floor checks, and the map's floor color all ask
 * THIS set instead of re-deciding floor-ness per system — a new
 * floor joins here once and behaves everywhere. (The ground-layer
 * list above is the wider occupancy family: floors plus the mound.)
 */
export const FLOOR_TYPES: ReadonlySet<StructureType> = new Set([
  'root_tile_floor',
  'heart_tile',
]);

export function isFloorType(type: StructureType): boolean {
  return FLOOR_TYPES.has(type);
}

/**
 * Walk-over kinds (Adam, 2026-10-16, registry step 2): the
 * non-floor pieces a player crosses freely — collision asks
 * isWalkOverType, which is floors plus these.
 */
export const WALK_OVER_TYPES: ReadonlySet<StructureType> = new Set([
  'cultivation_mound',
  'spore_canopy',
  'vine_ladder',
]);

export function isWalkOverType(type: StructureType): boolean {
  return isFloorType(type) || WALK_OVER_TYPES.has(type);
}

/**
 * Portal kinds: doorways a player stands IN to use — the cave
 * exit's ring, the descent's throat, the ruin threshold. They
 * never push back in collision.
 */
export const PORTAL_TYPES: ReadonlySet<StructureType> = new Set([
  'cave_exit',
  'cave_descent',
  'vine_shaft',
  'ruin_exit',
]);

export function isPortalType(type: StructureType): boolean {
  return PORTAL_TYPES.has(type);
}

/**
 * The grid-built types that share build datums (moved here from
 * threeEngine in registry step 2, Adam, 2026-10-16). Standalone
 * objects — the forge, the cultivation mound, cave mouths, ruin
 * landmarks — are NOT builds: they keep their own ground height
 * and never join (or drag) a neighboring build's datum.
 */
export const BUILDING_TYPES: ReadonlySet<string> = new Set([
  'root_tile_floor',
  'heart_tile',
  'chitin_glass_wall',
  'iris_slit_door',
  'rootweave_wall',
  'spore_canopy',
  'vine_ladder',
  'tamed_snap_trap_turret',
  'lantern_fern_post',
]);

export function isBuildingType(type: StructureType): boolean {
  return BUILDING_TYPES.has(type);
}

export function isEdgePanel(type: StructureType): boolean {
  return EDGE_PANEL_TYPES.includes(type);
}

/** The vine ladder hangs ON a panel's edge (sharing its coordinates)
 * but occupies an occupancy family of its own: one per edge per level,
 * and it never blocks panels, floors, or anything else. */
export function isLadder(type: StructureType): boolean {
  return type === 'vine_ladder';
}

export interface PlacementSpot {
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  /** Story level (0 = ground). Ground-aim placement is always level 0;
   * stacking/ceiling placement (clicking a panel) sets higher levels. */
  level: number;
}

/**
 * Resolve a placement: given the structure type, the aim point on the
 * ground, and the player's snapped facing rotation, produce the cell
 * the piece belongs to and the exact world position it occupies.
 */
export function placementFor(
  type: StructureType,
  aimX: number,
  aimZ: number,
  rotation: number,
): PlacementSpot {
  const gridX = Math.round(aimX / CELL_SIZE);
  const gridZ = Math.round(aimZ / CELL_SIZE);
  const cx = gridX * CELL_SIZE;
  const cz = gridZ * CELL_SIZE;

  if (!isEdgePanel(type)) {
    return { gridX, gridZ, worldX: cx, worldZ: cz, level: 0 };
  }

  // Panel orientation comes from the facing: sin(rotation) ≈ 0 means
  // facing north/south, so the panel runs east-west and takes a
  // north/south edge; otherwise it runs north-south on an east/west edge.
  const runsEastWest = Math.abs(Math.sin(rotation)) < 0.7;
  if (runsEastWest) {
    const side = aimZ >= cz ? 1 : -1;
    return { gridX, gridZ, worldX: cx, worldZ: cz + side, level: 0 };
  }
  const side = aimX >= cx ? 1 : -1;
  return { gridX, gridZ, worldX: cx + side, worldZ: cz, level: 0 };
}

/**
 * The existing structure blocking this placement, if any. Edge panels
 * conflict only with a panel on the SAME edge (exact coordinates — edge
 * midpoints are whole meters, so equality is safe); cell pieces keep
 * the layer rule within their cell.
 */
export function occupancyConflict(
  type: StructureType,
  spot: PlacementSpot,
  structures: StructureEntity[],
): StructureEntity | undefined {
  if (isLadder(type)) {
    return structures.find(
      (s) =>
        isLadder(s.type) &&
        (s.level ?? 0) === spot.level &&
        s.worldX === spot.worldX &&
        s.worldZ === spot.worldZ,
    );
  }
  if (isEdgePanel(type)) {
    return structures.find(
      (s) =>
        isEdgePanel(s.type) &&
        (s.level ?? 0) === spot.level &&
        s.worldX === spot.worldX &&
        s.worldZ === spot.worldZ,
    );
  }
  const placingGroundLayer = GROUND_LAYER_TYPES.includes(type);
  return structures.find((s) => {
    if (s.gridX !== spot.gridX || s.gridZ !== spot.gridZ) return false;
    if ((s.level ?? 0) !== spot.level) return false; // each story has its own layers
    if (isEdgePanel(s.type) || isLadder(s.type)) return false; // panels/ladders live on edges, not in the cell's layers
    return GROUND_LAYER_TYPES.includes(s.type) === placingGroundLayer;
  });
}
