// ====================================================================
// THE HELMET'S RULES (helmet build, 2026-10-18)
//
// The Homestead Helm is the platform that KNOWS. Its modules
// — the lens line, the visors, the filters — shipped as paper
// on 2026-10-15 (items, recipes, quests); this module is
// where their WORN state is derived, so every effect reads
// the same answer.
//
// WORN, for a helmet module, means what it has meant since
// the radar conversion (Adam, 2026-10-16): the modules are
// maxStack-1 equipment, and OWNERSHIP IS INSTALLATION — a
// growth rides its platform by being owned, exactly as the
// radar rides the helm and the Windlung's rungs ride the
// Quicksteps (creatures/quicksteps.ts is the sibling rules
// module). A module without its helm is a lens in a pouch:
// glass, not sight. So every read here is helm AND module.
//
// Nothing here is saved: the derivations run over the live
// inventory wherever an effect needs them (the game loop's
// getter-dep pattern), which keeps the save format untouched
// and the effects local-player only by construction.
// ====================================================================

import type { ItemId } from '../../types/game';

type Inventory = Partial<Record<ItemId, number>>;

const owned = (inventory: Inventory, id: ItemId): boolean => (inventory[id] ?? 0) > 0;

/** The platform itself, worn (owned — see the header). */
export function helmWorn(inventory: Inventory): boolean {
  return owned(inventory, 'homestead_helm');
}

/** A module's worn answer: its platform AND the module. */
export function helmetModuleWorn(inventory: Inventory, moduleId: ItemId): boolean {
  return helmWorn(inventory) && owned(inventory, moduleId);
}

/**
 * The Biolume Visor: reads living light through the deepest
 * dark. The engine treatment hangs off this one answer
 * (threeEngine.setBiolumeVisor, driven per frame by the
 * game loop beside the held lantern's drive).
 */
export function biolumeVisorWorn(inventory: Inventory): boolean {
  return helmetModuleWorn(inventory, 'biolume_visor');
}

/**
 * The zone read, tiered by the lens line (helmet slice 2):
 * naming the land is a sense, and the helm is the sensory
 * platform. TIER 0 — no lens: the land stays unidentified.
 * TIER 1 — the Trail Lens: the FAMILY is named, the variant
 * stays the land's secret. TIER 2 — the Identifier Lens:
 * family, variant, and all. The consumers are the HUD's
 * zone labels (world/zones.zoneHudLabels) and the arrival
 * announcement (hooks/useZoneTravel) — both read this one
 * derivation, so the two surfaces can never disagree about
 * what the player's helm can see.
 */
export function helmetReadTier(inventory: Inventory): 0 | 1 | 2 {
  if (helmetModuleWorn(inventory, 'identifier_lens')) return 2;
  if (helmetModuleWorn(inventory, 'trail_lens')) return 1;
  return 0;
}
