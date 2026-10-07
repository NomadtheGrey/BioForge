# BioForge 🌿🔬

> A 3D first-person web-based sandbox for alien ecosystem survival, non-lethal botanical cultivation, and living base building.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

---

## 🌌 Overview

**BioForge** is an atmospheric first-person WebGL survival and exploration game set on an uncharted bioluminescent world. Rather than stripping the planet for industrial gain, players use non-lethal bio-tools to harvest resins, cultivate living seeds, domesticate alien fauna, and weave bio-composite architectures.

Built with a modern web stack utilizing **Three.js**, **React**, and **TypeScript**, BioForge features a fully decoupled, domain-driven simulation architecture optimized for smooth 60 FPS performance directly in the browser.

---

## ✨ Core Features

* **1st-Person Perspective & Viewmodel Controls:** Full 3D camera controls with pointer lock immersion, fluid movement physics, and real-time tool dynamics.
* **Non-Lethal Botanical Cultivation:** Extract resins, fibers, and essences without destroying host plant life. Plant seeds in cultivation mounds and apply specialized growth/yield fertilizers.
* **Fauna Domestication & Ecosystem Simulation:** Lure and tame native wildlife (such as Soft-Puffs and Chitin-Stalkers) to patrol your base perimeter and harvest secondary byproducts.
* **Living Bio-Architecture:** Grow interlocking root floors, chitin-glass translucent walls, and proximity-activated iris doors.
* **Browser-Native P2P Co-Op:** Real-time multiplayer synchronization via BroadcastChannel/WebRTC channels with zero external server requirements.
* **Built-in Developer Source Exporter:** Integrated overlay tool allowing developers to scan workspace files, filter by extension, and stitch codebase snapshots into structured Markdown for code reviews.

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
