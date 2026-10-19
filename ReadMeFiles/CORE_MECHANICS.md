# BioForge — Core Gameplay Mechanics & Systems Specification

> **Status:** Living Document  
> **Last Updated:** October 18, 2026 (the catch-up sweep: modes, the worn platform, propagation, cloud saves, and display coordinates added; §4.7's transport facts corrected)
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

#### 4.1.1. Propagation — How Plants Are Planted Again (shipped 2026-10-18)
* **One truth:** every flora species carries a `propagation` field in its definition — `'seed'`, a piece item, or `null` (wild-only). All 197 species are classified explicitly; every reader (planter, solvent, trowel wheel, quest events) resolves through the one module (`src/game/flora/propagation.ts`).
* **Seed-bearers** (flowers, grasses, ferns, harvest-bearing fungi): a glove harvest rolls **0–2 seeds** (¼ / ½ / ¼); a yield-fertilized plant rolls 1–2. There is no guaranteed seed anywhere. Seed items are generated from the field (`Seeds`, or `Spores` for fungi and ferns).
* **Piece species** (vines, reeds, mosses by their own stock; jellies by their gel; the stormcatcher by fulgurite): planted with a piece of the original plant, and a piece is reclaimed **only by dissolving the plant** — the cutting costs the plant.
* **Wild-only:** exactly eight harvest-bearing species are the land's own (heartbloom, tending_vine, grabvine, obsidian_bloom, rime_spire, sunshard_cluster, prism_cluster, zot_star), plus all scenery with no harvest. Their stories say why.
* The trowel's wheel walks all planting stock — seeds and pieces together; the glow_spore pair (surface cluster / cavern fungus) is the one designed sharing of a propagule.

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
* **Playing on a phone (touch mode, shipped 2026-10-14):** On
  coarse-pointer devices there is no pointer lock — and the game
  no longer asks for it: the simulation runs unlocked, a floating
  thumbstick moves (push far to sprint), dragging looks, and taps
  use the active tool at the reticle, with on-screen USE and JUMP
  buttons and tap targets for cycling seeds / fertilizer /
  blueprints. The HUD rearranges for the small screen (compact
  vitals, 48 px hotbar, the minimap yields on short landscape
  heights). Desktop play is unchanged in every particular.
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
* **The built radar device (Adam, 2026-10-14; BUILT the same day):**
  The player assembles a **Prismatic Field Radar** from four biological
  subassemblies at a Bio-Forge, rather than the navigation suite being
  only an abstract permanent HUD feature. Adam delegated the parts
  list to Marlowe; the decided recipe is:

  | Subassembly | Parts | Job in the device |
  |---|---|---|
  | **Resonant Antenna Fan** | 4 **Resonant Reeds** + 2 Ribbon Fiber | Sends and receives the radar pulse; the fibers carry the returning signal. |
  | **Sonar Receiver** | 2 **Sonar Vanes** + 1 Prismatic Core | The vanes gather faint returns; the core focuses and interprets them. |
  | **Chitin Housing** | 3 Carapace Scales + 2 Resin Sap | Rigid shell and antenna ribs, sealed with living resin. |
  | **Biolume Power Cell** | 1 Lantern-Fern Spore + 2 Dew Essence + 2 Bio-Pellets | A grown, self-lit power source for the pulse and display. |

  Final assembly consumes one of each subassembly. In raw materials:
  4 Resonant Reeds, 2 Sonar Vanes, 1 Prismatic Core, 3 Carapace Scales,
  2 Resin Sap, 2 Ribbon Fiber, 1 Lantern-Fern Spore, 2 Dew Essence, and
  2 Bio-Pellets.

  **Tier: 2** — by the derived recipe graph, never by assignment. Each
  subassembly crafts directly from Tier 0 raw/harvested materials, so
  the subassemblies are Tier 1; the radar consumes Tier 1 products, so
  the radar itself computes to Tier 2. (If a future refinement recipe
  ever produces one of its raw inputs — a refined Prismatic Core, say —
  the graph will deepen the radar's tier on its own.)

* **Two species exist partly to feed that recipe (both LIVE):**
  - **Echo Reed** *(flora)* — a hollow-stalked reed of the wetlands
    (two per wetland zone, dealt outside the census). Its segmented
    stalks resonate when the wind moves through them. A mature plant
    yields **Resonant Reeds** ×2 (×4 yield-fertilized) plus dew.
  - **Vesper Glider** *(fauna)* — a gliding creature with broad
    hearing vanes that navigates by emitted pulses, haunting the
    meadow and fungal zones beyond the homestead. It naturally sheds
    **Sonar Vanes** (about every 45 seconds, wild or tame), so the
    part follows BioForge's non-lethal byproduct pattern; no kill
    harvest is required.

  **What the finished radar DOES (decided and built 2026-10-14):**
  the radar is a Left-Hand instrument (below). While held, the
  minimap **pings the finds worth walking for** in the current zone
  or cavern: cave mouths (violet), precursor ruins (amber), cave
  descents (deep violet), vine shafts (emerald), chitin stalkers
  (pink), and snap-traps (red) — a pulsing diamond on the scope in
  range, a rim diamond at the find's bearing beyond it, and a ring
  on the expanded survey. The pre-radar split is the shipped one:
  the basic minimap, zone labels, the spawn arrow, and the cave-exit
  arrow work from the first minute; the crafted device adds the
  pings. ("Ribbon Fiber" in the recipe table is the game's
  **Soft Fiber** item.)

* **Cave-exit arrow:** Inside an instanced cavern, the radar's rim
  arrow turns violet and points to the cave exit portal — the way
  back up — taking the spawn arrow's place while underground (the
  surface spawn is not in the cavern's coordinate space).
* **The gauntlet is the progression spine (live 2026-10-15):** the
  explorer's gauntlet is issued at start knowing ONE function —
  harvest. Every other tool is a **module**, crafted at the Bio-Forge
  from simple spawn-zone ingredients and grafted on: Scanner
  (2 Dew Essence + 1 Carapace Scale), Planter (2 Soft Fiber +
  1 Basic Compost), Builder (3 Resin Sap + 2 Soft Fiber), Solvent
  (2 Dew Essence + 1 Resin Sap), Taming Lure (2 Soft Fiber + 2 Dew
  Essence). Owning the module item is the unlock; locked hotbar
  tiles show as lock silhouettes and explain themselves when
  clicked. Worlds created before modules existed keep their full
  tool set (nobody gets demoted), as do co-op guests. Crafting away
  from the forge is **Field Synthesis** — the gauntlet ladder's
  tier 2, granted by the Synthesizer Graft (3 Carapace + 3 Resin +
  2 Dew); tier-3 recipes stay forge-tethered regardless.
* **Mini-quests (live 2026-10-15):** the tutorial is a chain of
  little quests that mirror what the player does anyway, in
  complexity order: First Harvest → the five module crafts →
  Field Synthesis. A small **tracker HUD** follows one quest with a
  checkmark per gathered ingredient (checks light as items land in
  the pouch; completions latch, so spending the items keeps the
  credit). The **quest list** — top-row Quests button or the **Q**
  hotkey — groups the quests by tier, holds the tracking pick, and
  owns the tracker's visibility through its "Show the quest HUD"
  checkbox. Progress rides the save inside the player state.
  (Also fixed 2026-10-15: cave **prism clusters yield the Prismatic
  Core** the Sonar Receiver needs — before, the Core dropped
  nowhere and the cluster's Violet Prism fed no recipe; prisms
  remain ruin-cache treasure.)
* **Carrying capacity is a ladder too (live 2026-10-15):** new
  explorers start with an **empty pouch** (the worn gauntlet is the
  whole starter kit) and **stacks capped at 10**. Crafted pouch
  upgrades raise the cap — **Woven Pouch 25** (6 Fiber + 2 Dew),
  **Resin-Bound Satchel 50** (4 Resin + 4 Resonant Reed + 2 Fiber),
  **Living Rucksack 100** (4 Carapace + 1 Prismatic Core +
  4 Fiber); owning the item is the tier, and equipment (own max 1)
  never stacks. Caps bind every gain (harvest, loot, craft output);
  **overflow falls on the ground** at the player's feet — nothing
  vanishes. Two mini-quests teach the ladder: *Room to Breathe*
  after First Harvest, and *A Place for Things* after the Builder
  quest — the **Storage Pod** (4 Resin + 4 Fiber + 2 Carapace),
  placed with the Bio-Builder and clicked to open: **4 kinds × 25**,
  grown in place by kits into a **Hutch (8 × 50)** and a **Vault
  (12 × 100)**. Dissolving a pod spills its contents at its feet.
  (Development convenience, for now: the **backquote key** swaps
  the pouch with a full debug kit; saves always record the real
  pouch, never the kit.)
* **The Left Hand:** A dedicated off-hand slot beside the hotbar
  holds passive gear. Its citizens are the **Hand Lantern-Fern**
  (crafted: 1 Lantern-Fern Seed + 1 Organic Compost): carried in the
  left hand, its light follows the player like a torch, surface or
  cave — and the **Prismatic Field Radar** (above), which turns the
  minimap into a finder while held. Clicking the slot **cycles the
  instruments you own** (lantern → radar → stow) — in the dark,
  light or knowledge is a real choice; the held item is part of the
  saved player state.
* **Species↔biome affinities (live 2026-10-14):** in wild zones,
  census species grow only where they belong — bell-blooms in
  meadow/wetland, petal-mills in meadow/fungal, sap-weavers in
  fungal/ember, snap-traps in wetland/fungal; soft-puffs in
  meadow/wetland, stalkers in ember/fungal; lantern-ferns and
  burrow-mice everywhere. Off-affinity zones grow a little sparser,
  with a cast that tells you where you are — and getting resin
  (sap-weavers) or carapace (stalkers) means a trip. The spawn
  homestead is cultivated ground and always deals the classic
  census, so the first session is unchanged.
* **Glow-spore planting:** Glow Spores are seed stock. They take
  hold only in cavern dark, where they rise as **glow fungus** (the
  cave form of the surface glow spore cluster); on the surface the
  trowel refuses — wrong soil. Other seeds stay refused underground:
  the cavern floor is barren rock to everything but its own spores.
  What the player plants in a cave **persists per-cave**: the save
  record keeps each cavern's planted flora (keyed by instance) and
  restores it on the next delve, even though the wild cave regrows.
* **Display coordinates (2026-10-18):** under the hood, north is **−Z** — the engine's settled convention, and generation, travel, and saves all run on it. But every number the player sees reads like latitude — **north positive**: the zone one step north of spawn displays "Zone 0, 1". All player-facing Z readouts (zone label, minimap position and hover) negate through one helper (`displayZ` in zones.ts) so the screen can never disagree with itself.

### 4.7. Co-Op Multiplayer Architecture (corrected 2026-10-18)
* **Transport:** a Cloudflare Durable Object relay (`bioforge-relay`); the **host is authoritative** for the world. (The earlier BroadcastChannel/WebRTC description was AI-Studio-era and never described the shipped game.)
* **Zero-Setup Room Codes:** Hosts share a room code; guests join by code and receive the host's full world snapshot. A guest never attaches a save of their own.
* **State Synchronization:**
  * Real-time position & avatar orientation.
  * Synchronized structure placement and solvent deconstruction.
  * Shared flora harvesting timers and wildlife taming events.
  * In-game sector text communications — including the **SYSTEM / ADMIN** seats of the system-messages channel (see ReadMeFiles/SYSTEM_MESSAGES.md).
* **The host's law:** the host's save carries the session's difficulty; guests play under it (see §4.8).

### 4.8. Modes of the World — Difficulty Law (shipped 2026-10-18)
Every world is created under one law, recorded on its save:
* **PEACEFUL:** nothing can harm the player, and the player can harm nothing. Health floors at 1.
* **NORMAL:** the land has teeth. Wild hunters notice the player in every mode (the alert theater is universal), but only on an armed world do they commit — chase and bite for real damage. Player weapons likewise bite.
* **HOSTILE:** Normal's law, plus **explorers can harm explorers**: weapons work on other players exactly as they work on creatures — no special buttons, no separate arsenal. A strike is judged on the attacker's client with the weapon's own geometry and resolved on the victim's through the same shield/health path as a creature's bite.
* **THE REFUGE:** the spawn zone (0, 0) is safe as if it were Peaceful under any law — no bites, no player harm, no hazard deaths. The arming rule is one pure function (`isArmedAt`); Hostile is that rule plus the hostile flag (`isHostileAt`).
* **Death** is the same mercy in every mode: "Taken by the Land" — wake at the spawn base's Heart Tile, pouch untouched, nothing dropped.
* A world border warning speaks when a player steps out of the Refuge onto armed ground.

### 4.9. The Worn Platform — Helmet & Quicksteps (shipped 2026-10-18)
Equipment-state doctrine: every platform piece is **worn**; per-piece state lives in the piece; module effects key off **ownership** (these are maxStack-1 equipment — owned = installed), never off loose pouch possession and never off a player-level map.
* **The Homestead Helm's growths:** Trail Lens (names country by family) → Identifier Lens (proper names); Spore Filter (the Hollow's spore tax does not bite); Shade Visor (glare country sits at a gentler exposure); Glyph Lens (ruin reads give the deep line; precursor caches glow through walls); Charge Sight (the ground shows the zot's reach and the coming charge); **Biolume Visor** (living-light sight for caves, ruins, and deep night — the helm's brow-glow is deliberately weaker than a carried lantern).
* **The Quicksteps' growths:** Windlung (the stamina ladder: drain and recovery factors by tier); Ember Soles (lava is slow ground, no burn, while grown).
* **THE WATER MODULE is one module** (Webfoots + Stillsteps consolidated): tier 1 (Webfoots) improves swimming; tier 2 (Stillsteps, crafted by consuming Webfoots) adds standing and walking on still pond water. The **F key** — and the touch stance button — flips between swimming and water-walking, and the current choice is hinted on screen while in water. The stance is a posture, never saved. Stillsteps hold only on ponds, never rivers.

### 4.10. Cloud Saves (shipped 2026-10-18)
* **Opt-in only, forever; the local save is the master; the cloud is a mirror.** No accounts, no database: a Cloudflare KV box addressed by the SHA-256 fingerprint of a secret the game shows as **exactly three plain words**. The secret itself is never stored server-side.
* The seat is the start screen's **Saved Worlds** panel: turn on (words are dealt — write them down; there is no reset), bring a world down on another device by entering the words at the door, and **adopt** the typed words on that device so it saves back to the same box.
* Every overwrite parks the displaced copy first — a world is never silently overwritten. Guess-throttling (per-address + global budgets, residents exempt) is the security model in place of passphrase entropy. Design + proof record: `~/workspace/bioforge-saves/`.

---

## 5. Input & Controls Matrix

| Action | Primary Input | Secondary / Contextual Input |
|---|---|---|
| Move Explorer | `W`, `A`, `S`, `D` | Collision-Resolved Smooth Sliding |
| Look & Aim (Mouse-Look) | Screen Click (`PointerLockControls`) | Press `ESC` to release cursor for UI |
| Use Active Tool | Left Click | Viewmodel Recoil & Particle FX |
| Select Tools | Keys `1` – `7` (7 = Striker; tap again / wheel to swap its draw) | HUD Bottom Hotbar Click |
| Cycle the Left Hand | `Ctrl` + `↑` / `↓`, or `Ctrl` + wheel | Left Hand tile click |
| Water Stance (tier-2 water module) | `F` | Touch stance button |
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
