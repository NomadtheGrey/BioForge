# BioForge — Code Manifesto & Engineering Guidelines

> **Status:** Mandatory Engineering Specification  
> **Last Updated:** October 7, 2026  
> **Scope:** All Code Generation, Features, Refactoring, and Architecture

This document defines the strict architectural, style, and performance rules governing all code contributions and refactors in the BioForge codebase. Every developer, agent, and reviewer must adhere strictly to these 7 tenets:

---

## 1. Guard Clauses, Fail-Fast Flow & Zero 'else' / 'else if'
* **STRICT RULE:** Avoid using `else` or `else if` blocks entirely across all code. Use guard clauses, early returns, and discrete, independent `if` checks to keep code completely flat at depth 0.
* **Prohibition:** Absolutely no `else` blocks, `else if` chains, deep nesting, or pyramidal control flow.
* **Pattern:**
  ```typescript
  // PREFERRED (Flat, early return, zero 'else' or 'else if'):
  function processAction(action: ActionType, isPaused: boolean) {
    if (isPaused) return;
    if (!action) return;

    if (action === 'harvest') {
      executeHarvest();
      return;
    }

    if (action === 'scan') {
      executeScan();
      return;
    }

    executeDefault();
  }

  // REJECTED (Forbidden use of else / else if):
  function processAction(action: ActionType, isPaused: boolean) {
    if (!isPaused) {
      if (action === 'harvest') {
        executeHarvest();
      } else if (action === 'scan') {
        executeScan();
      } else {
        executeDefault();
      }
    }
  }
  ```

---

## 2. Functional Style Over Imperative Loops
* **Rule:** Prefer declarative transformations using `.map()`, `.filter()`, `.reduce()`, `.find()`, `.some()`, and `.every()` instead of imperative `for`, `for...in`, or `while` index loops.
* **Pattern:**
  ```typescript
  // PREFERRED:
  const ripeFlora = floraList.filter((f) => f.harvestReady);
  const totalBioPellets = droppedItems
    .filter((item) => item.itemId === 'bio_pellet')
    .reduce((acc, item) => acc + item.count, 0);

  // REJECTED:
  let total = 0;
  for (let i = 0; i < droppedItems.length; i++) {
    if (droppedItems[i].itemId === 'bio_pellet') {
      total += droppedItems[i].count;
    }
  }
  ```

---

## 3. Memoization & Render-Loop Performance
* **Rule:** Cache and memoize expensive computations, spatial queries, noise generation, and procedural Three.js geometry allocations.
* **Prohibition:** Never instantiate geometries, materials, or allocate heavy objects inside the 60fps render/animation loop (`requestAnimationFrame`). Pre-allocate reusable scratch vectors (`THREE.Vector3`), matrices, and raycaster targets.
* **Pattern:**
  ```typescript
  // Scratch vector allocated once at module scope
  const SCRATCH_VEC3 = new THREE.Vector3();

  function updateEntityTransform(mesh: THREE.Object3D, x: number, z: number) {
    SCRATCH_VEC3.set(x, 0, z);
    mesh.position.copy(SCRATCH_VEC3);
  }
  ```

---

## 4. Single-Purpose & Decoupled Architecture
* **Rule:** Each function, class, and component must have exactly one clearly defined responsibility.
* **Decoupling Boundaries:**
  * **Pure Game State:** Kept as pristine serializable data objects (e.g. `FloraEntity`, `StructureEntity`, `PlayerState`).
  * **Render Layer:** Three.js scene graphs, shaders, and meshes only consume state snapshots; they never hold authoritative gameplay state.
  * **Networking Layer:** P2P WebRTC / BroadcastChannel protocols communicate independent of UI rendering.
* **Module Length:** Keep files concise and modularized across logical sub-domains.

---

## 5. Explicit Dependencies & Pure Ingestion
* **Rule:** Pass all dependencies, configurations, and state references explicitly as typed function arguments or hook props.
* **Prohibition:** Avoid hidden module-level mutable variables, ambient implicit globals, or unexpected side-effects across module boundaries.

---

## 6. Event-Driven Pub/Sub Communication
* **Rule:** Utilize a lightweight, strongly-typed pub/sub event bus to notify downstream subsystems (UI modals, Web Audio sound engine, particle FX, network sync) of in-game actions.
* **Benefit:** Decouples core gameplay logic from audio triggers, HUD toasts, and multiplayer broadcasting so features can be extended without touching existing handlers.
* **Pattern:**
  ```typescript
  // Dispatch event from core system:
  gameEvents.emit('flora:harvested', { flora, yields: [{ id: 'resin_sap', count: 3 }] });

  // Independent subscribers react cleanly:
  // - soundEngine plays harvest sound
  // - UI displays notification toast
  // - multiplayerManager broadcasts to peers
  ```

---

## 7. Memory Management & Strict Resource Disposal
* **Rule:** Always explicitly call `.dispose()` on Three.js geometries, materials, and textures when meshes, structures, or visual effects are removed or replaced.
* **Listeners & Timers:** Clean up all `addEventListener`, `requestAnimationFrame`, `setInterval`, and data channel subscriptions inside component unmount / teardown routines.
* **Pattern:**
  ```typescript
  function destroyStructureMesh(group: THREE.Group, scene: THREE.Scene) {
    scene.remove(group);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
  ```

---

## 8. Modular Domain Separation & Thin Coordinators
* **Rule:** Do not store all gameplay domain state inside a monolithic root component. Logically separate distinct domains into dedicated, testable hooks/modules (e.g., `useInventory`, `useWorldEntities`, `usePlayerState`, `useInteractions`).
* **Role of App.tsx:** The top-level `App.tsx` must remain a thin coordinator responsible solely for wiring decoupled subsystems, event subscriptions, and high-level layout composition.
* **Prohibition:** Do not bundle raw inventory math, creature AI update routines, and world entity seeding together in the view layer.

---

## 9. Strict Type Safety & Zero Duck-Typing
* **Rule:** All types, entity shapes, events, and parameters must be explicitly typed with zero ambiguity.
* **Prohibition:** Absolutely no `any`, unchecked `unknown`, loose duck-typing, or dynamic shape assumptions.
* **Requirements:**
  * Use **Discriminated Unions** for polymorphic targets (e.g., `InteractionTarget = { type: 'flora'; entity: FloraEntity } | { type: 'fauna'; entity: FaunaEntity } | ...`).
  * Ensure exhaustive type checks using `never` in switch statements where applicable.
  * Use strictly bounded key sets (e.g. `Record<ItemId, number>`) instead of generic string-indexed maps where domain keys are finite.
  * Define explicit return types for domain services, hooks, and event handlers.

---

## Verification & Compliance
All pull requests, agent tasks, and automated refactors must verify compliance against these 9 rules prior to merging.
