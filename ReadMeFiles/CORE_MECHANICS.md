# BioForge — Core Gameplay Mechanics & Systems Specification

> **Status:** Living Document  
> **Last Updated:** October 14, 2026
> **Game Version:** v0.1.0  
> **Aesthetic:** Prismatic Botanical Tech (High-contrast, vibrant, porcelain synthetics, neon bioluminescence)

---

## 1. Overview & Mechanical Philosophy

BioForge is an open-world isometric exploration, bio-crafting, and living base-building game. Its central philosophical and mechanical pillars are:

1. **Non-Lethal Ecosystem Symbiosis:** Players harvest byproducts, saps, and secretions without destroying the environment or exterminating wildlife.
2. **Additive Enrichment (No Soil Depletion):** Cultivation focuses on positive enrichment through tailored bio-fertilizers rather than tedious crop rotation or penalty mechanics.
3. **Living Kinetic Architecture:** Structures are grown from living seed-nodes rather than welded as static blocks. They react dynamically to entities (such as Iris-Slit doors that dilate upon player proximity).
4. **100% Closed-Loop Deconstruction:** The Solvent Sprayer dissolves structures back into seed-nodes with zero material loss.
5. **Browser-Native P2P Co-Op:** Instant host-driven sessions with room codes over peer-to-peer data channels for zero-friction cooperative world-building.

---

## 2. Core Gameplay Loop

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    [ Explore Frontiers ]                    │
 │         Discover biomes, catalog new flora & fauna          │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Discover Flora / Fauna)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                [ Cultivate & Harvest ]                      │
 │    Gentle non-lethal gathering, seed planting & fertilizing │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Collect Byproducts & Pellets)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                [ Bio-Forge & Molecular Refine ]             │
 │  Synthesize living composites, fertilizers & defense bulbs  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Living Seed-Nodes & Modules)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                [ Construct, Tame & Expand ]                 │
 │     Grow bases, domesticate guardians, protect territory     │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Enables Deeper Expeditions)
                                └──────────────► [ Return to Explore ]
