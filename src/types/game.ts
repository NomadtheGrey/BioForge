/**
 * BioForge Core Type Definitions
 * Prismatic Botanical Tech Ecosystem
 */

import type { BiomeId } from '../game/biomes';

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
  | 'glow_spore'
  | 'hand_lantern_fern'
  | 'sunshard'
  | 'violet_prism'
  | 'precursor_shard'
  | 'resonant_reed'
  | 'sonar_vane'
  | 'resonant_antenna_fan'
  | 'sonar_receiver'
  | 'chitin_housing'
  | 'biolume_power_cell'
  | 'prismatic_field_radar'
  // Cultivation Seeds
  | 'seed_lantern_fern'
  | 'seed_sap_weaver'
  | 'seed_petal_mill'
  | 'seed_snap_trap'
  | 'seed_bell_bloom'
  | 'seed_bounce_shroom'
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
  | 'cultivation_mound'
  | 'vine_ladder'
  | 'cave_mouth'
  | 'cave_exit'
  | 'cave_descent'
  | 'vine_shaft'
  | 'ruin_landmark'
  | 'ruin_exit'
  | 'precursor_cache'
  | 'artifact_heart'
  | 'ruin_glyph'
  // Worn Equipment — the two platforms (settled 2026-10-13/14): the
  // GAUNTLET is the action platform (the hotbar tools are its modes);
  // the HELMET, when it arrives, is the sensory platform and joins
  // this same section. Equipment is WORN, never built — these ids
  // are ItemIds only, NOT StructureTypes. The gauntlet spent a month
  // inside StructureType, forcing impossible entries into every
  // Record keyed on it; the types pass of 2026-10-15 set that right.
  | 'field_synthesizer_gauntlet'
  | 'gauntlet_synthesizer_upgrade'
  // Gauntlet MODULES (Adam, 2026-10-15): the gauntlet is the early
  // game's progression spine — it starts able to HARVEST only, and
  // each further tool is a module crafted at the forge and grafted
  // on. Owning the module item IS the unlock (App derives the
  // unlocked tool set from the pouch; see game/quests.ts). The
  // items are equipment: they sit in the pouch, never spent.
  | 'gauntlet_scanner_module'
  | 'gauntlet_planter_module'
  | 'gauntlet_builder_module'
  | 'gauntlet_solvent_module'
  | 'gauntlet_lure_module';

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
  // 'equipment' joined the union in the 2026-10-15 types pass: worn
  // platforms (gauntlet, its graft, the future helmet) are their own
  // category, not raw materials with ambitions.
  category: 'raw' | 'seed' | 'fertilizer' | 'structure' | 'equipment';
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
  | 'bounce_shroom'
  | 'ribbon_moss'
  | 'glow_spore_cluster'
  | 'glow_fungus'
  | 'sunshard_cluster'
  | 'prism_cluster'
  | 'echo_reed';

export interface FloraEntity {
  id: string;
  species: FloraSpecies;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  growthStage: number; // 0=seed, 1=sprout, 2=growing, 3=established, 4=mature, 5=ready
  growthProgress: number; // 0 to 1
  fertilizedGrowth: boolean;
  fertilizedYield: boolean;
  fertilizerTimer?: number; // Seconds of growth-boost left (0/absent = none)
  harvestReady: boolean;
  harvestTimer: number;
  isHazardous: boolean;
  pacifiedUntil?: number;
  swayOffset: number;
  /** Biome TYPE this plant grew in (world-gen stamp; absent on player-planted flora and old saves). */
  biome?: BiomeId;
  colorVariant?: string;
  isPlayerPlanted?: boolean;
}

export type FaunaSpecies =
  | 'soft_puff'
  | 'burrow_mouse'
  | 'chitin_stalker'
  | 'scale_bear'
  | 'vesper_glider';

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
  /** Biome TYPE this creature spawned in (world-gen stamp; absent on old saves). */
  biome?: BiomeId;
  colorVariant?: string;
  customName?: string;
  command?: 'follow' | 'stay' | 'guard';
  anchorX?: number; // Guard post: where 'guard' was ordered — patrols loop
  anchorZ?: number; // around it and collectors return to it.

}

export type StructureType =
  | 'root_tile_floor'
  | 'chitin_glass_wall'
  | 'iris_slit_door'
  | 'lantern_fern_post'
  | 'spore_canopy'
  | 'bio_forge_station'
  | 'tamed_snap_trap_turret'
  | 'cultivation_mound'
  | 'vine_ladder'
  | 'cave_mouth'
  | 'cave_exit'
  | 'cave_descent'
  | 'vine_shaft'
  | 'ruin_landmark'
  | 'ruin_exit'
  | 'precursor_cache'
  | 'artifact_heart'
  | 'ruin_glyph';
  // NOTE: worn equipment (the gauntlet and its kin) is NOT a
  // structure — it cannot be built, placed, or stood on. It lives in
  // ItemId's equipment section. (It lived HERE until 2026-10-15,
  // which is why the engine's structure tables demanded a world
  // model and a glow entry for a glove.)

