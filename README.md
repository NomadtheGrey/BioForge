# BioForge 🌿🔬

> A first-person browser game about exploring a living, seeded world, befriending its creatures, and growing — rather than building — your tools, gear, and home. *(The game's canonical description lives in ReadMeFiles/GAME_DESCRIPTION.md; this README draws from it.)*

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

---

## 🌌 Overview

**BioForge** is a free first-person exploration and crafting game that plays in your browser. Every world grows from a seed: strange country, living creatures, ancient ruins, and a sky with its own turning. Nothing here is manufactured — you *grow* your equipment (tools, weapons, shields, living gear, tunnels, walls, and home itself) at the Bio-Forge, learn which creatures can be trusted, plant species back by seed, spore, or cutting, and follow the mystery of the vanished Precursors toward the Departure. Choose how dangerous the world should be: **Peaceful**, **Normal** (the wild country has teeth outside your starting refuge), or **Hostile** (explorers can harm one another too).

Built with a modern web stack utilizing **Three.js**, **React**, and **TypeScript**, BioForge features a fully decoupled, domain-driven simulation architecture optimized for smooth 60 FPS performance directly in the browser.

---

## ✨ Core Features

* **1st-Person Perspective & Viewmodel Controls:** Full 3D camera controls with pointer lock immersion, fluid movement physics, and real-time tool dynamics.
* **Grown, Not Built:** Equipment, structures, weapons, and creatures come from living cultivation at the Bio-Forge and the Culture Vat — not factories or machines. A gauntlet for doing, a helmet for knowing, Quicksteps for going, a shield for warding.
* **Botanical Cultivation & Propagation:** Extract resins, fibers, and essences; plant species back by seed, spore, cutting, or piece according to their own nature, and apply specialized growth/yield fertilizers.
* **Creatures With Lives:** Befriend, follow, protect, hunt, or regrow native wildlife; individuals matter, death is permanent unless a living sample was saved for the Culture Vat.
* **Three Ways to Live:** Peaceful, Normal, and Hostile — with the starting zone kept as a refuge in every world.
* **Living Bio-Architecture:** Grow interlocking root floors, chitin-glass translucent walls, and proximity-activated iris doors.
* **Family Co-Op:** Real-time multiplayer through a host-authoritative relay — join the host's world from another device by room code or invite; the host's world and difficulty govern all.
* **Cloud Saves Without an Account:** Optional and off until chosen; your world follows you between devices behind three secret words only you hold.
* **The Precursor Mystery:** Explore grown ruins, recover what was left behind across eleven fates, and prepare for the Departure.

---

## 🕹️ Controls & Field Manual

| Action | Control |
| :--- | :--- |
| **Movement** | `W` `A` `S` `D` / Arrow Keys |
| **Look / Aim** | Mouse (Click screen to lock, `ESC` to unlock) |
| **Interact / Tool Action** | Left Mouse Click |
| **Harvest Glove** | `1` |
| **Bio-Scanner** | `2` |
| **Planter Trowel** | `3` |
| **Solvent Sprayer** | `4` |
| **Taming Lure** | `5` |
| **Bio-Builder** | `6` |
| **Bio-Forge Crafting** | `B` |
| **Storage Pouch** | `I` |
| **Ecosystem Codex** | `C` |
| **P2P Multiplayer** | `M` |

---

## 🛠️ Tech Stack & Coding Architecture

BioForge is engineered following strict architectural guidelines focused on zero-friction modularity and functional maintainability:

* **Engine & Render Loop:** Three.js with custom WebGL shader effects, lighting pipelines, and pre-allocated vector math.
* **UI & Modals:** React with Tailwind CSS and Lucide React icons.
* **Domain Hooks:** Fully decoupled React state hooks (`useInventory`, `useWorldEntities`, `usePlayerState`, `useToolInteractions`).
* **Code Manifesto Standard:** Enforces guard clauses, early returns, functional transformations (`.map`, `.filter`, `.reduce`), and zero `else`/`else if` conditional branching for clean execution paths.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/bioforge.git](https://github.com/YOUR_USERNAME/bioforge.git)
   cd bioforge