```

---

## 3. Primary Player Actions & Tool Suite

The player's bio-suit is equipped with six specialized botanical tech tools mapped to hotkeys `[1]` through `[6]`:

| Hotkey | Tool | Primary Action | Mechanic & Interactions |
|---|---|---|---|
| **[1]** | **Harvest Glove** | Non-Lethal Botanical Extraction | Gathers renewable resources (Resin Sap, Vibrant Petals, Ribbon Fibers, Dew Essence) without destroying plants. Plants reset to a regrowth cycle. |
| **[2]** | **Bio-Scanner** | Ecological Specimen Analysis | Points at any flora, fauna, or architecture to record genetic profile, habitat, byproducts, and taming diet into the Codex `[C]`. |
| **[3]** | **Planter Trowel** | Seeding & Soil Fertilization | Plants seeds into Cultivation Mounds or fertile ground. Applies Growth or Yield Fertilizers to accelerate or enhance existing crops. |
| **[4]** | **Solvent Sprayer** | Enzymatic Deconstruction | Discharges an enzyme that dissolves bio-composites back into liquid slurry on the spot, returning **100% of raw seed-nodes** to inventory. |
| **[5]** | **Taming Lure** | Wildlife Pacification & Domestication | Offers Sweet Nectar to docile critters (Soft-Puffs) or Carapace Baits to predators (Chitin-Stalkers) to domesticate them as companions or patrol sentries. |
| **[6]** | **Bio-Builder** | Living Structure Cultivation | Projects a holographic grid preview to place living walls, root floors, proximity doors, lamps, and workstations. |

---

## 4. Core Systems Detail

### 4.1. Botany, Growth & Additive Fertilization System
* **Growth Stages:** Sprout (Stage 0) ➔ Juvenile (Stage 1) ➔ Mature (Stage 2) ➔ Harvestable Bloom (Stage 3).
* **Regrowth Mechanics:** Harvested plants remain alive, resetting their maturation timer rather than despawning.
* **No Soil Depletion:** Plants do not degrade ground nutrients. Instead, players enrich plots with additive fertilizers:
  * **Growth Fertilizer** *(Organic Compost + Bio-Pellets)*: Accelerates maturation speed by 250%–300%.
  * **Yield Fertilizer** *(Animal Secretions + Resin Sap + Dew Essence)*: Doubles byproduct drop counts and unlocks rare prismatic color variants.

### 4.2. Living Kinetic Base Construction
* **Root-Tile Floors:** Interlocking woven bio-cellulose foundations that provide flat building surfaces and eliminate movement penalties.
* **Chitin-Glass Walls:** Semi-translucent porcelain panels reinforced with flex-resin, letting ambient bioluminescent light filter into rooms.
* **Iris-Slit Proximity Doors:** Sphincter/aperture doorways that dilate open when authorized explorers or tamed companions approach within 2.5 meters, sealing shut when empty or hostile threats draw near.
* **Lantern-Fern Lamps:** Bio-organic lampposts casting continuous cool-cyan radiance, illuminating dark frontier nights.
* **Spore-Canopy Ceilings:** Domed organic shelters that filter airborne environmental contaminants.
* **Bio-Forge Workstation:** Central molecular terminal for assembling blueprints, fertilizers, and seed strains.

### 4.3. Wildlife Behavioral AI & Domestication System
Fauna are categorized into two behavioral classes:

#### Class A: Passive Utility Critters (*Soft-Puffs, Burrow-Mice*)
* **Behavior:** Docile, wandering, hopping across meadows.
* **Taming:** Feed Sweet Nectar via the Taming Lure.
* **Utility:** Follow the player or clean the base perimeter; excrete **Bio-Pellets** over time (the core ingredient for Growth Fertilizer).

#### Class B: Territorial Guardians (*Chitin-Stalkers, Scale-Bears*)
* **Behavior:** Prowling frontier borders, aggressive to intruders.
* **Taming:** Subdue or lure using Sweet Nectar / Carapace bait.
* **Utility:** Patrol base boundaries, attack hostile beasts, and periodically shed **Reinforced Carapace Scales** for structural reinforcement.

### 4.4. In-Universe Deconstruction (Solvent Sprayer)
* Rather than swinging a destructive pickaxe or hammer, the player sprays a harmless organic solvent.
* The structure liquefies into an iridescent mist and congeals back into its pristine seed-node form.
* **100% Refund Rate:** No penalties, no waste, encouraging bold architectural experimentation.

### 4.5. First-Person Perspective, Viewmodel & Collision Physics
* **Camera Perspective:** Full 1st-person camera at eye-level height ($y \approx 1.6$) driven by `PointerLockControls`.
* **Aim & Reticle:** Central crosshair with distance-bounded raycasting (up to 7.5 meters) for interactive harvesting, scanning, planting, and solvent spraying.
* **Viewmodel (Hands & Active Bio-Tools):**
  * Renders porcelain explorer gauntlets and active bio-tools in front of the camera.
  * Dynamically switches tool heads based on active slot (Glow tips, Tricorder screen, Trowel scoop, Enzyme nozzle, Honey wand, Hologram projector).
  * Features breathing sway, rhythmic walking bobbing, and action recoil animations.
* **Spatial Collision Resolution:**
  * Physical boundary collision against placed walls (`chitin_glass_wall`), closed doors (`iris_slit_door`), workstations (`bio_forge_station`), and dense hazardous flora (`snap_trap`, `sap_weaver`).
  * Smooth axis-independent sliding allows natural movement along base corridors and boundaries.

### 4.6. World Geography, Navigation & Radar

* **Surface zones:** The world is organized as a grid of 100 m × 100 m
  surface zones. The current playable map is the spawn zone, **(0, 0)**.
  Each zone has one biome — its ecological identity — and a poetic name
  generated from pools matched to that biome. The spawn zone is always
  a meadow; stranger biomes occur farther away by zone-hop distance.
* **Current zone readout:** The HUD names the current zone and shows
  its biome and grid coordinates. Within 10 m of the map edge, it also
  identifies the next zone in that direction by name and biome, giving
  the player a horizon before inter-zone travel is implemented.
* **Minimap & survey:** The minimap footer and world-survey header show
  the current zone coordinates and identity. The survey's four colors
  are sectors of the current zone, not separate zones or biomes.
* **Spawn tracking:** The circular radar carries a small amber arrow on
  its rim pointing toward the spawn point, so the player can always
  recover the direction home. It disappears when the player is already
  at spawn.
* **Future intent — a built radar device (Adam, 2026-10-14):** At some
  point the player will **assemble a radar device out of pieces and
  parts**, rather than the navigation suite being only an abstract HUD
  feature. The exact components, recipe, assembly location, and which
  present-day radar functions belong to the device are undecided. The
  design question to settle when this is built is what basic orientation
  remains available before construction and what the completed device
  adds or improves.

### 4.7. Browser-Native P2P Multiplayer Architecture
* **Host-Driven Sessions:** One browser acts as host authority; no external game servers required for casual play.
* **Zero-Setup Room Codes:** Hosts share a 6-letter room code (e.g. `BIO77X`).
* **State Synchronization:**
  * Real-time position & avatar orientation.
  * Synchronized structure placement and solvent deconstruction.
  * Shared flora harvesting timers and wildlife taming events.
  * In-game sector text communications.

---

## 5. Input & Controls Matrix

| Action | Primary Input | Secondary / Contextual Input |
|---|---|---|
| Move Explorer | `W`, `A`, `S`, `D` | Collision-Resolved Smooth Sliding |
| Look & Aim (Mouse-Look) | Screen Click (`PointerLockControls`) | Press `ESC` to release cursor for UI |
| Use Active Tool | Left Click | Viewmodel Recoil & Particle FX |
| Select Tools | Keys `1` – `6` | HUD Bottom Hotbar Click |
| Bio-Forge Workstation | `B` | Interacting with Workstation Structure |
| Inventory Pouch | `I` | HUD Bottom Button |
| Ecosystem Codex | `C` | HUD Bottom Button |
| P2P Multiplayer Lobby | `M` | HUD Top Room Pill |
| Controls Field Manual | `?` | HUD Top Help Icon |
| Day / Night Sol-Cycle Toggle | HUD Atmosphere Pill | Natural real-time solar transition |
| Audio Mute / Unmute | HUD Speaker Icon | Persistent Audio Context |

---

## 6. Document Maintenance
This specification must be updated alongside any major commit affecting tool behaviors, economy equations, entity classifications, or multiplayer networking protocols.