/** Dressing piece types a cave mouth wears (see game/caveSurface.ts). */
export type CaveDressingType =
  | 'cave_mouth'
  | 'dark_soil_patch'
  | 'rock_lip'
  | 'boulder'
  | 'rubble'
  | 'path_stone'
  | 'glow_spore_cluster'
  | 'reed_cluster'
  | 'glow_fungus_cluster'
  | 'heat_cracked_stone'
  | 'ember_vent';

/** One piece of cave-mouth set dressing, in zone-local meters. */
export interface CaveDressingPiece {
  id: string;
  type: CaveDressingType;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  /** Solid set dressing (kept out of the mouth's approach corridor). */
  blocking: boolean;
}

/**
 * The portal link on a cave-mouth structure: where this mouth leads and
 * where an exiting player reappears on the surface. This is the settled
 * "return address" design — stored save data (host-authoritative),
 * NEVER a generation input: the cavern behind this mouth derives from
 * (world seed + instanceId) alone, so moving this record can never
 * change the cave.
 */
export interface CaveLinkData {
  instanceId: string;
  /** Exit spawn: the mouth's anchor pushed 2 m out along its facing. */
  exitX: number;
  exitZ: number;
  dressing: CaveDressingPiece[];
}

/** Dressing piece types a ruin landmark wears (see game/ruins.ts). */
export type RuinDressingType =
  | 'pillar'
  | 'toppled_pillar'
  | 'wall_stub'
  | 'arch_fragment'
  | 'shard'
  | 'rubble';

/** One piece of ruin set dressing, in zone-local meters. */
export interface RuinDressingPiece {
  id: string;
  type: RuinDressingType;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  /** Solid set dressing (kept out of the entrance approach). */
  blocking: boolean;
}

/**
 * The record on a ruin_landmark structure (P4, surface stage): which
 * precursor fate built this place, which interior generator variant
 * that fate chooses, and how large the ruin is. Like the cave link,
 * this is stored bookkeeping — the interior (a later stage) derives
 * from (world seed + instanceId + fate) alone, so this record can
 * never change what sleeps below. The fate is deliberately NOT shown
 * in the UI: a world's story is discovered by reading its ruins.
 */
export interface RuinLinkData {
  instanceId: string;
  fate: string;
  variant: string;
  tier: 'traces' | 'small' | 'medium' | 'grand';
  /** Return address for the future interior: anchor + 2 m facing. */
  exitX: number;
  exitZ: number;
  dressing: RuinDressingPiece[];
}
;

export interface StructureEntity {
  id: string;
  type: StructureType;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  rotation: number;
  /**
   * Story level: 0 (or absent, in older saves) = ground story. A wall at
   * level 1 stands on a level-0 wall; a floor at level 1 is a ceiling
   * from below and the floor of the second story from above.
   */
  level?: number;
  health: number;
  /**
   * Ruin-interior feature payload (P4 interior stage): rides the
   * precursor_cache / artifact_heart / ruin_glyph structures inside a
   * ruin instance so any client can resolve loot and lore locally.
   * fate = the world's fate id; band = the feature's depth band.
   * Instance-transient like the cave link: never in a save's surface
   * world (instances park, they don't persist).
   */
  ruinFeature?: {
    fate: string;
    band: 'shallow' | 'mid' | 'deep';
  };
  maxHealth: number;
  doorOpenProgress: number; // 0 closed, 1 open
  plantedFloraId?: string; // for cultivation mound
  lastDefendTimer?: number;
  color?: string;
  /** Present only on cave_mouth structures: the portal link + dressing. */
  cave?: CaveLinkData;
  /** Present only on ruin_landmark structures: fate/variant/tier record. */
  ruin?: RuinLinkData;
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
  // The forge's recipe-tab groups (BioForgeModal filters on exactly
  // these). This type previously declared the ITEM category union,
  // which made every seed recipe a type error — corrected 2026-10-14.
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

/**
 * Mini-quest progress (Adam, 2026-10-15): which tutorial quests are
 * latched complete, which one the tracker HUD follows, and whether
 * the tracker shows at all. Rides the save inside PlayerState, like
 * heldItemId; absent on saves from before quests existed — App
 * treats absence as the veteran default (nothing latched, nothing
 * tracked, tracker hidden; the quest list still opens and the show
 * checkbox there can wake the tracker).
 */
export interface QuestProgressState {
  completedIds: string[];
  trackedId: string | null;
  showHud: boolean;
}

export interface PlayerState {
  x: number;
  z: number;
  rotation: number;
  /** Which story the player stands on (0 = ground). See StructureEntity.level. */
  level: number;
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
  /** The LEFT HAND: an item carried for its passive effect (today: the
   * Hand Lantern-Fern's light), separate from the active tool. Rides
   * the save verbatim with the rest of PlayerState; absent (undefined)
   * on saves from before the slot existed — treat as empty. */
  heldItemId?: ItemId | null;
  /** Mini-quest progress — see QuestProgressState. Optional for
   * save compatibility; new worlds start it fresh in
   * handleCreateSave. */
  questProgress?: QuestProgressState;
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
