# BioForge — Changelog

All notable changes to the BioForge project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.0] - 2026-10-07

### Added
- **Tactical Minimap & Prismatic Verge World Survey Component (`Minimap.tsx`):**
  - Designed and implemented a responsive, high-tech `Minimap` component displaying real-time explorer coordinates ($X$ / $Z$), forward orientation indicator, and current sector name.
  - **Dual Display Modes:**
    - **Tactical Radar Mode**: Circular rotating radar view centered on the player with range rings, crosshairs, cardinal direction markers (N/E/S/W), vision cone wedge, and radar proximity blips.
    - **World Survey Mode**: Overview of the entire 100m $\times$ 100m world divided into the four distinct quadrants: *Violet Cradle*, *Turquoise Glade*, *Amber Thicket*, and *Prismatic Verge*.
  - **Entity Tracking & Hover Tooltips:**
    - Live tracking of nearby base structures (floors, chitin walls, defenses/turrets) with color-coded nodes.
    - Live tracking of nearby fauna (docile Soft-Puffs, tamed companions, territorial Chitin-Stalkers with alert pulse rings).
    - Optional Flora tracking toggle to view nearby harvesting nodes and botanical blooms.
    - Interactive hover tooltips providing entity name, category, metric distance ($m$), and world coordinates.
  - **Integration & Code Manifesto Compliance:**
    - Integrated seamlessly into the top-left HUD column underneath Bio-Suit Vitals with an on-demand "Map" toggle button in the header toolbar.
    - Fully compliant with `CODE_MANIFESTO.md`: 100% flat control flow, guard clauses, zero `else`/`else if` blocks, functional transformations, and strict TypeScript types.

---

## [0.6.0] - 2026-10-07

### Added
- **Developer Source Exporter Tool (`FileExporter.ts` & `SourceExporterModal.tsx`):**
  - Integrated `FileExporter.ts` in `src/utils/` containing pure utility functions for file extension extraction, language tagging, extension options aggregation, multi-extension & search filtering, and single-click Markdown concatenation.
  - Added `SourceExporterModal.tsx` in `src/components/`, featuring interactive extension badge filtering, live search, line count & byte volume indicators, full stitched Markdown preview, clipboard copy, and formatted `.md` file download.
  - Created `src/utils/workspaceFiles.ts` mapping Vite's `import.meta.glob('...', { query: '?raw', eager: true })` to provide a live, comprehensive virtual file map of all workspace files (`.ts`, `.tsx`, `.css`, `package.json`, `vite.config.ts`, `CODE_MANIFESTO.md`, `CHANGELOG.md`).
  - Added "Dev Tools" trigger button in the main application HUD header with clean icon and responsive pill styling.
  - Maintained complete compliance with the Code Manifesto: 100% flat control flow, guard clauses, zero `else`/`else if` statements, functional transformations, and strict TypeScript types.
  - Left game loop, rendering, and physics logic completely untouched.

---

## [0.5.0] - 2026-10-07

### Fixed & Optimized
- **ShadowMap & Clock Modernization:**
  - Replaced deprecated/removed shadow map types with `THREE.PCFShadowMap` (`renderer.shadowMap.type = THREE.PCFShadowMap`).
  - Completely eliminated `THREE.Clock` across the codebase, replacing it with high-resolution monotonic `performance.now()` frame timing.
- **Runaway FPS & Render Loop Unification:**
  - Diagnosed and resolved root cause of intense screen jitter: eliminated the competing secondary `requestAnimationFrame` loop in `App.tsx` that was tearing down and remounting on every frame due to high-frequency state dependency updates.
  - Established a **Single Source of Truth** animation loop inside `BioForgeThreeEngine`, which computes an authoritative frame delta ($dt \le 0.05$) and passes it downstream via the `onFrame(dt)` engine callback.
  - Routed high-frequency position, tool, and modal state through React `useRef` handles, preventing 60Hz/144Hz React reconciliation storms.
- **Pollen & Spore Particles Dynamics:**
  - Resolved runaway pollen speed: replaced unchecked frame-rate dependent position accumulation with gentle, frame-rate independent botanical drifting scaled strictly by `delta` ($0.35\text{ m/s}$ drift, $0.25\text{ m/s}$ vertical bobbing).
  - Added soft perimeter wrapping boundaries around the field, keeping pollen motes calmly floating without pop-in or warping.
