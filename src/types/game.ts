/**
 * BioForge Core Type Definitions
 * Prismatic Botanical Tech Ecosystem
 */

export type ItemId =
  // Raw Botanical Byproducts & Harvests
  | 'resin_sap'
  | 'vibrant_petal'
  | 'sweet_nectar'
  | 'soft_fiber'
  | 'dew_essence'
  | 'bio_pellet'
  | 'carapace_scale'
  | 'prismatic_core'
  | 'basic_compost'
  // Cultivation Seeds
  | 'seed_lantern_fern'
  | 'seed_sap_weaver'
  | 'seed_petal_mill'
  | 'seed_snap_trap'
  | 'seed_bell_bloom'
  // Fertilizers
  | 'growth_fertilizer'
  | 'yield_fertilizer'
  // Bio-Composite Building Seed-Nodes
  | 'root_tile_floor'
  | 'chitin_glass_wall'
  | 'iris_slit_door'
  | 'lantern_fern_post'
  | 'spore_canopy'
  | 'bio_forge_station'
  | 'tamed_snap_trap_turret'
  | 'cultivation_mound';

export type ToolType =
  | 'harvest_glove'
  | 'bio_scanner'
  | 'planter_trowel'
  | 'solvent_sprayer'
  | 'taming_lure'
  | 'builder';

export interface ItemDef {
  id: ItemId;
  name: string;
  category: 'raw' | 'seed' | 'fertilizer' | 'structure';
  description: string;
  iconName: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'prismatic';
  maxStack: number;
}

export interface InventoryItem {
  id: ItemId;
  count: number;
}

export type FloraSpecies =
  | 'lantern_fern'
  | 'sap_weaver'
  | 'petal_mill'
  | 'mouth_vine'
  | 'snap_trap'
  | 'bell_bloom'
  | 'ribbon_moss';

export interface FloraEntity {
  id: string;
  species: FloraSpecies;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  growthStage: number; // 0=seedling, 1=sprout, 2=mature, 3=ready
  growthProgress: number; // 0 to 1
  fertilizedGrowth: boolean;
  fertilizedYield: boolean;
  harvestReady: boolean;
  harvestTimer: number;
  isHazardous: boolean;
  pacifiedUntil?: number;
  swayOffset: number;
  colorVariant?: string;
  isPlayerPlanted?: boolean;
}

export type FaunaSpecies =
  | 'soft_puff'
  | 'burrow_mouse'
  | 'chitin_stalker'
  | 'scale_bear';

export interface FaunaEntity {
  id: string;
  species: FaunaSpecies;
  x: number;
  z: number;
  y: number;
  rotation: number;
  state: 'idle' | 'wandering' | 'following' | 'patrolling' | 'eating' | 'alert' | 'attacking';
  isTamed: boolean;
  tamedBy?: string;
  targetX: number;
  targetZ: number;
  speed: number;
  health: number;
  maxHealth: number;
  byproductTimer: number; // spawns bio_pellet or carapace_scale
  animTime: number;
  colorVariant?: string;
  customName?: string;
}

export type StructureType =
  | 'root_tile_floor'
  | 'chitin_glass_wall'
  | 'iris_slit_door'
  | 'lantern_fern_post'
  | 'spore_canopy'
  | 'bio_forge_station'
  | 'tamed_snap_trap_turret'
  | 'cultivation_mound';

export interface StructureEntity {
  id: string;
  type: StructureType;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  rotation: number;
  health: number;
  maxHealth: number;
  doorOpenProgress: number; // 0 closed, 1 open
  plantedFloraId?: string; // for cultivation mound
  lastDefendTimer?: number;
  color?: string;
}

export interface DroppedItemEntity {
  id: string;
  itemId: ItemId;
  count: number;
  x: number;
  z: number;
  y: number;
  bobTime: number;
}

export interface CraftingRecipe {
  id: string;
  outputId: ItemId;
  outputCount: number;
  name: string;
  description: string;
  category: 'seeds' | 'fertilizers' | 'composites' | 'defenses';
  ingredients: { id: ItemId; count: number }[];
  craftTimeMs: number;
}

export interface CodexEntry {
  species: FloraSpecies | FaunaSpecies | StructureType;
  name: string;
  type: 'flora' | 'fauna' | 'composite';
  discovered: boolean;
  scannedCount: number;
  description: string;
  byproducts: string[];
  tamingOrCraftNotes: string;
  biome: string;
  iconColor: string;
}

export interface BiomeArea {
  name: string;
  description: string;
  groundColor: number;
  ambientLightColor: number;
  fogColor: number;
  primaryTone: string;
}

export interface PlayerState {
  x: number;
  z: number;
  rotation: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  energy: number;
  maxEnergy: number;
  activeTool: ToolType;
  selectedStructureType: StructureType;
  selectedSeedId: ItemId;
  selectedFertilizerId: ItemId;
}

export interface MultiplayerPeer {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  rotation: number;
  currentTool: ToolType;
  ping: number;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  type: 'harvest' | 'discover' | 'tame' | 'craft' | 'alert' | 'system';
  iconColor: string;
  time: number;
}

/**
 * Strict Discriminated Union for 1st-person reticle inspection
 * Enforces CODE_MANIFESTO.md Rule 9 (Zero Duck-Typing)
 */
export type HoverTarget =
  | { type: 'flora'; entity: FloraEntity; name: string; details: string }
  | { type: 'fauna'; entity: FaunaEntity; name: string; details: string }
  | { type: 'structure'; entity: StructureEntity; name: string; details: string }
  | { type: 'ground'; worldX: number; worldZ: number; name: string; details: string }
  | null;