- **Simulation Tick Throttling:**
  - Decoupled ecosystem simulation ticks (`updateTick` for critter AI, flora growth, item magnetism) to a stable 10Hz (100ms) interval.
  - Throttled Sol-Cycle HUD updates to 1Hz, preventing UI re-render thrashing.

---

## [0.4.0] - 2026-10-07

### Enhanced & Hardened
- **Continuous 1st-Person WASD Movement & Velocity Vector Dynamics:**
  - Added continuous movement controls (W: forward, S: backward, A: strafe left, D: strafe right, plus Arrow key support).
  - Clean velocity vector calculation in the animation loop using horizontal camera direction and right strafe vectors with smooth acceleration, top speed clamping ($6.4\text{ m/s}$), and linear friction damping ($16.0\text{ s}^{-1}$).
  - Clean vector resolution with axis-separated spatial collision detection and sliding.
- **Esc / Pause Mode Guard Clauses:**
  - Applied early-return guard clauses at the top of `keydown` and `keyup` listeners, instantly ignoring movement inputs when Esc or modal pause states are active.
  - Implemented immediate input reset and velocity zeroing upon pause/modal toggles to prevent stuck keys or phantom acceleration.
  - Guard clauses in `movementController.update()` instantly damp velocity and bail out when paused.
- **Strict Zero-'else' / Zero-'else if' Architectural Enforcement (Code Manifesto Rule 1):**
  - Audited and refactored all remaining `else` and `else if` constructs across the entire codebase into flat guard clauses, early returns, and discrete `if` checks.
  - Enforced zero `else` occurrences across all game logic, modals, engine renderers, and networking components.

---

## [0.3.0] - 2026-10-07

### Refactored & Enhanced
- **Modular Domain Architecture (Code Manifesto Rule 8):**
  - Refactored monolithic `App.tsx` state into dedicated, decoupled domain hooks:
    - `useInventory`: Pure inventory mutations, item checks, and crafting transactions.
    - `useWorldEntities`: Flora/fauna life-cycles, procedural seeds, entity placement, and byproduct simulation ticks.
    - `usePlayerState`: Explorer vitals, tool slots, blueprints, and coordinate transformations.
    - `useNotifications`: Transient toast notification queue management.
    - `useToolInteractions`: Clean encapsulation of all 6 botanical tool action handlers.
  - `App.tsx` now operates strictly as a thin coordinator layer wiring decoupled subsystems.
- **Strict Type Safety & Zero Duck-Typing (Code Manifesto Rule 9):**
  - Introduced the `HoverTarget` Discriminated Union in `types/game.ts` eliminating ambiguous `unknown` properties and duck-typed shapes.
  - Strictly bound raycaster reticle inspection targets (`flora`, `fauna`, `structure`, `ground`) with compile-time type verification.
  - Enforced strict return types across domain services and callback interfaces.
- **Code Manifesto Expansion:**
  - Formally codified Rule 8 (*Modular Domain Separation & Thin Coordinators*) and Rule 9 (*Strict Type Safety & Zero Duck-Typing*) into `CODE_MANIFESTO.md`.

---

## [0.2.0] - 2026-10-07

### Added
- **Full First-Person Perspective:**
  - Transitioned camera from isometric to a complete 1st-person viewpoint at eye-level height ($y \approx 1.6$).
  - Integrated `PointerLockControls` enabling smooth mouse-look navigation upon screen click (with `ESC` release).
  - Central targeting crosshair reticle with contextual raycast detection up to 7.5 meters.
- **First-Person Viewmodel (Hands & Bio-Tools):**
  - Interactive right-hand porcelain explorer gauntlet attached directly to the camera viewport.
  - Distinct modular tool attachments for all 6 active tools (Glow fingertip nodes, Tricorder scanner display, Trowel seed reservoir, Solvent pressurized nozzle, Honey blossom lure wand, and miniature holographic blueprint projector).
  - Idle breathing sway, rhythmic walking bobbing, and action recoil animations.
- **Spatial Collision Detection & Sliding:**
  - Collision physics preventing walking through placed walls (`chitin_glass_wall`), closed doors (`iris_slit_door`), solid stations (`bio_forge_station`), and dense hazardous flora (`snap_trap`, `sap_weaver`).
  - Axis-independent collision resolution allowing smooth sliding along corridors and boundaries.
  - Proximity doors dynamically open to grant collision-free passage when authorized.

---

## [0.1.0] - 2026-10-07

### Added
- **Core 3D Engine & Isometric Perspective:**
  - Three.js WebGL renderer configured with custom PBR materials (porcelain-white synthetics, translucent chitin-glass, emissive bioluminescent nodes).
  - High-angle isometric camera with 360-degree rotation (`Q`/`E`), smooth zooming, and lerped player tracking.
  - Procedural spore particle simulation with additive bioluminescent motes.
  - Real-time Day/Night Sol-Cycle transitioning between warm daylight and radiant midnight bioluminescence.
- **Quad-Biome Open World:**
  - *Violet Cradle:* Deep violet soils, mycelial mushrooms, and gentle Soft-Puffs.
  - *Turquoise Glade:* Saturated cyan/teal moss and musical Bell-Blooms.
  - *Amber Thicket:* Golden resin pools, Petal-Mills, and burrowing wildlife.
  * *Prismatic Verge:* Neon mineral spires, Snap-Traps, and predatory Chitin-Stalkers.
- **Botanical Tool Suite (Hotkeys 1–6):**
  - `[1] Harvest Glove:` Gentle non-lethal extraction of saps, petals, fibers, and essences without destroying plants.
  - `[2] Bio-Scanner:` Real-time entity scanning logging genetic profiles and breeding notes into the Codex.
  - `[3] Planter Trowel:` Cultivates seeds in enriched mounds and administers additive fertilizers.
  - `[4] Solvent Sprayer:` Discharges enzymatic mist dissolving bio-structures with 100% seed-node recycling.
  - `[5] Taming Lure:` Delivers Sweet Nectar and Carapace bait to domesticate passive critters and apex guardians.
  - `[6] Bio-Builder:` Live holographic grid cursor for growing organic base tiles and walls.
- **Living Bio-Building System:**
  - Root-Tile Floors with woven-wood textures.
  - Chitin-Glass Walls filtering environmental light.
  - Iris-Slit Proximity Doors automatically dilating when players approach.
  - Lantern-Fern Lampposts casting point-light bioluminescence.
  - Spore-Canopy Ceilings filtering dust contaminants.
  - Tamed Snap-Trap Defense Sentries.
- **Additive Cultivation & Fertilizer System:**
  - Four distinct plant maturation stages (Sprout, Juvenile, Mature, Bloom).
  - *Growth Fertilizer* (Organic Compost + Bio-Pellets) accelerating crop growth by 250%–300%.
  - *Yield Fertilizer* (Animal Secretions + Resin Sap + Dew) doubling yields and triggering prismatic variants.
  - Elimination of soil depletion penalties.
- **Fauna Behavioral AI & Companionship:**
  - Docile *Soft-Puffs* hopping around and excreting *Bio-Pellets* when tamed.
  * Predatory *Chitin-Stalkers* patrolling base boundaries and shedding *Reinforced Carapace Scales*.
- **Bio-Forge Workstation [B]:**
  - Molecular synthesis interface with categorized recipes for Seeds, Fertilizers, Living Composites, and Defenses.
- **Storage Pouch [I] & Ecosystem Codex [C]:**
  - Grid inventory with category filters, stack counters, and quick-equip actions.
  - Comprehensive field codex tracking discovery mastery, ecological lore, and drop tables.
- **Browser-Native P2P Multiplayer [M]:**
  - Zero-server host session creation with 6-character room codes.
  - Real-time synchronization of player movement, building placement, solvent deconstruction, and flora harvesting.
  - Integrated in-room sector chat log.
- **Procedural Web Audio Engine:**
  - Ambient botanical synthesizer drone, non-lethal harvest shimmer, solvent enzyme spray hiss, placement snaps, and creature chirps.
- **Documentation:**
  - Created `CORE_MECHANICS.md` detailing player actions, loop diagrams, and core systems.
  - Created `MONETIZATION.md` proposing 5 fair-play, cosmetic, pass, and expansion revenue streams.
  - Created `CODE_MANIFESTO.md` enshrining the 7 mandatory architectural, functional, and performance coding rules.
  - Created `CHANGELOG.md` tracking development history.

---

## [Unreleased]
- Expansion of genetic trait cross-pollination.
- Automated irrigation conduits linking bio-canopies to cultivation mounds.
- Biome-specific seasonal weather events (Prismatic Auroras, Acid Rain Mists).
